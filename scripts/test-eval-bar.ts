import assert from "node:assert/strict";
import { calculateMaterialCp } from "../lib/chess.ts";

// 1. Initial position: completely balanced (0 material diff)
const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
assert.equal(calculateMaterialCp(startFen), 0, "start FEN should have 0 material diff");

// 2. White has an extra pawn (+100 cp)
const whiteExtraPawn = "rnbqkbnr/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
assert.equal(calculateMaterialCp(whiteExtraPawn), 100, "White with extra pawn should be +100");

// 3. Black has an extra queen (-900 cp)
const blackExtraQueen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1";
assert.equal(calculateMaterialCp(blackExtraQueen), -900, "Black with extra queen should be -900");

// 4. White takes pawn: instantly swings from 0 to +100
console.log("eval-bar material tests passed: start=0, extraPawn=+100, extraQueen=-900");
