/**
 * app/api/practice/weekly/route.ts (S7-T3, ADR-010 D4)
 * GET /api/practice/weekly → WeeklyTargetResponse.
 *
 * target = konstanta server (WEEKLY_TARGET=20) — TIDAK dihitung client
 * (no-mock, eksplisit di kontrak). actuals = riil dari `puzzle_attempts`
 * window 7 hari SQL-side (docs/db/sprint7.md §3 query + EXPLAIN).
 * Auth FIX-1: 401 / 403 account_pending / 503 service_unavailable.
 *
 * [NO-NEW-TABLE]: tidak ada kolom users.weekly_puzzle_target; target
 * konstan di route, aktual di-derive dari tabel riil.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

/** Konstanta server (kontrak D4): jumlah puzzle benar unik/minggu. */
const WEEKLY_TARGET = 20;
const WINDOW_DAYS = 7;

export interface WeeklyTargetResponse {
  windowDays: number;
  target: number;
  attempted: number; // count(attempt) window 7 hari
  correct: number; // count(DISTINCT puzzle_id) attempt benar window 7 hari
  onTrack: boolean; // correct >= target
}

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;

  // docs/db/sprint7.md §3 — query + EXPLAIN verified live.
  let rows: { attempted: string; correct: string }[];
  try {
    rows = await query<{ attempted: string; correct: string }>(
      `SELECT count(*)::text AS attempted,
              count(DISTINCT puzzle_id) FILTER (WHERE a.correct) AS correct
       FROM puzzle_attempts a
       WHERE a.user_id = $1::uuid
         AND a.attempted_at >= now() - interval '7 days'`,
      [me.pgId],
    );
  } catch (err) {
    console.error("[practice/weekly] DB gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }
  const attempted = Number(rows[0]?.attempted ?? 0);
  const correct = Number(rows[0]?.correct ?? 0);

  const response: WeeklyTargetResponse = {
    windowDays: WINDOW_DAYS,
    target: WEEKLY_TARGET,
    attempted,
    correct,
    onTrack: correct >= WEEKLY_TARGET,
  };
  return NextResponse.json(response);
}
