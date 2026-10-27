/**
 * app/api/insights/route.ts (S6-T4, ADR-009 D4)
 * GET /api/insights?user=<username>&window=30|90|365|all&game_type=bullet|blitz|rapid&color=w|b
 *
 * Agregasi SQL-side dari `games` (pola api/stats/summary + kategori waktu
 * api/leaderboard — docs/db/sprint6.md §4): totals+winRate, byType,
 * ratingGraph (rating before/after), ratingDelta, recentGames (shape reuse
 * recentGames GET /api/home/dashboard). Window/filter SEMUA di SQL
 * (guardrail no-client-side-filter). Toleran skema live (docs/db/sprint6.md §1):
 * 99,99% baris games game_type/time_control NULL, status='active' → hanya
 * status='finished' + kategori COALESCE 'unknown' (tidak asumsikan).
 *
 * Auth (kontrak §1.4):
 * - `user` = session sendiri (atau tanpa param) → guard FIX-1:
 *   401 unauthenticated / 403 account_pending / 403 account_rejected /
 *   403 account_missing / 503 service_unavailable (pola resolvePgUser).
 * - `user` ≠ session → PUBLIK tanpa guard auth (username+rating sudah publik
 *   di api/leaderboard). 404 bila username tak ada di PG; user pending yang
 *   hanya eksis di file-store juga 404 (anti-leak keberadaan akun).
 * - Param invalid → 400.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loadUsers, sessionUserForToken, tokenFromRequest, type UserProfile } from "@/lib/auth-store";
import { resolvePgUser } from "@/lib/puzzle-api";
import { timeCategoryOf, type TimeCategory } from "@/lib/time-control";

export const runtime = "nodejs";

const WINDOWS = ["30", "90", "365", "all"] as const;
type Window = (typeof WINDOWS)[number];
const GAME_TYPES = ["bullet", "blitz", "rapid"] as const;
const COLORS = ["w", "b"] as const;

export interface RecentGame {
  id: string;
  myResult: "win" | "loss" | "draw";
  opponent: { username: string; rating: number };
  timeControl: string | null;
  gameType: string | null;
  endedAt: string | null;
}

export interface InsightsResponse {
  user: { username: string; rating: number | null };
  window: Window;
  gameType: TimeCategory | null;
  color: "w" | "b" | null;
  totals: { wins: number; losses: number; draws: number; games: number; winRate: number | null };
  byType: Record<string, { wins: number; losses: number; draws: number; total: number }>;
  ratingGraph: { date: string | null; gameId: string; gameType: string | null; rating: number | null }[];
  ratingDelta: number | null;
  recentGames: RecentGame[];
}

/** Query utama: finished games user (docs/db/sprint6.md §4.1: satu scan per
 *  warna — jangan OR + ORDER BY global). $1 = pg user id; filter window /
 *  kategori waktu / color ditambahkan di WHERE (param urut otomatis). */
function insightQuery(window: Window, gameType: TimeCategory | null, color: "w" | "b" | null, params: string[]): string {
  const where: string[] = [`(g.white_user_id = $1::uuid OR g.black_user_id = $1::uuid)`, `g.status = 'finished'`];
  const ph = (v: string) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (window !== "all") where.push(`g.ended_at > NOW() - ${ph(`${window} days`)}::interval`);
  if (gameType) {
    // TL F4 (pin deliberat): baris time_control NULL TIDAK BOLEH masuk bucket
    // kategori — seed live 99,99% NULL (docs/db/sprint6.md §1) harus tetap di
    // bucket 'unknown' byType, bukan "bullet". Maka filter kategori mensyaratkan
    // time_control tak-NULL + parseable; tanpa guard ini, filter 'bullet'
    // (minut COALESCE→0 <3) akan mencocokkan seluruh baris NULL — filter &
    // bucket byType sependapat sekarang.
    const min = `split_part(g.time_control, '+', 1)::int`;
    if (gameType === "bullet") where.push(`g.time_control IS NOT NULL AND ${min} < 3`);
    else if (gameType === "blitz") where.push(`g.time_control IS NOT NULL AND ${min} >= 3 AND ${min} < 10`);
    else where.push(`g.time_control IS NOT NULL AND ${min} >= 10`);
  }
  if (color === "w") where.push(`g.white_user_id = $1::uuid`);
  if (color === "b") where.push(`g.black_user_id = $1::uuid`);
  return `
    SELECT g.id, g.result, g.white_user_id, g.black_user_id,
           g.game_type, g.time_control, g.ended_at,
           CASE WHEN g.white_user_id = $1::uuid THEN g.white_rating_before
                ELSE g.black_rating_before END AS rating_before,
           CASE WHEN g.white_user_id = $1::uuid THEN g.white_rating_after
                ELSE g.black_rating_after END AS rating_after
    FROM games g
    WHERE ${where.join("\n      AND ")}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userParam = (url.searchParams.get("user") ?? "").trim();
  const windowParam = url.searchParams.get("window") ?? "90";
  const gameTypeParam = url.searchParams.get("game_type");
  const colorParam = url.searchParams.get("color");
  if (!(WINDOWS as readonly string[]).includes(windowParam)) {
    return NextResponse.json({ error: "window harus 30|90|365|all.", code: "invalid_window", retryable: false }, { status: 400 });
  }
  const window = windowParam as Window;
  if (gameTypeParam !== null && !(GAME_TYPES as readonly string[]).includes(gameTypeParam)) {
    return NextResponse.json({ error: "game_type harus bullet|blitz|rapid.", code: "invalid_game_type", retryable: false }, { status: 400 });
  }
  const gameType = gameTypeParam as TimeCategory | null;
  if (colorParam !== null && !(COLORS as readonly string[]).includes(colorParam)) {
    return NextResponse.json({ error: "color harus w|b.", code: "invalid_color", retryable: false }, { status: 400 });
  }
  const color = colorParam as "w" | "b" | null;

  let fileUsers: UserProfile[];
  try {
    fileUsers = await loadUsers();
  } catch {
    fileUsers = [];
  }
  const me = sessionUserForToken(tokenFromRequest(request), fileUsers);
  const targetFile: UserProfile | undefined = userParam
    ? fileUsers.find((u) => u.username === userParam)
    : undefined;

  // Path sendiri: param user == session, atau tanpa param.
  const isOwn = userParam === "" || (me !== null && targetFile !== undefined && targetFile.username === me.username);

  let pgId: string;
  let targetUsername: string;
  let targetRating: number | null;

  if (isOwn) {
    // Guard FIX-1 penuh (401 / 403 account_pending / 403 account_rejected /
    // 403 account_missing / 503) — pola resolvePgUser.
    if (!me) {
      return NextResponse.json({ error: "Authentication required.", code: "unauthenticated", retryable: false }, { status: 401 });
    }
    const auth = await resolvePgUser(request);
    if (!auth.ok) return auth.response;
    pgId = auth.user.pgId;
    targetUsername = auth.user.username;
    targetRating = auth.user.rating;
  } else {
    // Publik deep-link: TANPA guard auth. Akun pending yang hanya ada di
    // file-store → 404 (jangan bocorkan keberadaan); 404 bila tak ada di PG.
    if (targetFile && targetFile.status === "pending") {
      return NextResponse.json({ error: "User tidak ditemukan.", code: "user_not_found", retryable: false }, { status: 404 });
    }
    let rows: { id: string; rating: number }[];
    try {
      rows = await query<{ id: string; rating: number }>(
        `SELECT id, rating FROM users WHERE username = $1 LIMIT 1`,
        [userParam],
      );
    } catch (err) {
      console.error("[insights] resolve user PG gagal:", err);
      return NextResponse.json(
        { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
        { status: 503 },
      );
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan.", code: "user_not_found", retryable: false }, { status: 404 });
    }
    pgId = String(rows[0].id);
    targetUsername = userParam;
    targetRating = Number(rows[0].rating) || null;
  }

  const data = await buildInsights({
    pgId,
    targetUsername,
    targetRating,
    window,
    gameType,
    color,
    isOwn,
  });
  if (data instanceof NextResponse) return data;
  return NextResponse.json(data);
}

async function buildInsights(args: {
  pgId: string;
  targetUsername: string;
  targetRating: number | null;
  window: Window;
  gameType: TimeCategory | null;
  color: "w" | "b" | null;
  isOwn: boolean;
}): Promise<InsightsResponse | NextResponse> {
  const { pgId, targetUsername, targetRating, window, gameType, color, isOwn } = args;

  const params: string[] = [pgId];
  const sql = insightQuery(window, gameType, color, params);
  let rows: Record<string, unknown>[];
  try {
    rows = await query<Record<string, unknown>>(sql, params);
  } catch (err) {
    console.error("[insights] query games gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }

  // recentGames: HANYA perspektif sendiri (deep-link publik: kosong —
  // perspektif "you" tidak terdefinisi, kontrak §1.4). Shape = dashboard.
  let recentGames: RecentGame[] = [];
  if (isOwn) {
    try {
      const recentRows = await query<Record<string, unknown>>(
        `SELECT g.id, g.result, g.white_user_id, g.time_control, g.game_type, g.ended_at,
                ur.username AS opponent_username, ur.rating AS opponent_rating
         FROM games g
         JOIN users ur ON ur.id = CASE WHEN g.white_user_id = $1::uuid THEN g.black_user_id ELSE g.white_user_id END
         WHERE (g.white_user_id = $1::uuid OR g.black_user_id = $1::uuid) AND g.status <> 'active'
         ORDER BY COALESCE(g.ended_at, g.created_at) DESC
         LIMIT 10`,
        [pgId],
      );
      recentGames = recentRows.map((r) => {
        const g = r as Record<string, unknown>;
        const result = String(g.result ?? "*");
        const myColor = g.white_user_id === pgId ? "white" : "black";
        const myResult = result === "draw" ? "draw" : result === myColor ? "win" : "loss";
        return {
          id: String(g.id),
          myResult,
          opponent: {
            username: String(g.opponent_username ?? "?"),
            rating: Number(g.opponent_rating ?? 0),
          },
          timeControl: (g.time_control as string) ?? null,
          gameType: (g.game_type as string) ?? null,
          endedAt: g.ended_at ? String(g.ended_at) : null,
        };
      });
    } catch {
      recentGames = []; // best-effort: angka utama sudah dari query utama
    }
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  const byType: Record<string, { wins: number; losses: number; draws: number; total: number }> = {};
  const ratingGraph: InsightsResponse["ratingGraph"] = [];

  for (const r of rows) {
    const g = r as Record<string, unknown>;
    const myWhite = g.white_user_id === pgId;
    const result = String(g.result ?? "");
    let mine: "win" | "loss" | "draw";
    if (result === "draw") mine = "draw";
    else if ((result === "white") === myWhite) mine = "win";
    else mine = "loss";

    // Kategori waktu TURUN dari time_control (aturan api/leaderboard);
    // NULL seed → bucket "unknown" (docs/db/sprint6.md §1 — jangan asumsikan).
    const tc = (g.time_control as string) ?? null;
    const cat = tc ? timeCategoryOf(tc) : null;
    const bucketKey = cat ?? "unknown";
    const bt = (byType[bucketKey] ??= { wins: 0, losses: 0, draws: 0, total: 0 });
    if (mine === "draw") {
      draws += 1;
      bt.draws += 1;
    } else if (mine === "win") {
      wins += 1;
      bt.wins += 1;
    } else {
      losses += 1;
      bt.losses += 1;
    }
    bt.total += 1;

    const after = Number(g.rating_after);
    ratingGraph.push({
      date: g.ended_at ? new Date(String(g.ended_at)).toISOString() : null,
      gameId: String(g.id),
      gameType: (g.game_type as string) ?? null,
      rating: Number.isFinite(after) ? after : null,
    });
  }

  const games = wins + losses + draws;
  const withRating = ratingGraph.filter((pt) => pt.rating !== null);
  const latest = withRating.at(-1)?.rating ?? null;
  const earliest = withRating[0]?.rating ?? null;

  return {
    user: { username: targetUsername, rating: targetRating },
    window,
    gameType,
    color,
    totals: {
      wins,
      losses,
      draws,
      games,
      winRate: games === 0 ? null : Math.round((wins / games) * 100) / 100,
    },
    byType,
    ratingGraph,
    ratingDelta: latest !== null && earliest !== null ? latest - earliest : null,
    recentGames,
  };
}
