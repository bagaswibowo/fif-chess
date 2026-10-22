/**
 * post-game-analysis.ts
 * Port of com.chess.compengine.v2.ChessEngineImpl.s(...): iaa<k1>
 * from chess.com APK v4.10.20 (REA MCP decompilation).
 *
 * Mirrors the chess.com post-game analysis contract:
 *   Input: PGN + game result + player ratings + coach settings
 *   Output: analysis object (iaa<k1>) with coach feedback, evaluations, move-by-move review
 *
 * FIXES (Tech Lead JEV-010, JEV-011):
 * - Better PGN token cleaning (handles O-O, O-O-O, annotations, comments, NAGs)
 * - Delta Cp calculated with correct side-to-move perspective flip
 *   (centipawn loss measured from the side-to-move's point of view)
 *
 * Implemented by replaying the PGN through chess.js and annotating each move
 * with Stockfish eval (cp delta) — mirroring chess.com's v1(request).d() pipeline.
 */

import { Chess } from "chess.js";
import { playStockfishMove } from "@/lib/stockfish";

export interface MoveAnalysis {
  ply: number;
  san: string;
  uci: string;
  fen: string;
  scoreCp: number | null;
  deltaCp: number | null;
  classification: "brilliant" | "great" | "good" | "book" | "mistake" | "blunder" | "inaccuracy";
  isBestMove: boolean;
}

export interface PostGameAnalysisResponse {
  gamePgn: string;
  gameResult: string;
  totalPly: number;
  analysis: MoveAnalysis[];
  coachTextId?: string;
  coachLocale?: string;
  suppressBrilliantSpeech?: boolean;
  averageCpl: number; // centipawn loss average
}

function classifyMove(deltaCp: number | null, isBest: boolean, inBook: boolean): MoveAnalysis["classification"] {
  if (inBook) return "book";
  if (isBest) return "great";
  if (deltaCp === null) return "good";
  if (deltaCp <= 20) return "good";
  if (deltaCp <= 60) return "inaccuracy";
  if (deltaCp <= 150) return "mistake";
  return "blunder";
}

/**
 * Extract clean SAN tokens from PGN text.
 * Handles:
 *   - move numbers (1., 2., ...)
 *   - result tokens (1-0, 0-1, 1/2-1/2, *)
 *   - castling (O-O, O-O-O)
 *   - annotations (!, ?, !!, ??, !?, ?!) and NAGs ($1, $2, ...)
 *   - inline comments ({...}) stripped
 */
function extractSanMoves(pgn: string): string[] {
  // Remove inline comments {...}
  const noComments = pgn.replace(/\{[^}]*\}/g, " ");
  // Remove NAG annotations $N
  const noNags = noComments.replace(/\$\d+/g, "");
  const tokens = noNags.split(/\s+/);
  const sanMoves: string[] = [];
  const resultTokens = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
  for (const raw of tokens) {
    // Strip move number prefix (e.g. "1.", "12...", "3.")
    let clean = raw.replace(/^\d+\.?\.?$/, "").replace(/\.{1,3}$/, "");
    // Strip trailing annotations (!/? combinations)
    clean = clean.replace(/[!?]+$/, "");
    if (!clean || resultTokens.has(clean)) continue;
    sanMoves.push(clean);
  }
  return sanMoves;
}

export async function analyzePgn(
  gamePgn: string,
  gameResult: string,
  options: {
    coachTextId?: string;
    coachLocale?: string;
    suppressBrilliantSpeech?: boolean;
    playersRatings?: Record<string, number>;
  } = {}
): Promise<PostGameAnalysisResponse> {
  const chess = new Chess();
  const sanMoves = extractSanMoves(gamePgn);

  const analysis: MoveAnalysis[] = [];
  let totalCpl = 0;

  for (let i = 0; i < sanMoves.length; i++) {
    const san = sanMoves[i];
    const fenBefore = chess.fen();
    const sideBefore = chess.turn(); // "w" or "b" — perspective of the side to move

    let applied: { san: string; uci: string } | null = null;
    try {
      const mv = chess.move(san);
      if (mv) {
        applied = { san: mv.san, uci: `${mv.from}${mv.to}${mv.promotion || ""}` };
      }
    } catch {
      // If SAN fails, stop analysis at this point
      break;
    }
    if (!applied) break;

    // Get Stockfish eval for the position before this move (mirrors ceeFeatures pipeline)
    let scoreCp: number | null = null;
    let deltaCp: number | null = null;
    let isBest = false;

    try {
      const sf = await playStockfishMove(fenBefore, 10);
      scoreCp = sf.scoreCp ?? null;
      isBest = (applied.uci === sf.uci);
    } catch {
      scoreCp = null;
    }

    // Delta cp vs previous (centipawn loss), measured from side-to-move perspective.
    // After each move the side to move flips, so we flip the sign of the previous
    // score before subtracting to keep the perspective consistent.
    if (i > 0 && analysis[i - 1].scoreCp !== null && scoreCp !== null) {
      // Previous ply was played by the opponent of the current side-to-move,
      // so flip the previous score to current side-to-move perspective.
      const prevRaw = analysis[i - 1].scoreCp!;
      const prevPerspective = sideBefore === "w" ? -prevRaw : prevRaw;
      const currentPerspective = sideBefore === "w" ? scoreCp : -scoreCp;
      deltaCp = Math.max(0, currentPerspective - prevPerspective);
      totalCpl += deltaCp;
    }

    // Opening book heuristic: first 8 plies considered "book"
    const inBook = i < 8;

    analysis.push({
      ply: i + 1,
      san: applied.san,
      uci: applied.uci,
      fen: chess.fen(),
      scoreCp,
      deltaCp,
      classification: classifyMove(deltaCp, isBest, inBook),
      isBestMove: isBest,
    });
  }

  const averageCpl = analysis.length > 0 ? Math.round(totalCpl / analysis.length) : 0;

  return {
    gamePgn,
    gameResult,
    totalPly: analysis.length,
    analysis,
    coachTextId: options.coachTextId,
    coachLocale: options.coachLocale,
    suppressBrilliantSpeech: options.suppressBrilliantSpeech ?? false,
    averageCpl,
  };
}
