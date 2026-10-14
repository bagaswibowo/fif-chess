import { Chess } from "chess.js";
import { playEngineMove } from "../lib/engines";
import { reinforceMatchDopamine } from "../lib/experience";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

try {
  process.loadEnvFile?.(join(process.cwd(), ".env"));
} catch {}

const DB_PATH = join(process.env.JEV_DATA_DIR || join(process.cwd(), "data"), "experience.json");
function getDbSize(): number {
  if (existsSync(DB_PATH)) {
    try {
      return Object.keys(JSON.parse(readFileSync(DB_PATH, "utf-8"))).length;
    } catch {}
  }
  return 0;
}

async function runEngineWorker(engineId: "jev" | "fly" | "jev-fly") {
  let matchIdx = 0;
  let currentSkillLevel = Number(process.env.INITIAL_SKILL_LEVEL ?? 3);
  let tierWins = 0;
  let tierLosses = 0;

  console.log(`[Worker:${engineId.toUpperCase()}] Ready. Opponent: Stockfish 19 (Depth 14, Lv.${currentSkillLevel}).`);

  while (true) {
    matchIdx++;
    const chess = new Chess();
    const myColor: "white" | "black" = matchIdx % 2 === 1 ? "white" : "black";
    const whiteEngine = myColor === "white" ? engineId : "stockfish";
    const blackEngine = myColor === "black" ? engineId : "stockfish";
    const history: string[] = [];

    console.log(`[${engineId.toUpperCase()} #${matchIdx} | SF Lv.${currentSkillLevel}] Playing ${myColor.toUpperCase()} vs Stockfish`);

    while (!chess.isGameOver()) {
      const turn = chess.turn();
      const current = turn === "w" ? whiteEngine : blackEngine;
      const fenBefore = chess.fen();

      try {
        const res = await playEngineMove(current as any, {
          fen: fenBefore,
          depth: 14,
          simulations: 25,
          skillLevel: currentSkillLevel,
          seed: Math.floor(Math.random() * 1000000),
          history: history.slice(-10),
        });

        if (!res?.uci) break;
        const applied = chess.move(res.san);
        if (!applied) break;
        history.push(res.san);
      } catch (err: any) {
        console.error(`  [${engineId.toUpperCase()} #${matchIdx}] Error on turn ${turn}:`, err?.message);
        break;
      }
    }

    const isCheckmate = chess.isCheckmate();
    let winner: "white" | "black" | "draw" = "draw";

    if (isCheckmate) {
      winner = chess.turn() === "w" ? "black" : "white";
    }

    console.log(`  -> [${engineId.toUpperCase()} #${matchIdx} RESULT] Winner = ${winner.toUpperCase()} (${isCheckmate ? "CHECKMATE" : "DRAW"}), Plies: ${history.length}, DB: ${getDbSize()}`);

    if (winner !== "draw") {
      reinforceMatchDopamine(history, winner);
    }

    if (winner === myColor) {
      tierWins++;
      tierLosses = 0;
      if (tierWins >= 2 && currentSkillLevel < 20) {
        currentSkillLevel++;
        tierWins = 0;
        console.log(`\n>>> [${engineId.toUpperCase()} PROMOTION] Advanced to Skill Level ${currentSkillLevel}! <<<\n`);
      }
    } else if (winner !== "draw") {
      tierLosses++;
      if (tierLosses >= 6 && currentSkillLevel > 1) {
        currentSkillLevel--;
        tierLosses = 0;
        tierWins = 0;
        console.log(`\n>>> [${engineId.toUpperCase()} STABILIZE] Re-calibrating to Skill Level ${currentSkillLevel} <<<\n`);
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main() {
  console.log("=============================================================");
  console.log("  PARALLEL TRI-ENGINE TRAINING: JEV, FLY, JEV-FLY SIMULTANEOUS");
  console.log("  Opponent: Stockfish 19 (Depth 14, Adaptive Skill Level)");
  console.log(`  Current Database Size: ${getDbSize()} positions`);
  console.log("=============================================================\n");

  await Promise.all([
    runEngineWorker("jev"),
    runEngineWorker("fly"),
    runEngineWorker("jev-fly"),
  ]);
}

main().catch(console.error);
