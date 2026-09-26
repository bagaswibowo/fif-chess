import type { GameOutcome, PromotionPiece, Side } from "@/lib/chess";

export type Player = "human" | "stockfish" | "jev" | "jev-fly" | "fly";

export type PlayedMove = {
  san: string;
  uci: string;
  by: Player;
  ply: number;
};

export type JevAnalysis = {
  chosenUci: string;
  chosenSan: string;
  probabilities: Record<string, number>;
  confidence: number | null;
  droppedMoveCount: number;
};

export type JevError = {
  message: string;
  retryable: boolean;
};

export type { GameOutcome, PromotionPiece, Side };
