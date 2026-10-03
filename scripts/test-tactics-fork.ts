import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { isKnightFork, isQueenThreatened } from "../lib/chess.ts";

// 1. Royal Fork Test: White Knight on d5 moves to c7, forking Black King on e8 and Black Rook on a8
const forkFen = "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1";
const forkChess = new Chess(forkFen);
assert.equal(isKnightFork(forkChess, "d5c7"), true, "d5c7 must be detected as Royal Fork (King on e8 + Rook on a8)");
assert.equal(isKnightFork(forkChess, "d5b6"), false, "d5b6 does not fork 2 high-value pieces");

// 2. Queen Threatened Test: White Rook on d1 attacks Black Queen on d4
const rayFen = "2r2rk1/pp6/7b/3n1p2/3q1B2/5Q2/PP4PP/3R1R1K b - - 0 27";
const rayChess = new Chess(rayFen);
assert.equal(isQueenThreatened(rayChess), true, "Queen on d4 is attacked by Rd1 and Bf4");

// 3. Safe Queen Test: Queen not under attack
const safeFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const safeChess = new Chess(safeFen);
assert.equal(isQueenThreatened(safeChess), false, "Starting queen is not attacked");

console.log("tactics fork & queen threat tests passed: royal_fork=ok, queen_threat=ok");
