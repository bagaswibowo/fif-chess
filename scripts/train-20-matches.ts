import { Chess } from "chess.js";
import { playEngineMove } from "../lib/engines";
import { reinforceMatchDopamine, recordMatchExperience } from "../lib/experience";
import { calculateMaterialCp } from "../lib/chess";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface MatchResult {
  match: number;
  white: string;
  black: string;
  moves: string[];
  winner: "white" | "black" | "draw";
  plyCount: number;
  reason: string;
}

async function playOneMatch(matchIndex: number, jfColor: "white" | "black"): Promise<MatchResult> {
  const chess = new Chess();
  const history: string[] = [];
  const whiteEngine = jfColor === "white" ? "jev-fly" : "stockfish";
  const blackEngine = jfColor === "black" ? "jev-fly" : "stockfish";

  console.log(`\n--- Match ${matchIndex}/20: White [${whiteEngine}] vs Black [${blackEngine}] ---`);

  let moveCount = 0;
  const maxMoves = 40; // 80 plies cap
  let earlyWinner: "white" | "black" | null = null;
  let adjudicationReason = "";

  while (!chess.isGameOver() && moveCount < maxMoves) {
    const turn = chess.turn();
    const currentEngine = turn === "w" ? whiteEngine : blackEngine;
    const fenBefore = chess.fen();

    try {
      const res = await playEngineMove(currentEngine as any, {
        fen: fenBefore,
        depth: 14,
        simulations: 10,
        history,
      });

      // Distill Stockfish moves into experience memory directly
      if (currentEngine === "stockfish") {
        recordMatchExperience(fenBefore, res.uci, 100);
      }

      const applied = chess.move(res.san);
      if (!applied) break;

      history.push(res.san);
      if (turn === "b") moveCount++;

      // Print move compactly
      if (turn === "w") {
        process.stdout.write(`${moveCount + 1}. ${res.san} `);
      } else {
        process.stdout.write(`${res.san} `);
        if ((moveCount % 6) === 0) process.stdout.write("\n");
      }

      // Adjudication: jika keunggulan materi >= 900 (Menteri hilang)
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
      console.error(`Error during move by ${currentEngine}:`, err?.message);
      break;
    }
  }

  process.stdout.write("\n");

  let winner: "white" | "black" | "draw" = "draw";
  let reason = "draw";

  if (earlyWinner) {
    winner = earlyWinner;
    reason = adjudicationReason;
  } else if (chess.isCheckmate()) {
    winner = chess.turn() === "w" ? "black" : "white";
    reason = "checkmate";
  } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    winner = "draw";
    reason = chess.isStalemate() ? "stalemate" : chess.isThreefoldRepetition() ? "threefold_repetition" : "draw";
  } else if (moveCount >= maxMoves) {
    reason = "move_cap_reached";
  }

  console.log(`Match ${matchIndex} Done: Winner = ${winner.toUpperCase()} (${reason}), Plies: ${history.length}`);

  // Synaptic Reinforcement & Blunder Registration
  if (winner === "white" || winner === "black") {
    reinforceMatchDopamine(history, winner);
  }

  return {
    match: matchIndex,
    white: whiteEngine,
    black: blackEngine,
    moves: history,
    winner,
    plyCount: history.length,
    reason,
  };
}

async function main() {
  console.log("=============================================================");
  console.log("  TRAINING RUN: 20 MATCHES (Stockfish Depth 14 vs Jev+Fly)");
  console.log("  Online Distillation: Stockfish GM moves recorded to memory");
  console.log("=============================================================");

  const results: MatchResult[] = [];
  const totalMatches = 20;

  for (let i = 1; i <= totalMatches; i++) {
    const jfColor = i % 2 === 1 ? "white" : "black";
    const res = await playOneMatch(i, jfColor);
    results.push(res);
  }

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "training-20-matches.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");

  console.log("\n=============================================================");
  console.log(`  ALL 20 MATCHES COMPLETED & SAVED TO ${outPath}`);
  console.log("=============================================================");
}

main().catch((err) => {
  console.error("Training failed:", err);
  process.exit(1);
});
