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

  try {
    const header = JSON.parse(fs.readFileSync(headerPath, "utf8"));
    const buffer = fs.readFileSync(bufferPath);
    const arrays = parseArrays(
      header,
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    );
    cachedBrain = new FlyBrain({ header, arrays });
    return cachedBrain;
  } catch (err) {
    console.error("Failed to load FlyBrain model:", err);
    return null;
  }
}

export type FlyMoveScore = {
  uci: string;
  san: string;
  prob: number;
};

export function evaluateWithFlyBrain(fen: string): {
  moves: FlyMoveScore[];
  value: number;
} | null {
  try {
    const brain = getFlyBrain();
    if (!brain) return null;

    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;

    const planes = encodeBoard(chess);
    const { policy, value } = brain.forward(planes);

    const legal = legalMoveIndices(chess);
    if (!legal || legal.length === 0) return null;

    const logits = legal.map((idx: number) => policy[idx]);
    const maxLogit = Math.max(...logits);
    const exps = logits.map((l: number) => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a: number, b: number) => a + b, 0);

    const scored: FlyMoveScore[] = legal.map((idx: number, i: number) => {
      const m = indexToMove(idx, chess) as any;
      const uci = m.from + m.to + (m.promotion || "");
      let san = uci;
      try {
        const mv = chess.move({ from: m.from, to: m.to, promotion: m.promotion });
        if (mv) {
          san = mv.san;
          chess.undo();
        }
      } catch {}

      return {
        uci,
        san,
        prob: sumExps > 0 ? exps[i] / sumExps : 0,
      };
    });

    scored.sort((a, b) => b.prob - a.prob);

    return {
      moves: scored,
      value,
    };
  } catch (err) {
    console.error("FlyBrain evaluation error:", err);
    return null;
  }
}
