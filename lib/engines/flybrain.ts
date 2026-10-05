import { Chess } from "chess.js";
import { applyUci, describeOutcome } from "@/lib/chess";
import { playSuperflyMove, playFlyBrainMove } from "@/lib/flybrain/service";
import { recordMatchExperience } from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";

export class PureSuperflyEngine implements IChessEngine {
  readonly id = "fly" as const;
  readonly name = "Superfly Connectome (PUCT MCTS)";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const sims = Math.max(12, req.simulations ?? 15);
    // 100% Pure Drosophila Connectome PUCT MCTS with Nature 2024 Circuits
    const flyRes = playSuperflyMove(req.fen, sims) || playFlyBrainMove(req.fen);
    if (!flyRes) {
      throw new Error("Superfly engine failed to evaluate position.");
    }

    // Online background learning from Stockfish: saves superior moves to experience.json
    const prediction = await getStockfishPrediction(flyRes.fen, flyRes.uci);
    if (prediction && prediction.uci) {
      recordMatchExperience(flyRes.fen, prediction.uci, prediction.scoreCp ?? 0);
    }

    return {
      engine: this.id,
      uci: flyRes.uci,
      san: flyRes.san,
      fen: flyRes.fen,
      probabilities: flyRes.probabilities,
      confidence: flyRes.confidence,
      droppedMoveCount: flyRes.droppedMoveCount,
      outcome: flyRes.outcome,
      scoreCp: flyRes.scoreCp,
      prediction,
      metadata: {
        diagnostics: flyRes.diagnostics,
        simulations: sims,
      },
    };
  }
}

export const pureSuperflyEngine = new PureSuperflyEngine();
