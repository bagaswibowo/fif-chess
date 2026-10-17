import { Chess, type Square } from "chess.js";
import { getLearnedMove, isBlunderMove } from "@/lib/experience";

export interface GabPriorResult {
  priors: Record<string, number>;
  bestUci: string;
  sourceDestLogits: Float32Array; // 64x64 matrix flattened
}

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

/**
 * Computes Geometric Attention Bias (GAB) and GATEAU Edge Features for a chess position.
 * Implements insights from:
 * 1. ICLR 2026: Chessformer - Geometric Attention Bias & Source-Destination Policy Head
 * 2. NeurIPS 2024: GATEAU - Graph Representation with Edge-Featured Policy Head
 */
export function computeGabPriors(fen: string, history?: string[]): GabPriorResult {
  const chess = new Chess(fen);
  const board = chess.board();
  const turn = chess.turn();
  const oppColor = turn === "w" ? "b" : "w";
  const legalMoves = chess.moves({ verbose: true });

  const matrix = new Float32Array(64 * 64);
  const priors: Record<string, number> = {};

  if (legalMoves.length === 0) {
    return { priors, bestUci: "", sourceDestLogits: matrix };
  }

  // 1. Fill GAB Matrix (64x64 geometric template biases)
  for (let fromIdx = 0; fromIdx < 64; fromIdx++) {
    const fromR = Math.floor(fromIdx / 8);
    const fromC = fromIdx % 8;
    const piece = board[fromR][fromC];
    if (!piece || piece.color !== turn) continue;

    const fromSquare = (String.fromCharCode(97 + fromC) + (8 - fromR)) as Square;

    for (let toIdx = 0; toIdx < 64; toIdx++) {
      if (fromIdx === toIdx) continue;
      const toR = Math.floor(toIdx / 8);
      const toC = toIdx % 8;
      const toSquare = (String.fromCharCode(97 + toC) + (8 - toR)) as Square;

      const dr = Math.abs(toR - fromR);
      const dc = Math.abs(toC - fromC);
      const isOrth = dr === 0 || dc === 0;
      const isDiag = dr === dc;
      const isKnight = (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
      const matIdx = fromIdx * 64 + toIdx;

      let geomBias = 0.0;

      // Geometri dasar pergerakan bidak
      if (piece.type === "n" && isKnight) geomBias += 2.5;
      if ((piece.type === "b" || piece.type === "q") && isDiag) geomBias += 2.2;
      if ((piece.type === "r" || piece.type === "q") && isOrth) geomBias += 2.2;
      if (piece.type === "p") {
        const pDir = piece.color === "w" ? -1 : 1;
        if (toR - fromR === pDir) {
          if (dc === 0) geomBias += 2.0;
          if (dc === 1 && board[toR][toC]) geomBias += 3.2; // Capture
        }
      }
      if (piece.type === "k" && dr <= 1 && dc <= 1) geomBias += 1.5;

      // Fitur Taktis GATEAU: Target & Proteksi
      const target = board[toR][toC];
      if (target && target.color === oppColor) {
        // Semakin berharga target yang diincar, semakin tinggi bias serangannya
        geomBias += (PIECE_VALUES[target.type] ?? 100) / 100.0 * 1.8;
      }

      // Bonus kontrol petak tengah (e4, d4, e5, d5)
      if ((toR === 3 || toR === 4) && (toC === 3 || toC === 4)) {
        geomBias += 1.2;
      }

      matrix[matIdx] = geomBias;
    }
  }

  // 2. Score Legal Moves via Source-Destination Attention Dot-Product
  const moveScores: { uci: string; score: number }[] = [];
  const learned = getLearnedMove(fen);

  for (const m of legalMoves) {
    const uci = m.from + m.to + (m.promotion || "");
    const fromC = m.from.charCodeAt(0) - 97;
    const fromR = 8 - parseInt(m.from[1], 10);
    const toC = m.to.charCodeAt(0) - 97;
    const toR = 8 - parseInt(m.to[1], 10);

    const fromIdx = fromR * 8 + fromC;
    const toIdx = toR * 8 + toC;
    let score = matrix[fromIdx * 64 + toIdx];

    // Tactical Rewards
    if (m.captured) {
      const capVal = PIECE_VALUES[m.captured] ?? 100;
      const myVal = PIECE_VALUES[m.piece] ?? 100;
      score += 2.5 + (capVal - myVal) / 200.0;
    }
    if (m.san.includes("+")) score += 2.0; // Check
    if (m.san.includes("#")) score += 100.0; // Instant checkmate
    if (m.promotion) score += 4.5;
    if (m.san === "O-O" || m.san === "O-O-O") score += 3.0; // Castling safety

    // Viridithas & Stockfish 19: Countermove Response to Opponent Last Move
    if (history && history.length > 0) {
      const lastMove = history[history.length - 1];
      const lastTo = lastMove.slice(-2);
      if (m.to === lastTo) score += 2.2; // Menyerang / membalas petak langkah lawan
    }

    // RL Experience Integration:
    // Gunakan memori 96,000+ posisi dari training Stockfish!
    if (learned && learned.move === uci) {
      score += 6.0 + Math.max(0, learned.score) / 100.0 + (learned.dopamine ?? 0) / 10.0;
    }
    if (isBlunderMove(fen, uci)) {
      score -= 15.0; // Hukuman keras untuk langkah yang terbukti blunder
    }

    moveScores.push({ uci, score });
  }

  // 3. Softmax Normalization across legal moves
  const maxScore = Math.max(...moveScores.map((s) => s.score));
  let expSum = 0;
  const exps = moveScores.map((s) => {
    const e = Math.exp(Math.min(20, Math.max(-20, (s.score - maxScore) * 1.2)));
    expSum += e;
    return { uci: s.uci, exp: e };
  });

  for (const item of exps) {
    priors[item.uci] = item.exp / (expSum || 1);
  }

  moveScores.sort((a, b) => (priors[b.uci] ?? 0) - (priors[a.uci] ?? 0));
  const bestUci = moveScores[0]?.uci || "";

  return { priors, bestUci, sourceDestLogits: matrix };
}
