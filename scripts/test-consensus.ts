import assert from "node:assert/strict";
import { consensusMoves } from "../lib/flybrain/consensus.ts";

const dbs = {
  Lichess: { e2e4: 420, d2d4: 310, g1f3: 180 },
  "365chess": { e2e4: 390, d2d4: 290, b2b3: 45 },
  PGD: { e2e4: 410, d2d4: 300 },
};

const r = consensusMoves("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", dbs);
const e4 = r.moves.find((m) => m.san === "e2e4");
const d4 = r.moves.find((m) => m.san === "d2d4");

assert.ok(e4 && e4.reliability === "strong" && !e4.snowflake, "e4 should be strong");
assert.ok(d4 && d4.reliability === "strong", `d4 should be strong, got ${d4?.reliability}`);
assert.ok(r.strongPct >= 0 && r.strongPct <= 100, "pct bounds");
assert.ok(r.snowflakePct >= 0 && r.snowflakePct <= 100, "pct bounds");

// Asymmetric DB noise detection (KCg-m compensation analog)
const dbsAsym = {
  Lichess: { e2e4: 420, d2d4: 310 },
  "365chess": { e2e4: 130, d2d4: 290 },
  PGD: { e2e4: 137, d2d4: 300 },
};

const r2 = consensusMoves("fen", dbsAsym);
const e4l = r2.moves.find((m) => m.san === "e2e4");
assert.ok(e4l && e4l.technicalNoise > 0.25, `noise should be >0.25, got ${e4l?.technicalNoise}`);
assert.equal(e4l.reliability, "moderate", `noisy strong should drop to moderate, got ${e4l.reliability}`);

const d4l = r2.moves.find((m) => m.san === "d2d4");
assert.ok(d4l && d4l.reliability === "strong", "d4l should be strong");

console.log("consensus self-check passed:", r.strongPct, r.snowflakePct, r.nTypes);
