/**
 * app/api/endgames/drills/[setId]/next/route.ts (ticket S4-T4)
 * GET /api/endgames/drills/[setId]/next
 * Puzzle berikutnya dari set drill: belum dicoba ATAU terakhir gagal.
 * Reuse kontrak api/puzzles/next ({ puzzle: {id,title,fen,rating,themes,moveCount}, streak }).
 * Pool puzzle = id statis kurasi lib/endgame-drills.ts (query SQL-side per set).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser, currentStreak } from "@/lib/puzzle-api";
import { drillSetById } from "@/lib/endgame-drills";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ setId: string }> }) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;
  const { setId } = await ctx.params;
  const set = drillSetById(setId);
  if (!set) {
    return NextResponse.json({ error: "Set drill tidak ditemukan.", retryable: false }, { status: 404 });
  }

  // Belum dicoba (tanpa attempt) ATAU attempt terakhirnya salah.
  const rows = await query(
    `SELECT p.id, p.title, p.fen, p.solution_moves, p.rating, p.themes
     FROM puzzles p
     WHERE p.id = ANY($1::uuid[]) AND $2::text = ANY(p.themes)
       AND (NOT EXISTS (SELECT 1 FROM puzzle_attempts a WHERE a.puzzle_id = p.id AND a.user_id = $3::uuid)
            OR (SELECT a.correct FROM puzzle_attempts a
                WHERE a.puzzle_id = p.id AND a.user_id = $3::uuid
                ORDER BY a.attempted_at DESC LIMIT 1) = false)
     ORDER BY p.rating ASC, random()
     LIMIT 1`,
    [set.puzzleIds, set.theme, me.pgId],
  );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Semua puzzle di set ini sudah selesai.", done: true, retryable: false },
      { status: 404 },
    );
  }

  const row = rows[0] as Record<string, unknown>;
  const moves = row.solution_moves as unknown;
  const streak = await currentStreak(me.pgId);

  return NextResponse.json({
    set: { id: set.id, title: set.title },
    puzzle: {
      id: String(row.id),
      title: row.title,
      fen: row.fen,
      rating: Number(row.rating),
      themes: row.themes ?? [],
      moveCount: Array.isArray(moves) ? moves.length : 0,
    },
    streak,
  });
}
