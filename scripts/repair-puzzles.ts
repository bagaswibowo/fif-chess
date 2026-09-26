// Hitung ulang description + difficulty dari FEN. Satu sumber kebenaran.
// Jalankan: node --experimental-strip-types --no-warnings scripts/repair-puzzles.ts
import { Chess } from "chess.js";
import { PUZZLES, type Puzzle } from "../lib/puzzle-data.ts";

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME: Record<string, [string, string]> = {
  w: ["Putih", "Hitam"],
  b: ["Hitam", "Putih"],
};
const PIECE: Record<string, string> = {
  p: "pion",
  n: "knight",
  b: "gajah",
  r: "menara",
  q: "sekertaris",
};

const CAT: Record<string, string> = {
  opening: "pembukaan",
  middlegame: "babak tengah",
  endgame: "babak akhir",
};

function facts(puz: Puzzle) {
  const c = new Chess(puz.fen);
  const mover = c.turn();
  const before = c.get(puz.solutionUci.slice(0, 2) as never); // piece that moves
  const captured = c.get(puz.solutionUci.slice(2, 4) as never);
  c.move(puz.solutionUci);
  const inCheck = c.isCheck();
  const mate = c.isCheckmate();
  const promo = c.history({ verbose: true }).at(-1)?.promotion;
  return {
    mover,
    moverName: NAME[mover][0],
    oppName: NAME[mover][1],
    piece: before?.type ?? "?",
    pieceName: PIECE[before?.type ?? "?"] ?? "bidak",
    captured: captured?.type ?? null,
    capturedName: captured ? (PIECE[captured.type] ?? "bidak") : null,
    capturedValue: captured ? VALUE[captured.type] : 0,
    promo,
    inCheck,
    mate,
    threats: c.moves({ verbose: true }).filter((m) => m.captured).length,
    replies: c.isCheck() ? c.moves().length : 0,
  };
}

function describe(puz: Puzzle): string {
  const f = facts(puz);
  const where = CAT[puz.category] ?? puz.category;
  const at = puz.solutionUci.slice(2, 4);
  const land = puz.solutionUci.slice(0, 2);

  if (f.mate) {
    return `${f.moverName} menutup dengan ${puz.solutionSan} dan itu langsung skakmat. Lawan tidak punya satu jawaban pun.`;
  }
  if (f.promo) {
    const cap = f.capturedName
      ? ` sambil menangkap ${f.capturedName} bernilai ${f.capturedValue} pion di ${at}`
      : ` tanpa captures`;
    return `Pion di ${land} maju dan langsung promosi${cap}. ${f.moverName} menyelesaikan dengan ${puz.solutionSan} dan mendapat perwira baru di ${at}.`;
  }
  if (f.capturedName) {
    const net = f.capturedValue - VALUE[f.piece];
    const tail = f.inCheck
      ? ` dan langsung memberi skak. ${f.oppName} tinggal ${f.replies} jawaban.`
      : `. Posisi ini masuk hitungan taktik.`;
    return `${f.moverName} menjawab dengan ${puz.solutionSan}: ${f.pieceName} ${f.moverName} mengambil ${f.capturedName} bernilai ${f.capturedValue} pion di ${at} (selisih ${net} poin)${tail}`;
  }
  return `${f.moverName} menjawab dengan ${puz.solutionSan} di ${at}${f.inCheck ? " sambil memberi skak" : ""}.`;
}

// Sulit = butuhذبocker lebih dari satu langkah. Mate di langkah pertama bukan Sulit.
function difficulty(puz: Puzzle): "Mudah" | "Sedang" | "Sulit" {
  const f = facts(puz);
  if (f.mate) return "Mudah";
  if (!f.inCheck && !f.captured) return "Mudah";
  if (f.replies > 4) return "Mudah";
  if (f.captured && f.capturedValue - VALUE[f.piece] >= 5) return "Sulit";
  return "Sedang";
}

const XP: Record<string, number> = { Mudah: 50, Sedang: 100, Sulit: 175 };

const out = PUZZLES.map((p) => {
  const d = difficulty(p);
  return `    {
      "id": "${p.id}",
      "category": "${p.category}",
      "difficulty": "${d}",
      "xp": ${XP[d]},
      "track": "${p.track}",
      "fen": "${p.fen}",
      "turn": "${p.turn}",
      "solutionUci": "${p.solutionUci}",
      "solutionSan": "${p.solutionSan}",
      "motif": "${p.motif}",
      "theme": "${p.theme}",
      "description": ${JSON.stringify(describe(p))},
      "hintPiece": ${JSON.stringify(
        facts(p).piece === "p"
          ? `Pion di ${p.solutionUci.slice(0, 2)}`
          : `${(facts(p).pieceName ?? "Bidak").replace(/^./, (c) => c.toUpperCase())} ${facts(p).moverName}`,
      )},
      "trickExplanation": ${JSON.stringify(describe(p))},
    },`;
});

console.log(out.join("\n"));
console.log(
  `\n// total ${out.length}; ` +
    `mate=${PUZZLES.filter((p) => facts(p).mate).length} ` +
    `promo=${PUZZLES.filter((p) => facts(p).promo).length}`,
);
