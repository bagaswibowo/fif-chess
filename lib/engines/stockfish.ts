import { Chess } from "chess.js";
import { playStockfishMove } from "@/lib/stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse, EnginePrediction } from "./types";

export async function getStockfishPrediction(fen: string): Promise<EnginePrediction | null> {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;
    const sf = await playStockfishMove(fen, 10);
    const side = chess.turn() === "w" ? "Putih" : "Hitam";
    const evalStr = sf.scoreCp !== null ? `${(sf.scoreCp / 100).toFixed(1)}` : "0.0";
    return {
      engine: "stockfish",
      uci: sf.uci,
      san: sf.san,
      scoreCp: sf.scoreCp,
      summary: `Stockfish 15 NNUE memprediksi balasan terbaik ${side}: ${sf.san} (${evalStr})`,
    };
  } catch {
    return null;
  }
}

export class StockfishEngine implements IChessEngine {
  readonly id = "stockfish" as const;
  readonly name = "Stockfish 15 NNUE";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const depth = Math.min(14, Math.max(6, req.depth ?? 12));
    const sf = await playStockfishMove(req.fen, depth);
    const prediction = await getStockfishPrediction(sf.fen);

    return {
      engine: this.id,
      uci: sf.uci,
      san: sf.san,
      fen: sf.fen,
      probabilities: sf.probabilities,
      confidence: sf.confidence,
      droppedMoveCount: sf.droppedMoveCount,
      outcome: sf.outcome,
      scoreCp: sf.scoreCp,
      prediction,
    };
  }
}

export const stockfishEngine = new StockfishEngine();
