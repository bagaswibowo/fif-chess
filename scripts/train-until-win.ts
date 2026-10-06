import { Chess } from "chess.js";
import { playEngineMove } from "../lib/engines";
import { recordMatchExperience, reinforceMatchDopamine } from "../lib/experience";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = join(process.env.JEV_DATA_DIR || join(process.cwd(), "data"), "experience.json");

function getDbSize(): number {
  if (existsSync(DB_PATH)) {
    try {
      const db = JSON.parse(readFileSync(DB_PATH, "utf-8"));
      return Object.keys(db).length;
    } catch {}
  }
  return 0;
}

async function runTrainingUntilWin() {
  console.log("=============================================================");
  console.log("  AUTONOMOUS TRAINING: JEV + FLYBRAIN VS STOCKFISH");
  console.log("  Target: Loop continuously until JEV+FLY delivers CHECKMATE to Stockfish!");
  console.log("  Self-improvement: Reinforcing wins, punishing blunders via experience.json");
  console.log(`  Initial Experience DB Size: ${getDbSize()} positions`);
  console.log("=============================================================\n");

  let matchIndex = 0;
  let wonCheckmate = false;

  while (!wonCheckmate) {
    matchIndex++;
    const chess = new Chess();
    // Ganti warna: Match ganjil Jev White, Match genap Jev Black
    const jfColor: "white" | "black" = matchIndex % 2 === 1 ? "white" : "black";
    const whiteEngine = jfColor === "white" ? "jev-fly" : "stockfish";
    const blackEngine = jfColor === "black" ? "jev-fly" : "stockfish";

    console.log(`[Match #${matchIndex}] Jev+FlyBrain (${jfColor.toUpperCase()}) vs Stockfish (${jfColor === "white" ? "BLACK" : "WHITE"})`);

    const history: string[] = [];

    // Unlimited plies: game continues until natural FIDE game over (checkmate / draw)
    while (!chess.isGameOver()) {
      const turn = chess.turn();
      const currentEngine = turn === "w" ? whiteEngine : blackEngine;
      const fenBefore = chess.fen();

      try {
        const res = await playEngineMove(currentEngine as any, {
          fen: fenBefore,
          depth: 10,
          simulations: 15,
          history,
        });

        if (!res?.uci) break;

        // Otomatis serap langkah Stockfish ke memori experience agar Jev+FlyBrain semakin pintar
        if (currentEngine === "stockfish") {
          recordMatchExperience(fenBefore, res.uci, 120);
        }

        const applied = chess.move(res.san);
        if (!applied) break;

        history.push(res.san);
      } catch (err: any) {
        console.error(`  Error in Match #${matchIndex} on turn ${turn}:`, err?.message);
        break;
      }
    }

    let winner: "white" | "black" | "draw" = "draw";
    let isCheckmate = false;

    if (chess.isCheckmate()) {
      winner = chess.turn() === "w" ? "black" : "white";
      isCheckmate = true;
    } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
      winner = "draw";
    }

    console.log(`  -> Match #${matchIndex} Result: Winner = ${winner.toUpperCase()} (${isCheckmate ? "CHECKMATE" : "DRAW"}), Plies: ${history.length}, DB Size: ${getDbSize()}`);

    // Update Dopamine & Aversive Learning langsung ke experience.json
    if (winner !== "draw") {
      reinforceMatchDopamine(history, winner);
    }

    // Evaluasi Syarat Berhenti: Jev + FlyBrain menang telak dengan checkmate!
    if (winner === jfColor && isCheckmate) {
      wonCheckmate = true;
      console.log("\n=============================================================");
      console.log(`  VICTORY ACHIEVED! JEV + FLYBRAIN CHECKMATED STOCKFISH!`);
      console.log(`  Total Matches Played: ${matchIndex}`);
      console.log(`  Final Experience Database: ${getDbSize()} positions`);
      console.log(`  Winning Game Moves (${history.length} plies): ${history.join(" ")}`);
      console.log("=============================================================\n");
      break;
    }

    // Jeda 500ms antar-game agar sistem bernafas
    await new Promise((r) => setTimeout(r, 500));
  }
}

runTrainingUntilWin().catch((err) => {
  console.error("Training loop fatal error:", err);
  process.exit(1);
});
