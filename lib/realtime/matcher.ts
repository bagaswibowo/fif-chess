/**
 * lib/realtime/matcher.ts
 * Matcher loop (ticket S1-T2): dipicu tiap publish seek (bukan cron).
 * Match → buat row Game (pola db-create api/pvp) → publish GameAdded ke topik
 * matcher/<userId> kedua pemain → GameStarted ke topik game.
 * Fire-and-forget (ADR-002 #4): error hanya di-log, tidak menggagalkan HTTP.
 */
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { publishBusEvent } from "./bus.ts";
import { matcherTopic, gameTopic, type GameAdded, type GameStarted } from "./events.ts";
import { tryMatch, removeUserSeek, type SeekTicket } from "./seek-pool.ts";
import { setPlaying } from "./playing-count.ts";

const matcherState = new Set<string>(); // seekId sedang diproses — idempotensi

export function onSeekCreated(seek: SeekTicket): void {
  if (matcherState.has(seek.seekId)) return;
  matcherState.add(seek.seekId);
  void runMatch(seek)
    .catch((err: unknown) => console.error("[matcher] match gagal:", err))
    .finally(() => matcherState.delete(seek.seekId));
}

async function runMatch(seek: SeekTicket): Promise<void> {
  const pair = await tryMatch(seek);
  if (!pair) return; // belum ada lawan — seek tetap di pool
  const { a, b } = pair;
  const gameId = randomUUID();
  // Store id (auth) untuk topik realtime; Postgres uuid (FK games) untuk row.
  const whiteId = Math.random() < 0.5 ? a.userId : b.userId;
  const blackId = whiteId === a.userId ? b.userId : a.userId;
  const whitePg = (whiteId === a.userId ? a : b).pgUserId;
  const blackPg = (whiteId === a.userId ? b : a).pgUserId;
  const whiteSeek = whiteId === a.userId ? a : b;
  const blackSeek = whiteId === a.userId ? b : a;

  // Pola db-create api/pvp/route.ts (handleCreate). S2-T2: game_type 'live' +
  // time_control snapshot dari seek ticket (kedua seek dijamin tc sama oleh pool).
  await query(
    `INSERT INTO games (id, white_user_id, black_user_id, status, result, started_at, created_at, time_control, game_type)
     VALUES ($1, $2, $3, 'active', '*', NOW(), NOW(), $4, 'live')`,
    [gameId, whitePg, blackPg, (whiteSeek.tc ?? blackSeek.tc ?? "10+0").slice(0, 10)],
  );

  // Badge "Bermain N" (ticket S1-T3) — dua pemain masuk game.
  await setPlaying(a.userId, true).catch(() => {});
  await setPlaying(b.userId, true).catch(() => {});

  const gameAdded: GameAdded = { type: "game_added", gameId, white: whiteId, black: blackId };
  publishBusEvent(matcherTopic(a.userId), gameAdded);
  publishBusEvent(matcherTopic(b.userId), gameAdded);

  const gameStarted: GameStarted = { type: "game_started", gameId, white: whiteId, black: blackId };
  publishBusEvent(gameTopic(gameId), gameStarted);
}

/** Cancel seek: hapus ticket + publish GameRemoved ke topik matcher pemilik. */
export async function cancelSeek(seekId: string, userId: string): Promise<boolean> {
  const removed = await removeUserSeek(userId);
  if (!removed) return false;
  publishBusEvent(matcherTopic(userId), { type: "game_removed", gameId: removed });
  return true;
}
