/**
 * app/api/challenge/route.ts
 * Challenge API (ticket S1-T4, model Challenge di docs/db/sprint1.md §2 — persist Postgres).
 *
 * POST /api/challenge { toUserId, timeControl, rated? }
 *   → INSERT row Challenge (status 'pending') + publish ChallengeReceived ke matcher/<target>.
 * POST /api/challenge/[id]/respond { action: 'accept' | 'decline' } (route terpisah).
 * DELETE /api/challenge?id=<id> → cancel challenge milik pengirim (status 'cancelled').
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser, loadUsers } from "@/lib/auth-store";
import { publishBusEvent } from "@/lib/realtime/bus.ts";
import { matcherTopic, type ChallengeReceived, type RematchRequested } from "@/lib/realtime/events.ts";
import { isValidTimeControl } from "@/lib/time-control";

export const runtime = "nodejs";

async function currentUserId(request: Request): Promise<{ id: string; username: string } | null> {
  try {
    const users = await loadUsers();
    const me = currentUser(request, users);
    return me ? { id: me.id, username: me.username } : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const me = await currentUserId(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required. Login first.", retryable: false }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const toUserId = typeof body.toUserId === "string" ? body.toUserId.trim() : "";
  const timeControl = typeof body.timeControl === "string" ? body.timeControl.trim() : "";
  const rated = body.rated === true;
  // S6-T3 (ADR-009 D3.2): opt-in konteks rematch — bila ada, publish
  // RematchRequested di atas ChallengeReceived (route ini satu-satunya
  // tempat event rematch dipublish; lib/rematch.ts hanya memanggil route
  // ini dengan flag tsb). Challenge biasa tanpa flag tidak berubah.
  const rematchFromGameId = typeof body.rematchFrom === "string" && body.rematchFrom.trim() ? body.rematchFrom.trim() : null;
  if (!toUserId || !isValidTimeControl(timeControl)) {
    // S6-T2 (ADR-009 D2.2): format tunggal "<menit>+<inkremen>" (1..999 menit,
    // 1..999 detik). Kategori (bullet/blitz/rapid) TIDAK dikirim client —
    // diturunkan server-side dari menit (aturan api/leaderboard).
    return NextResponse.json({ error: "toUserId dan timeControl ('<menit>+<inkremen>', mis. '1+0' atau '999+999') wajib.", retryable: false }, { status: 400 });
  }

  // Target: store id (auth) — petakan ke pg uuid via username (join key, docs/db/sprint1.md §Migration).
  const users = await loadUsers();
  const target = users.find((u) => u.id === toUserId);
  if (!target) {
    return NextResponse.json({ error: "User target tidak ditemukan.", retryable: false }, { status: 404 });
  }
  if (target.id === me.id) {
    return NextResponse.json({ error: "Tidak bisa challenge diri sendiri.", retryable: false }, { status: 400 });
  }
  const targetRows = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [target.username]);
  if (targetRows.length === 0) {
    return NextResponse.json({ error: "User target tidak ditemukan di DB.", retryable: false }, { status: 404 });
  }
  const meRows = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [me.username]);
  if (meRows.length === 0) {
    return NextResponse.json({ error: "User pengirim tidak ditemukan di DB.", retryable: false }, { status: 404 });
  }

  const challengeId = crypto.randomUUID();
  await query(
    `INSERT INTO challenges (id, from_user_id, to_user_id, time_control, rated, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
    [challengeId, String((meRows[0] as { id: string }).id), String((targetRows[0] as { id: string }).id), timeControl, rated],
  );

  const ev: ChallengeReceived = { type: "challenge_received", challengeId, fromUserId: me.id, fromUsername: me.username };
  publishBusEvent(matcherTopic(target.id), ev);
  // S6-T3 (D3.2): konteks "rematch dari partai X" — di atas ChallengeReceived.
  if (rematchFromGameId) {
    const rematch: RematchRequested = {
      type: "rematch_requested",
      gameId: rematchFromGameId,
      challengeId,
      fromUser: me.username,
    };
    publishBusEvent(matcherTopic(target.id), rematch);
  }

  return NextResponse.json({ ok: true, challengeId }, { status: 201 });
}

/** Cancel challenge milik pengirim (outstanding) — status 'cancelled' + publish. */
export async function DELETE(request: Request) {
  const me = await currentUserId(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required. Login first.", retryable: false }, { status: 401 });
  }
  const challengeId = new URL(request.url).searchParams.get("id") ?? "";
  if (!challengeId) {
    return NextResponse.json({ error: "Query param id wajib.", retryable: false }, { status: 400 });
  }
  const meRow = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [me.username]);
  if (meRow.length === 0) {
    return NextResponse.json({ error: "User tidak ditemukan di DB.", retryable: false }, { status: 404 });
  }
  const rows = await query(
    `UPDATE challenges SET status = 'cancelled', decided_at = NOW()
     WHERE id = $1 AND from_user_id = $2 AND status = 'pending'
     RETURNING to_user_id`,
    [challengeId, String((meRow[0] as { id: string }).id)],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Challenge tidak ditemukan / bukan milik Anda / sudah diputuskan.", retryable: false }, { status: 404 });
  }
  // Petakan pg uuid target → store id untuk topik realtime.
  const toPg = String((rows[0] as { to_user_id: string }).to_user_id);
  const tRow = await query(`SELECT username FROM users WHERE id = $1`, [toPg]);
  const target = tRow.length > 0 ? (await loadUsers()).find((u) => u.username === String((tRow[0] as { username: string }).username)) : undefined;
  if (target) {
    publishBusEvent(matcherTopic(target.id), { type: "game_removed", gameId: challengeId });
  }
  return NextResponse.json({ ok: true });
}
