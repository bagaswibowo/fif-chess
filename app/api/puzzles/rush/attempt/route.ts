/**
 * app/api/puzzles/rush/attempt/route.ts (S3-T3)
 * POST { sessionId, puzzle_id, correct, time_spent_sec }.
 * Strike & skor dihitung server-side; 3 strike / timer habis -> gameOver.
 * Skor = jumlah benar (YAGNI: tanpa bonus waktu). Sesi di Redis TTL 15 menit.
 * Rekor: users.rush_best diupdate bila skor baru lebih tinggi.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";
import { deleteSession, getSession, isExpired, saveSession } from "@/lib/puzzle-rush";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const sessionId = String(body.sessionId ?? "");
  const puzzleId = String(body.puzzle_id ?? "");
  const correct = body.correct === true;
  const timeSpent = Number(body.time_spent_sec);
  if (!sessionId || !puzzleId || !Number.isFinite(timeSpent) || timeSpent < 0 || timeSpent > 3600) {
    return NextResponse.json({ error: "sessionId, puzzle_id, time_spent_sec wajib valid.", retryable: false }, { status: 400 });
  }

  const s = await getSession(sessionId);
  if (!s) {
    return NextResponse.json({ error: "Sesi tidak ditemukan atau kedaluwarsa.", retryable: false }, { status: 404 });
  }
  if (s.userId !== me.pgId) {
    return NextResponse.json({ error: "Bukan sesi Anda.", retryable: false }, { status: 403 });
  }

  // Catat attempt ke puzzle_attempts agar ikut stats/rekap user (acceptance S3-T3).
  await query(
    "INSERT INTO puzzle_attempts (user_id, puzzle_id, correct, time_spent_sec) VALUES ($1::uuid, $2::uuid, $3, $4)",
    [me.pgId, puzzleId, correct, Math.round(timeSpent)],
  );

  if (correct) {
    s.score += 1;
    s.rating = Math.min(2200, s.rating + 75);
  } else {
    s.strikes += 1;
    s.rating = Math.max(800, s.rating - 50);
  }
  s.puzzleIds.push(puzzleId);

  const gameOver = s.strikes >= 3 || isExpired(s);

  let newRecord = false;
  if (gameOver) {
    const upd = await query(
      `UPDATE users SET rush_best = $2, rush_best_at = NOW()
       WHERE id = $1::uuid AND $2 > rush_best
       RETURNING rush_best`,
      [me.pgId, s.score],
    );
    newRecord = upd.length > 0;
    await deleteSession(sessionId);
  } else {
    await saveSession(sessionId, s);
  }

  return NextResponse.json({
    strikes: s.strikes, score: s.score, gameOver, newRecord,
    nextRating: s.rating, puzzleIdsShown: s.puzzleIds.length,
  });
}
