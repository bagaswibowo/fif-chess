/**
 * lib/puzzle-solve.ts (S3-T1..T4 frontend)
 * Logika murni solve mode puzzle DB (Sprint 3) — tanpa React, tanpa fetch.
 * Kontrak API: app/api/puzzles/* (docs/tickets/S3-T1..T4, docs/db/sprint3.md).
 */
import { Chess } from "chess.js";

export type PuzzleDto = {
  id: string;
  title: string;
  fen: string;
  rating: number;
  themes: string[];
  moveCount: number;
};

/** Sisi yang harus melangkah dari FEN — papan puzzle selalu orientasi sisi ini. */
export function sideToMove(fen: string): "white" | "black" {
  const turn = new Chess(fen).turn();
  return turn === "w" ? "white" : "black";
}

export type StepResult =
  | { ok: true; san: string; nextFen: string; isLast: boolean }
  | { ok: false; reason: "illegal" | "not-solution"; san?: string };

/**
 * Validasi satu langkah user (UCI) vs langkah solusi ke-i.
 * Legal secara aturan papan tapi bukan solusi → "not-solution" (shake, retry).
 * Ilegal penuh → "illegal" (papan menolak senyap — design §1.6).
 */
export function validateSolutionStep(
  fen: string,
  uci: string,
  solutionUci: string | undefined,
): StepResult {
  const chess = new Chess(fen);
  let move;
  try {
    move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
    });
  } catch {
    return { ok: false, reason: "illegal" };
  }
  if (uci !== solutionUci) {
    return { ok: false, reason: "not-solution", san: move.san };
  }
  return {
    ok: true,
    san: move.san,
    nextFen: chess.fen(),
    isLast: false, // diisi pemanggil dari index solusi
  };
}

/** Terapkan UCI lawan (auto-reply) ke FEN → FEN baru. */
export function applyUci(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
    });
    return chess.fen();
  } catch {
    return null;
  }
}

/** SAN dari UCI di posisi tertentu (untuk status panel). */
export function uciToSan(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
    }).san;
  } catch {
    return null;
  }
}

/** Timer mm:ss — HUD rush (design §3.3). Negatif di-clamp ke 00:00. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Key tanggal UTC YYYY-MM-DD (rotasi daily — semua key tanggal memakai UTC). */
export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "Kamis, 22 Okt 2026" dari key YYYY-MM-DD (label tanggal daily, UTC). */
export function formatDailyDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS_ID[dt.getUTCDay()]}, ${d} ${MONTHS_ID[m - 1]} ${y}`;
}

/** Format share daily: "Jev Chess Daily 22 Okt 2026: ✅ 1/1" (design §2.3). */
export function dailyShareText(dateKey: string, solved: boolean): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `Jev Chess Daily ${d} ${MONTHS_ID[m - 1]} ${new Date(
    Date.UTC(Number(dateKey.slice(0, 4)), m - 1, d),
  ).getUTCFullYear()}: ${solved ? "✅ 1/1" : "❌ 0/1"}`;
}
