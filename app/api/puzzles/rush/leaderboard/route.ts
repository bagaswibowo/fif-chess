/**
 * app/api/puzzles/rush/leaderboard/route.ts (S3-T3)
 * GET — top 20 rush_best (SQL-side agregat; kolom users.rush_best).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = await query<{ username: string; rush_best: number; rush_best_at: string | null }>(
    `SELECT username, rush_best, rush_best_at
     FROM users WHERE rush_best > 0
     ORDER BY rush_best DESC, rush_best_at ASC NULLS LAST
     LIMIT 20`,
  );
  return NextResponse.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1, username: r.username, score: Number(r.rush_best), achievedAt: r.rush_best_at,
    })),
  });
}
