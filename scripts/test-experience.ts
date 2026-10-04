import assert from "node:assert/strict";
import { getLearnedMove, recordMatchExperience, isBlunderMove } from "../lib/experience.ts";

const testId = Date.now();
// Unique ep square ensuring unique key in parts[0..3] across test executions
const fen = `8/8/8/8/8/8/8/4K2k w - a${(testId % 6) + 2} 0 1`;

// 1. Initial state: no learned move
assert.equal(getLearnedMove(fen), null);

// 2. Record experience from match against Stockfish
recordMatchExperience(fen, "e7e5", -30, "f7f6");

// 3. Learned move exists
const learned = getLearnedMove(fen);
assert.notEqual(learned, null);
assert.equal(learned?.move, "e7e5");

// 4. Blunder move remembered and penalized
assert.equal(isBlunderMove(fen, "f7f6"), true);
assert.equal(isBlunderMove(fen, "e7e5"), false);

console.log("experience learning tests passed: persist=ok, blunder_filter=ok");
