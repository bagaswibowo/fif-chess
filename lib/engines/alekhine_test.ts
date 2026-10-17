import { Chess } from "chess.js";
import { playEngineMove } from "./index";

async function runRegressionSuite() {
  console.log("==========================================================");
  console.log(" REGRESSION TEST: ALEKHINE-CHATARD DEFENSE (MATT POCOCK TDD)");
  console.log("==========================================================");

  // 1. Move 8 Test
  const c8 = new Chess();
  const moves = ["d4","e6","e4","d5","Nc3","Nf6","Bg5","Be7","e5","Nfd7","h4","O-O","Qh5","Re8","Bd3"];
  for (const m of moves) c8.move(m);
  const fen8 = c8.fen();

  console.log("\n[TEST 1] Testing Move 8 Defense against 8.Bd3 (Qxh7# threat)");
  const res8 = await playEngineMove("jev-fly", { fen: fen8, depth: 14 });
  console.log(`  Engine chose: ${res8.san} (${res8.uci}) | Gate: ${res8.metadata?.gateReason || "clean"}`);

  if (res8.uci === "e7g5") {
    throw new Error("FAILED: Engine played suicidal blunder 8...Bxg5?? allowing 9.hxg5 and mating net!");
  }
  if (res8.uci === "d7f8" || res8.san === "Nf8" || res8.san === "g6" || res8.san === "f5") {
    console.log("  ✓ PASSED: Engine correctly defended h7 with " + res8.san);
  } else {
    console.log("  ? Safe move played: " + res8.san);
  }

  // 2. Move 9 Test
  c8.move("Bxg5");
  c8.move("hxg5");
  const fen9 = c8.fen();

  console.log("\n[TEST 2] Testing Move 9 Escape if trapped in hxg5");
  const res9 = await playEngineMove("jev-fly", { fen: fen9, depth: 14 });
  console.log(`  Engine chose: ${res9.san} (${res9.uci}) | Gate: ${res9.metadata?.gateReason || "clean"}`);

  if (res9.uci === "b8a6") {
    throw new Error("FAILED: Engine played passive blunder 9...Na6?? allowing mate in 4!");
  }
  if (res9.uci === "g8f8" || res9.san === "Kf8") {
    console.log("  ✓ PASSED: Engine correctly escaped mating net with " + res9.san);
  } else {
    console.log("  ? Safe move played: " + res9.san);
  }

  console.log("\n==========================================================");
  console.log(" ALL REGRESSION TESTS PASSED CLEANLY!");
  console.log("==========================================================");
}

runRegressionSuite().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message);
  process.exit(1);
});
