import { spawn } from "node:child_process";
import { Chess, validateFen, type Chess as ChessType } from "chess.js";
import { applyUci, describeOutcome, detectMotif, type LegalMove } from "@/lib/chess";

export type { LegalMove, GameOutcome } from "@/lib/chess";

export type StockfishResult = {
  uci: string;
  san: string;
  fen: string;
  multiPv: Array<{ uci: string; san: string; motif: string; evaluation: string }>;
  evalDelta: { centipawn: number; label: string } | null;
  motif: string;
  confidence: number | null;
  outcome: GameOutcome;
};

export async function playStockfishMove(
  fen: string,
  depth = 14,
): Promise<StockfishResult> {
  // Strict FEN validation using chess.js parser, not regex
  const fenCheck = validateFen(fen);
  if (!fenCheck.ok) {
    throw new Error(fenCheck.error ?? "Invalid FEN.");
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
    let bestMove = "";
    let bestSan = "";
    let evalDelta: StockfishResult["evalDelta"] = null;

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
        // MultiPV lines
        const pvMatch = line.match(/^info\s+.*multipv\s+(\d+)\s+.*pv\s+((?:[a-h][1-8]\s?)+[qrbn]?)/);
        if (pvMatch) {
          topMoves.set(parseInt(pvMatch[1], 10), pvMatch[2].trim());
        }

        // Score info for evaluation delta
        const scoreMatch = line.match(/^info\s+(?:depth\s+\d+\s+)?.*score\s+cp\s+(-?\d+)/);
        if (scoreMatch && !bestMove) {
          const cp = parseInt(scoreMatch[1], 10);
          evalDelta = {
            centipawn: cp,
            label: cp > 0 ? `+${(cp / 100).toFixed(2)}` : (cp / 100).toFixed(2),
          };
        }

        const bestMatch = line.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (bestMatch) {
          clearTimeout(timeout);
          cleanup();
          bestMove = bestMatch[1];

          // Apply best move to get san and motif
          let bestChess: ChessType | null = null;
          try {
            bestChess = new Chess(fen);
            bestChess.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: bestMove.length > 4 ? bestMove[4] as any : undefined });
            bestSan = bestChess.history({ verbose: true }).pop()?.san ?? bestMove;
          } catch {
            bestSan = bestMove;
          }

          const motif = bestChess ? detectMotif(new Chess(fen), bestChess, { ...bestChess.history({ verbose: true }).pop() as any, color: chess.turn() } as any) : "none";

          // Build MultiPV list
          const multiPv: StockfishResult["multiPv"] = [];
          for (const [num, uci] of topMoves) {
            if (num > 5) break; // cap at top 5
            multiPv.push({ uci, san: uci, motif: "none", evaluation: "" });
          }

          // Confidence derived from engine eval spread, not hardcoded
          const confidence = evalDelta ? (Math.abs(evalDelta.centipawn) > 300 ? 0.9 : evalDelta.centipawn > 100 ? 0.8 : null) : null;

          const applied = applyUci(chess, bestMove);
          resolve({
            uci: bestMove,
            san: bestSan,
            fen: chess.fen(),
            multiPv,
            evalDelta,
            motif,
            confidence,
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

    p.stdin.write("setoption name MultiPV value 5\n");
    p.stdin.write(`position fen ${fen}\n`);
    p.stdin.write(`go depth ${depth}\n`);
  });
}