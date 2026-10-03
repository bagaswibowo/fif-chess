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
// 1. REPERTOAR PEMBUKAAN & GAMBIT CATUR TAJAM
//    Sumber: Buku Pintar Catur-Pedia (Fienso Suharsono) BAB 8, CT-Art 4.0
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
      name: "Gambit Raja (King's Gambit) · BPCaturPedia Bab 8",
      category: "gambit",
      description: "Putih mengorbankan pion f4 untuk membongkar petak pusat dan membuka lajur-f untuk serangan benteng ke raja lawan. Pembukaan agresif klasik yang dibahas lengkap di BPCaturPedia.",
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
      name: "Gambit Mentri (Queen's Gambit) · BPCaturPedia Bab 8",
      category: "gambit",
      description: "Putih menawarkan pion c4 untuk mengalihkan pion hitam dari pusat demi kendali mutlak petak d4-e4. Salah satu pembukaan tertua dan paling strategis dalam catur.",
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    };
  }
  if (pgn.startsWith("e4 c5 d4 cxd4 c3")) {
    return {
      name: "Smith-Morra / Danish Gambit · BPCaturPedia Bab 11",
      category: "gambit",
      description: "Pengorbanan pion tajam untuk inisiatif perwira aktif. Hati-hati Jebakan Siberia! (BPCaturPedia Bab 11)",
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

  // --- BPCaturPedia Bab 8: Pertahanan Sicilia & Varian ---
  if (pgn.startsWith("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6")) {
    return {
      name: "Sicilia Varian Naga (Dragon) · BPCaturPedia Bab 8",
      category: "opening",
      description: "Hitam menguasai diagonal panjang h8-a1 dengan fianchetto Gajah. Struktur bidak hitam mirip naga. Permainan tengah sering terjadi rokade berlawanan dan serangan saling mengancam.",
      badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    };
  }
  if (pgn.startsWith("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6")) {
    return {
      name: "Sicilia Varian Najdorf · BPCaturPedia Bab 8",
      category: "opening",
      description: "Varian terpopuler Pertahanan Sicilia. Hitam memainkan a6 untuk fleksibilitas dan serangan balik di sayap menteri. Favorit Bobby Fischer dan Garry Kasparov.",
      badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    };
  }
  if (pgn.startsWith("e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 d6")) {
    return {
      name: "Sicilia Varian Scheveningen · BPCaturPedia Bab 8",
      category: "opening",
      description: "Hitam membentuk struktur pion e6-d6 yang fleksibel. Putih sering melancarkan serangan Keres (f4-f5-g4) atau serangan Fischer-Sozin.",
      badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/40",
    };
  }
  if (pgn.startsWith("e4 c5")) {
    return {
      name: "Pertahanan Sicilia · BPCaturPedia Bab 8",
      category: "opening",
      description: "Langkah paling populer terhadap 1.e4. Hitam langsung menyambut pertempuran tengah dengan posisi asimetris. BPCaturPedia membahas 5+ varian: Naga, Najdorf, Scheveningen, Sveshnikov.",
      badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
    };
  }

  // --- BPCaturPedia Bab 8: Pertahanan Perancis ---
  if (pgn.startsWith("e4 e6")) {
    return {
      name: "Pertahanan Perancis (French Defense) · BPCaturPedia Bab 8",
      category: "opening",
      description: "Struktur pertahanan rantai pion solid dengan serangan balik di petak pusat. BPCaturPedia: hitam merencanakan c5 untuk menyerang rantai pion putih d4-e5.",
      badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    };
  }

  // --- BPCaturPedia Bab 8: Caro-Kann ---
  if (pgn.startsWith("e4 c6")) {
    return {
      name: "Pertahanan Caro-Kann · BPCaturPedia Bab 8",
      category: "opening",
      description: "Pertahanan sangat kokoh yang menjaga struktur sayap raja tetap rapat. BPCaturPedia membahas Varian Klasik dan varian-varian populernya.",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    };
  }

  // --- BPCaturPedia Bab 8: Pirc/Modern ---
  if (pgn.startsWith("e4 d6")) {
    return {
      name: "Pertahanan Pirc/Modern · BPCaturPedia Bab 8",
      category: "opening",
      description: "Hitam membiarkan putih menguasai pusat, lalu menyerang balik dengan fianchetto Gajah raja. Pembukaan hypermodern yang fleksibel.",
      badgeColor: "bg-lime-500/20 text-lime-300 border-lime-500/40",
    };
  }

  if (pgn.startsWith("e4 e5 Nf3 Nc6 Bb5")) {
    return {
      name: "Ruy Lopez (Pembukaan Spanyol) · BPCaturPedia Bab 8",
      category: "opening",
      description: "Sistem klasik menekan kuda penjaga pion e5 untuk mengontrol tempo jangka panjang. Salah satu pembukaan tertua dan paling dipelajari.",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 Nf3 Nc6 Bc4 Bc5")) {
    return {
      name: "Giuoco Piano (Pembukaan Italia) · BPCaturPedia Bab 8",
      category: "opening",
      description: "Pembukaan 'permainan tenang' — kedua gajah dikembangkan ke diagonal aktif. BPCaturPedia: putih mengincar titik lemah f7 dengan kombinasi Gajah c4 dan Kuda.",
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    };
  }
  if (pgn.startsWith("e4 e5 Nf3 Nc6 Bc4")) {
    return {
      name: "Italian Game (Pembukaan Italia) · BPCaturPedia Bab 8",
      category: "opening",
      description: "Pengembangan gajah cepat mengincar titik lemah alami f7 pada pertahanan hitam.",
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    };
  }

  // --- BPCaturPedia Bab 8: Pertahanan India Raja ---
  if (pgn.startsWith("d4 Nf6 c4 g6")) {
    return {
      name: "Pertahanan India Raja (King's Indian) · BPCaturPedia Bab 8",
      category: "opening",
      description: "Hitam fianchetto gajah raja dan merencanakan serangan e5 di sayap raja. Pembukaan dinamis yang sering menghasilkan pertempuran sengit.",
      badgeColor: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
    };
  }

  // --- BPCaturPedia Bab 8: Pertahanan Nimzo-India ---
  if (pgn.startsWith("d4 Nf6 c4 e6 Nc3 Bb4")) {
    return {
      name: "Pertahanan Nimzo-India · BPCaturPedia Bab 8",
      category: "opening",
      description: "Hitam memaku kuda c3 dengan gajah b4, mengontrol pusat secara tidak langsung. Pembukaan strategis tingkat tinggi yang sangat populer di level master.",
      badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    };
  }

  // --- BPCaturPedia Bab 8: Pembukaan Inggris ---
  if (pgn.startsWith("c4")) {
    return {
      name: "Pembukaan Inggris (English Opening) · BPCaturPedia Bab 8",
      category: "opening",
      description: "Pendekatan posisional fleksibel yang mengendalikan petak d5 dari sayap menteri.",
      badgeColor: "bg-neutral-500/20 text-neutral-300 border-neutral-500/40",
    };
  }

  // --- BPCaturPedia Bab 8: Gambit Latvian ---
  if (pgn.startsWith("e4 e5 Nf3 f5")) {
    return {
      name: "Gambit Latvian · BPCaturPedia Bab 8",
      category: "gambit",
      description: "Hitam mengorbankan pion f5 untuk serangan kilat ke sayap raja putih. Pembukaan spekulatif namun penuh jebakan!",
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/40",
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

  // --- Chapter 1: Checkmate (Skakmat Mutlak) ---
  if (chess.isCheckmate() || lastUci.includes("#")) {
    return {
      name: "Skakmat Mutlak (Checkmate)",
      category: "tactic",
      chapter: 1,
      description: `Raja lawan di petak ${oppKingSq || "pertahanan"} terkepung tanpa jalan keluar dan perlindungan! Kemenangan mutlak tercapai.`,
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    };
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
  // BPCaturPedia Bab 7: Serangan Mengintai (Discovered Attack)
  if (chess.isCheck()) {
    // Detect if the check is a discovered check (piece that moved didn't deliver the check)
    if (oppKingSq) {
      const kCol = oppKingSq.charCodeAt(0) - 97;
      const kRow = parseInt(oppKingSq[1], 10) - 1;
      const moveCol = toSq.charCodeAt(0) - 97;
      const moveRow = parseInt(toSq[1], 10) - 1;
      // Check if the moved piece is NOT directly attacking the king (discovered check)
      const dCol = Math.abs(kCol - moveCol);
      const dRow = Math.abs(kRow - moveRow);
      const isKnightCheck = movedPiece.type === "n" && ((dCol === 1 && dRow === 2) || (dCol === 2 && dRow === 1));
      const isDirectLineCheck = (movedPiece.type === "r" || movedPiece.type === "q") && (dCol === 0 || dRow === 0);
      const isDirectDiagCheck = (movedPiece.type === "b" || movedPiece.type === "q") && dCol === dRow && dCol > 0;
      const isPawnCheck = movedPiece.type === "p" && dCol === 1 && dRow === 1;

      if (!isKnightCheck && !isDirectLineCheck && !isDirectDiagCheck && !isPawnCheck) {
        return {
          name: "Serangan Mengintai / Skak Terbuka (Discovered Check) · BPCaturPedia Bab 7",
          category: "tactic",
          description: `Perwira di ${fromSq} pindah ke ${toSq}, membuka jalur serangan skak dari perwira di belakangnya! Teknik BPCaturPedia Bab 7: Serangan Mengintai sangat berbahaya karena bidak yang bergerak bebas mengancam sasaran lain.`,
          badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/40",
        };
      }
    }

    return {
      name: "Skak Taktis (Bain: Checking Attack)",
      category: "tactic",
      description: `Serangan skak langsung ke Raja musuh di petak ${oppKingSq}! Mengambil tempo dan inisiatif permainan.`,
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    };
  }

  // --- BPCaturPedia Bab 7: Tusuk Sate (Skewer) ---
  // Detect when a sliding piece attacks through a valuable piece to another behind it
  if (movedPiece.type === "b" || movedPiece.type === "r" || movedPiece.type === "q") {
    if (oppKingSq) {
      const toCol = toSq.charCodeAt(0) - 97;
      const toRow = parseInt(toSq[1], 10) - 1;
      // Check 8 ray directions from the moved piece
      const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const [dc, dr] of dirs) {
        // Only check valid directions for this piece type
        if (movedPiece.type === "r" && dc !== 0 && dr !== 0) continue;
        if (movedPiece.type === "b" && (dc === 0 || dr === 0)) continue;

        let firstPiece: { type: string; sq: string } | null = null;
        let secondPiece: { type: string; sq: string } | null = null;
        let currC = toCol + dc;
        let currR = toRow + dr;
        while (currC >= 0 && currC < 8 && currR >= 0 && currR < 8) {
          const p = board[7 - currR]?.[currC];
          if (p) {
            if (!firstPiece) {
              if (p.color === oppColor) firstPiece = { type: p.type, sq: String.fromCharCode(97 + currC) + (currR + 1) };
              else break;
            } else if (!secondPiece) {
              if (p.color === oppColor) secondPiece = { type: p.type, sq: String.fromCharCode(97 + currC) + (currR + 1) };
              break;
            }
            currC += dc;
            currR += dr;
            continue;
          }
          currC += dc;
          currR += dr;
        }
        // Skewer: first piece is more valuable, second is less
        if (firstPiece && secondPiece) {
          const valOrder: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
          if ((valOrder[firstPiece.type] || 0) > (valOrder[secondPiece.type] || 0) && (valOrder[firstPiece.type] || 0) >= 5) {
            return {
              name: "Tusuk Sate (Skewer) · BPCaturPedia Bab 7",
              category: "tactic",
              description: `Perwira di ${toSq} menusuk sate: ${firstPiece.type.toUpperCase()} di ${firstPiece.sq} dipaksa pindah, mengekspos ${secondPiece.type.toUpperCase()} di ${secondPiece.sq}! BPCaturPedia: "Buah bernilai tinggi diserang di depan, dipaksa pindah, sehingga buah di belakangnya tertangkap."`,
              badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/40",
            };
          }
        }
      }
    }
  }

  // --- BPCaturPedia Bab 7: Pengorbanan (Sacrifice) ---
  // Detect when a piece captures a lower-value piece (sacrifice pattern)
  if (lastUci.length >= 4) {
    const captured = chess.history({ verbose: true });
    const lastMove = captured[captured.length - 1];
    if (lastMove && lastMove.captured) {
      const valOrder: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
      const movedVal = valOrder[movedPiece.type] || 0;
      const capturedVal = valOrder[lastMove.captured] || 0;
      if (movedVal > capturedVal + 2 && movedVal >= 5) {
        return {
          name: "Pengorbanan (Sacrifice) · BPCaturPedia Bab 7",
          category: "tactic",
          description: `${movedPiece.type.toUpperCase()} bernilai ${movedVal} mengorbankan diri dengan memakan ${lastMove.captured.toUpperCase()} bernilai ${capturedVal}! BPCaturPedia Bab 7: "Pengorbanan adalah taktik mengorbankan buah catur berharga demi keuntungan posisi, tempo, atau serangan skakmat."`,
          badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        };
      }
    }
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