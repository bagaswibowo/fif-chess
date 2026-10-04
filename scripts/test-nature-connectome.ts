import { isPredationTrap } from "../lib/flybrain/service";
import { playEngineMove } from "../lib/engines";
import { getLearnedMove, isBlunderMove, recordMatchExperience } from "../lib/experience";

async function main() {
  console.log("=== Testing Nature 2024 Connectome Circuits & Zero-Guard Intelligence ===");

  // Test 1: Predation trap detection on Move 3: 1. d4 e5 2. dxe5 Bb4+ 3. c3
  const fen3 = "rnbqk1nr/pppp1ppp/8/4P3/1b6/2P5/PP2PPPP/RNBQKBNR b KQkq - 0 3";
  const trapNc6 = isPredationTrap(fen3, "b8c6");
  const trapBc5 = isPredationTrap(fen3, "b4c5");
  const trapBa5 = isPredationTrap(fen3, "b4a5");

  console.log("Test 1 - Predation Trap Check:");
  console.log("  3... Nc6 (leaves bishop to cxb4):", trapNc6, trapNc6 === true ? "✓ PASS" : "✗ FAIL");
  console.log("  3... Bc5 (retreats bishop):", trapBc5, trapBc5 === false ? "✓ PASS" : "✗ FAIL");
  console.log("  3... Ba5 (retreats bishop):", trapBa5, trapBa5 === false ? "✓ PASS" : "✗ FAIL");

  if (!trapNc6 || trapBc5 || trapBa5) {
    throw new Error("Predation trap detection failed.");
  }

  // Test 2: Superfly Connectome move selection (Zero Stockfish Guard)
  console.log("\nTest 2 - Pure Superfly Move Selection on Trap Position:");
  const flyMove = await playEngineMove("fly", { fen: fen3, simulations: 35 });
  console.log("  Superfly chose:", flyMove.uci, flyMove.san);
  if (flyMove.uci === "b8c6") {
    throw new Error("Superfly blundered bishop on b4!");
  }
  console.log("  ✓ PASS: Superfly avoided catastrophic predation trap!");

  // Test 3: Hybrid Jev-Fly move selection (Zero Stockfish Guard)
  console.log("\nTest 3 - Hybrid Jev-Fly Move Selection on Trap Position:");
  const hybridMove = await playEngineMove("jev-fly", { fen: fen3, simulations: 40 });
  console.log("  Hybrid chose:", hybridMove.uci, hybridMove.san);
  if (hybridMove.uci === "b8c6") {
    throw new Error("Hybrid blundered bishop on b4!");
  }
  console.log("  ✓ PASS: Hybrid avoided catastrophic predation trap!");

  // Test 4: Online Experience Memory Learning
  console.log("\nTest 4 - Online Synaptic Plasticity Learning:");
  recordMatchExperience(fen3, "b4c5", -50, "b8c6");
  const learned = getLearnedMove(fen3);
  const isBlunder = isBlunderMove(fen3, "b8c6");
  console.log("  Learned move:", learned?.move, "Score:", learned?.score);
  console.log("  Is 3... Nc6 remembered as blunder?", isBlunder);

  if (learned?.move !== "b4c5" || !isBlunder) {
    throw new Error("Synaptic experience memory failed.");
  }
  console.log("  ✓ PASS: Memory recorded and recalled successfully!");

  console.log("\n>>> ALL NATURE 2024 CONNECTOME & LEARNING TESTS PASSED! <<<");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
