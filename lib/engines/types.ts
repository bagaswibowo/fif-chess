import type { GameOutcome } from "@/lib/chess";

export type EngineId = "stockfish" | "jev" | "fly" | "jev-fly";

export interface EngineMoveRequest {
  fen: string;
  history?: string[];
  depth?: number;
  seed?: number;
  apiKey?: string;
  simulations?: number;
}

export interface EnginePrediction {
  engine: "stockfish";
  uci: string;
  san: string;
  from?: string;
  to?: string;
  scoreCp?: number | null;
  mate?: number | null;
  summary?: string;
  threat?: {
    from: string;
    to: string;
    sq: string;
    description: string;
  } | null;
  strategicMove?: {
    uci: string;
    san: string;
    from: string;
    to: string;
    intention: string;
  } | null;
}

export interface EngineMoveResponse {
  engine: EngineId;
  uci: string;
  san: string;
  fen: string;
  probabilities?: Record<string, number>;
  confidence?: number | null;
  droppedMoveCount?: number;
  outcome?: GameOutcome;
  scoreCp?: number | null;
  prediction?: EnginePrediction | null;
  metadata?: Record<string, unknown>;
}

export interface IChessEngine {
  readonly id: EngineId;
  readonly name: string;
  play(req: EngineMoveRequest): Promise<EngineMoveResponse>;
}
