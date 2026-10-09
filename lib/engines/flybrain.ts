import { Chess } from "chess.js";
import { applyUci, describeOutcome } from "@/lib/chess";
import { playSuperflyMove, playFlyBrainMove } from "@/lib/flybrain/service";
import { recordMatchExperience, getLearnedMove, isBlunderMove } from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";
import { fenEngineCache } from "./lru-cache";
import { mctsConcurrencyGate } from "./concurrency-gate";

export class PureSuperflyEngine implements IChessEngine {
  readonly id = "fly" as const;
  readonly name = "Superfly Connectome (PUCT MCTS)";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const cached = fenEngineCache.get(req.fen);
    if (cached) return cached;
    const baseSims = Math.max(10, req.simulations ?? 15);
    const sims = mctsConcurrencyGate.getAdaptiveSimulations(baseSims);

    // MBON Learned Recall: pakai hasil training (experience.json) di posisi yang
    // pernah dikunjungi. Mirip engines/jev.ts — sebelumnya engine fly HANYA menulis
    // DB, tidak pernah membaca, sehingga belajar dari training tidak memengaruhinya.
    const learned = getLearnedMove(req.fen);
    if (learned && !isBlunderMove(req.fen, learned.move) && (learned.dopamine ?? 0) > 0 && (learned.score ?? 0) >= 0) {
      const chL = new Chess(req.fen);
      const appL = applyUci(chL, learned.move);
      if (appL) {
        const prediction = await getStockfishPrediction(chL.fen());
        return {
          engine: this.id,
          uci: learned.move,
          san: appL.san,
          fen: chL.fen(),
          probabilities: { [learned.move]: 0.99 },
          confidence: 0.99,
          droppedMoveCount: 0,
          outcome: describeOutcome(chL),
          scoreCp: learned.score,
          prediction,
          metadata: { source: "mbon-learned", model: "superfly-pure" },
        };
      }
    }

    // 100% Pure Drosophila Connectome PUCT MCTS with Nature 2024 Circuits
    const flyRes = await mctsConcurrencyGate.run(async () => {
      return playSuperflyMove(req.fen, sims) || playFlyBrainMove(req.fen);
    });
    if (!flyRes) {
      throw new Error("Superfly engine failed to evaluate position.");
    }

    // Online background learning from Stockfish: saves superior moves to experience.json
    const prediction = await getStockfishPrediction(flyRes.fen, flyRes.uci);
    if (prediction && prediction.uci) {
      recordMatchExperience(flyRes.fen, prediction.uci, prediction.scoreCp ?? 0);
    }

    const response: EngineMoveResponse = {
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
    fenEngineCache.set(req.fen, response);
    return response;
  }
}

export const pureSuperflyEngine = new PureSuperflyEngine();
