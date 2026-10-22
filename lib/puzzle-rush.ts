/**
 * lib/puzzle-rush.ts (S3-T3, G9)
 * State sesi rush di Redis (jev-redis) TTL 15 menit — tidak ada tabel sesi
 * persisten (guardrail YAGNI). Strike & skor dihitung server-side.
 */
import Redis from "ioredis";

const TTL_SEC = 15 * 60;

function redisUrl(): string {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl(), { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  }
  return redis;
}

export type RushMode = "3min" | "5min" | "endless";

export type RushSession = {
  userId: string;
  mode: RushMode;
  rating: number; // rating puzzle adaptif (mulai 1000, +75 benar / -50 salah)
  strikes: number;
  score: number;
  startedAt: number;
  puzzleIds: string[];
};

const key = (sessionId: string) => `rush:session:${sessionId}`;

export async function createSession(userId: string, mode: RushMode): Promise<string> {
  const sessionId = crypto.randomUUID();
  const s: RushSession = {
    userId, mode, rating: 1000, strikes: 0, score: 0,
    startedAt: Date.now(), puzzleIds: [],
  };
  await getRedis().set(key(sessionId), JSON.stringify(s), "EX", TTL_SEC);
  return sessionId;
}

export async function getSession(sessionId: string): Promise<RushSession | null> {
  const raw = await getRedis().get(key(sessionId));
  return raw ? (JSON.parse(raw) as RushSession) : null;
}

export async function saveSession(sessionId: string, s: RushSession): Promise<void> {
  await getRedis().set(key(sessionId), JSON.stringify(s), "EX", TTL_SEC);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getRedis().del(key(sessionId));
}

export function isExpired(s: RushSession): boolean {
  if (s.mode === "endless") return false;
  const limit = s.mode === "3min" ? 3 * 60 : 5 * 60;
  return (Date.now() - s.startedAt) / 1000 >= limit;
}

export function timeLeftSec(s: RushSession): number | null {
  if (s.mode === "endless") return null;
  const limit = s.mode === "3min" ? 3 * 60 : 5 * 60;
  return Math.max(0, limit - Math.floor((Date.now() - s.startedAt) / 1000));
}
