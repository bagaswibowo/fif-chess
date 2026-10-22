/**
 * app/api/puzzles/[id]/attempt/route.ts (S3-T1)
 * POST { correct, time_spent_sec } -> INSERT puzzle_attempts; return streak.
 * Sisi server hanya mencatat hasil validasi client (chess.js step-by-step
 * dilakukan di UI; server memvalidasi bentuk payload & kepemilikan sesi).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPgUser, currentStreak, isValidSolutionMoves } from "@/lib/puzzle-api";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const correct = body.correct === true;
  const timeSpent = Number(body.time_spent_sec);
  if (!Number.isFinite(timeSpent) || timeSpent < 0 || timeSpent > 3600) {
    return NextResponse.json({ error: "time_spent_sec tidak valid.", retryable: false }, { status: 400 });
  }
  const moves = body.moves;
  if (moves !== undefined && !isValidSolutionMoves(moves)) {
    return NextResponse.json({ error: "Format moves tidak valid (harus array UCI).", retryable: false }, { status: 400 });
  }

  const puzzle = await query<{ id: string }>("SELECT id FROM puzzles WHERE id = $1::uuid LIMIT 1", [id]);
  if (puzzle.length === 0) {
    return NextResponse.json({ error: "Puzzle tidak ditemukan.", retryable: false }, { status: 404 });
  }

  await query(
    "INSERT INTO puzzle_attempts (user_id, puzzle_id, correct, time_spent_sec) VALUES ($1::uuid, $2::uuid, $3, $4)",
    [me.pgId, id, correct, Math.round(timeSpent)],
  );
  const streak = await currentStreak(me.pgId);
  return NextResponse.json({ ok: true, correct, streak });
}
