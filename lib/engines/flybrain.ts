import { Chess } from "chess.js";
import { applyUci, describeOutcome } from "@/lib/chess";
import { playSuperflyMove, playFlyBrainMove } from "@/lib/flybrain/service";
import { recordMatchExperience, getLearnedMove, isBlunderMove } from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";
import { fenEngineCache } from "./lru-cache";
import { tacticalGatekeeper } from "./tactical-gatekeeper";
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
      const safeCheck = await tacticalGatekeeper(req.fen, learned.move);
      const finalUci = safeCheck.vetoed ? safeCheck.uci : learned.move;
      const chL = new Chess(req.fen);
      const appL = applyUci(chL, finalUci);
      if (appL) {
        const prediction = await getStockfishPrediction(chL.fen(), finalUci);
        return {
          engine: this.id,
          uci: finalUci,
          san: appL.san,
          fen: chL.fen(),
          probabilities: { [finalUci]: 0.99 },
          confidence: 0.99,
          droppedMoveCount: 0,
          outcome: describeOutcome(chL),
          scoreCp: learned.score,
          prediction,
          metadata: { source: safeCheck.vetoed ? "tactical-override" : "mbon-learned", model: "superfly-pure" },
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

    // Tactical gatekeeper & quiescence evaluation blunder check
    const gateResult = await tacticalGatekeeper(req.fen, flyRes.uci, {
      probabilities: flyRes.probabilities,
    });
    let finalUci = flyRes.uci;
    let finalSan = flyRes.san;
    let finalFen = flyRes.fen;
    let finalOutcome = flyRes.outcome;

    if (gateResult.vetoed && gateResult.uci !== flyRes.uci) {
      const chNew = new Chess(req.fen);
      const appNew = applyUci(chNew, gateResult.uci);
      if (appNew) {
        finalUci = gateResult.uci;
        finalSan = appNew.san;
        finalFen = chNew.fen();
        finalOutcome = describeOutcome(chNew);
        recordMatchExperience(req.fen, gateResult.uci, 50, flyRes.uci);
      }
    }

    // Online background learning from Stockfish: saves superior moves to experience.json
    const prediction = await getStockfishPrediction(finalFen, finalUci);
    if (prediction && prediction.uci) {
      recordMatchExperience(finalFen, prediction.uci, prediction.scoreCp ?? 0);
    }

    const response: EngineMoveResponse = {
      engine: this.id,
      uci: finalUci,
      san: finalSan,
      fen: finalFen,
      probabilities: gateResult.vetoed ? { [finalUci]: 1.0 } : flyRes.probabilities,
      confidence: gateResult.vetoed ? 0.95 : flyRes.confidence,
      droppedMoveCount: flyRes.droppedMoveCount,
      outcome: finalOutcome,
      scoreCp: flyRes.scoreCp,
      prediction,
      metadata: {
        diagnostics: flyRes.diagnostics,
        simulations: sims,
        tacticalGateVetoed: gateResult.vetoed,
        tacticalGateReason: gateResult.reason,
        quiescenceScore: gateResult.quiescenceScore,
      },
    };
    fenEngineCache.set(req.fen, response);
    return response;
  }
}

export const pureSuperflyEngine = new PureSuperflyEngine();
