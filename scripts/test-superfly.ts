import { Chess } from "chess.js";
import { getFlyBrain } from "../lib/flybrain/service.ts";
// @ts-ignore
import { runMCTS } from "../lib/flybrain/mcts.js";
// @ts-ignore
import * as enc from "../lib/flybrain/encoding.js";

const chess = new Chess("8/8/8/Pk2p3/1P2N3/3K1p2/8/8 b - - 0 45");
const brain = getFlyBrain();

console.log("Starting Superfly MCTS (40 sims)...");
const t0 = Date.now();
const res = runMCTS(brain, chess, enc, { sims: 40, cPuct: 1.5 });
const elapsed = Date.now() - t0;

console.log(`Superfly chosen move: ${res.move} in ${elapsed}ms (sims: ${res.sims})`);
console.log("Top visit moves:", res.visits.slice(0, 3));
