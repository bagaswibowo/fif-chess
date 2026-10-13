import { Chess } from "chess.js";
import { applyUci, describeOutcome } from "@/lib/chess";
import {
  buildJevRequest,
  resolveJevChoice,
  mapHttpError,
  JevRequestError,
  TYPESAFE_ENDPOINT,
} from "@/lib/jev";
import { playSuperflyMove, playFlyBrainMove, isPredationTrap } from "@/lib/flybrain/service";
import { getLearnedMove, isBlunderMove, recordMatchExperience, reinforceMatchDopamine } from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
import { tacticalGatekeeper } from "./tactical-gatekeeper";
import { evalSingleMove, playStockfishMove } from "../stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";

export class PureJevEngine implements IChessEngine {
  readonly id = "jev" as const;
  readonly name = "Jev AI Connectome (Pure)";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const chStart = new Chess(req.fen);

    // 0. Killer Instinct (Insting Pembunuh - Eksekusi Skakmat Mutlak):
    // Jika ada langkah legal yang langsung SKAKMAT lawan di giliran ini, EKSEKUSI SEGERA 100%!
    const legalMoves = chStart.moves({ verbose: true });
    for (const lm of legalMoves) {
      const cMate = new Chess(req.fen);
      const appMate = cMate.move(lm);
      if (appMate && cMate.isCheckmate()) {
        const mateUci = lm.from + lm.to + (lm.promotion || "");
        return {
          engine: this.id,
          uci: mateUci,
          san: appMate.san,
          fen: cMate.fen(),
          probabilities: { [mateUci]: 1.0 },
          confidence: 1.0,
          droppedMoveCount: 0,
          outcome: describeOutcome(cMate),
          scoreCp: 30000,
          metadata: { source: "instant-checkmate", model: "jev-latest" },
        };
      }
    }

    const key = req.apiKey || process.env.TYPESAFE_API_KEY;

    // 1. Nature 2024 MBON Learned Recall: Ingat langkah terbaik jika sudah pernah dipelajari
    const learned = getLearnedMove(req.fen);
    if (learned && !isBlunderMove(req.fen, learned.move) && (learned.dopamine ?? 0) > 0 && (learned.score ?? 0) >= 0) {
      const safeCheck = await tacticalGatekeeper(req.fen, learned.move);
      const finalUci = safeCheck.vetoed ? safeCheck.uci : learned.move;
      const chL = new Chess(req.fen);
      const appL = applyUci(chL, finalUci);
      if (appL) {
        const nextFenL = chL.fen();
        const prediction = await getStockfishPrediction(nextFenL, finalUci);
        return {
          engine: this.id,
          uci: finalUci,
          san: appL.san,
          fen: nextFenL,
          probabilities: { [finalUci]: 0.99 },
          confidence: 0.99,
          droppedMoveCount: 0,
          outcome: describeOutcome(chL),
          scoreCp: learned.score,
          prediction,
          metadata: { source: safeCheck.vetoed ? "tactical-override" : "mbon-learned", model: "jev-latest" },
        };
      }
    }

    if (!key) {
      // Fallback: use Superfly connectome MCTS
      const fb = playSuperflyMove(req.fen, 40) || playFlyBrainMove(req.fen);
      if (fb) {
        const gate = await tacticalGatekeeper(req.fen, fb.uci, { probabilities: fb.probabilities });
        let finalUci = fb.uci;
        let finalSan = fb.san;
        let finalFen = fb.fen;
        let finalOutcome = fb.outcome;
        if (gate.vetoed && gate.uci !== fb.uci) {
          const chNew = new Chess(req.fen);
          const appNew = applyUci(chNew, gate.uci);
          if (appNew) {
            finalUci = gate.uci;
            finalSan = appNew.san;
            finalFen = chNew.fen();
            finalOutcome = describeOutcome(chNew);
            recordMatchExperience(req.fen, gate.uci, 50, fb.uci);
          }
        }
        const prediction = await getStockfishPrediction(finalFen, finalUci);
        return {
          engine: this.id,
          uci: finalUci,
          san: finalSan,
          fen: finalFen,
          probabilities: gate.vetoed ? { [finalUci]: 1.0 } : fb.probabilities,
          confidence: gate.vetoed ? 0.95 : fb.confidence,
          droppedMoveCount: fb.droppedMoveCount,
          outcome: finalOutcome,
          scoreCp: fb.scoreCp,
          prediction,
          metadata: {
            fallback: "superfly_mcts",
            tacticalGateVetoed: gate.vetoed,
            gateReason: gate.reason,
            quiescenceScore: gate.quiescenceScore,
            model: "jev-latest",
          },
        };
      }
      throw new JevRequestError("TYPESAFE_API_KEY not set", 503, false);
    }

    const built = buildJevRequest(req.fen, req.seed, req.history ?? []);

    const legalSet = new Set(built.legalUcis);

    const response = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(built.request),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new JevRequestError(
        "TypeSafe returned a response that was not JSON. No move was applied.",
        502,
        true,
      );
    }

    const answers =
      payload && typeof payload === "object"
        ? (payload as { answers?: { move?: unknown } }).answers
        : undefined;

    const resolved = resolveJevChoice(legalSet, answers?.move);
    if (!resolved.ok) {
      throw new JevRequestError(resolved.error, 422, true);
    }

    // 2. Tactical Gatekeeper & Quiescence Evaluation Blunder Check
    const chBefore = new Chess(req.fen);
    const legalUcis = chBefore.moves({ verbose: true }).map((m: any) => m.from + m.to + (m.promotion ?? ""));

    let chosenUci = resolved.uci;
    const gateResult = await tacticalGatekeeper(req.fen, chosenUci, {
      legalUcis,
      probabilities: resolved.probabilities,
    });

    if (gateResult.vetoed && gateResult.uci !== chosenUci) {
      recordMatchExperience(req.fen, gateResult.uci, 50, chosenUci);
      chosenUci = gateResult.uci;
    }

    const chess = new Chess(req.fen);
    const applied = applyUci(chess, chosenUci);
    const nextFen = chess.fen();

    // 3. Online Learning from Stockfish (Background Observer)
    const prediction = await getStockfishPrediction(nextFen, chosenUci);
    if (prediction && prediction.uci) {
      recordMatchExperience(nextFen, prediction.uci, prediction.scoreCp ?? 0);
    }

    const outcome = describeOutcome(chess);
    if (outcome.over && (outcome.winner === "white" || outcome.winner === "black")) {
      reinforceMatchDopamine([...(req.history ?? []), applied.san], outcome.winner);
    }

    return {
      engine: this.id,
      uci: chosenUci,
      san: applied.san,
      fen: nextFen,
      probabilities: resolved.probabilities,
      confidence: resolved.confidence ?? 0.8,
      droppedMoveCount: built.droppedUcis.length,
      outcome,
      scoreCp: undefined,
      prediction,
      metadata: {
        rawChoice: resolved.uci,
        vncVetoed: gateResult.vetoed,
        gateReason: gateResult.reason,
        quiescenceScore: gateResult.quiescenceScore,
        model: "jev-latest",
      },
    };
  }
}

export const pureJevEngine = new PureJevEngine();
