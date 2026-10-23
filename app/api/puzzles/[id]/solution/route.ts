/**
 * app/api/puzzles/[id]/solution/route.ts (W1 — interaksi papan PuzzleSolver)
 * GET — solution_moves (UCI) puzzle untuk validasi langkah di client (chess.js,
 * lib/puzzle-solve.validateSolutionStep). Kontrak S3: server TIDAK re-validate
 * langkah; attempt hanya mencatat hasil validasi client (risiko kejujian rendah,
 * dicatat PM di pm-board-training-plan.md §A.4). Auth wajib (resolvePgUser).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const rows = await query<{ solution_moves: unknown }>(
    "SELECT solution_moves FROM puzzles WHERE id = $1::uuid LIMIT 1",
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Puzzle tidak ditemukan.", retryable: false }, { status: 404 });
  }
  const moves = rows[0].solution_moves;
  if (!Array.isArray(moves) || moves.length === 0 || typeof moves[0] !== "string") {
    return NextResponse.json({ error: "Solusi puzzle tidak tersedia.", retryable: false }, { status: 409 });
  }
  return NextResponse.json({ solutionMoves: moves });
}
