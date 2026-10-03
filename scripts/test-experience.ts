import assert from "node:assert/strict";
import { getLearnedMove, recordMatchExperience, isBlunderMove } from "../lib/experience.ts";

const testId = Date.now();
// Unique board position with isolated pawn on random rank
const fen = `8/8/8/8/${(testId % 7) + 1}P6/8/8/4K2k w - - 0 1`;

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
