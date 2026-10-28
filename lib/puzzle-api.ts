/**
 * lib/puzzle-api.ts (Sprint 3 — helper bersama API puzzle DB baru)
 * Tabel `puzzles`/`puzzle_attempts` DB — BUKAN bank statis lib/puzzle-data.ts.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loadUsers, sessionUserForToken, tokenFromRequest, type UserProfile } from "@/lib/auth-store";

export type PgUser = { pgId: string; rating: number; username: string };
export type PgUserResolution =
  | { ok: true; user: PgUser }
  | { ok: false; response: Response };

/**
 * FIX-1.1/1.3: semantics auth yang jelas untuk route handler.
 *  - tanpa session valid            -> 401 (belum login)
 *  - session valid, status pending  -> 403 code=account_pending
 *  - session valid, status rejected -> 403 code=account_rejected
 *  - error DB                       -> 503 code=service_unavailable (di-LOG, bukan ditelan)
 *  - username tak ada di PG         -> 403 code=account_missing + warning (deteksi drift R4)
 */
export async function resolvePgUser(request: Request): Promise<PgUserResolution> {
  const users: UserProfile[] = await loadUsers();
  const me = sessionUserForToken(tokenFromRequest(request), users);
  if (!me) {
    return { ok: false, response: NextResponse.json({ error: "Authentication required.", code: "unauthenticated", retryable: false }, { status: 401 }) };
  }
  if (me.status === "pending") {
    return { ok: false, response: NextResponse.json({ error: "Akun menunggu persetujuan admin.", code: "account_pending", retryable: false }, { status: 403 }) };
  }
  if (me.status === "rejected") {
    return { ok: false, response: NextResponse.json({ error: "Akun ditolak admin.", code: "account_rejected", retryable: false }, { status: 403 }) };
  }
  try {
    const rows = await query<{ id: string; rating: number; username: string }>(
      "SELECT id, rating, username FROM users WHERE username = $1 LIMIT 1",
      [me.username],
    );
    if (rows.length === 0) {
      console.warn(`[puzzle-api] R4 drift: user ${JSON.stringify(me.username)} ada di users.json tapi tidak di PG`);
      return { ok: false, response: NextResponse.json({ error: "Akun belum tersinkron dengan database.", code: "account_missing", retryable: true }, { status: 403 }) };
    }
    const r = rows[0];
    return { ok: true, user: { pgId: String(r.id), rating: Number(r.rating) || 1200, username: String(r.username) } };
  } catch (err) {
    console.error("[puzzle-api] DB gagal saat resolve user:", err);
    return { ok: false, response: NextResponse.json({ error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true }, { status: 503 }) };
  }
}

export type SessionUserResolution =
  | { ok: true; user: UserProfile }
  | { ok: false; response: Response };

/**
 * FIX-1.2 (S9-T1): varian `resolvePgUser` TANPA query PG — untuk endpoint yang
 * menyimpan id store (u-*) sendiri dan memetakan username→uuid PG di route
 * (pola `currentUserId` lama di api/pvp, api/seek, api/stats/summary).
 * Mapping: tanpa sesi → 401 unauthenticated; pending → 403 account_pending;
 * rejected → 403 account_rejected; loadUsers gagal → 503 service_unavailable.
 * Shape respons: { error, code?, retryable } (kontrak FIX-1.2).
 */
export async function resolveSessionUser(request: Request): Promise<SessionUserResolution> {
  let me: UserProfile | null;
  try {
    const users: UserProfile[] = await loadUsers();
    me = sessionUserForToken(tokenFromRequest(request), users);
  } catch (err) {
    console.error("[puzzle-api] loadUsers gagal saat resolve session user:", err);
    return { ok: false, response: NextResponse.json({ error: "Layanan sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true }, { status: 503 }) };
  }
  if (!me) {
    return { ok: false, response: NextResponse.json({ error: "Authentication required.", code: "unauthenticated", retryable: false }, { status: 401 }) };
  }
  if (me.status === "pending") {
    return { ok: false, response: NextResponse.json({ error: "Akun menunggu persetujuan admin.", code: "account_pending", retryable: false }, { status: 403 }) };
  }
  if (me.status === "rejected") {
    return { ok: false, response: NextResponse.json({ error: "Akun ditolak admin.", code: "account_rejected", retryable: false }, { status: 403 }) };
  }
  return { ok: true, user: me };
}

export type PuzzleDto = {
  id: string;
  title: string;
  fen: string;
  rating: number;
  themes: string[];
  moveCount: number;
};

export function toDto(row: Record<string, unknown>): PuzzleDto {
  const moves = row.solution_moves as unknown;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    fen: String(row.fen),
    rating: Number(row.rating ?? 1200),
    themes: Array.isArray(row.themes) ? (row.themes as string[]) : [],
    // Panjang solusi dibocorkan sebagai jumlah langkah (standar chess.com), bukan langkahnya.
    moveCount: Array.isArray(moves) ? moves.length : 0,
  };
}

/** Streak berjalan user: panjang run attempt benar terakhir (per attempted_at). */
export async function currentStreak(pgId: string): Promise<number> {
  const rows = await query<{ correct: boolean }>(
    `SELECT correct FROM puzzle_attempts WHERE user_id = $1 ORDER BY attempted_at DESC LIMIT 100`,
    [pgId],
  );
  let streak = 0;
  for (const r of rows) {
    if (r.correct) streak++;
    else break;
  }
  return streak;
}

/** Streak harian (S3-T2): hari UTC berurutan dengan >=1 attempt benar. */
export async function dailyStreak(pgId: string): Promise<number> {
  const rows = await query<{ d: string; correct: boolean }>(
    `SELECT DISTINCT (attempted_at AT TIME ZONE 'UTC')::date::text AS d, bool_or(correct) AS correct
     FROM puzzle_attempts
     WHERE user_id = $1 AND attempted_at > NOW() - interval '400 days'
     GROUP BY 1 ORDER BY 1 DESC`,
    [pgId],
  );
  const map = new Map(rows.map((r) => [r.d, r.correct]));
  // Mulai hari ini (UTC); hari ini belum main tidak memutus streak — mulai dari kemarin.
  const cursor = new Date();
  const key = (dt: Date) => dt.toISOString().slice(0, 10);
  let streak = 0;
  let start = map.has(key(cursor)) ? 0 : 1;
  for (let i = start; i < 400; i++) {
    const dt = new Date(cursor);
    dt.setUTCDate(dt.getUTCDate() - i);
    const k = key(dt);
    if (map.get(k) === true) streak++;
    else break;
  }
  return streak;
}

/** Validasi solution_moves jsonb: array string UCI. */
export function isValidSolutionMoves(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((m) => typeof m === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m));
}
