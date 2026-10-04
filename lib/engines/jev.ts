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
import { getLearnedMove, isBlunderMove, recordMatchExperience } from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";

export class PureJevEngine implements IChessEngine {
  readonly id = "jev" as const;
  readonly name = "Jev AI Connectome (Pure)";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const key = req.apiKey || process.env.TYPESAFE_API_KEY;

    // 1. Nature 2024 MBON Learned Recall: Ingat langkah terbaik jika sudah pernah dipelajari
    const learned = getLearnedMove(req.fen);
    if (learned) {
      const chL = new Chess(req.fen);
      const appL = applyUci(chL, learned.move);
      const nextFenL = chL.fen();
      const prediction = await getStockfishPrediction(nextFenL);
      return {
        engine: this.id,
        uci: learned.move,
        san: appL.san,
        fen: nextFenL,
        probabilities: { [learned.move]: 0.99 },
        confidence: 0.99,
        droppedMoveCount: 0,
        outcome: describeOutcome(chL),
        scoreCp: learned.score,
        prediction,
        metadata: { source: "mbon-learned", model: "jev-latest" },
      };
    }

    if (!key) {
      // Fallback: use Superfly connectome MCTS
      const fb = playSuperflyMove(req.fen, 40) || playFlyBrainMove(req.fen);
      if (fb) {
        const prediction = await getStockfishPrediction(fb.fen);
        return {
          engine: this.id,
          uci: fb.uci,
          san: fb.san,
          fen: fb.fen,
          probabilities: fb.probabilities,
          confidence: fb.confidence,
          droppedMoveCount: fb.droppedMoveCount,
          outcome: fb.outcome,
          scoreCp: fb.scoreCp,
          prediction,
          metadata: { fallback: "superfly_mcts", model: "jev-latest" },
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

    // 2. Nature 2024 VNC Descending Premotor Veto (Murni biologis, tanpa intervensi Stockfish)
    let chosenUci = resolved.uci;
    const isBadMove = (m: string) => isBlunderMove(req.fen, m) || isPredationTrap(req.fen, m);

    if (isBadMove(chosenUci)) {
      recordMatchExperience(req.fen, undefined, undefined, chosenUci);
      const sortedProbs = Object.entries(resolved.probabilities).sort((a, b) => b[1] - a[1]);
      const safeCandidate = sortedProbs.find(([move]) => !isBadMove(move));
      if (safeCandidate) {
        chosenUci = safeCandidate[0];
      }
    }

    const chess = new Chess(req.fen);
    const applied = applyUci(chess, chosenUci);
    const nextFen = chess.fen();

    // 3. Online Learning from Stockfish (Background Observer)
    const prediction = await getStockfishPrediction(nextFen);
    if (prediction && prediction.uci) {
      recordMatchExperience(nextFen, prediction.uci, prediction.scoreCp ?? 0);
    }

    return {
      engine: this.id,
      uci: chosenUci,
      san: applied.san,
      fen: nextFen,
      probabilities: resolved.probabilities,
      confidence: resolved.confidence ?? 0.8,
      droppedMoveCount: built.droppedUcis.length,
      outcome: describeOutcome(chess),
      scoreCp: undefined,
      prediction,
      metadata: {
        rawChoice: resolved.uci,
        vncVetoed: chosenUci !== resolved.uci,
        model: "jev-latest",
      },
    };
  }
}

export const pureJevEngine = new PureJevEngine();
