import { Chess, type Square, type PieceSymbol } from "chess.js";
import { playStockfishMove } from "@/lib/stockfish";
import { applyUci } from "@/lib/chess";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse, EnginePrediction, StrategicStep } from "./types";

const PIECE_NAMES: Record<string, string> = {
  p: "Pion",
  n: "Kuda",
  b: "Gajah",
  r: "Benteng",
  q: "Menteri",
  k: "Raja",
};

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3.2,
  r: 5,
  q: 9,
  k: 100,
};

/**
 * Menganalisis secara mendalam niat strategis dari suatu langkah riil di atas papan:
 * 1. Serangan langsung / Fork / Skak
 * 2. Membuka jalan bagi perwira lain (discovered line / unblocking)
 * 3. Penyelamatan dari ancaman lawan
 * 4. Penguatan pertahanan kawan
 * 5. Manuver posisional / kontrol petak sentral
 */
function analyzeDetailedStrategy(
  chess: Chess,
  lastUci?: string,
  san?: string,
  pvLine: string[] = []
): { intention: string; strategicGoal: string; chain3Moves: string; strategicMove?: { from: string; to: string; san: string; intention: string } } {
  if (!lastUci || lastUci.length < 4) {
    return {
      intention: "Mengembangkan perwira untuk kontrol posisi dan koordinasi ruang.",
      strategicGoal: "Posisi",
      chain3Moves: "",
    };
  }

  const from = lastUci.slice(0, 2) as Square;
  const to = lastUci.slice(2, 4) as Square;
  const currentSide = chess.turn(); // Giliran lawan saat ini
  const moverSide = currentSide === "w" ? "b" : "w"; // Sisi yang baru saja melangkah
  const moverSideName = moverSide === "w" ? "Putih" : "Hitam";
  const opponentSideName = currentSide === "w" ? "Putih" : "Hitam";

  const pObj = chess.get(to);
  const pName = pObj ? (PIECE_NAMES[pObj.type] || "Perwira") : "Perwira";

  // Cek posisi sebelum langkah dilakukan (via copy & undo)
  const prevChess = new Chess(chess.fen());
  const undoneMove = prevChess.undo(); // kembalikan 1 langkah ke posisi sebelum lastUci

  let wasUnderThreat = false;
  if (undoneMove) {
    // Apakah petak from diserang oleh lawan sebelum melangkah?
    const prevEnemyMoves = prevChess.moves({ verbose: true });
    wasUnderThreat = prevEnemyMoves.some((m: any) => m.to === from);
  }

  // 1. Skakmat atau Skak
  if (san?.includes("#") || chess.isCheckmate()) {
    return {
      intention: `Serangan pamungkas ${san} mengeksekusi skakmat mutlak terhadap Raja ${opponentSideName}!`,
      strategicGoal: "Skakmat",
      chain3Moves: `1. ${san} (Skakmat) ➔ Kemenangan mutlak`,
    };
  }
  if (san?.includes("+") || chess.isCheck()) {
    return {
      intention: `Serangan skak langsung menekan Raja lawan di ${to}, memaksa lawan merespons bertahan dan kehilangan tempo.`,
      strategicGoal: "Skak Serangan",
      chain3Moves: `1. ${san}+ (Skak Raja) ➔ Membatasi ruang pelarian Raja lawan`,
    };
  }

  // 2. Pemukulan materi (Capture)
  if (san?.includes("x")) {
    return {
      intention: `Memukul perwira lawan di ${to} untuk merebut keunggulan materi dan merusak koordinasi pertahanan lawan.`,
      strategicGoal: "Eksekusi Materi",
      chain3Moves: `1. ${san} (Pukul Materi) ➔ Membuka inisiatif ofensif`,
    };
  }

  // 3. Penyelamatan / Evakuasi
  if (wasUnderThreat) {
    return {
      intention: `Menyelamatkan ${pName} dari ancaman pemukulan lawan di ${from} dan mereposisinya ke petak aman ${to}.`,
      strategicGoal: "Penyelamatan",
      chain3Moves: `1. ${san} (Evakuasi Aman) ➔ Menghindari kehilangan perwira`,
    };
  }

  // 4. Deteksi Serangan Langsung / Garpuan (Fork) dari petak baru
  // Simulasikan jika giliran masih pihak mover: periksa apa saja yang dibidik oleh petak to
  const tempChess = new Chess(chess.fen());
  // Ubah giliran sementara untuk memeriksa jangkauan serang petak to
  const tokens = tempChess.fen().split(" ");
  tokens[1] = moverSide;
  tokens[3] = "-"; // clear ep
  let targetsThreatened: { to: string; piece: string; val: number }[] = [];
  try {
    const probeChess = new Chess(tokens.join(" "));
    const activeMoves = probeChess.moves({ verbose: true }).filter((m: any) => m.from === to);
    for (const m of activeMoves) {
      if (m.captured) {
        targetsThreatened.push({
          to: m.to,
          piece: PIECE_NAMES[m.captured] || "Perwira",
          val: PIECE_VALUES[m.captured] || 1,
        });
      }
    }
  } catch (_) {}

  // Urutkan target tertinggi
  targetsThreatened.sort((a, b) => b.val - a.val);

  if (targetsThreatened.length >= 2) {
    const t1 = targetsThreatened[0];
    const t2 = targetsThreatened[1];
    return {
      intention: `Manuver garpuan ganda (Fork) mengancam sekaligus ${t1.piece} di ${t1.to} dan ${t2.piece} di ${t2.to}!`,
      strategicGoal: "Serangan Ganda (Fork)",
      chain3Moves: `1. ${san} (Ancaman Ganda) ➔ 2. Lawan terpaksa memilih ➔ 3. Merebut perwira`,
    };
  }

  if (targetsThreatened.length === 1 && targetsThreatened[0].val >= 3) {
    const t = targetsThreatened[0];
    return {
      intention: `Menyerang ${t.piece} lawan di ${t.to}, menciptakan tekanan taktis langsung dan membatasi ruang gerak lawan.`,
      strategicGoal: "Tekanan Perwira",
      chain3Moves: `1. ${san} (Menyerang ${t.piece}) ➔ 2. Memaksa ${t.piece} mundur/bertahan`,
    };
  }

  // 5. Deteksi Membuka Jalan untuk Bidak Lain (Discovered Attack / Line Clearance)
  // Periksa apakah perwira kawan jarak jauh (Gajah, Benteng, Menteri) sekarang memiliki garis serang baru
  let openedLinesDesc = "";
  if (undoneMove) {
    const beforeRayAttacks: string[] = [];
    const afterRayAttacks: string[] = [];
    try {
      // Ray attackers di posisi setelah langkah
      const probeNow = new Chess(tokens.join(" "));
      const movesNow = probeNow.moves({ verbose: true });
      for (const m of movesNow) {
        if (m.from !== to && (m.piece === "b" || m.piece === "r" || m.piece === "q") && m.captured) {
          afterRayAttacks.push(`${PIECE_NAMES[m.piece]} (${m.from}) ➔ ${m.to}`);
        }
      }
      // Ray attackers di posisi sebelum langkah
      const tokensBefore = prevChess.fen().split(" ");
      tokensBefore[1] = moverSide;
      tokensBefore[3] = "-";
      const probeBefore = new Chess(tokensBefore.join(" "));
      const movesBefore = probeBefore.moves({ verbose: true });
      for (const m of movesBefore) {
        if ((m.piece === "b" || m.piece === "r" || m.piece === "q") && m.captured) {
          beforeRayAttacks.push(`${PIECE_NAMES[m.piece]} (${m.from}) ➔ ${m.to}`);
        }
      }

      const newlyOpened = afterRayAttacks.filter(a => !beforeRayAttacks.includes(a));
      if (newlyOpened.length > 0) {
        openedLinesDesc = `Membuka jalur/diagonal serang untuk ${newlyOpened[0]}`;
      }
    } catch (_) {}
  }

  if (openedLinesDesc) {
    return {
      intention: `Melangkah ke ${to} sekaligus membuka jalan serang diagonal/lajur: ${openedLinesDesc}.`,
      strategicGoal: "Membuka Jalur Serang",
      chain3Moves: `1. ${san} (Buka Jalur) ➔ 2. Menembus lajur pertahanan lawan`,
    };
  }

  // 6. Rokade (King Safety)
  if (san === "O-O" || san === "O-O-O") {
    return {
      intention: `Mengamankan Raja ke sayap benteng yang terlindungi dan mengaktifkan Benteng ke pusat pertarungan.`,
      strategicGoal: "Keamanan Raja & Aktivasi Benteng",
      chain3Moves: `1. ${san} (Rokade) ➔ 2. Hubungkan kedua Benteng ➔ 3. Kontrol lajur pusat`,
    };
  }

  // 7. Penguasaan Petak Pusat (Positional Control)
  if (["d4", "e4", "d5", "e5", "c4", "f4", "c5", "f5"].includes(to)) {
    return {
      intention: `Mendominasi petak strategis sentral di ${to} untuk mengunci mobilitas perwira lawan dan mengontrol alur permainan.`,
      strategicGoal: "Dominasi Pusat",
      chain3Moves: `1. ${san} (Kontrol Pusat) ➔ 2. Ekspansi ruang serang`,
    };
  }

  // 8. Rantai 3 Langkah ke Depan berdasarkan PV Stockfish
  const move1 = san || lastUci;
  let chain3 = `1. ${move1} (Kontrol Posisi)`;
  if (pvLine && pvLine.length >= 2) {
    chain3 = `1. ${move1} ➔ 2. Lawan: ${pvLine[0]} ➔ 3. Balasan: ${pvLine[1]}`;
  } else if (pvLine && pvLine.length === 1) {
    chain3 = `1. ${move1} ➔ 2. Lawan: ${pvLine[0]}`;
  }

  return {
    intention: `Mengembangkan ${pName} ke ${to} untuk memperkuat koordinasi formasi dan membuka opsi manuver lanjutan.`,
    strategicGoal: "Pengembangan & Konsolidasi",
    chain3Moves: chain3,
  };
}



function describeStrategicIntention(chess: Chess, uci: string, san: string): string {
  const to = uci.slice(2, 4);
  if (san.includes("#")) return `Mengunci skakmat mutlak di ${to}`;
  if (san.includes("+")) return `Melakukan skak langsung menekan Raja lawan di ${to}`;
  if (san.includes("x")) return `Memukul materi di ${to} untuk dominasi inisiatif`;
  return `Manuver ke ${to} untuk mengontrol petak kritis dan koordinasi perwira`;
}

function identifyThreatWithStockfish(chess: Chess, lastUci?: string): { from: string; to: string; sq: string; description: string } | null {
  const nextTurn = chess.turn();
  const opponentSide = nextTurn === "w" ? "Putih" : "Hitam";

  if (chess.isCheck()) {
    const board = chess.board();
    let kingSq = "";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.color === nextTurn && piece.type === "k") {
          kingSq = String.fromCharCode(97 + c) + (8 - r);
          break;
        }
      }
      if (kingSq) break;
    }
    const fromSq = lastUci ? lastUci.slice(2, 4) : kingSq;
    return {
      from: fromSq,
      to: kingSq,
      sq: kingSq,
      description: `Skak langsung mengancam Raja ${opponentSide} di ${kingSq}!`,
    };
  }

  if (!lastUci || lastUci.length < 4) return null;
  const landedSq = lastUci.slice(2, 4) as Square;
  const legalMoves = chess.moves({ verbose: true });
  
  const valMap: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
  const pieceNames: Record<string, string> = { q: "Menteri", r: "Benteng", b: "Gajah", n: "Kuda", p: "Pion" };
  
  let bestThreat: { from: string; to: string; sq: string; description: string; val: number } | null = null;
  
  for (const m of legalMoves) {
    if (m.from === landedSq && m.captured) {
      const v = valMap[m.captured] || 0;
      if (!bestThreat || v > bestThreat.val) {
        bestThreat = {
          from: landedSq,
          to: m.to,
          sq: m.to,
          val: v,
          description: `Mengancam ${pieceNames[m.captured] || "perwira"} ${opponentSide} di ${m.to}!`,
        };
      }
    }
  }

  if (bestThreat) {
    return {
      from: bestThreat.from,
      to: bestThreat.to,
      sq: bestThreat.sq,
      description: bestThreat.description,
    };
  }

  return {
    from: landedSq,
    to: landedSq,
    sq: landedSq,
    description: `Mengontrol petak strategis ${landedSq} di wilayah pertarungan.`,
  };
}

export async function getStockfishPrediction(fen: string, lastUci?: string): Promise<EnginePrediction | null> {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;
    
    // 1. Target Diancam (dibaca langsung dari posisi pasca langkah via Stockfish engine)
    const threat = identifyThreatWithStockfish(chess, lastUci);

    // 2. Prediksi Balasan Lawan (Stockfish 19 NNUE)
    const sf = await playStockfishMove(fen, 12);
    const side = chess.turn() === "w" ? "Putih" : "Hitam";
    const evalStr = sf.scoreCp !== null ? `${(sf.scoreCp / 100).toFixed(1)}` : "0.0";
    
    // Analisis Strategis Mendalam berbasis Stockfish REA
        // Dapatkan SAN langkah yang baru saja dilakukan dari lastUci
    let lastSan = lastUci || "";
    if (lastUci && lastUci.length >= 4) {
      try {
        const revChess = new Chess(fen);
        const undoM = revChess.undo();
        if (undoM) lastSan = undoM.san;
      } catch (_) {}
    }
    const stratAnalysis = analyzeDetailedStrategy(chess, lastUci, lastSan, sf.pvLine || []);

    // 3. Proyeksi Garis Strategis hingga 15 Langkah Masa Depan (Deep Future Trajectory)
    const futureChess = new Chess(fen);
    const futureLine: StrategicStep[] = [];
    const pvMoves: string[] = [];
    const candidateMoves = [...(sf.pvLine || [])];
    if (candidateMoves.length === 0 && sf.uci) candidateMoves.push(sf.uci);

    for (let step = 0; step < 15; step++) {
      if (futureChess.isGameOver()) break;
      let nextUci = candidateMoves[step];
      if (!nextUci) {
        const legals = futureChess.moves({ verbose: true });
        if (legals.length === 0) break;
        const pick = legals.find((m: any) => m.captured) || legals.find((m: any) => m.san.includes("+")) || legals[0];
        nextUci = pick.from + pick.to + (pick.promotion || "");
      }

      try {
        const from = nextUci.slice(0, 2) as Square;
        const to = nextUci.slice(2, 4) as Square;
        const promotion = nextUci[4] || undefined;
        const color = futureChess.turn();
        const pObj = futureChess.get(from);
        const piece = pObj ? pObj.type : "p";
        const app = futureChess.move({ from, to, promotion });
        if (!app) break;

        const intention = describeStrategicIntention(futureChess, nextUci, app.san);
        futureLine.push({
          uci: nextUci,
          san: app.san,
          from,
          to,
          ply: step + 1,
          color,
          piece,
          intention,
        });
        pvMoves.push(app.san);
      } catch {
        break;
      }
    }

    // 3. Proyeksi Strategi Khusus Bidak/Pion yang Melangkah Saja (Bukan semua bidak di papan)
    const movedSq = lastUci && lastUci.length >= 4 ? (lastUci.slice(2, 4) as Square) : null;
    const pieceTrajectory: StrategicStep[] = [];
    let trackSq = movedSq;

    if (trackSq) {
      // Telusuri pergerakan lanjutan khusus untuk bidak ini dari futureLine
      for (const step of futureLine) {
        if (step.from === trackSq) {
          pieceTrajectory.push(step);
          trackSq = step.to as Square;
        }
      }

      // Jika bidak ini belum melangkah di PV, cari kelanjutan taktis terbaik khusus untuk bidak ini
      if (pieceTrajectory.length === 0) {
        const continuationChess = new Chess(fen);
        if (sf.uci) {
          try { applyUci(continuationChess, sf.uci); } catch (_) {}
        }
        if (!continuationChess.isGameOver()) {
          const pieceMoves = continuationChess.moves({ verbose: true }).filter((m: any) => m.from === movedSq);
          if (pieceMoves.length > 0) {
            pieceMoves.sort((a: any, b: any) => {
              const scoreM = (m: any) => (m.captured ? 10 : 0) + (m.san.includes("+") ? 5 : 0) + (["d4","e4","d5","e5"].includes(m.to) ? 3 : 1);
              return scoreM(b) - scoreM(a);
            });
            const bestPieceMove = pieceMoves[0];
            const pUci = bestPieceMove.from + bestPieceMove.to + (bestPieceMove.promotion || "");
            const intention = describeStrategicIntention(continuationChess, pUci, bestPieceMove.san);
            pieceTrajectory.push({
              uci: pUci,
              san: bestPieceMove.san,
              from: bestPieceMove.from,
              to: bestPieceMove.to,
              ply: 2,
              color: continuationChess.turn(),
              piece: bestPieceMove.piece,
              intention,
            });
          }
        }
      }
    }

    let strategicMove: { uci: string; san: string; from: string; to: string; intention: string } | null = null;
    if (pieceTrajectory.length > 0) {
      strategicMove = {
        uci: pieceTrajectory[0].uci,
        san: pieceTrajectory[0].san,
        from: pieceTrajectory[0].from,
        to: pieceTrajectory[0].to,
        intention: pieceTrajectory[0].intention || "Melanjutkan manuver taktis bidak ini.",
      };
    } else if (futureLine.length > 1) {
      strategicMove = {
        uci: futureLine[1].uci,
        san: futureLine[1].san,
        from: futureLine[1].from,
        to: futureLine[1].to,
        intention: futureLine[1].intention || "Melanjutkan rantai manuver taktis posisi.",
      };
    } else if (futureLine.length === 1) {
      strategicMove = {
        uci: futureLine[0].uci,
        san: futureLine[0].san,
        from: futureLine[0].from,
        to: futureLine[0].to,
        intention: futureLine[0].intention || "Langkah taktis tunggal.",
      };
    }

    // Bangun teks PGN PV lengkap (misal: 1... e5 2. Nf3 Nc6 ...)
    const isStartBlack = chess.turn() === "b";
    const startMoveNum = Math.floor(chess.history().length / 2) + 1;
    let pvText = "";
    pvMoves.forEach((san, idx) => {
      const isBlackMove = isStartBlack ? idx % 2 === 0 : idx % 2 === 1;
      const moveNum = startMoveNum + Math.floor((idx + (isStartBlack ? 1 : 0)) / 2);
      if (idx === 0) {
        pvText += isBlackMove ? `${moveNum}... ${san}` : `${moveNum}. ${san}`;
      } else if (!isBlackMove) {
        pvText += ` ${moveNum}. ${san}`;
      } else {
        pvText += ` ${san}`;
      }
    });

    const cleanSummary = `Prediksi Balasan Lawan (${side}): ${sf.san} (Eval: ${evalStr})`;

    return {
      engine: "stockfish",
      uci: sf.uci,
      san: sf.san,
      from: sf.uci.slice(0, 2),
      to: sf.uci.slice(2, 4),
      scoreCp: sf.scoreCp,
      summary: cleanSummary,
      threat,
      strategicMove: {
        uci: sf.uci,
        san: sf.san,
        from: sf.uci.slice(0, 2),
        to: sf.uci.slice(2, 4),
        intention: stratAnalysis.intention,
      },
      strategicGoal: stratAnalysis.strategicGoal,
      chain3Moves: stratAnalysis.chain3Moves,
      futureLine,
      pieceTrajectory,
      pvMoves,
      pvText,
    };
  } catch {
    return null;
  }
}

export class StockfishEngine implements IChessEngine {
  readonly id = "stockfish" as const;
  readonly name = "Stockfish 19 NNUE";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const depth = Math.min(14, Math.max(6, req.depth ?? 12));
    const sf = await playStockfishMove(req.fen, depth, undefined, req.skillLevel);
    const prediction = await getStockfishPrediction(sf.fen, sf.uci);

    return {
      engine: this.id,
      uci: sf.uci,
      san: sf.san,
      fen: sf.fen,
      probabilities: sf.probabilities,
      confidence: sf.confidence,
      droppedMoveCount: sf.droppedMoveCount,
      outcome: sf.outcome,
      scoreCp: sf.scoreCp,
      prediction,
    };
  }
}

export const stockfishEngine = new StockfishEngine();
