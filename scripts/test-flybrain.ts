import { getFlyBrain, evaluateWithFlyBrain, playFlyBrainMove } from "../lib/flybrain/service.ts";

console.log("Loading FlyBrain...");
const brain = getFlyBrain();
if (!brain) {
  console.error("FAILED to load FlyBrain!");
  process.exit(1);
}
console.log("FlyBrain loaded successfully! Neurons:", brain.n, "Synapses:", brain.nnz);

const startFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
console.log("Evaluating move for Black after 1. e4...");
const t0 = performance.now();
const move = playFlyBrainMove(startFen);
const t1 = performance.now();

console.log(`FlyBrain evaluation took ${(t1 - t0).toFixed(1)} ms`);
console.log("FlyBrain move result:", JSON.stringify(move, null, 2));
