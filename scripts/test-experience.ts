import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getLearnedMove, recordMatchExperience, isBlunderMove, normalizeFen } from "../lib/experience.ts";

const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 10";

// Clean initial state for this test key
const dbFile = path.join(process.env.JEV_DATA_DIR || path.join(process.cwd(), "data"), "experience.json");
try {
  const db = JSON.parse(fs.readFileSync(dbFile, "utf-8"));
  delete db[normalizeFen(fen)];
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
} catch {}

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
