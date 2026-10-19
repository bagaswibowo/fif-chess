// CAPS (Chess.com Accuracy Percentage Score) Evaluator
// Replikasi formula akurasi Chess.com berbasis weighted exponential centipawn decay

export type MoveClassificationType =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface MoveAnalysis {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  turn: 'w' | 'b';
  evalBefore: number; // centipawns dari perspektif side to move
  evalAfter: number;
  deltaCp: number; // loss (evalBefore - evalAfter)
  classification: MoveClassificationType;
  commentary?: string;
}

export interface PlayerGameSummary {
  accuracy: number; // 0.0 - 100.0%
  brilliantCount: number;
  greatCount: number;
  bestCount: number;
  bookCount: number;
  inaccuracyCount: number;
  mistakeCount: number;
  blunderCount: number;
}

export interface GameReviewReport {
  white: PlayerGameSummary;
  black: PlayerGameSummary;
  moves: MoveAnalysis[];
}

export function calculateCapsAccuracy(centipawnLosses: number[]): number {
  if (centipawnLosses.length === 0) return 100.0;
  // Weighted exponential centipawn decay: Acc = 100 * mean(exp(-0.004 * deltaCp))
  const sum = centipawnLosses.reduce((acc, delta) => {
    const boundedLoss = Math.max(0, delta);
    return acc + Math.exp(-0.004 * boundedLoss);
  }, 0);
  const rawAcc = (sum / centipawnLosses.length) * 100;
  return Number(Math.min(100, Math.max(0, rawAcc)).toFixed(1));
}

export function buildPlayerSummary(analyses: MoveAnalysis[], side: 'w' | 'b'): PlayerGameSummary {
  const sideMoves = analyses.filter((m) => m.turn === side);
  const losses = sideMoves.map((m) => m.deltaCp);
  const accuracy = calculateCapsAccuracy(losses);

  let brilliantCount = 0;
  let greatCount = 0;
  let bestCount = 0;
  let bookCount = 0;
  let inaccuracyCount = 0;
  let mistakeCount = 0;
  let blunderCount = 0;

  for (const m of sideMoves) {
    switch (m.classification) {
      case 'brilliant':
        brilliantCount++;
        break;
      case 'great':
        greatCount++;
        break;
      case 'best':
        bestCount++;
        break;
      case 'book':
        bookCount++;
        break;
      case 'inaccuracy':
        inaccuracyCount++;
        break;
      case 'mistake':
        mistakeCount++;
        break;
      case 'blunder':
        blunderCount++;
        break;
    }
  }

  return {
    accuracy,
    brilliantCount,
    greatCount,
    bestCount,
    bookCount,
    inaccuracyCount,
    mistakeCount,
    blunderCount,
  };
}
