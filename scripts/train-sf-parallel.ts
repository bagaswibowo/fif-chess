import { Chess } from "chess.js";
import { playStockfishMove } from "../lib/stockfish";
import { normalizeFen } from "../lib/experience";
import { calculateMaterialCp } from "../lib/chess";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface MatchResult {
  match: number;
  white: string;
  black: string;
  moves: string[];
  winner: "white" | "black" | "draw";
  plyCount: number;
  reason: string;
  queenPromotions: number;
  checkmates: number;
}

const DB_PATH = join(process.env.JEV_DATA_DIR || join(process.cwd(), "data"), "experience.json");

function getDb(): Record<string, any> {
  if (existsSync(DB_PATH)) {
    try {
      return JSON.parse(readFileSync(DB_PATH, "utf-8"));
    } catch {}
  }
  return {};
}

function saveDb(db: Record<string, any>): void {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

async function playOneMatch(matchIndex: number): Promise<MatchResult> {
  const chess = new Chess();
  const history: string[] = [];
  const uciHistory: string[] = [];
  let moveCount = 0;
  const maxMoves = 45; // 90 plies cap
  let earlyWinner: "white" | "black" | null = null;
  let adjudicationReason = "";
  let queenPromotions = 0;
  let checkmates = 0;

  console.log(`[Batch] Starting Match #${matchIndex} (Stockfish 15 NNUE vs Stockfish 15 NNUE)`);

  while (!chess.isGameOver() && moveCount < maxMoves) {
    const turn = chess.turn();
    const fenBefore = chess.fen();

    try {
      // Stockfish depth 14 calculation
      const res = await playStockfishMove(fenBefore, 14);
      if (!res?.uci) break;

      const applied = chess.move(res.san);
      if (!applied) break;

      history.push(res.san);
      uciHistory.push(res.uci);
      if (turn === "b") moveCount++;

      if (res.san.includes("=Q") || res.uci.endsWith("q")) {
        queenPromotions++;
      }

      // Adjudication materi >= 900
      const mat = calculateMaterialCp(chess.fen());
      if (mat >= 900 && moveCount >= 10) {
        earlyWinner = "white";
        adjudicationReason = "material_adjudication (+900 White)";
        break;
      } else if (mat <= -900 && moveCount >= 10) {
        earlyWinner = "black";
        adjudicationReason = "material_adjudication (-900 Black)";
        break;
      }
    } catch (err: any) {
      console.error(`Match #${matchIndex} error:`, err?.message);
      break;
    }
  }

  let winner: "white" | "black" | "draw" = "draw";
  let reason = "draw";

  if (earlyWinner) {
    winner = earlyWinner;
    reason = adjudicationReason;
  } else if (chess.isCheckmate()) {
    winner = chess.turn() === "w" ? "black" : "white";
    reason = "checkmate";
    checkmates++;
  } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    winner = "draw";
    reason = chess.isStalemate() ? "stalemate" : chess.isThreefoldRepetition() ? "threefold_repetition" : "draw";
  } else if (moveCount >= maxMoves) {
    reason = "move_cap_reached";
  }

  console.log(`[Batch] Match #${matchIndex} Finished: Winner = ${winner.toUpperCase()} (${reason}), Plies: ${history.length}, QueenPromos: ${queenPromotions}`);

  // Biologis: Lonjakan Dopamin & Hukuman Aversif (PAM-DAN / PPL1 MBON)
  const db = getDb();
  const replayChess = new Chess();

  for (let idx = 0; idx < history.length; idx++) {
    const fen = normalizeFen(replayChess.fen());
    const mSan = history[idx];
    const mUci = uciHistory[idx];
    const side = replayChess.turn() === "w" ? "white" : "black";
    replayChess.move(mSan);

    const entry = db[fen] || { timesEncountered: 0 };
    entry.timesEncountered = (entry.timesEncountered || 0) + 1;
    entry.bestMove = mUci;

    let dopamineBonus = 350; // Base dopamine dari langkah Stockfish GM

    // Reward: Skakmat langsung (+1000 PAM)
    if (mSan.includes("#")) {
      dopamineBonus = 1000;
    }
    // Reward: Promosi menjadi Menteri (+800 PAM)
    else if (mSan.includes("=Q") || mUci.endsWith("q")) {
      dopamineBonus = 800;
    }
    // Reward: Taktik pemukulan perwira lawan (+500 PAM)
    else if (mSan.includes("x")) {
      dopamineBonus = 500;
    }

    if (winner === side) {
      entry.dopamine = Math.min(1000, (entry.dopamine || 0) + dopamineBonus);
      entry.score = Math.max(entry.score ?? 50, 150);
    } else if (winner !== "draw" && idx >= history.length - 6) {
      // Hukuman Aversif: Sisi yang kalah dihukum aversive depression (-600 PPL1)
      entry.dopamine = Math.max(-1000, (entry.dopamine || 0) - 600);
      entry.blunders = Array.from(new Set([...(entry.blunders || []), mUci]));
    }

    db[fen] = entry;
  }

  saveDb(db);

  return {
    match: matchIndex,
    white: "stockfish",
    black: "stockfish",
    moves: history,
    winner,
    plyCount: history.length,
    reason,
    queenPromotions,
    checkmates,
  };
}

async function main() {
  console.log("=============================================================");
  console.log("  PARALLEL TRAINING: 20 MATCHES (Stockfish 15 NNUE vs Stockfish 15)");
  console.log("  Concurrency: 5 games simultaneous per batch");
  console.log("  Drosophila Learning: Dopamine Surge (+PAM) & Aversive Shock (-PPL1)");
  console.log("=============================================================");

  const totalMatches = 20;
  const batchSize = 5;
  const allResults: MatchResult[] = [];

  for (let b = 0; b < totalMatches; b += batchSize) {
    const currentBatch = [];
    for (let i = 1; i <= batchSize; i++) {
      const matchNum = b + i;
      if (matchNum <= totalMatches) {
        currentBatch.push(playOneMatch(matchNum));
      }
    }
    console.log(`\n>>> Launching Batch ${b / batchSize + 1}: Matches ${b + 1} to ${Math.min(b + batchSize, totalMatches)} in parallel...`);
    const batchRes = await Promise.all(currentBatch);
    allResults.push(...batchRes);
  }

  const outDir = join(process.cwd(), "data");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "training-sf20-parallel.json");
  writeFileSync(outPath, JSON.stringify(allResults, null, 2), "utf-8");

  const db = getDb();
  console.log("\n=============================================================");
  console.log(`  ALL ${totalMatches} MATCHES COMPLETED & DISTILLED!`);
  console.log(`  Total Experience Memory Positions: ${Object.keys(db).length}`);
  console.log(`  Batch Results Saved: ${outPath}`);
  console.log("=============================================================");
}

main().catch((err) => {
  console.error("Training execution failed:", err);
  process.exit(1);
});
