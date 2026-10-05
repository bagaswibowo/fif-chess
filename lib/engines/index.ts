import { Chess } from "chess.js";
import { applyUci, describeOutcome } from "@/lib/chess";
import type { EngineId, IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";
import { stockfishEngine, getStockfishPrediction } from "./stockfish";
import { pureJevEngine } from "./jev";
import { pureSuperflyEngine } from "./flybrain";
import { jevSuperflyHybridEngine } from "./hybrid";
import { getOpeningBookMove } from "./opening-book";

export * from "./types";
export { stockfishEngine, getStockfishPrediction } from "./stockfish";
export { pureJevEngine } from "./jev";
export { pureSuperflyEngine } from "./flybrain";
export { jevSuperflyHybridEngine } from "./hybrid";
export { getOpeningBookMove } from "./opening-book";

const engines: Record<EngineId, IChessEngine> = {
  stockfish: stockfishEngine,
  jev: pureJevEngine,
  fly: pureSuperflyEngine,
  "jev-fly": jevSuperflyHybridEngine,
};

export function getEngine(id: EngineId): IChessEngine {
  const engine = engines[id];
  if (!engine) {
    throw new Error(`Engine "${id}" not found. Available: ${Object.keys(engines).join(", ")}`);
  }
  return engine;
}

export async function playEngineMove(
  id: EngineId,
  req: EngineMoveRequest,
): Promise<EngineMoveResponse> {
  // Classical Master Opening Book (untuk Jev, Fly, dan Hybrid)
  if (id !== "stockfish") {
    const bookMove = getOpeningBookMove(req.fen);
    if (bookMove) {
      try {
        const ch = new Chess(req.fen);
        const app = applyUci(ch, bookMove);
        if (app) {
          const prediction = await getStockfishPrediction(ch.fen());
          return {
            engine: id,
            uci: bookMove,
            san: app.san,
            fen: ch.fen(),
            probabilities: { [bookMove]: 1.0 },
            confidence: 1.0,
            droppedMoveCount: 0,
            outcome: describeOutcome(ch),
            prediction,
            metadata: {
              source: "master_opening_book",
            },
          };
        }
      } catch {}
    }
  }

  const engine = getEngine(id);
  return engine.play(req);
}
