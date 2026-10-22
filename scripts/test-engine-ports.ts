/**
 * scripts/test-engine-ports.ts
 * QA tests for lib engine ports (chess-com-engine, threat-detection, post-game-analysis,
 * bot-chat, opening-book, extra-security).
 * Run: DATABASE_URL='...' npx tsx scripts/test-engine-ports.ts
 */

import { lookupFen } from "@/lib/opening-book";
import { fetchBotChatV2 } from "@/lib/bot-chat";
import { detectThreats } from "@/lib/threat-detection";
import { analyzePgn } from "@/lib/post-game-analysis";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

async function main() {
  console.log("=== QA: lib engine ports ===\n");

  // --- opening-book ---
  console.log("opening-book:");
  const r1 = lookupFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  check("start position valid=true", r1.valid === true);
  check("sideToMove=w", r1.sideToMove === "w");
  const r2 = lookupFen("invalid fen");
  check("invalid FEN valid=false", r2.valid === false);

  // --- bot-chat ---
  console.log("bot-chat:");
  const bc = await fetchBotChatV2(
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2",
    "*",
    "b",
    "Jev"
  );
  check("explanation non-empty", typeof bc.explanation === "string" && bc.explanation.length > 0);
  check("confidence >= 0", bc.confidence >= 0);
  const bcInvalid = await fetchBotChatV2("invalid", "*", "w", "Jev");
  check("invalid FEN graceful (no crash)", bcInvalid.explanation !== undefined);

  // --- post-game-analysis ---
  console.log("post-game-analysis:");
  const pa = await analyzePgn("1. e4 e5 2. Nf3 Nc6", "1/2-1/2");
  check("totalPly=4", pa.totalPly === 4);
  check("averageCpl >= 0", pa.averageCpl >= 0);
  check("analysis has 4 entries", pa.analysis.length === 4);

  // --- threat-detection ---
  console.log("threat-detection:");
  const th = await detectThreats("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2");
  check("returns array", Array.isArray(th));
  const thEmpty = await detectThreats("8/8/8/8/8/8/8/K6k w - - 0 1");
  check("game over → empty array", thEmpty.length === 0);

  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
