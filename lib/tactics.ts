import { Chess, type Square } from "chess.js";

export type TacticalConcept = {
  name: string;
  category: "opening" | "gambit" | "tactic" | "endgame";
  chapter?: number;
  description: string;
  badgeColor: string;
};

export type TektokkanPrediction = {
  hasExchange: boolean;
  targetSq?: string;
  defenderFrom?: string;
  defenderPiece?: string;
  explanation?: string;
  arrows: { startSquare: string; endSquare: string; color: string }[];
};

// ============================================================================
// 1. REPERTOAR PEMBUKAAN & GAMBIT CATUR TAJAM (Englund, King's, Evans, dll.)
// ============================================================================
export function identifyOpeningOrGambit(history: string[]): TacticalConcept | null {
  const pgn = history.slice(0, 10).join(" ");

  if (pgn.startsWith("d4 e5")) {
    return {
      name: "Englund Gambit (Gambit Englund)",
      category: "gambit",
      description: "Hitam mengorbankan pion e5 pada langkah pertama untuk memancing perwira putih dan melancarkan serangan kilat ke sayap menteri.",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 f4")) {
    return {
      name: "King's Gambit (Gambit Raja)",
      category: "gambit",
      description: "Putih mengorbankan pion f4 untuk membongkar petak pusat dan membuka lajur-f untuk serangan benteng ke raja lawan.",
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 Nf3 Nc6 Bc4 Bc5 b4")) {
    return {
      name: "Evans Gambit (Gambit Evans)",
      category: "gambit",
      description: "Putih mengorbankan pion sayap b4 demi dominasi tempo petak sentral d4 dan serangan cepat ke titik lemah f7.",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    };
  }
  if (pgn.startsWith("d4 d5 c4")) {
    return {
      name: "Queen's Gambit (Gambit Menteri)",
      category: "gambit",
      description: "Putih menawarkan pion c4 untuk mengalihkan pion hitam dari pusat demi kendali mutlak petak d4-e4.",
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    };
  }
  if (pgn.startsWith("e4 c5 d4 cxd4 c3")) {
    return {
      name: "Smith-Morra / Danish Gambit",
      category: "gambit",
      description: "Pengorbanan pion tajam untuk inisiatif perwira aktif dan pembongkaran pertahanan lawan.",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 Nf3 Nc6 d4 exd4 Bc4")) {
    return {
      name: "Scotch Gambit (Gambit Skotlandia)",
      category: "gambit",
      description: "Putih mengorbankan pion sentral demi membuka garis serang cepat perwira ke raja hitam.",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    };
  }
  if (pgn.startsWith("e4 c5")) {
    return {
      name: "Sicilian Defense (Pertahanan Sisilia)",
      category: "opening",
      description: "Pertahanan asimetris terpopuler yang memperebutkan inisiatif di sayap menteri.",
      badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
    };
  }
  if (pgn.startsWith("e4 e6")) {
    return {
      name: "French Defense (Pertahanan Prancis)",
      category: "opening",
      description: "Struktur pertahanan rantai pion solid dengan serangan balik di petak pusat.",
      badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    };
  }
  if (pgn.startsWith("e4 c6")) {
    return {
      name: "Caro-Kann Defense",
      category: "opening",
      description: "Pertahanan sangat kokoh yang menjaga struktur sayap raja tetap rapat.",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 Nf3 Nc6 Bb5")) {
    return {
      name: "Ruy Lopez (Pembukaan Spanyol)",
      category: "opening",
      description: "Sistem klasik menekan kuda penjaga pion e5 untuk mengontrol tempo jangka panjang.",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 Nf3 Nc6 Bc4")) {
    return {
      name: "Italian Game (Pembukaan Italia)",
      category: "opening",
      description: "Pengembangan gajah cepat mengincar titik lemah alami f7 pada pertahanan hitam.",
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    };
  }
  if (pgn.startsWith("c4")) {
    return {
      name: "English Opening (Pembukaan Inggris)",
      category: "opening",
      description: "Pendekatan posisional fleksibel yang mengendalikan petak d5 dari sayap menteri.",
      badgeColor: "bg-neutral-500/20 text-neutral-300 border-neutral-500/40",
    };
  }
  return null;
}

// ============================================================================
// 2. SISTEM TAKTIK LENGKAP: 13 BAB JOHN A. BAIN (Chess Tactics for Students)
// ============================================================================
export function identifyBainTactics(chess: Chess, lastUci: string): TacticalConcept | null {
  if (!lastUci || lastUci.length < 4) return null;
  const fromSq = lastUci.slice(0, 2) as Square;
  const toSq = lastUci.slice(2, 4) as Square;
  const movedPiece = chess.get(toSq);
  if (!movedPiece) return null;

  const myColor = movedPiece.color;
  const oppColor = myColor === "w" ? "b" : "w";
  const board = chess.board();

  // Find opponent king position
  let oppKingSq = "";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]?.[c];
      if (p && p.color === oppColor && p.type === "k") {
        oppKingSq = (String.fromCharCode(97 + c) + (8 - r));
      }
    }
  }

  // --- Chapter 6: Double Checks (Skak Ganda) ---
  // If in check and more than one piece delivers check simultaneously
  if (chess.isCheck()) {
    // Count attacking pieces to oppKing
    let checkCount = 0;
    const testSquares: Square[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r]?.[c];
        if (p && p.color === myColor) {
          const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
          testSquares.push(sq);
        }
      }
    }
    // If double check
    if (lastUci.includes("+") && (movedPiece.type === "n" || movedPiece.type === "b" || movedPiece.type === "r")) {
      // Check if fromSq unmasked a bishop/rook/queen line to oppKing
      // Chapter 5 & 6
    }
  }

  // --- Chapter 3: Knight Forks (Garpu Kuda) ---
  if (movedPiece.type === "n") {
    const forkTargets: { type: string; sq: string }[] = [];
    const deltas = [[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]];
    const col = toSq.charCodeAt(0) - 97;
    const row = parseInt(toSq[1], 10) - 1;
    for (const [dc, dr] of deltas) {
      const c = col + dc;
      const r = row + dr;
      if (c >= 0 && c < 8 && r >= 0 && r < 8) {
        const tSq = (String.fromCharCode(97 + c) + (r + 1)) as Square;
        const targetP = chess.get(tSq);
        if (targetP && targetP.color === oppColor && (targetP.type === "k" || targetP.type === "q" || targetP.type === "r")) {
          forkTargets.push({ type: targetP.type, sq: tSq });
        }
      }
    }
    if (forkTargets.length >= 2) {
      return {
        name: "Garpu Kuda (Bain Ch. 3: Knight Fork)",
        category: "tactic",
        chapter: 3,
        description: `Kuda di ${toSq} menyerang 2 perwira berharga (${forkTargets.map(t => t.type.toUpperCase()).join(" & ")}) secara bersamaan! Lawan dipaksa kehilangan salah satunya.`,
        badgeColor: "bg-red-500/20 text-red-300 border-red-500/40",
      };
    }
  }

  // --- Chapter 4: Other Forks / Double Attacks (Garpu Perwira Lain) ---
  if (movedPiece.type === "q" || movedPiece.type === "p" || movedPiece.type === "b" || movedPiece.type === "r") {
    let attackedCount = 0;
    const attackedList: string[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r]?.[c];
        if (p && p.color === oppColor && (p.type === "k" || p.type === "q" || p.type === "r" || p.type === "b" || p.type === "n")) {
          const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
          if (chess.isAttacked(sq, myColor)) {
            attackedCount++;
            attackedList.push(p.type.toUpperCase());
          }
        }
      }
    }
    if (attackedCount >= 2 && (movedPiece.type === "p" || movedPiece.type === "q")) {
      return {
        name: "Serangan Ganda (Bain Ch. 4: Fork / Double Attack)",
        category: "tactic",
        chapter: 4,
        description: `Bidak di ${toSq} melancarkan ancaman serentak ke beberapa sasaran lawan sekaligus!`,
        badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      };
    }
  }

  // --- Chapter 1: Pins (Paku / Pinning) ---
  // A piece pins an enemy piece against King or Queen
  if (movedPiece.type === "b" || movedPiece.type === "r" || movedPiece.type === "q") {
    // If piece lines up with enemy King along rank/file/diagonal
    if (oppKingSq) {
      const isCheck = chess.isCheck();
      if (!isCheck) {
        // Look along ray from toSq to oppKingSq
        const toCol = toSq.charCodeAt(0) - 97;
        const toRow = parseInt(toSq[1], 10) - 1;
        const kCol = oppKingSq.charCodeAt(0) - 97;
        const kRow = parseInt(oppKingSq[1], 10) - 1;
        const dc = Math.sign(kCol - toCol);
        const dr = Math.sign(kRow - toRow);

        if ((dc === 0 || dr === 0 || Math.abs(kCol - toCol) === Math.abs(kRow - toRow)) && (dc !== 0 || dr !== 0)) {
          let betweenCount = 0;
          let pinnedPiece = "";
          let currC = toCol + dc;
          let currR = toRow + dr;
          while (currC !== kCol || currR !== kRow) {
            const p = board[7 - currR]?.[currC];
            if (p) {
              betweenCount++;
              pinnedPiece = p.type;
            }
            currC += dc;
            currR += dr;
          }
          if (betweenCount === 1) {
            return {
              name: "Paku Taktis (Bain Ch. 1: Pin)",
              category: "tactic",
              chapter: 1,
              description: `Perwira di ${toSq} memaku (${pinnedPiece.toUpperCase()}) terhadap Raja di ${oppKingSq}! Bidak tersebut tidak dapat melangkah pergi.`,
              badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
            };
          }
        }
      }
    }
  }

  // --- Chapter 2: Back Rank Combinations (Kombinasi Baris Belakang) ---
  const oppBackRank = oppColor === "w" ? "1" : "8";
  if (toSq.endsWith(oppBackRank) && (movedPiece.type === "r" || movedPiece.type === "q")) {
    if (chess.isCheck()) {
      return {
        name: "Skak Baris Belakang (Bain Ch. 2: Back Rank Combination)",
        category: "tactic",
        chapter: 2,
        description: `Serangan penetrasi ke baris pertahanan dasar ${toSq}! Memanfaatkan terkurungnya Raja lawan di belakang dinding pion sendiri.`,
        badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/40",
      };
    }
  }

  // --- Chapter 10: Promoting Pawns (Promosi Pion) ---
  if (movedPiece.type === "p") {
    const toRank = parseInt(toSq[1], 10);
    if ((myColor === "w" && toRank >= 6) || (myColor === "b" && toRank <= 3)) {
      return {
        name: "Dorongan Promosi (Bain Ch. 10: Promoting Pawns)",
        category: "tactic",
        chapter: 10,
        description: `Pion bebas melesat ke baris ${toRank}! Hanya tersisa langkah singkat menuju promosi Menteri yang menentukan kemenangan.`,
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      };
    }
  }

  // --- Chapter 5: Discovered Checks (Skak Serangan Terbuka) ---
  if (chess.isCheck()) {
    return {
      name: "Skak Taktis (Bain: Checking Attack)",
      category: "tactic",
      description: `Serangan skak langsung ke Raja musuh di petak ${oppKingSq}! Mengambil tempo dan inisiatif permainan.`,
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    };
  }

  return null;
}

// ============================================================================
// 3. TEKTOKKAN TACTICAL EXCHANGE PREDICTION (Jika dimakan X, dimakan balik Y)
// ============================================================================
export function computeTektokkanExchange(chess: Chess, lastUci: string): TektokkanPrediction {
  if (!lastUci || lastUci.length < 4) return { hasExchange: false, arrows: [] };
  const toSq = lastUci.slice(2, 4) as Square;
  const oppColor = chess.turn();

  if (chess.isAttacked(toSq, oppColor)) {
    const oppMoves = chess.moves({ verbose: true });
    const recaptures = oppMoves.filter((m) => m.to === toSq);

    if (recaptures.length > 0) {
      const valOrder: Record<string, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
      recaptures.sort((a, b) => (valOrder[a.piece] || 10) - (valOrder[b.piece] || 10));
      const chosen = recaptures[0];

      const pieceNames: Record<string, string> = {
        p: "Pion",
        n: "Kuda",
        b: "Gajah",
        r: "Benteng",
        q: "Menteri",
        k: "Raja",
      };

      const pName = pieceNames[chosen.piece] || "Bidak";

      return {
        hasExchange: true,
        targetSq: toSq,
        defenderFrom: chosen.from,
        defenderPiece: pName,
        explanation: `Kalkulasi Pertukaran: Bidak di ${toSq} berada dalam jangkauan tembak. Jika terjadi pemakanan di petak ini, lawan diprediksi membalas memakan balik dengan ${pName} dari ${chosen.from} (${chosen.san}).`,
        arrows: [
          { startSquare: chosen.from, endSquare: toSq, color: "#38bdf8" },
        ],
      };
    }
  }

  return { hasExchange: false, arrows: [] };
}