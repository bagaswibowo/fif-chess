import { Chess } from "chess.js";
import { applyUci, describeOutcome } from "@/lib/chess";
import {
  buildJevRequest,
  resolveJevChoice,
  mapHttpError,
  JevRequestError,
  TYPESAFE_ENDPOINT,
  type JevPlaySuccess,
} from "@/lib/jev";
import { getStockfishPrediction } from "./stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";

export class PureJevEngine implements IChessEngine {
  readonly id = "jev" as const;
  readonly name = "Jev AI Connectome (Pure)";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const key = req.apiKey || process.env.TYPESAFE_API_KEY;
    if (!key) {
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

    // Pure Jev — direct RLCD decision without external blending
    const chess = new Chess(req.fen);
    const applied = applyUci(chess, resolved.uci);
    const nextFen = chess.fen();
    const prediction = await getStockfishPrediction(nextFen);

    return {
      engine: this.id,
      uci: resolved.uci,
      san: applied.san,
      fen: nextFen,
      probabilities: resolved.probabilities,
      confidence: resolved.confidence,
      droppedMoveCount: built.droppedUcis.length,
      outcome: describeOutcome(chess),
      scoreCp: undefined,
      prediction,
      metadata: {
        rawChoice: resolved.uci,
        model: "jev-latest",
      },
    };
  }
}

export const pureJevEngine = new PureJevEngine();
