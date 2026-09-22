import { spawn } from "node:child_process";
import { Chess } from "chess.js";
import { applyUci, describeOutcome, type GameOutcome } from "@/lib/chess";

export type StockfishResult = {
  uci: string;
  san: string;
  fen: string;
  probabilities: Record<string, number>;
  confidence: number;
  droppedMoveCount: number;
  outcome: GameOutcome;
};

export async function playStockfishMove(fen: string, depth = 14): Promise<StockfishResult> {
  // Validate FEN characters to strictly prevent UCI command injection
  if (!/^[0-9a-zA-Z\/\s\-]+$/.test(fen)) {
    throw new Error("Invalid FEN string format");
  }

  const chess = new Chess(fen);
  if (chess.isGameOver()) {
    throw new Error("Game is already over");
  }

  return new Promise((resolve, reject) => {
    const p = spawn("/usr/games/stockfish");
    let out = "";
    const topMoves = new Map<number, string>();
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        try { p.stdin.write("quit\n"); } catch (_) {}
        p.kill();
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Stockfish calculation timeout"));
    }, 5000);

    p.stdout.on("data", (data: Buffer) => {
      out += data.toString();
      const lines = out.split("\n");
      out = lines.pop() || "";

      for (const line of lines) {
        const pvMatch = line.match(/multipv\s+(\d+).*?pv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (pvMatch) {
          topMoves.set(parseInt(pvMatch[1], 10), pvMatch[2]);
        }

        const bestMatch = line.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (bestMatch) {
          clearTimeout(timeout);
          cleanup();

          const bestMove = bestMatch[1];
          const probs: Record<string, number> = { [bestMove]: 0.70 };
          const m2 = topMoves.get(2);
          const m3 = topMoves.get(3);
          if (m2 && m2 !== bestMove) probs[m2] = 0.20;
          if (m3 && m3 !== bestMove && m3 !== m2) probs[m3] = 0.10;

          const applied = applyUci(chess, bestMove);
          resolve({
            uci: bestMove,
            san: applied.san,
            fen: chess.fen(),
            probabilities: probs,
            confidence: 0.99,
            droppedMoveCount: 0,
            outcome: describeOutcome(chess),
          });
          return;
        }
      }
    });

    p.stderr.on("data", (err) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(err.toString()));
    });

    p.stdin.write("setoption name MultiPV value 3\n");
    p.stdin.write(`position fen ${fen}\n`);
    p.stdin.write(`go depth ${depth}\n`);
  });
}
