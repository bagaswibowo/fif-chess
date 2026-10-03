import assert from "node:assert/strict";
import { guardJevFlyMove } from "../lib/stockfish.ts";
import { playSuperflyMove } from "../lib/flybrain/service.ts";

async function main() {
  const fen = "8/8/8/Pk2p3/1P2N3/3K1p2/8/8 b - - 0 45";
  console.log("Testing Archive 6 Move 45 Endgame Guard...");
  const rawMove = playSuperflyMove(fen, 20);
  assert.ok(rawMove, "rawMove must exist");
  console.log("Superfly candidate move:", rawMove.uci);

  const guarded = await guardJevFlyMove(fen, {
    ...rawMove,
    droppedMoveCount: 0,
    request: {} as any,
  }, 14);

  console.log("Guarded move chosen:", guarded.uci, guarded.san);
  // White pawn on a5 must be controlled; Black king must NOT blunder away to b4 leaving a5 open!
  // Stockfish best move is b5c6 (Kc6)
  assert.notEqual(guarded.uci, "b5b4", "Guard must NOT allow blunder move b5b4");
  console.log("Archive 6 Move 45 guard test PASSED: prevented bait pawn capture b5b4!");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
