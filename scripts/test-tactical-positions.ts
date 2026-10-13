import assert from "node:assert";
import { playEngineMove } from "../lib/engines";

interface TestCase {
  id: string;
  name: string;
  fen: string;
  forbiddenMoves?: string[];
  expectedMoves?: string[];
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: "move-32",
    name: "Move 32 King attack position",
    fen: "2br2k1/p1qrb1p1/1pp1p2P/4p3/P1PP1B1P/6Q1/3R1P2/1B1R2K1 b - - 0 32",
    forbiddenMoves: ["c8b7", "d8e8", "d7d6", "e5f4", "e5d4"],
    expectedMoves: ["e7h4", "e7f8", "e7f6"],
    description: "Must defend against 33. Qxg7# attack by maintaining king shelter (e.g. Bxh4 countering queen)",
  },
  {
    id: "move-39",
    name: "Move 39 Queen pin position",
    fen: "2brk3/p1q5/1pp1p2p/7Q/P1PP1p2/8/5P2/1B4RK b - - 5 39",
    forbiddenMoves: ["c7f7"],
    expectedMoves: ["e8d7", "e8e7"],
    description: "Must NOT play Qf7 (c7f7) into Bg6 pin; must move King out of check (Kd7 or Ke7)",
  },
  {
    id: "move-43",
    name: "Move 43 Promotion position",
    fen: "6k1/2P2p1p/3R2p1/8/5PPb/N4r1P/8/2B3K1 b - - 0 43",
    forbiddenMoves: ["f3g3", "g8g7", "g8h8", "h4e7"],
    expectedMoves: ["f3c3"],
    description: "Must block/attack c8=Q promotion via Rc3 (f3c3) controlling c8 and attacking c7",
  },
];

async function runTests() {
  console.log("=============================================================");
  console.log("  TACTICAL TEST SUITE: JEV + FLYBRAIN CRITICAL POSITIONS");
  console.log("=============================================================\n");

  const results: Array<{
    id: string;
    name: string;
    uci: string;
    san: string;
    passed: boolean;
    reason: string;
  }> = [];

  for (const tc of TEST_CASES) {
    console.log(`[TEST] ${tc.name}`);
    console.log(`  FEN: ${tc.fen}`);
    console.log(`  Requirement: ${tc.description}`);

    const res = await playEngineMove("jev-fly", {
      fen: tc.fen,
      depth: 10,
      simulations: 20,
    });

    console.log(`  -> Engine move: ${res.san} (${res.uci}) [confidence: ${res.confidence}]`);

    let passed = true;
    let reason = "OK";

    if (tc.forbiddenMoves && tc.forbiddenMoves.includes(res.uci)) {
      passed = false;
      reason = `Played forbidden blunder move ${res.uci} (${res.san})`;
    } else if (tc.expectedMoves && !tc.expectedMoves.includes(res.uci)) {
      passed = false;
      reason = `Move ${res.uci} (${res.san}) not in expected sound moves: ${tc.expectedMoves.join(", ")}`;
    }

    console.log(`  -> Result: ${passed ? "PASS" : "FAIL"} (${reason})\n`);
    results.push({
      id: tc.id,
      name: tc.name,
      uci: res.uci,
      san: res.san,
      passed,
      reason,
    });
  }

  console.log("=============================================================");
  console.log("  SUMMARY RESULTS");
  console.log("=============================================================");
  for (const r of results) {
    console.log(`  ${r.passed ? "✓ PASS" : "✗ FAIL"}: ${r.name} -> ${r.san} (${r.uci}) - ${r.reason}`);
  }

  const allPassed = results.every((r) => r.passed);
  console.log(`\nOverall: ${allPassed ? "ALL TESTS PASSED" : "TEST FAILURES DETECTED"}`);
  if (!allPassed) {
    process.exitCode = 1;
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
