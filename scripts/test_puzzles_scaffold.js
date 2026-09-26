const { Chess } = require('/home/sxz/projects/active/jev-chess/node_modules/chess.js');

function testMove(fen, uci, expectedSan) {
  const c = new Chess(fen);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  const res = c.move({ from, to, promotion });
  if (!res) {
    throw new Error('Illegal move: ' + uci + ' in FEN: ' + fen);
  }
  return res.san;
}

console.log('Testing testMove: ', testMove('r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4', 'h5f7', 'Qxf7#'));
