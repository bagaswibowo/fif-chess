/**
 * app/api/puzzles/next/route.ts (S3-T1, G8)
 * GET /api/puzzles/next?theme=&minRating=&maxRating=
 * 1 puzzle dekat rating user (±150, fallback ±400), random tiebreak,
 * exclude yang sudah dijaw benar user (baru-baru ini).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }

  const url = new URL(request.url);
  const theme = url.searchParams.get("theme")?.trim() || null;
  const minR = Number(url.searchParams.get("minRating")) || null;
  const maxR = Number(url.searchParams.get("maxRating")) || null;

  const center = minR && maxR ? Math.round((minR + maxR) / 2) : me.rating;
  const lo = minR ?? Math.max(800, center - 150);
  const hi = maxR ?? Math.min(2200, center + 150);
  const params: unknown[] = [me.pgId, lo, hi];
  const themeFilter = theme ? "AND $4::text = ANY(p.themes)" : "";
  if (theme) params.push(theme);

  const sql = (lo2: number, hi2: number) => `
    SELECT p.id, p.title, p.fen, p.solution_moves, p.rating, p.themes
    FROM puzzles p
    WHERE p.rating BETWEEN ${lo2} AND ${hi2} ${themeFilter}
      AND p.id NOT IN (
        SELECT a.puzzle_id FROM puzzle_attempts a
        WHERE a.user_id = $1 AND a.correct = true AND a.attempted_at > NOW() - interval '7 days'
      )
    ORDER BY random()
    LIMIT 1`;

  let rows = await query(sql(lo, hi), params);
  if (rows.length === 0) {
    // fallback ±400
    const flo = minR ?? Math.max(800, center - 400);
    const fhi = maxR ?? Math.min(2200, center + 400);
    rows = await query(sql(flo, fhi), params);
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada teka-teki di rentang ini.", retryable: false }, { status: 404 });
  }
  const row = rows[0] as Record<string, unknown>;
  const moves = row.solution_moves as string[];
  // Streak berjalan: run benar terakhir.
  const recent = await query<{ correct: boolean }>(
    `SELECT correct FROM puzzle_attempts WHERE user_id = $1 ORDER BY attempted_at DESC LIMIT 200`,
    [me.pgId],
  );
  let streak = 0;
  for (const r of recent) { if (r.correct) streak++; else break; }

  return NextResponse.json({
    puzzle: {
      id: String(row.id), title: row.title, fen: row.fen,
      rating: Number(row.rating), themes: row.themes ?? [],
      moveCount: Array.isArray(moves) ? moves.length : 0,
    },
    streak,
  });
}
