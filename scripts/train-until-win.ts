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
  let currentSkillLevel = Number(process.env.INITIAL_SKILL_LEVEL ?? 3); // Curriculum Tier start: Level 3
  let bioWinsAtTier = 0;

  const ROTATION = ["jev", "fly", "jev-fly"] as const;
  const OPPONENT = "stockfish" as const; // Stockfish is the benchmark, never trained

  while (!wonCheckmate) {
    matchIndex++;
    const chess = new Chess();
    const myColor: "white" | "black" = matchIndex % 2 === 1 ? "white" : "black";
    const currentBio = ROTATION[(matchIndex - 1) % ROTATION.length];
    const whiteEngine = myColor === "white" ? currentBio : OPPONENT;
    const blackEngine = myColor === "black" ? currentBio : OPPONENT;

    console.log(`[Match #${matchIndex} | SF Skill Lv.${currentSkillLevel}] ${currentBio.toUpperCase()} (${myColor.toUpperCase()}) vs Stockfish (${myColor === "white" ? "BLACK" : "WHITE"})`);

    const history: string[] = [];

    // Unlimited plies: game continues until natural FIDE game over (checkmate / draw)
    while (!chess.isGameOver()) {
      const turn = chess.turn();
      const currentEngine = turn === "w" ? whiteEngine : blackEngine;
      const fenBefore = chess.fen();

      try {
        const res = await playEngineMove(currentEngine as any, {
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

    // Update Dopamine hanya jika bio engine menang (atau hukum blunder jika kalah)
    if (winner !== "draw") {
      reinforceMatchDopamine(history, winner);
    }

    if (winner === myColor) {
      bioWinsAtTier++;
      if (bioWinsAtTier >= 2 && currentSkillLevel < 20) {
        currentSkillLevel++;
        bioWinsAtTier = 0;
        console.log(`\n>>> [CURRICULUM LEVEL UP] Bio-Engine reached Tier Skill Level ${currentSkillLevel}! <<\n`);
      }
    }

    // Evaluasi Syarat Berhenti: Bio-engine menang telak dengan checkmate!
    if (winner === myColor && isCheckmate && currentSkillLevel >= 10) {
      wonCheckmate = true;
      console.log("\n=============================================================");
      console.log(`  VICTORY ACHIEVED! ${currentBio.toUpperCase()} CHECKMATED STOCKFISH!`);
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
