import fs from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";

interface ExperienceEntry {
  bestMove?: string;
  score?: number;
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

export function getLearnedMove(fen: string): { move: string; score: number } | null {
  const db = loadDb();
  const entry = db[normalizeFen(fen)];
  if (entry?.bestMove) {
    return { move: entry.bestMove, score: entry.score ?? 0 };
  }
  return null;
}

export function isBlunderMove(fen: string, move: string): boolean {
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
