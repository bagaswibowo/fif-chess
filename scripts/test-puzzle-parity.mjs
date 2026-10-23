/**
 * scripts/test-puzzle-parity.mjs (P1 AC)
 * Simulasi chess.js pada 100 puzzle DB: mainkan langkah user (index genap)
 * berurutan dengan validateSolutionStep-parity → semua harus ok:true.
 * Juga: langkah legal-rawan (bukan solusi) harus ditolak (not-solution).
 */
import { Chess } from "chess.js";
import pg from "pg";

const { Pool } = pg;

function validateSolutionStep(fen, uci, solutionUci) {
  const chess = new Chess(fen);
  let move;
  try {
    move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? uci[4] : undefined,
    });
  } catch {
    return { ok: false, reason: "illegal" };
  }
  if (uci !== solutionUci) return { ok: false, reason: "not-solution", san: move.san };
  return { ok: true, san: move.san, nextFen: chess.fen() };
}

function applyUci(fen, uci) {
  try {
    const chess = new Chess(fen);
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length === 5 ? uci[4] : undefined });
    return chess.fen();
  } catch { return null; }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  "SELECT id, fen, solution_moves FROM puzzles WHERE solution_moves IS NOT NULL ORDER BY random() LIMIT 100"
);
let pass = 0, fail = 0, wrongRejected = 0;
for (const r of rows) {
  const moves = r.solution_moves;
  if (!Array.isArray(moves) || moves.length === 0) { fail++; continue; }
  let ok = true;
  let fenNow = r.fen;
  for (let step = 0; step * 2 < moves.length; step++) {
    const userUci = moves[step * 2];
    const res = validateSolutionStep(fenNow, userUci, userUci);
    if (!res.ok) { ok = false; console.log("FAIL", r.id, "step", step, userUci, res.reason); break; }
    // sanity: langkah legal lain harus not-solution (cek di langkah pertama saja)
    if (step === 0) {
      const legal = new Chess(r.fen).moves({ verbose: true }).find((m) => m.from + m.to !== userUci.slice(0, 4));
      if (legal) {
        const bad = validateSolutionStep(r.fen, legal.from + legal.to, userUci);
        if (bad.ok) { ok = false; console.log("WRONGMOVE accepted?!", r.id); break; }
        wrongRejected++;
      }
    }
    fenNow = res.nextFen;
    const replyUci = moves[step * 2 + 1];
    if (replyUci) {
      fenNow = applyUci(fenNow, replyUci);
      if (!fenNow) { ok = false; console.log("REPLYFAIL", r.id, replyUci); break; }
    }
  }
  if (ok) pass++; else fail++;
}
console.log(`RESULT: pass=${pass} fail=${fail} (of ${rows.length}), wrong-move-rejected-checks=${wrongRejected}`);
await pool.end();
if (fail > 0) process.exit(1);
