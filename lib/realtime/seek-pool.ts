/**
 * lib/realtime/seek-pool.ts
 * Seek pool (ticket S1-T2): Redis-only, tanpa model DB (docs/db/sprint1.md §1).
 *
 * Struktur (konvensi docs/db/sprint1.md):
 * - ZSET `seek:pool:{tc}:{mode}`  score = rating, member = seekId
 * - HASH `seek:{seekId}`          (userId, rating, tc, mode, createdAt), TTL singkat
 *
 * Matching atomic via Lua: ambil kandidat rating-window terdekat (ZPOPMIN loop)
 * lalu ZREM/HDEL pemiliknya — seek yang sudah match tidak bisa match lagi.
 */
import Redis from "ioredis";

export type SeekTicket = {
  seekId: string;
  userId: string;
  /** Id user di Postgres (FK games) — auth-store pakai store id berbeda. */
  pgUserId: string;
  rating: number;
  tc: string; // time control, mis. "10+0" (format use-chess-clock)
  mode: "casual" | "rated";
  createdAt: number;
};

const SEEK_TTL_S = 300; // seek hidup maks 5 menit
const WINDOW_START = 200; // window rating awal (±200 → melebar)
const WINDOW_MAX = 800;

function redisUrl(): string {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

let redis: Redis | null = null;
export function seekRedis(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl(), { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  }
  return redis;
}

const poolKey = (tc: string, mode: string) => `seek:pool:${tc}:${mode}`;
const hashKey = (seekId: string) => `seek:${seekId}`;

/** Atomic pop satu seek terdekat dalam window rating, menghapus dari pool. Lua agar atomic. */
const MATCH_LUA = `
local pool = KEYS[1]
local rating = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local selfId = ARGV[3]
local cands = redis.call('ZRANGE', pool, rating - window, rating + window, 'BYSCORE')
for i, sid in ipairs(cands) do
  if sid ~= selfId then
    local h = redis.call('HGETALL', 'seek:' .. sid)
    local map = {}
    for j = 1, #h, 2 do map[h[j]] = h[j + 1] end
    if map.userId and map.rating then
      redis.call('ZREM', pool, sid)
      redis.call('DEL', 'seek:' .. sid)
      return { sid, map.userId, map.rating, map.tc, map.mode, map.createdAt, map.pgUserId or map.userId }
    else
      redis.call('ZREM', pool, sid) -- seek zombie (hash expired): buang
    end
  end
end
return nil
`;

export async function addSeek(t: Omit<SeekTicket, "seekId"> & { seekId: string }): Promise<void> {
  const r = seekRedis();
  const key = hashKey(t.seekId);
  await r
    .multi()
    .hset(key, {
      userId: t.userId,
      pgUserId: t.pgUserId,
      rating: String(t.rating),
      tc: t.tc,
      mode: t.mode,
      createdAt: String(t.createdAt),
    })
    .expire(key, SEEK_TTL_S)
    .zadd(poolKey(t.tc, t.mode), String(t.rating), t.seekId)
    .exec();
}

/** Hapus seek milik userId (cancel / re-seek). Return seekId yang dihapus atau null. */
export async function removeUserSeek(userId: string): Promise<string | null> {
  const r = seekRedis();
  // Cari seek user di semua pool (tc x mode) — jumlah kombinasi kecil, aman scan langsung.
  for (const key of await r.keys("seek:pool:*")) {
    const members = await r.zrange(key, "0", "-1");
    for (const sid of members) {
      const owner = await r.hget(hashKey(sid), "userId");
      if (owner === userId) {
        await r.zrem(key, sid);
        await r.del(hashKey(sid));
        return sid;
      }
    }
  }
  return null;
}

export async function getUserSeek(userId: string): Promise<SeekTicket | null> {
  const r = seekRedis();
  for (const key of await r.keys("seek:pool:*")) {
    for (const sid of await r.zrange(key, "0", "-1")) {
      const h = await r.hgetall(hashKey(sid));
      if (h.userId === userId) {
        return {
          seekId: sid,
          userId,
          pgUserId: h.pgUserId || userId,
          rating: Number(h.rating),
          tc: h.tc,
          mode: h.mode === "rated" ? "rated" : "casual",
          createdAt: Number(h.createdAt),
        };
      }
    }
  }
  return null;
}

export type MatchPair = { a: SeekTicket; b: SeekTicket };

/** Coba match seekId dengan seek lain dalam window rating (atomic di Redis). */
export async function tryMatch(seek: SeekTicket): Promise<MatchPair | null> {
  const r = seekRedis();
  const now = Date.now();
  for (let window = WINDOW_START; window <= WINDOW_MAX; window *= 2) {
    const res = (await r.eval(
      MATCH_LUA,
      1,
      poolKey(seek.tc, seek.mode),
      String(seek.rating),
      String(window),
      seek.seekId,
    )) as [string, string, string, string, string, string, string] | null;
    if (res) {
      // Hapus seek pemanggil dari pool (match terbentuk).
      await r.zrem(poolKey(seek.tc, seek.mode), seek.seekId);
      await r.del(hashKey(seek.seekId));
      return {
        a: seek,
        b: {
          seekId: res[0],
          userId: res[1],
          pgUserId: res[6] ?? res[1],
          rating: Number(res[2]),
          tc: res[3],
          mode: res[4] === "rated" ? "rated" : "casual",
          createdAt: Number(res[5]) || now,
        },
      };
    }
    if (window >= WINDOW_MAX) break;
  }
  return null;
}
