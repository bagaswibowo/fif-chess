/**
 * app/api/puzzles/stats/route.ts (W4 — statistik latihan)
 * GET — agregat puzzle_attempts user: akurasi 7/30 hari, rating delta
 * (rating PG saat ini vs rating puzzle rata-rata yang dijaw 30 hari),
 * top tema lemah (akurasi terendah, min 3 attempt). Guest 401 diteruskan
 * (UI PuzzleHub sudah punya fallback guest); 403/503 via resolvePgUser.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;

  const [win7, win30, ratingRow, weakThemes] = await Promise.all([
    query<{ total: string; correct: string }>(
      `SELECT count(*)::text AS total, count(*) FILTER (WHERE correct)::text AS correct
       FROM puzzle_attempts WHERE user_id = $1::uuid AND attempted_at > NOW() - interval '7 days'`,
      [me.pgId],
    ),
    query<{ total: string; correct: string }>(
      `SELECT count(*)::text AS total, count(*) FILTER (WHERE correct)::text AS correct
       FROM puzzle_attempts WHERE user_id = $1::uuid AND attempted_at > NOW() - interval '30 days'`,
      [me.pgId],
    ),
    // Rating delta: selisih rating user vs rata-rata rating puzzle yang dijaw 30 hari.
    query<{ avg_rating: string | null; solved30: string }>(
      `SELECT avg(p.rating)::text AS avg_rating, count(DISTINCT a.puzzle_id)::text AS solved30
       FROM puzzle_attempts a JOIN puzzles p ON p.id = a.puzzle_id
       WHERE a.user_id = $1::uuid AND a.correct = true AND a.attempted_at > NOW() - interval '30 days'`,
      [me.pgId],
    ),
    // Top tema lemah: akurasi attempt terendah, min 3 attempt dalam 30 hari.
    query<{ theme: string; total: string; correct: string }>(
      `SELECT t.theme, count(*)::text AS total, count(*) FILTER (WHERE a.correct)::text AS correct
       FROM puzzle_attempts a
       JOIN puzzles p ON p.id = a.puzzle_id
       CROSS JOIN LATERAL unnest(p.themes) AS t(theme)
       WHERE a.user_id = $1::uuid AND a.attempted_at > NOW() - interval '30 days'
       GROUP BY t.theme HAVING count(*) >= 3
       ORDER BY (count(*) FILTER (WHERE a.correct))::float / count(*) ASC
       LIMIT 5`,
      [me.pgId],
    ),
  ]);

  const acc = (r: { total: string; correct: string }) => {
    const total = Number(r.total), correct = Number(r.correct);
    return { total, correct, accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null };
  };
  const rating = Number(me.rating) || 1200;
  const avgPuzzle = ratingRow[0]?.avg_rating != null ? Math.round(Number(ratingRow[0].avg_rating)) : null;

  return NextResponse.json({
    days7: acc(win7[0]),
    days30: acc(win30[0]),
    ratingNow: rating,
    avgPuzzleRating30d: avgPuzzle,
    ratingDelta: avgPuzzle != null ? rating - avgPuzzle : null,
    solvedPuzzles30d: Number(ratingRow[0]?.solved30 ?? 0),
    weakThemes: weakThemes.map((r) => ({
      theme: r.theme,
      total: Number(r.total),
      correct: Number(r.correct),
      accuracyPct: Math.round((Number(r.correct) / Number(r.total)) * 100),
    })),
  });
}
