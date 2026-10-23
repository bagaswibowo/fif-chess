/**
 * app/api/puzzles/missed/route.ts (W2 — tab Koreksi)
 * GET — daftar puzzle yang pernah GAGAL user (puzzle_attempts correct=false),
 * unik per puzzle (attempt gagal terakhir), window 7–30 hari, ringkas + streak.
 * Identitas via resolvePgUser (username=$1 → pgId; 401/403/503 semantics FIX-1).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser, currentStreak } from "@/lib/puzzle-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;

  // Unik per puzzle: attempt GAGAL TERAKHIR di window 7-30 hari yang belum
  // ditindak-lanjuti attempt benar setelahnya (solved menghapus dari daftar).
  const rows = await query(
    `SELECT DISTINCT ON (a.puzzle_id)
            p.id, p.title, p.fen, p.rating, p.themes,
            (SELECT jsonb_array_length(p.solution_moves)) AS move_count,
            a.attempted_at AS last_failed_at
     FROM puzzle_attempts a
     JOIN puzzles p ON p.id = a.puzzle_id
     WHERE a.user_id = $1::uuid AND a.correct = false
       AND a.attempted_at > NOW() - interval '30 days'
       AND NOT EXISTS (
         SELECT 1 FROM puzzle_attempts a2
         WHERE a2.puzzle_id = a.puzzle_id AND a2.user_id = $1::uuid
           AND a2.correct = true AND a2.attempted_at >= a.attempted_at
       )
     ORDER BY a.puzzle_id, a.attempted_at DESC`,
    [me.pgId],
  );

  const missed = rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        title: String(row.title ?? ""),
        fen: String(row.fen),
        rating: Number(row.rating ?? 1200),
        themes: Array.isArray(row.themes) ? (row.themes as string[]) : [],
        moveCount: Number(row.move_count ?? 0),
        lastFailedAt: row.last_failed_at,
      };
    });

  const streak = await currentStreak(me.pgId);
  return NextResponse.json({ missed, streak });
}
