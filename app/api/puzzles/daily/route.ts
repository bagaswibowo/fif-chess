/**
 * app/api/puzzles/daily/route.ts (S3-T2, G10)
 * GET /api/puzzles/daily?date=YYYY-MM-DD (default: hari ini UTC).
 * Rotasi deterministic: hash(date) -> OFFSET di band rating 1200-1800.
 * Semua user dapat puzzle sama per tanggal UTC; future date ditolak 400.
 * Streak harian derive dari puzzle_attempts (tanpa tabel baru — YAGNI).
 */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPgUser, dailyStreak } from "@/lib/puzzle-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date")?.trim();
  const todayUtc = new Date().toISOString().slice(0, 10);

  const date = dateParam || todayUtc;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return NextResponse.json({ error: "Format date harus YYYY-MM-DD.", retryable: false }, { status: 400 });
  }
  if (date > todayUtc) {
    return NextResponse.json({ error: "Tanggal belum tersedia.", retryable: false }, { status: 400 });
  }

  // Deterministik: hash tanggal -> offset stabil dalam band 1200-1800.
  const countRows = await query<{ c: string }>(
    "SELECT count(*)::text AS c FROM puzzles WHERE rating BETWEEN 1200 AND 1800",
  );
  const count = Number(countRows[0].c);
  if (count === 0) {
    return NextResponse.json({ error: "Belum tersedia — kembali besok.", retryable: false }, { status: 503 });
  }
  const h = createHash("sha256").update(`jev-daily:${date}`).digest();
  const offset = h.readUInt32BE(0) % count;
  const rows = await query(
    `SELECT id, title, fen, solution_moves, rating, themes
     FROM puzzles WHERE rating BETWEEN 1200 AND 1800
     ORDER BY id LIMIT 1 OFFSET $1`,
    [offset],
  );
  const row = rows[0] as Record<string, unknown>;
  const moves = row.solution_moves as unknown;

  // Solved hari X + streak harian (butuh login; anonim tetap dapat puzzle).
  const me = await currentPgUser(request);
  let solvedToday = false;
  let streakHarian = 0;
  if (me) {
    const solvedRows = await query<{ c: string }>(
      `SELECT count(*)::text AS c FROM puzzle_attempts
       WHERE user_id = $1 AND correct = true AND puzzle_id = $2::uuid
         AND (attempted_at AT TIME ZONE 'UTC')::date = $3::date`,
      [me.pgId, String(row.id), date],
    );
    solvedToday = Number(solvedRows[0].c) > 0;
    streakHarian = await dailyStreak(me.pgId);
  }

  return NextResponse.json({
    date,
    todayUtc,
    puzzle: {
      id: String(row.id), title: row.title, fen: row.fen,
      rating: Number(row.rating), themes: row.themes ?? [],
      moveCount: Array.isArray(moves) ? moves.length : 0,
    },
    solvedToday,
    streakHarian,
  });
}
