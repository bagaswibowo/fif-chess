import assert from "node:assert";
import { getEngine, playEngineMove } from "../lib/engines";

async function main() {
  console.log("=== Testing Modular Chess Engines Architecture ===");

  // Test 1: Engine Registry
  const sf = getEngine("stockfish");
  assert.strictEqual(sf.id, "stockfish");
  assert.strictEqual(sf.name, "Stockfish 15 NNUE");

  const jev = getEngine("jev");
  assert.strictEqual(jev.id, "jev");
  assert.strictEqual(jev.name, "Jev AI Connectome (Pure)");

  const fly = getEngine("fly");
  assert.strictEqual(fly.id, "fly");
  assert.strictEqual(fly.name, "Superfly Connectome (PUCT MCTS)");

  const hybrid = getEngine("jev-fly");
  assert.strictEqual(hybrid.id, "jev-fly");
  assert.strictEqual(hybrid.name, "Jev AI + Superfly Connectome Hybrid");
  console.log("✓ Engine Registry verification passed (4 engines registered).");

  // Test 2: Pure Stockfish play
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const sfRes = await playEngineMove("stockfish", { fen: startFen, depth: 6 });
  assert.ok(sfRes.uci, "Stockfish must produce UCI move");
  assert.ok(sfRes.san, "Stockfish must produce SAN move");
  assert.strictEqual(sfRes.engine, "stockfish");
  assert.ok(sfRes.prediction, "Stockfish must include opponent prediction");
  console.log(`✓ Stockfish Pure: ${sfRes.san} (${sfRes.uci}), prediction: ${sfRes.prediction?.san}`);

  // Test 3: Pure Superfly Connectome PUCT MCTS
  const flyRes = await playEngineMove("fly", { fen: startFen, simulations: 15 });
  assert.ok(flyRes.uci, "Superfly must produce UCI move");
  assert.strictEqual(flyRes.engine, "fly");
  assert.ok(flyRes.probabilities, "Superfly must include probabilities");
  console.log(`✓ Superfly Connectome: ${flyRes.san} (${flyRes.uci}), confidence: ${flyRes.confidence}`);

  // Test 4: Jev + Superfly Hybrid (Novelty Engine)
  const hybridRes = await playEngineMove("jev-fly", { fen: startFen, depth: 10, simulations: 20 });
  assert.ok(hybridRes.uci, "Hybrid must produce UCI move");
  assert.strictEqual(hybridRes.engine, "jev-fly");
  assert.ok(hybridRes.prediction, "Hybrid must include Stockfish opponent prediction");
  console.log(`✓ Hybrid (Jev + Fly): ${hybridRes.san} (${hybridRes.uci}), prediction: ${hybridRes.prediction?.san}`);

  console.log("=== All Engine Architecture Tests Passed! ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
