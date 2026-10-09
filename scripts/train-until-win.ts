import { Chess } from "chess.js";
import { playEngineMove } from "../lib/engines";
import { recordMatchExperience, reinforceMatchDopamine } from "../lib/experience";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ROOT-CAUSE FIX: the live app runs with TYPESAFE_API_KEY set (via docker-compose
// .env), but this loop was historically launched WITHOUT it, so the hybrid engine's
// entire Jev-LLM layer (hybrid.ts `if (key)`) was skipped and only the Superfly MCTS
// fallback trained. That is why live play (full hybrid) diverged from training results.
// Loading .env here makes training use the SAME secret as live. Existing env vars
// (a launcher-provided key) take precedence, so this never overrides the container.
try {
  process.loadEnvFile?.(join(process.cwd(), ".env"));
} catch {}
// ponytail: loadEnvFile does not overwrite existing vars, so a launcher-supplied
// key still wins; if a future launcher needs to FORCE a different key, export it
// before the call (env precedence handles it) — no code change needed.

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
  console.log("  AUTONOMOUS TRAINING: JEV + FLY + JEV-FLY (all 3 bio engines)");
  console.log("  Opponent: Stockfish (benchmark, never trained)");
  console.log("  Rotation: jev ↔ fly ↔ jev-fly vs SF, per-match alternation");
  console.log("  Self-improvement: Reinforcing wins, punishing blunders via experience.json");
  console.log(`  Initial Experience DB Size: ${getDbSize()} positions`);
  console.log("=============================================================\n");

  let matchIndex = 0;
  let wonCheckmate = false;

  const ROTATION = ["jev", "fly", "jev-fly"] as const;
  const OPPONENT = "stockfish" as const; // Stockfish is the benchmark, never trained

  while (!wonCheckmate) {
    matchIndex++;
    const chess = new Chess();
    const myColor: "white" | "black" = matchIndex % 2 === 1 ? "white" : "black";
    // Fokus latihan: Pure FlyBrain MCTS (terbukti mampu menahan remis 116 plies)
    const whiteEngine = myColor === "white" ? "fly" : OPPONENT;
    const blackEngine = myColor === "black" ? "fly" : OPPONENT;

    console.log(`[Match #${matchIndex}] Jev+FlyBrain (${myColor.toUpperCase()}) vs Stockfish (${myColor === "white" ? "BLACK" : "WHITE"})`);

    const history: string[] = [];

    // Unlimited plies: game continues until natural FIDE game over (checkmate / draw)
    while (!chess.isGameOver()) {
      const turn = chess.turn();
      const currentEngine = turn === "w" ? whiteEngine : blackEngine;
      const fenBefore = chess.fen();

      try {
        // PARAM PERSIS LIVE (components/game.tsx -> /api/engine-move):
        // seed:0 + history slice(-10) + depth:14. seed & history masuk prompt Jev
        // (buildJevRequest), jadi harus sama agar hasil training == live.
        const res = await playEngineMove(currentEngine as any, {
          fen: fenBefore,
          depth: 14,
          simulations: 15,
          seed: 0,
          history: history.slice(-10),
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
    if (winner === myColor && isCheckmate) {
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
