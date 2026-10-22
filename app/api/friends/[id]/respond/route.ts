/**
 * app/api/friends/[id]/respond/route.ts (ticket S4-T3)
 * POST /api/friends/[id]/respond { action: "accept" | "decline" }
 * id = uuid row request pending (pengirim→saya). Hanya penerima boleh respond.
 * accept: UPDATE atomic WHERE status='pending' + insert row arah balik 'accepted'.
 */
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { currentPgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id tidak valid.", retryable: false }, { status: 400 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const action = body.action === "accept" ? "accept" : body.action === "decline" ? "decline" : null;
  if (!action) {
    return NextResponse.json({ error: "action harus accept|decline.", retryable: false }, { status: 400 });
  }

  const result = await transaction(async (client) => {
    // Kunci row request: harus pending DAN saya penerimanya.
    const req = await client.query(
      `SELECT user_id FROM friends
       WHERE id = $1::uuid AND friend_user_id = $2::uuid AND status = 'pending'
       FOR UPDATE`,
      [id, me.pgId],
    );
    if (req.rowCount === 0) return "not_found" as const;
    const senderId = String((req.rows[0] as { user_id: string }).user_id);

    if (action === "decline") {
      await client.query(`DELETE FROM friends WHERE id = $1::uuid`, [id]);
      return { senderId } as const;
    }

    // accept: atomic UPDATE row request + row arah balik jadi accepted (idempoten).
    const upd = await client.query(
      `UPDATE friends SET status = 'accepted', updated_at = NOW()
       WHERE id = $1::uuid AND status = 'pending'`,
      [id],
    );
    if (upd.rowCount === 0) return "not_found" as const;
    await client.query(
      `INSERT INTO friends (user_id, friend_user_id, status)
       VALUES ($1::uuid, $2::uuid, 'accepted')
       ON CONFLICT (user_id, friend_user_id) DO UPDATE SET status = 'accepted', updated_at = NOW()`,
      [senderId, me.pgId],
    );
    return { senderId } as const;
  });

  if (result === "not_found") {
    return NextResponse.json({ error: "Permintaan tidak ditemukan atau sudah direspons.", retryable: false }, { status: 404 });
  }

  let username: string | null = null;
  const u = await query<{ username: string }>("SELECT username FROM users WHERE id = $1::uuid", [result.senderId]);
  if (u.length > 0) username = String(u[0].username);

  return NextResponse.json({ ok: true, action, username });
}
