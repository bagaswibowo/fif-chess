/**
 * bot-chat.ts
 * Port of com.chess.compengine.binary.BinaryEngine.k(...): fetchBotChatV2
 * from chess.com APK v4.10.20 (REA MCP decompilation).
 *
 * Mirrors the chess.com bot-chat / coach-explanation contract:
 *   Input: position + game result + player color + bot username
 *   Output: BotChatV2-shaped explanation text with evaluation
 *
 * FIXES (Tech Lead JEV-003, JEV-010):
 * - Explicit FEN validation with validateFen (chess.js) before new Chess(fen)
 * - Silent catch {} replaced with context-aware error logging
 */

import { Chess, validateFen } from "chess.js";
import { playStockfishMove } from "@/lib/stockfish";

export interface BotChatResponse {
  position: string;
  gameResult: string;
  playerColor: string;
  botUsername: string;
  explanation: string;
  evaluationCp: number | null;
  confidence: number;
}

const EXPLANATION_TEMPLATES: Record<string, string[]> = {
  advantage: [
    "You have a clear advantage here, {color}. Push the initiative.",
    "Position looks favorable for {color}. Keep the pressure on.",
    "{color} is better. Look for the strongest continuation."
  ],
  equal: [
    "The position is balanced. Both sides have chances.",
    "Equal game — typical chess.com equilibrium.",
    "No clear advantage yet. Keep developing."
  ],
  disadvantage: [
    "You're worse here, {color}. Find the best defense.",
    "Position is difficult for {color}. Be careful.",
    "{color} is under pressure. Look for counterplay."
  ],
  blunder: [
    "That was a blunder, {color}. Stockfish would punish it.",
    "Big mistake, {color}. The evaluation swings hard.",
    "Ouch, {color}. That move loses material."
  ],
  checkmate: [
    "Checkmate! Game over, {color}.",
    "Skakmat! {color} loses the game.",
    "Mate delivered. {color} is mated."
  ]
};

function pickTemplate(key: string, color: string): string {
  const list = EXPLANATION_TEMPLATES[key] || EXPLANATION_TEMPLATES.equal;
  const t = list[Math.floor(Math.random() * list.length)];
  return t.replace(/\{color\}/g, color);
}

export async function fetchBotChatV2(
  fen: string,
  gameResult: string,
  playerColor: string,
  botUsername = "Jev"
): Promise<BotChatResponse> {
  // Explicit FEN validation (JEV-010) — do not swallow invalid input silently
  const fenCheck = validateFen(fen);
  if (!fenCheck.ok) {
    // eslint-disable-next-line no-console
    console.error(`[chess-com] fetchBotChatV2: invalid FEN '${fen}': ${fenCheck.error}`);
    return {
      position: fen,
      gameResult,
      playerColor,
      botUsername,
      explanation: pickTemplate("equal", playerColor),
      evaluationCp: null,
      confidence: 0,
    };
  }

  const chess = new Chess(fen);
  const side = chess.turn() as "w" | "b";

  let evaluationCp: number | null = null;
  let explanation = "";

  try {
    const sf = await playStockfishMove(fen, 10);
    evaluationCp = sf.scoreCp ?? null;

    const isGameOver = chess.isGameOver();
    if (isGameOver) {
      explanation = pickTemplate("checkmate", playerColor);
    } else if (evaluationCp !== null) {
      const fromPerspective = side === "w" ? evaluationCp : -evaluationCp;
      if (fromPerspective >= 100) {
        explanation = pickTemplate("advantage", playerColor);
      } else if (fromPerspective <= -100) {
        explanation = pickTemplate("disadvantage", playerColor);
      } else {
        explanation = pickTemplate("equal", playerColor);
      }
    } else {
      explanation = pickTemplate("equal", playerColor);
    }
  } catch (err) {
    // JEV-003: replace silent catch with context-aware logging
    // eslint-disable-next-line no-console
    console.error(
      `[chess-com] fetchBotChatV2: Stockfish error for FEN '${fen}', ` +
      `gameResult='${gameResult}', playerColor='${playerColor}': ` +
      (err instanceof Error ? err.message : String(err))
    );
    explanation = pickTemplate("equal", playerColor);
    evaluationCp = null;
  }

  // Mirror the decompiled log line: "fetchBotChatV2: position=..., gameResult=..., playerColor=..., botUsername=..."
  // eslint-disable-next-line no-console
  console.debug(`[chess-com] fetchBotChatV2: position=${fen}, gameResult=${gameResult}, playerColor=${playerColor}, botUsername=${botUsername}`);

  return {
    position: fen,
    gameResult,
    playerColor,
    botUsername,
    explanation,
    evaluationCp,
    confidence: evaluationCp !== null ? 0.85 : 0.5,
  };
}
