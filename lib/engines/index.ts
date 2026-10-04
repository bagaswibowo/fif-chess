import type { EngineId, IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";
import { stockfishEngine } from "./stockfish";
import { pureJevEngine } from "./jev";
import { pureSuperflyEngine } from "./flybrain";
import { jevSuperflyHybridEngine } from "./hybrid";

export * from "./types";
export { stockfishEngine } from "./stockfish";
export { pureJevEngine } from "./jev";
export { pureSuperflyEngine } from "./flybrain";
export { jevSuperflyHybridEngine } from "./hybrid";

const engines: Record<EngineId, IChessEngine> = {
  stockfish: stockfishEngine,
  jev: pureJevEngine,
  fly: pureSuperflyEngine,
  "jev-fly": jevSuperflyHybridEngine,
};

export function getEngine(id: EngineId): IChessEngine {
  const engine = engines[id];
  if (!engine) {
    throw new Error(`Engine "${id}" not found. Available: ${Object.keys(engines).join(", ")}`);
  }
  return engine;
}

export async function playEngineMove(
  id: EngineId,
  req: EngineMoveRequest,
): Promise<EngineMoveResponse> {
  const engine = getEngine(id);
  return engine.play(req);
}
