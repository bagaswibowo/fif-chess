/**
 * app/api/friends/route.ts (ticket S4-T3)
 * GET    /api/friends  → { friends: [...], incoming: [...] } (presence dari Redis jev:online)
 * POST   /api/friends  { username } → kirim friend request (pending, idempoten)
 * DELETE /api/friends?id=<uuid> → unfriend (hapus dua arah, pending juga)
 *
 * Tabel friends (docs/db/sprint4.md): row pengirim→penerima status pending;
 * accept meng-UPDATE kedua arah jadi 'accepted'.
 */
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { currentPgUser } from "@/lib/puzzle-api";
import { playingRedis } from "@/lib/realtime/playing-count.ts";

export const runtime = "nodejs";

type FriendRow = {
  user_id: string;
  friend_user_id: string;
  username: string;
  rating: number;
  created_at: string;
};

export async function GET(request: Request) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }

  // Teman: dua arah accepted (row bisa dibuat satu arah saat request; list join kedua arah).
  const friends = await query<FriendRow>(
    `SELECT f.user_id, f.friend_user_id, u.username, u.rating, f.created_at
     FROM friends f
     JOIN users u ON u.id = CASE WHEN f.user_id = $1::uuid THEN f.friend_user_id ELSE f.user_id END
     WHERE (f.user_id = $1::uuid OR f.friend_user_id = $1::uuid) AND f.status = 'accepted'
     ORDER BY u.username`,
    [me.pgId],
  );

  // Permintaan masuk: row pending di arah pengirim→saya.
  const incoming = await query<FriendRow>(
    `SELECT f.user_id, f.friend_user_id, u.username, u.rating, f.created_at
     FROM friends f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_user_id = $1::uuid AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [me.pgId],
  );

  // Permintaan keluar (untuk UI pending state).
  const outgoing = await query<FriendRow>(
    `SELECT f.user_id, f.friend_user_id, u.username, u.rating, f.created_at
     FROM friends f
     JOIN users u ON u.id = f.friend_user_id
     WHERE f.user_id = $1::uuid AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [me.pgId],
  );

  const shape = (r: FriendRow) => ({
    username: r.username,
    rating: Number(r.rating),
    since: r.created_at,
  });

  // Presence dari Redis set jev:online (S1-T3) — degrade ke offline bila Redis gagal.
  let onlineIds: string[] = [];
  try {
    if (friends.length > 0) {
      onlineIds = (await playingRedis().smismember(
        "jev:online",
        friends.map((f) => (f.user_id === me.pgId ? f.friend_user_id : f.user_id)),
      )) as unknown as string[];
    }
  } catch (err) {
    console.error("[friends] presence baca gagal:", err);
  }

  return NextResponse.json({
    friends: friends.map((f, i) => ({
      ...shape(f),
      online: onlineIds[i] === "1",
    })),
    incoming: incoming.map(shape),
    outgoing: outgoing.map(shape),
  });
}

export async function POST(request: Request) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    return NextResponse.json({ error: "username wajib diisi.", retryable: false }, { status: 400 });
  }
  if (username === me.username) {
    return NextResponse.json({ error: "Tidak bisa menambahkan diri sendiri.", retryable: false }, { status: 400 });
  }

  const target = await query<{ id: string }>("SELECT id FROM users WHERE username = $1 LIMIT 1", [username]);
  if (target.length === 0) {
    return NextResponse.json({ error: "User tidak ditemukan.", retryable: false }, { status: 404 });
  }
  const friendId = String(target[0].id);

  // Idempoten: duplikat request dibiarkan (ON CONFLICT DO NOTHING); bila sudah
  // accepted dua arah, jangan buat row pending arah balik.
  const existing = await query<{ status: string }>(
    `SELECT status FROM friends
     WHERE (user_id = $1::uuid AND friend_user_id = $2::uuid)
        OR (user_id = $2::uuid AND friend_user_id = $1::uuid)
     LIMIT 1`,
    [me.pgId, friendId],
  );
  if (existing.length > 0 && existing[0].status === "accepted") {
    return NextResponse.json({ error: "Sudah berteman.", retryable: false }, { status: 409 });
  }

  await query(
    `INSERT INTO friends (user_id, friend_user_id, status)
     VALUES ($1::uuid, $2::uuid, 'pending')
     ON CONFLICT (user_id, friend_user_id) DO NOTHING`,
    [me.pgId, friendId],
  );

  return NextResponse.json({ ok: true, status: existing.length > 0 ? existing[0].status : "pending" }, { status: 201 });
}

export async function DELETE(request: Request) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id tidak valid.", retryable: false }, { status: 400 });
  }

  // Resolusi id row → username lawan (row bisa dua arah), lalu hapus dua arah.
  const removed = await transaction(async (client) => {
    const rows = await client.query(
      `SELECT user_id, friend_user_id FROM friends WHERE id = $1::uuid LIMIT 1`,
      [id],
    );
    if (rows.rowCount === 0) return null;
    const row = rows.rows[0] as { user_id: string; friend_user_id: string };
    if (row.user_id !== me.pgId && row.friend_user_id !== me.pgId) return "forbidden" as const;
    await client.query(
      `DELETE FROM friends
       WHERE (user_id = $1::uuid AND friend_user_id = $2::uuid)
          OR (user_id = $2::uuid AND friend_user_id = $1::uuid)`,
      [row.user_id, row.friend_user_id],
    );
    const other = row.user_id === me.pgId ? row.friend_user_id : row.user_id;
    return { otherId: other } as const;
  });

  if (removed === null) {
    return NextResponse.json({ error: "Relasi tidak ditemukan.", retryable: false }, { status: 404 });
  }
  if (removed === "forbidden") {
    return NextResponse.json({ error: "Bukan relasi Anda.", retryable: false }, { status: 403 });
  }

  let username: string | null = null;
  const u = await query<{ username: string }>("SELECT username FROM users WHERE id = $1::uuid", [removed.otherId]);
  if (u.length > 0) username = String(u[0].username);
  return NextResponse.json({ ok: true, removed: username });
}
