import { describeOutcome } from "@/lib/chess";
import fs from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";
// @ts-ignore
import { parseArrays } from "./loader.js";
// @ts-ignore
import { FlyBrain } from "./flybrain.js";
// @ts-ignore
import { encodeBoard, legalMoveIndices, indexToMove } from "./encoding.js";

let cachedBrain: any = null;

export function getFlyBrain(): any {
  if (cachedBrain) return cachedBrain;
  const modelsDir = path.join(process.cwd(), "models");
  const headerPath = path.join(modelsDir, "brain.json");
  const bufferPath = path.join(modelsDir, "brain.flyb");

  if (!fs.existsSync(headerPath) || !fs.existsSync(bufferPath)) {
    return null;
  }

  const header = JSON.parse(fs.readFileSync(headerPath, "utf8"));
  const buffer = fs.readFileSync(bufferPath);
  const arrays = parseArrays(
    header,
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );

  cachedBrain = new FlyBrain({ header, arrays });
  return cachedBrain;
}

export type FlyMoveScore = {
  uci: string;
  san: string;
  prob: number;
  logit: number;
  value: number;
};

/**
 * Evaluates board using FlyBrain Connectome with 1-ply lookahead value search
 * and active pawn-push / promotion tactical incentives.
 */
export function evaluateWithFlyBrain(fen: string): {
  moves: FlyMoveScore[];
  value: number;
} | null {
  try {
    const brain = getFlyBrain();
    if (!brain) return null;

    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;

    const turn = chess.turn();
    const isWhite = turn === "w";
    const planes = encodeBoard(chess);
    const { policy, value: currentPosValue } = brain.forward(planes);

    const legal = legalMoveIndices(chess);
    if (!legal || legal.length === 0) return null;

    // Softmax policy distribution
    const logits = legal.map((idx: number) => policy[idx]);
    const maxLogit = Math.max(...logits);
    const exps = logits.map((l: number) => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a: number, b: number) => a + b, 0);

    const scored: FlyMoveScore[] = [];

    for (let i = 0; i < legal.length; i++) {
      const idx = legal[i];
      const m = indexToMove(idx, chess) as any;
      const uci = m.from + m.to + (m.promotion || "");
      let san = uci;
      let moveValue = 0;
      let isPromotion = Boolean(m.promotion || uci.length > 4);
      let isPawnPush = false;
      let pawnAdvancedRank = 0;

      const piece = chess.get(m.from as any);
      if (piece && piece.type === "p") {
        isPawnPush = true;
        const targetRank = parseInt(m.to[1], 10);
        pawnAdvancedRank = isWhite ? targetRank : 9 - targetRank;
      }

      try {
        const mv = chess.move({ from: m.from, to: m.to, promotion: m.promotion || (isPromotion ? "q" : undefined) });
        if (mv) {
          san = mv.san;
          if (chess.isCheckmate()) {
            moveValue = 1.0; // Immediate checkmate!
          } else if (chess.isDraw()) {
            moveValue = 0.0;
          } else {
            const oppPlanes = encodeBoard(chess);
            const oppFwd = brain.forward(oppPlanes, { activity: false });
            moveValue = -oppFwd.value; // Negated opponent value

            // Pawn promotion & advance bonus (aggressive promotion behavior)
            if (mv.promotion || san.includes("=")) {
              moveValue = Math.min(0.98, moveValue + 0.65);
            } else if (isPawnPush && pawnAdvancedRank >= 6) {
              moveValue = Math.min(0.92, moveValue + 0.25 * (pawnAdvancedRank - 5));
            }

            // Material capture bonus
            if (mv.captured) {
              const valMap: Record<string, number> = { q: 0.5, r: 0.35, b: 0.2, n: 0.2, p: 0.1 };
              moveValue = Math.min(0.95, moveValue + (valMap[mv.captured] || 0.1));
            }
          }
          chess.undo();
        }
      } catch {}

      const policyProb = sumExps > 0 ? exps[i] / sumExps : 0;
      // Combined Lookahead Score: 40% Policy Prior + 60% Lookahead Value
      const normalizedVal = (moveValue + 1) / 2; // Map [-1, 1] -> [0, 1]
      const combinedProb = Number((0.4 * policyProb + 0.6 * normalizedVal).toFixed(4));

      scored.push({
        uci,
        san,
        prob: combinedProb,
        logit: policy[idx],
        value: moveValue,
      });
    }

    scored.sort((a, b) => b.prob - a.prob);

    return {
      moves: scored,
      value: currentPosValue,
    };
  } catch (err) {
    console.error("FlyBrain evaluation error:", err);
    return null;
  }
}

export function playFlyBrainMove(fen: string) {
  const result = evaluateWithFlyBrain(fen);
  if (!result || result.moves.length === 0) return null;

  const best = result.moves[0];
  const chess = new Chess(fen);
  const applied = chess.move({
    from: best.uci.slice(0, 2),
    to: best.uci.slice(2, 4),
    promotion: best.uci[4] || undefined,
  });

  const probs: Record<string, number> = {};
  for (const m of result.moves) {
    probs[m.uci] = m.prob;
  }

  return {
    uci: best.uci,
    san: applied ? applied.san : best.san,
    fen: chess.fen(),
    probabilities: probs,
    confidence: best.prob,
    droppedMoveCount: 0,
    scoreCp: Math.round(result.value * 100),
    outcome: describeOutcome(chess),
  };
}
