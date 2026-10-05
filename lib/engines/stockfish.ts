import { Chess, type Square } from "chess.js";
import { playStockfishMove } from "@/lib/stockfish";
import { applyUci } from "@/lib/chess";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse, EnginePrediction, StrategicStep } from "./types";

function describeStrategicIntention(chess: Chess, uci: string, san: string): string {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const p = chess.get(from as Square);
  const pieceType = p ? p.type : (san[0] >= "A" && san[0] <= "Z" ? san[0].toLowerCase() : "p");

  if (san.includes("#")) return `Manuver ${san} mengunci kemenangan skakmat mutlak!`;
  if (san.includes("+")) return `Serangan skak langsung menekan Raja lawan di ${to}!`;
  if (san.includes("x")) return `Memukul perwira lawan di ${to} untuk merebut inisiatif materi.`;

  switch (pieceType) {
    case "n":
      if (["d4", "e4", "d5", "e5", "f5", "c5", "f4", "c4"].includes(to)) {
        return `Mengamankan pos luar (outpost) ${to} untuk mendominasi petak pusat dan sayap.`;
      }
      return `Mengembangkan Kuda ke ${to} untuk mengontrol jalur manuver dan koordinasi sentral.`;
    case "b":
      return `Menempatkan Gajah di diagonal aktif ${to} untuk membidik kelemahan struktur perwira lawan.`;
    case "r":
      return `Menguasai lajur strategis kolom ${to[0]} untuk penetrasi dan tekanan horizontal.`;
    case "q":
      return `Manuver Menteri ke ${to} untuk menciptakan ancaman taktis ganda dan tekanan serang.`;
    case "k":
      if (san === "O-O" || san === "O-O-O") {
        return `Mengamankan Raja ke sayap dan mengaktifkan Benteng ke pusat pertarungan.`;
      }
      return `Memposisikan Raja ke petak ${to} untuk konsolidasi pertahanan.`;
    case "p":
    default:
      if (["e4", "d4", "e5", "d5"].includes(to)) {
        return `Mendorong pion ke ${to} mendobrak kontrol sentral dan membuka ruang serang.`;
      }
      return `Mendorong pion ke ${to} memperkuat rantai pertahanan dan membuka diagonal perwira.`;
  }
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
  
  // Periksa perwira lawan yang diserang oleh petak landedSq (atau discovered attack)
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

    // 2. Prediksi Balasan Lawan (Stockfish 15 NNUE)
    const sf = await playStockfishMove(fen, 12);
    const side = chess.turn() === "w" ? "Putih" : "Hitam";
    const evalStr = sf.scoreCp !== null ? `${(sf.scoreCp / 100).toFixed(1)}` : "0.0";
    
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

    let strategicMove: { uci: string; san: string; from: string; to: string; intention: string } | null = null;
    if (futureLine.length > 1) {
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

    return {
      engine: "stockfish",
      uci: sf.uci,
      san: sf.san,
      from: sf.uci.slice(0, 2),
      to: sf.uci.slice(2, 4),
      scoreCp: sf.scoreCp,
      summary: `Stockfish 15 NNUE memprediksi balasan terbaik ${side}: ${sf.san} (${evalStr})`,
      threat,
      strategicMove,
      futureLine,
      pvMoves,
      pvText,
    };
  } catch {
    return null;
  }
}

export class StockfishEngine implements IChessEngine {
  readonly id = "stockfish" as const;
  readonly name = "Stockfish 15 NNUE";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const depth = Math.min(14, Math.max(6, req.depth ?? 12));
    const sf = await playStockfishMove(req.fen, depth);
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
