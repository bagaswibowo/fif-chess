const { Chess } = require('../node_modules/chess.js');

function validatePuzzle(p) {
  const c = new Chess();
  c.load(p.fen);
  if (c.turn() !== p.turn) {
    throw new Error(`Turn mismatch in ${p.id}: expected ${p.turn}, got ${c.turn()}`);
  }
  const from = p.solutionUci.slice(0, 2);
  const to = p.solutionUci.slice(2, 4);
  const promotion = p.solutionUci.length > 4 ? p.solutionUci[4] : undefined;
  const res = c.move({ from, to, promotion });
  if (!res) {
    throw new Error(`Illegal move in ${p.id}: ${p.solutionUci} on ${p.fen}`);
  }
  return res.san;
}

module.exports = { validatePuzzle };
