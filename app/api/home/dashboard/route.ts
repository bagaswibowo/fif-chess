/**
 * app/api/home/dashboard/route.ts (ticket S4-T2)
 * GET /api/home/dashboard — agregat satu call untuk home dashboard:
 * { username, rating, solvedToday, streakHarian, gamesAktif, tasksState }
 * Tanpa tabel/kolom baru (docs/db/sprint4.md keputusan #2): solvedToday dari
 * puzzle_attempts, game aktif dari games status='active', rating dari users.rating.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser, dailyStreak } from "@/lib/puzzle-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;

  const [solvedRows, activeRows, recentRows, lastFinished] = await Promise.all([
    query<{ n: string }>(
      `SELECT count(DISTINCT puzzle_id)::text AS n FROM puzzle_attempts
       WHERE user_id = $1::uuid AND correct AND attempted_at::date = (NOW() AT TIME ZONE 'UTC')::date`,
      [me.pgId],
    ),
    query(
      `SELECT g.id, g.time_control, g.game_type, g.white_user_id, g.black_user_id,
              g.white_rating_before, g.black_rating_before,
              uw.username AS white_username, ub.username AS black_username,
              ur.username AS rival_username, ur.id AS rival_id, ur.rating AS rival_rating
       FROM games g
       JOIN users uw ON uw.id = g.white_user_id
       JOIN users ub ON ub.id = g.black_user_id
       JOIN users ur ON ur.id = CASE WHEN g.white_user_id = $1::uuid THEN g.black_user_id ELSE g.white_user_id END
       WHERE (g.white_user_id = $1::uuid OR g.black_user_id = $1::uuid) AND g.status = 'active'
       ORDER BY g.started_at DESC
       LIMIT 20`,
      [me.pgId],
    ),
    // T1 (WS-2.5): recentGames — 5 game selesai terakhir dari perspektif user.
    query(
      `SELECT g.id, g.result, g.white_user_id, g.black_user_id, g.time_control, g.game_type,
              g.white_rating_before, g.black_rating_before, g.ended_at,
              ur.username AS opponent_username, ur.rating AS opponent_rating
       FROM games g
       JOIN users ur ON ur.id = CASE WHEN g.white_user_id = $1::uuid THEN g.black_user_id ELSE g.white_user_id END
       WHERE (g.white_user_id = $1::uuid OR g.black_user_id = $1::uuid) AND g.status <> 'active'
       ORDER BY COALESCE(g.ended_at, g.created_at) DESC
       LIMIT 5`,
      [me.pgId],
    ),
    query(
      `SELECT g.id, g.ended_at, ur.username AS opponent
       FROM games g
       JOIN users ur ON ur.id = CASE WHEN g.white_user_id = $1::uuid THEN g.black_user_id ELSE g.white_user_id END
       WHERE (g.white_user_id = $1::uuid OR g.black_user_id = $1::uuid) AND g.status = 'finished'
       ORDER BY g.ended_at DESC NULLS LAST
       LIMIT 1`,
      [me.pgId],
    ),
  ]);

  const gamesAktif = activeRows.map((r) => {
    const g = r as Record<string, unknown>;
    const myTurn = g.white_user_id === me.pgId; // sementara: putaran = giliran putih
    return {
      gameId: String(g.id),
      timeControl: (g.time_control as string) ?? null,
      gameType: (g.game_type as string) ?? null,
      opponent: {
        username: String(g.rival_username),
        rating: Number(g.rival_rating),
      },
      myColor: g.white_user_id === me.pgId ? "white" : "black",
      myTurn,
    };
  });

  const solvedToday = Number(solvedRows[0]?.n ?? 0);
  const streakHarian = await dailyStreak(me.pgId);
  const lastGame = lastFinished[0] as { id: string; ended_at: string; opponent: string } | undefined;

  // T1: hasil dihitung dari perspektif user (result = warna pemenang).
  const recentGames = recentRows.map((r) => {
    const g = r as Record<string, unknown>;
    const result = String(g.result ?? "*");
    const myResult = result === "draw" ? "draw" : result === (g.white_user_id === me.pgId ? "white" : "black") ? "win" : "loss";
    return {
      id: String(g.id),
      myResult,
      opponent: {
        username: String(g.opponent_username ?? "?"),
        rating: Number(g.opponent_rating ?? 0),
      },
      timeControl: (g.time_control as string) ?? null,
      gameType: (g.game_type as string) ?? null,
      endedAt: g.ended_at,
    };
  });

  return NextResponse.json({
    username: me.username,
    rating: me.rating,
    solvedToday,
    streakHarian,
    gamesAktif,
    recentGames,
    tasksState: {
      puzzleDone: solvedToday > 0,
      dailyPuzzleDone: solvedToday > 0,
      lastGameToReview: lastGame
        ? { gameId: String(lastGame.id), opponent: String(lastGame.opponent), endedAt: lastGame.ended_at }
        : null,
    },
  });
}
