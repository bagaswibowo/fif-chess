import { Chess } from "chess.js";
import { playEngineMove } from "../lib/engines";
import { getLearnedMove } from "../lib/experience";
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOG_FILE = "/home/sxz/projects/active/jev-chess/benchmark_round.log";
function log(msg: string) {
  console.log(msg);
  try { appendFileSync(LOG_FILE, msg + "\n", "utf-8"); } catch {}
}

const DB_PATH = join(process.env.JEV_DATA_DIR || join(process.cwd(), "data"), "experience.json");
const dbSize = existsSync(DB_PATH) ? Object.keys(JSON.parse(readFileSync(DB_PATH, "utf-8"))).length : 0;

writeFileSync(LOG_FILE, "", "utf-8");
log("================================================================================");
log(` BENCHMARK TEST 1 RONDE (UPGRADED WITH GAB & GATEAU DUAL-FUSION)`);
log(` Database Experience Posisi: ${dbSize} entri`);
log("================================================================================\n");

async function playOneMatch(engineId: "jev" | "fly" | "jev-fly", sfLevel: number, engineColor: "white" | "black") {
  const chess = new Chess();
  const history: string[] = [];
  let experienceHits = 0;
  let totalEngineMoves = 0;

  log(`--- [MATCH START] ${engineId.toUpperCase()} (${engineColor.toUpperCase()}) vs Stockfish 19 (Lv.${sfLevel}) ---`);

  const whiteEngine = engineColor === "white" ? engineId : "stockfish";
  const blackEngine = engineColor === "black" ? engineId : "stockfish";

  let ply = 0;
  while (!chess.isGameOver() && ply < 80) {
    ply++;
    const turn = chess.turn();
    const current = turn === "w" ? whiteEngine : blackEngine;
    const isOurEngine = current === engineId;

    if (isOurEngine) {
      totalEngineMoves++;
      const learned = getLearnedMove(chess.fen());
      if (learned && (learned.dopamine ?? 0) >= 0 && (learned.score ?? 0) >= 0) {
        experienceHits++;
      }
    }

    try {
      const res = await playEngineMove(current as any, {
        fen: chess.fen(),
        depth: 10,
        simulations: 15,
        skillLevel: sfLevel,
        seed: Math.floor(Math.random() * 1000000),
        history: history.slice(-8),
      });

      if (!res?.uci) {
        log(`  Engine ${current} failed to provide move.`);
        break;
      }

      const applied = chess.move(res.san);
      if (!applied) {
        log(`  Illegal move attempted: ${res.san}`);
        break;
      }

      history.push(res.san);
      if (ply % 10 === 0 || isOurEngine && res.metadata?.source === "mbon-learned") {
        log(`  Ply ${ply}: ${current} played ${res.san} (Eval: ${res.scoreCp ?? 0}cp)${res.metadata?.source === "mbon-learned" ? " [🎯 EXPERIENCE HIT]" : ""}`);
      }
    } catch (err: any) {
      log(`  Error on ply ${ply} (${current}): ${err?.message}`);
      break;
    }
  }

  const isCheckmate = chess.isCheckmate();
  let winner: "white" | "black" | "draw" = "draw";
  if (isCheckmate) {
    winner = chess.turn() === "w" ? "black" : "white";
  }

  const engineWon = winner === engineColor;
  const isDraw = winner === "draw";

  log(`-> [RESULT] Winner: ${winner.toUpperCase()} (${isCheckmate ? "CHECKMATE" : "GAME OVER/DRAW"})`);
  log(`   Total Plies: ${history.length} (${Math.ceil(history.length / 2)} moves)`);
  log(`   Experience Hits: ${experienceHits}/${totalEngineMoves} langkah (${Math.round((experienceHits / Math.max(1, totalEngineMoves)) * 100)}% posisi training kepakai!)`);
  log(`   PGN Preview: ${history.slice(0, 8).join(" ")} ... ${history.slice(-6).join(" ")}\n`);

  return {
    engineId,
    engineColor,
    winner,
    engineWon,
    isDraw,
    plies: history.length,
    experienceHits,
    totalEngineMoves,
    pctUsed: Math.round((experienceHits / Math.max(1, totalEngineMoves)) * 100),
  };
}

async function main() {
  const sfLevel = 10; // Level 10 benchmark
  const results = [];

  // 1. JEV-FLY (Hybrid) vs Stockfish
  const resHybrid = await playOneMatch("jev-fly", sfLevel, "white");
  results.push(resHybrid);

  // 2. FLY vs Stockfish
  const resFly = await playOneMatch("fly", sfLevel, "white");
  results.push(resFly);

  // 3. JEV vs Stockfish
  const resJev = await playOneMatch("jev", sfLevel, "white");
  results.push(resJev);

  log("================================================================================");
  log(" RINGKASAN BENCHMARK 1 RONDE (SEMUA ENGINE vs STOCKFISH 19 Lv.10)");
  log("================================================================================");
  for (const r of results) {
    const outcomeStr = r.engineWon ? "🏆 MENANG" : r.isDraw ? "🤝 REMIS" : "❌ KALAH";
    log(`${r.engineId.toUpperCase().padEnd(8)}: ${outcomeStr} | Plies: ${r.plies} | Experience Terpakai: ${r.experienceHits}/${r.totalEngineMoves} (${r.pctUsed}%)`);
  }
}

main().catch(console.error);
