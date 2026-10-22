/**
 * lib/realtime/playing-count.ts
 * Ticket S1-T3: hitung user dalam game + broadcast realtime.
 * Sumber: Redis SET `jev:playing` (userId). Di-update saat GameAdded (matcher),
 * PresenceChanged/PlayingCountChanged di-publish ke topik `presence` (global).
 */
import Redis from "ioredis";
import { publishBusEvent } from "./bus.ts";
import { type PlayingCountChanged } from "./events.ts";

export const PLAYING_KEY = "jev:playing";

function redisUrl(): string {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

let redis: Redis | null = null;
export function playingRedis(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl(), { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  }
  return redis;
}

/** Tandai userId masuk/keluar game; publish count baru kalau berubah. */
export async function setPlaying(userId: string, playing: boolean): Promise<void> {
  const r = playingRedis();
  const before = await r.scard(PLAYING_KEY);
  if (playing) await r.sadd(PLAYING_KEY, userId);
  else await r.srem(PLAYING_KEY, userId);
  const after = await r.scard(PLAYING_KEY);
  if (before !== after) publishCount(after);
}

export function publishCount(count: number): void {
  const ev: PlayingCountChanged = { type: "playing_count_changed", count };
  publishBusEvent("presence", ev);
}
