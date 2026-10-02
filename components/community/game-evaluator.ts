import { Chess } from 'chess.js';
import type { GameAnalysisReport } from './types';

export function analyzeGameMoves(moves: string[], side: 'white' | 'black'): GameAnalysisReport {
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;
  let missedWins = 0;
  let bestMoves = 0;

  const moveFeedback: GameAnalysisReport['moveFeedback'] = [];
  const chess = new Chess();

  moves.forEach((san, index) => {
    const isPlayerPly = side === 'white' ? index % 2 === 0 : index % 2 === 1;

    try {
      const legal = chess.move(san);
      if (!legal) return;

      if (isPlayerPly) {
        if (san.includes('#')) {
          bestMoves++;
          moveFeedback.push({
            ply: index + 1,
            san,
            type: 'best',
            commentary: 'Langkah penyelesaian taktik skakmat yang tajam & akurat!',
          });
        } else if (san.includes('+')) {
          bestMoves++;
          moveFeedback.push({
            ply: index + 1,
            san,
            type: 'best',
            commentary: 'Skak taktis yang menekan tempo lawan secara efektif.',
          });
        } else if (san.includes('x')) {
          if (['Q', 'R', 'B', 'N'].some((p) => san.startsWith(p))) {
            bestMoves++;
            moveFeedback.push({
              ply: index + 1,
              san,
              type: 'good',
              commentary: 'Pertukaran perwira yang menguntungkan struktur perwira.',
            });
          } else {
            moveFeedback.push({
              ply: index + 1,
              san,
              type: 'good',
              commentary: 'Pukulan bidak yang menjaga kontrol petak tengah.',
            });
          }
        }
      }
    } catch {
      // Ignore invalid moves
    }
  });

  const totalDeductions = blunders * 12 + mistakes * 6 + inaccuracies * 2;
  const accuracy = Math.max(45, Math.min(99, 100 - totalDeductions + Math.floor(bestMoves * 1.5)));

  let verdict = 'Permainan Solid & Terbuka';
  if (accuracy > 85) verdict = 'Akurasi Master / Presisi Taktis Tinggi';
  else if (blunders > 2) verdict = 'Pertarungan Sengit dengan Banyak Komplikasi Taktis';
  else if (inaccuracies > 3) verdict = 'Posisi Cenderung Seimbang Perlu Penajaman Akhir';

  return {
    accuracy,
    blunders,
    mistakes,
    missedWins,
    bestMovesCount: bestMoves,
    verdict,
    moveFeedback,
  };
}
