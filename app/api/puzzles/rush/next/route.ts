/**
 * app/api/puzzles/rush/next/route.ts (S3-T3)
 * GET ?sessionId= — puzzle berikutnya dengan difficulty adaptif (rating sesi),
 * exclude puzzle yang sudah muncul di sesi ini.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPgUser } from "@/lib/puzzle-api";
import { getSession, isExpired, timeLeftSec } from "@/lib/puzzle-rush";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  const s = sessionId ? await getSession(sessionId) : null;
  if (!s || s.userId !== me.pgId) {
    return NextResponse.json({ error: "Sesi tidak ditemukan atau kedaluwarsa.", retryable: false }, { status: 404 });
  }
  if (isExpired(s)) {
    return NextResponse.json({ gameOver: true, reason: "timer", score: s.score, strikes: s.strikes });
  }

  const lo = Math.max(800, s.rating - 100);
  const hi = Math.min(2200, s.rating + 100);
  const rows = await query(
    `SELECT id, title, fen, solution_moves, rating, themes
     FROM puzzles
     WHERE rating BETWEEN $1 AND $2
       AND ($3::int = 0 OR id::text <> ALL($4::text[]))
     ORDER BY random() LIMIT 1`,
    [lo, hi, s.puzzleIds.length, s.puzzleIds],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada teka-teki tersisa.", retryable: false }, { status: 404 });
  }
  const row = rows[0] as Record<string, unknown>;
  const moves = row.solution_moves as unknown;
  return NextResponse.json({
    puzzle: {
      id: String(row.id), title: row.title, fen: row.fen,
      rating: Number(row.rating), themes: row.themes ?? [],
      moveCount: Array.isArray(moves) ? moves.length : 0,
    },
    strikes: s.strikes, score: s.score, timeLeftSec: timeLeftSec(s),
  });
}
