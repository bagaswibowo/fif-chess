/**
 * app/api/challenge/[id]/respond/route.ts
 * POST /api/challenge/[id]/respond { action: 'accept' | 'decline' } (S1-T4).
 *
 * accept → UPDATE status 'accepted' + INSERT row Game + publish GameStarted
 *          ke topik game (yang sama di-subscribe dua pemain) + GameRemoved
 *          clear ke matcher kedua pihak.
 * decline → UPDATE status 'declined' + publish challenge_resolved (accepted=false)
 *           ke matcher pengirim.
 *
 * Atomic guard: UPDATE ... WHERE status='pending' RETURNING — dua respond
 * paralel (accept+decline) hanya satu yang menang (status sudah berubah).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser, loadUsers } from "@/lib/auth-store";
import { publishBusEvent } from "@/lib/realtime/bus.ts";
import {
  gameTopic,
  matcherTopic,
  type ChallengeResolved,
  type GameStarted,
} from "@/lib/realtime/events.ts";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  let userId: string | null = null;
  let username = "";
  try {
    const users = await loadUsers();
    const me = currentUser(request, users);
    if (me) {
      userId = me.id;
      username = me.username;
    }
  } catch {
    userId = null;
  }
  if (!userId) {
    return NextResponse.json({ error: "Authentication required. Login first.", retryable: false }, { status: 401 });
  }
  const { id: challengeId } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const action = body.action === "accept" ? "accept" : body.action === "decline" ? "decline" : "";
  if (!action) {
    return NextResponse.json({ error: "action harus 'accept' atau 'decline'.", retryable: false }, { status: 400 });
  }

  const meRow = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [username]);
  if (meRow.length === 0) {
    return NextResponse.json({ error: "User tidak ditemukan di DB.", retryable: false }, { status: 404 });
  }
  const myPgId = String((meRow[0] as { id: string }).id);

  if (action === "decline") {
    const rows = await query(
      `UPDATE challenges SET status = 'declined', decided_at = NOW()
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING from_user_id, to_user_id, time_control, rated`,
      [challengeId, myPgId],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Challenge tidak ditemukan / bukan untuk Anda / sudah diputuskan.", retryable: false }, { status: 404 });
    }
    const fromPg = String((rows[0] as { from_user_id: string }).from_user_id);
    await notifyUsers(fromPg, myPgId, (fromStore, toStore) => {
      const ev: ChallengeResolved = { type: "challenge_resolved", challengeId, accepted: false };
      publishBusEvent(matcherTopic(fromStore), ev);
    });
    return NextResponse.json({ ok: true, status: "declined" });
  }

  // accept — atomic claim (status pending → accepted), lalu buat Game.
  const claimed = await query(
    `UPDATE challenges SET status = 'accepted', decided_at = NOW()
     WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
     RETURNING from_user_id, to_user_id, time_control, rated`,
    [challengeId, myPgId],
  );
  if (claimed.length === 0) {
    return NextResponse.json({ error: "Challenge tidak ditemukan / bukan untuk Anda / sudah diputuskan.", retryable: false }, { status: 404 });
  }
  const ch = claimed[0] as { from_user_id: string; to_user_id: string; time_control: string; rated: boolean };
  const fromPg = String(ch.from_user_id);
  const toPg = String(ch.to_user_id);
  if (fromPg === toPg) {
    return NextResponse.json({ error: "Challenge tidak valid.", retryable: false }, { status: 400 });
  }

  const gameId = crypto.randomUUID();
  const whitePg = Math.random() < 0.5 ? fromPg : toPg;
  const blackPg = whitePg === fromPg ? toPg : fromPg;
  await query(
    `INSERT INTO games (id, white_user_id, black_user_id, status, result, started_at, created_at)
     VALUES ($1, $2, $3, 'active', '*', NOW(), NOW())`,
    [gameId, whitePg, blackPg],
  );
  await query(`UPDATE challenges SET game_id = $1 WHERE id = $2`, [gameId, challengeId]);

  await notifyUsers(fromPg, toPg, (fromStore, toStore) => {
    const whiteStore = whitePg === fromPg ? fromStore : toStore;
    const blackStore = whiteStore === fromStore ? toStore : fromStore;
    const started: GameStarted = { type: "game_started", gameId, white: whiteStore, black: blackStore };
    publishBusEvent(gameTopic(gameId), started);
    // Clear challenge outstanding di matcher kedua pihak.
    const ev: ChallengeResolved = { type: "challenge_resolved", challengeId, accepted: true };
    publishBusEvent(matcherTopic(fromStore), ev);
    publishBusEvent(matcherTopic(toStore), ev);
  });

  return NextResponse.json({ ok: true, status: "accepted", gameId }, { status: 201 });
}

/** Petakan dua pg uuid → store id (join key username — docs/db/sprint1.md §Migration). */
async function notifyUsers(
  pgA: string,
  pgB: string,
  emit: (storeA: string, storeB: string) => void,
): Promise<void> {
  const rows = await query(`SELECT id, username FROM users WHERE id = ANY($1::uuid[])`, [[pgA, pgB]]);
  const users = await loadUsers();
  const storeIdFor = (pgId: string): string | null => {
    const row = rows.find((r) => String((r as { id: string }).id) === pgId);
    if (!row) return null;
    const uname = String((row as { username: string }).username);
    return users.find((u) => u.username === uname)?.id ?? null;
  };
  const a = storeIdFor(pgA);
  const b = storeIdFor(pgB);
  if (a && b) emit(a, b);
}
