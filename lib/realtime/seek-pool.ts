/**
 * lib/realtime/seek-pool.ts
 * Seek pool (ticket S1-T2): Redis-only, tanpa model DB (docs/db/sprint1.md §1).
 *
 * Struktur (konvensi docs/db/sprint1.md):
 * - ZSET `seek:pool:{tc}:{mode}`  score = rating, member = seekId
 * - HASH `seek:{seekId}`          (userId, pgUserId, rating, tc, mode, createdAt), TTL singkat
 * - KEY  `seek:user:{userId}`     = seekId (indeks cancel/lookup O(1), tanpa KEYS/SCAN)
 *
 * Matching atomic penuh via Lua (TL review C1): penghapusan seek pemanggil
 * (ZREM pool + DEL hash) DAN pop lawan terjadi di SATU eksekusi script —
 * tidak ada round-trip terpisah, dua tryMatch paralel tidak mungkin
 * menghasilkan dua match untuk pasangan yang sama.
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
const userKey = (userId: string) => `seek:user:${userId}`;

/**
 * MATCH_LUA — atomic penuh (TL C1):
 * 1. Hapus seek PEMANGGIL dulu (ZREM pool + DEL hash + DEL indeks user) di
 *    dalam script yang sama — seek pemanggil tidak bisa di-pop oleh
 *    tryMatch paralel mana pun setelah titik ini.
 * 2. Pop satu kandidat lawan (ZREM + DEL hash-nya + DEL indeks user-nya).
 * Semua dalam satu eksekusi Redis — tidak ada round-trip terpisah.
 * KEYS: [pool, selfHash, selfUserIdx]; ARGV: [rating, window, selfId, selfUserId]
 * Return array lawan atau nil.
 */
const MATCH_LUA = `
local pool = KEYS[1]
local selfHash = KEYS[2]
local selfIdx = KEYS[3]
local rating = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local selfId = ARGV[3]
local selfUserId = ARGV[4]

-- 1. Seek pemanggil keluar dari pool SEKARANG, atomically.
redis.call('ZREM', pool, selfId)
redis.call('DEL', selfHash)
redis.call('DEL', selfIdx)

-- 2. Pop kandidat lawan dalam window rating.
local cands = redis.call('ZRANGE', pool, rating - window, rating + window, 'BYSCORE')
for i, sid in ipairs(cands) do
  if sid ~= selfId then
    local h = redis.call('HGETALL', 'seek:' .. sid)
    local map = {}
    for j = 1, #h, 2 do map[h[j]] = h[j + 1] end
    if map.userId and map.rating then
      redis.call('ZREM', pool, sid)
      redis.call('DEL', 'seek:' .. sid)
      if map.userId ~= '' then redis.call('DEL', 'seek:user:' .. map.userId) end
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
    .set(userKey(t.userId), t.seekId, "EX", SEEK_TTL_S)
    .zadd(poolKey(t.tc, t.mode), String(t.rating), t.seekId)
    .exec();
}

/**
 * Hapus seek milik userId (cancel / re-seek) — ATOMIC via Lua (TL C2):
 * indeks `seek:user:{userId}` → seekId, lalu ZREM pool + DEL hash + DEL
 * indeks dalam satu script. Tidak ada `KEYS` (blocking) dan tidak bisa
 * kalah balapan dengan tryMatch. Idempoten: seek yang sudah match/hilang
 * mengembalikan null tanpa error.
 */
const REMOVE_LUA = `
local idx = KEYS[1]
local sid = redis.call('GET', idx)
if not sid then return nil end
local h = redis.call('HGETALL', 'seek:' .. sid)
local map = {}
for j = 1, #h, 2 do map[h[j]] = h[j + 1] end
if map.tc and map.mode then
  redis.call('ZREM', 'seek:pool:' .. map.tc .. ':' .. map.mode, sid)
end
redis.call('DEL', 'seek:' .. sid)
redis.call('DEL', idx)
return sid
`;

export async function removeUserSeek(userId: string): Promise<string | null> {
  const r = seekRedis();
  const sid = (await r.eval(REMOVE_LUA, 1, userKey(userId), userId)) as string | null;
  return sid ?? null;
}

export async function getUserSeek(userId: string): Promise<SeekTicket | null> {
  const r = seekRedis();
  const sid = await r.get(userKey(userId));
  if (!sid) return null;
  const h = await r.hgetall(hashKey(sid));
  if (!h.userId || !h.rating) return null;
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

export type MatchPair = { a: SeekTicket; b: SeekTicket };

/** Coba match seekId dengan seek lain dalam window rating (atomic penuh di Redis). */
export async function tryMatch(seek: SeekTicket): Promise<MatchPair | null> {
  const r = seekRedis();
  const now = Date.now();
  for (let window = WINDOW_START; window <= WINDOW_MAX; window *= 2) {
    const res = (await r.eval(
      MATCH_LUA,
      3,
      poolKey(seek.tc, seek.mode),
      hashKey(seek.seekId),
      userKey(seek.userId),
      String(seek.rating),
      String(window),
      seek.seekId,
      seek.userId,
    )) as [string, string, string, string, string, string, string] | null;
    if (res) {
      // Seek pemanggil sudah dihapus DI DALAM Lua — tidak ada round-trip lagi.
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
