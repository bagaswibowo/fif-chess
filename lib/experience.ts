import fs from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";

interface ExperienceEntry {
  bestMove?: string;
  score?: number;
  dopamine?: number;
  blunders?: string[];
  timesEncountered?: number;
}

const DB_PATH = path.join(process.env.JEV_DATA_DIR || path.join(process.cwd(), "data"), "experience.json");
let memCache: Record<string, ExperienceEntry> | null = null;

function loadDb(): Record<string, ExperienceEntry> {
  if (memCache) return memCache;
  try {
    if (fs.existsSync(DB_PATH)) {
      memCache = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      return memCache!;
    }
  } catch {}
  memCache = {};
  return memCache;
}

function saveDb(): void {
  if (!memCache) return;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(memCache, null, 2), "utf-8");
  } catch {}
}

/** Simplify FEN to board + turn + castling rights for transposition matching */
export function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return parts.slice(0, 4).join(" ");
}

export function getLearnedMove(fen: string): { move: string; score: number; dopamine: number } | null {
  const db = loadDb();
  const entry = db[normalizeFen(fen)];
  if (entry?.bestMove) {
    return { move: entry.bestMove, score: entry.score ?? 0, dopamine: entry.dopamine ?? 0 };
  }
  return null;
}

const START_FEN_NORMALIZED = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

export function isBlunderMove(fen: string, move: string): boolean {
  // Posisi awal catur tidak pernah memiliki blunder pada langkah ke-1
  if (normalizeFen(fen) === START_FEN_NORMALIZED) {
    return false;
  }

  const db = loadDb();
  const entry = db[normalizeFen(fen)];
  return Array.isArray(entry?.blunders) && entry.blunders.includes(move);
}

export function recordMatchExperience(
  fen: string,
  provenMove?: string,
  score?: number,
  blunderedMove?: string,
): void {
  try {
    const ch = new Chess(fen);
    const legal = new Set(ch.moves({ verbose: true }).map((m: any) => m.from + m.to + (m.promotion || "")));

    const db = loadDb();
    const key = normalizeFen(fen);
    const entry = db[key] || { timesEncountered: 0 };

    entry.timesEncountered = (entry.timesEncountered || 0) + 1;

    // Pastikan langkah yang disimpan memang legal untuk FEN ini
    if (provenMove && legal.has(provenMove)) {
      entry.bestMove = provenMove;
      if (typeof score === "number") entry.score = score;
    }

    if (blunderedMove && legal.has(blunderedMove) && blunderedMove !== entry.bestMove) {
      entry.blunders = Array.from(new Set([...(entry.blunders || []), blunderedMove]));
    }

    db[key] = entry;
    saveDb();
  } catch {
    // Ignore invalid FEN
  }
}

/**
 * PAM-DAN Mushroom Body Dopamine Reinforcement:
 * Ketika pertandingan selesai dengan kemenangan, lonjakan dopamin (+400 PAM) diberikan
 * ke seluruh rangkaian langkah yang membawa kemenangan, memperkuat plastisitas sinaptik.
 * Langkah pihak yang kalah dipotong dopaminnya (-300 PPL1) dan langkah terakhir dicatat sebagai blunder.
 */
export function reinforceMatchDopamine(history: string[], winningColor: "white" | "black"): void {
  if (!Array.isArray(history) || history.length === 0) return;
  try {
    const ch = new Chess();
    const winningMoves: { fen: string; uci: string }[] = [];
    const losingMoves: { fen: string; uci: string }[] = [];

    for (const moveStr of history) {
      const fenBefore = ch.fen();
      const turn = ch.turn() === "w" ? "white" : "black";
      let applied = null;
      try {
        applied = ch.move(moveStr);
      } catch {
        try {
          applied = ch.move({
            from: moveStr.slice(0, 2),
            to: moveStr.slice(2, 4),
            promotion: moveStr[4] || undefined,
          });
        } catch {}
      }
      if (!applied) break;

      const uci = applied.from + applied.to + (applied.promotion || "");
      if (turn === winningColor) {
        winningMoves.push({ fen: fenBefore, uci });
      } else {
        losingMoves.push({ fen: fenBefore, uci });
      }
    }

    const db = loadDb();

    // 1. Dopamine Surge (+400 PAM) untuk langkah pemenang
    for (const item of winningMoves) {
      const key = normalizeFen(item.fen);
      const entry = db[key] || { timesEncountered: 0 };
      entry.timesEncountered = (entry.timesEncountered || 0) + 1;
      entry.dopamine = Math.min(1000, (entry.dopamine || 0) + 400);
      entry.bestMove = item.uci;
      entry.score = Math.max(entry.score ?? 50, 100);
      db[key] = entry;
    }

    // 2. Aversive Depression (-300 PPL1) untuk rangkaian langkah kritis pihak yang kalah
    if (losingMoves.length > 0) {
      // Rekam hingga 6 langkah terakhir pihak yang kalah sebagai zona blunder kritis
      const recentLosing = losingMoves.slice(-6);
      for (const fatalMove of recentLosing) {
        const key = normalizeFen(fatalMove.fen);
        const entry = db[key] || { timesEncountered: 0 };
        entry.timesEncountered = (entry.timesEncountered || 0) + 1;
        entry.dopamine = Math.max(-1000, (entry.dopamine || 0) - 300);
        entry.blunders = Array.from(new Set([...(entry.blunders || []), fatalMove.uci]));
        db[key] = entry;
      }
    }

    saveDb();
  } catch {}
}
