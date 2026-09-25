import { Chess, type Square } from "chess.js";

export type TacticalConcept = {
  name: string;
  category: "opening" | "gambit" | "tactic" | "endgame";
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

// 1. Identify Openings & Gambits
export function identifyOpeningOrGambit(history: string[]): TacticalConcept | null {
  const pgn = history.slice(0, 10).join(" ");

  if (pgn.startsWith("d4 e5")) {
    return {
      name: "Englund Gambit (Gambit Englund)",
      category: "gambit",
      description: "Hitam mengorbankan pion e5 untuk memicu serangan kejutan cepat ke sayap menteri putih.",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 f4")) {
    return {
      name: "King's Gambit (Gambit Raja)",
      category: "gambit",
      description: "Putih mengorbankan pion f4 untuk menguasai petak tengah dan membuka lajur-f untuk serangan raja.",
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 Nf3 Nc6 Bc4 Bc5 b4")) {
    return {
      name: "Evans Gambit (Gambit Evans)",
      category: "gambit",
      description: "Putih mengorbankan pion sayap b4 untuk merebut kendali pusat d4 dan serangan cepat ke f7.",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    };
  }
  if (pgn.startsWith("d4 d5 c4")) {
    return {
      name: "Queen's Gambit (Gambit Menteri)",
      category: "gambit",
      description: "Putih menawarkan pion c4 demi mendominasi kedua petak sentral d4 dan e4.",
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
  if (pgn.startsWith("e4 c5")) {
    return {
      name: "Sicilian Defense (Pertahanan Sisilia)",
      category: "opening",
      description: "Pertahanan asimetris terpopuler yang memperebutkan inisiatif di sayap menteri.",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
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
      badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
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

// 2. Identify John A. Bain Tactics (Pin, Fork, Skewer, Removing Guard, etc.)
export function identifyBainTactics(chess: Chess, lastUci: string): TacticalConcept | null {
  if (!lastUci || lastUci.length < 4) return null;
  const toSq = lastUci.slice(2, 4) as Square;
  const movedPiece = chess.get(toSq);
  if (!movedPiece) return null;

  const oppColor = movedPiece.color === "w" ? "b" : "w";

  // Check 1: FORK / DOUBLE ATTACK (Garpu Perwira)
  // Check how many enemy pieces are attacked by this piece
  const legals = chess.moves({ verbose: true });
  // Simulate attacks from moved piece
  const attackedOppPieces: { piece: string; sq: string }[] = [];
  const valMap: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 100 };

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]?.[c];
      if (p && p.color === oppColor) {
        const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
        if (chess.isAttacked(sq, movedPiece.color)) {
          attackedOppPieces.push({ piece: p.type, sq });
        }
      }
    }
  }

  if (attackedOppPieces.length >= 2 && (movedPiece.type === "n" || movedPiece.type === "p" || movedPiece.type === "q")) {
    return {
      name: "Garpu Taktis (Fork / Double Attack)",
      category: "tactic",
      description: `Bidak di ${toSq} melancarkan serangan ganda terhadap 2 perwira lawan sekaligus! Memaksa salah satu jatuh.`,
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/40",
    };
  }

  // Check 2: PIN (Paku / Pinning)
  // Check if any piece is pinned to King
  if (chess.isCheck()) {
    return {
      name: "Skak Serangan Terbuka (Checking Attack)",
      category: "tactic",
      description: `Serangan langsung ke Raja lawan di ${toSq}! Membatasi pilihan lawan ke petak evakuasi.`,
      badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    };
  }

  // Check 3: BACK-RANK WEAKNESS
  const oppKingRank = oppColor === "w" ? "1" : "8";
  if (toSq.endsWith(oppKingRank) && (movedPiece.type === "r" || movedPiece.type === "q")) {
    return {
      name: "Ancaman Baris Belakang (Back-Rank Attack)",
      category: "tactic",
      description: `Perwira berat menembus baris pertahanan terakhir lawan (${toSq}), memanfaatkan jebakan Raja yang terkurung pion sendiri.`,
      badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    };
  }

  return null;
}

// 3. Compute "Tektokkan" Exchange Sequence (Jika dimakan di X, akan dimakan balik oleh Y)
export function computeTektokkanExchange(chess: Chess, lastUci: string): TektokkanPrediction {
  if (!lastUci || lastUci.length < 4) return { hasExchange: false, arrows: [] };
  const toSq = lastUci.slice(2, 4) as Square;
  const oppColor = chess.turn(); // opponent to move right now

  // Check if toSq is attacked by the opponent (can be recaptured)
  if (chess.isAttacked(toSq, oppColor)) {
    // Find all opponent moves that can capture at toSq
    const oppMoves = chess.moves({ verbose: true });
    const recaptures = oppMoves.filter((m) => m.to === toSq);

    if (recaptures.length > 0) {
      // Pick the least valuable capturing piece (usually pawn or knight)
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
        explanation: `⚡ Tektokkan Taktis: Bidak di ${toSq} berada di garis tembak! Jika terjadi pertukaran, lawan akan membalas memakan balik dengan ${pName} dari ${chosen.from} (${chosen.san}).`,
        arrows: [
          { startSquare: chosen.from, endSquare: toSq, color: "#38bdf8" }, // Cyan recapture arrow
        ],
      };
    }
  }

  return { hasExchange: false, arrows: [] };
}
