"use client";

import { useState, useMemo, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti } from "@/components/confetti";
import {
  IconPuzzle3D,
  IconTrophy3D,
  IconMedal3D,
} from "@/components/icons3d";

export type PuzzleCategory = "all" | "opening" | "defense" | "middlegame" | "endgame" | "opponent";

export type Puzzle = {
  id: string;
  category: "opening" | "defense" | "middlegame" | "endgame" | "opponent";
  difficulty: "Mudah" | "Sedang" | "Sulit";
  fen: string;
  turn: "w" | "b";
  solutionUci: string;
  solutionSan: string;
  theme: string;
  description: string;
  hintPiece: string;
  hintExplanation: string;
  trickExplanation: string;
};

export const DEFAULT_PUZZLES: Puzzle[] = [
  // 1. OPENING TRICKS
  {
    id: "p1",
    category: "opening",
    difficulty: "Mudah",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4",
    turn: "w",
    solutionUci: "h5f7",
    solutionSan: "Qxf7#",
    theme: "Serangan Titik Lemah f7 (Scholar's Mate)",
    description: "Manfaatkan titik lemah petak f7 yang hanya dijaga oleh raja Hitam di fase pembukaan.",
    hintPiece: "Menteri putih di petak h5.",
    hintExplanation: "Menteri memukul bidak di f7 dengan bantuan perlindungan gajah di c4 untuk skakmat langsung.",
    trickExplanation: "Trik Titik Lemah f7: Sebelum rokade, f7 adalah petak paling rentan karena hanya dikawal oleh raja. Mengeksploitasi koordinasi Menteri + Gajah di awal laga bisa mengakhiri pertandingan kilat.",
  },
  {
    id: "p2",
    category: "opening",
    difficulty: "Sedang",
    fen: "rnbqkbnr/ppppp1pp/5p2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    turn: "w",
    solutionUci: "d1h5",
    solutionSan: "Qh5+",
    theme: "Perangkap Celah Diagonal e8-h5 (Fool's Pattern)",
    description: "Hitam melangkahkan f6 di langkah awal. Hukum celah fatal pada jalur diagonal raja.",
    hintPiece: "Menteri putih di petak d1.",
    hintExplanation: "Luncurkan Menteri ke h5 untuk memberikan skak keras pada raja Hitam.",
    trickExplanation: "Trik Diagonal Maut: Mendorong pion f7 di pembukaan catur adalah tabu bagi pemula karena membongkar pelindung utama raja ke diagonal h5.",
  },

  // 2. DEFENSE TRICKS
  {
    id: "p3",
    category: "defense",
    difficulty: "Sedang",
    fen: "r1b1k2r/pp1pqppp/2n5/8/8/8/PPPP1PPP/R1BQR1K1 w kq - 0 1",
    turn: "w",
    solutionUci: "e1e7",
    solutionSan: "Rxe7+",
    theme: "Pin Mutlak Jalur-e (Absolute Pin)",
    description: "Menteri hitam di e7 terkena pin mutlak terhadap raja di e8. Rebut materi gratis!",
    hintPiece: "Benteng putih di petak e1.",
    hintExplanation: "Pukul menteri lawan di e7 secara cuma-cuma karena menteri ter-pin terhadap raja.",
    trickExplanation: "Trik Pin Mutlak (Absolute Pin): Bidak yang ter-pin ke raja dilarang bergerak menurut aturan resmi catur. Benteng di jalur terbuka mengeksploitasi pin ini secara mutlak.",
  },
  {
    id: "p4",
    category: "defense",
    difficulty: "Mudah",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5",
    turn: "w",
    solutionUci: "c1g5",
    solutionSan: "Bg5",
    theme: "Pin Sayap Gajah (Flank Pin Defense)",
    description: "Kunci pergerakan Kuda f6 yang mengawal menteri lawan dengan gajah aktif.",
    hintPiece: "Gajah terang Putih di c1.",
    hintExplanation: "Langkahkan Gajah ke g5 untuk mem-pin Kuda terhadap Menteri hitam.",
    trickExplanation: "Trik Pin Relatif: Kuda di f6 tidak bisa bebas melangkah tanpa merelakan menterinya di d8 diserang oleh gajah.",
  },

  // 3. MIDDLEGAME TACTICS
  {
    id: "p5",
    category: "middlegame",
    difficulty: "Mudah",
    fen: "r1b1k2r/ppq2ppp/4p3/3N4/8/8/PPP2PPP/R1B1KB1R w KQkq - 0 10",
    turn: "w",
    solutionUci: "d5c7",
    solutionSan: "Nxc7+",
    theme: "Garpu Kuda Taktis (Knight Fork)",
    description: "Temukan langkah taktis kuda untuk mencabangkan raja dan menteri lawan sekaligus.",
    hintPiece: "Kuda putih di petak d5.",
    hintExplanation: "Kuda melompat ke c7 dengan skak, memukul pion dan menggarpu raja e8 serta menteri c7.",
    trickExplanation: "Trik Garpu Kuda (Knight Fork): Pola gerak huruf 'L' kuda sangat berbahaya karena kuda bisa menyerang dua perwira tinggi lawan secara bersamaan tanpa bisa ditangkis dengan menaruh penghalang.",
  },
  {
    id: "p6",
    category: "middlegame",
    difficulty: "Sulit",
    fen: "2r3k1/5ppp/8/8/8/8/1Q3PPP/2R3K1 w - - 0 1",
    turn: "w",
    solutionUci: "c1c8",
    solutionSan: "Rxc8#",
    theme: "Tusukan Sate & Defleksi Benteng (Skewer / Overload)",
    description: "Benteng Hitam terbebani menjaga baris belakang. Lakukan pertukaran yang berujung skakmat.",
    hintPiece: "Benteng putih di c1.",
    hintExplanation: "Pukul benteng c8 secara langsung untuk memberikan skakmat mutlak.",
    trickExplanation: "Trik Overloaded Piece: Ketika benteng lawan menjadi satu-satunya pelindung baris ke-8, menyerang benteng tersebut langsung melumpuhkan pertahanan total.",
  },

  // 4. ENDGAME & MATES
  {
    id: "p7",
    category: "endgame",
    difficulty: "Mudah",
    fen: "6k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1",
    turn: "w",
    solutionUci: "e2e8",
    solutionSan: "Qe8#",
    theme: "Skakmat Baris Belakang (Back Rank Mate)",
    description: "Raja lawan terjebak di baris ke-8 di belakang pagar pionnya sendiri.",
    hintPiece: "Menteri putih di petak e2.",
    hintExplanation: "Menteri meluncur ke baris ke-8 (e8) untuk skakmat mutlak.",
    trickExplanation: "Trik Skakmat Koridor: Raja yang sudah rokade seringkali terjebak jika tidak membuka petak 'luft' (lubang udara seperti h6 atau g6).",
  },
  {
    id: "p8",
    category: "endgame",
    difficulty: "Sedang",
    fen: "6rk/6pp/8/4N3/8/8/6PP/7K w - - 0 1",
    turn: "w",
    solutionUci: "e5f7",
    solutionSan: "Nf7#",
    theme: "Skakmat Kuda Terjepit (Smothered Mate)",
    description: "Raja lawan terjebak dikelilingi oleh benteng dan pionnya sendiri.",
    hintPiece: "Kuda putih di petak e5.",
    hintExplanation: "Lompatkan kuda ke f7. Raja Hitam mati langkah karena terhalang bidaknya sendiri.",
    trickExplanation: "Trik Philidor (Smothered Mate): Satu-satunya skakmat di mana bidak musuh sendiri yang mencekik rajanya hingga tidak bisa lari.",
  },
  {
    id: "p9",
    category: "endgame",
    difficulty: "Mudah",
    fen: "8/4P3/8/8/8/8/6k1/4K3 w - - 0 1",
    turn: "w",
    solutionUci: "e7e8q",
    solutionSan: "e8=Q",
    theme: "Promosi Pion Bebas (Passed Pawn Promotion)",
    description: "Dorong pion bebas selangkah lagi mencapai baris ke-8 untuk menjadi menteri baru.",
    hintPiece: "Pion Putih di e7.",
    hintExplanation: "Dorong pion ke e8 dan pilih menteri.",
    trickExplanation: "Trik Pion Bebas: Pion yang tidak memiliki halangan pion lawan di depannya bernilai setara perwira saat mendekati baris promosi.",
  },
];

type Props = {
  lang?: "id" | "en";
};

export function PuzzleView({ lang = "id" }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<PuzzleCategory>("all");
  const [customPuzzles, setCustomPuzzles] = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fen, setFen] = useState("");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [status, setStatus] = useState<"unsolved" | "correct" | "wrong">("unsolved");
  const [hintLevel, setHintLevel] = useState<number>(0);

  // Load custom opponent tactics from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fif_chess_custom_puzzles");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomPuzzles(parsed);
        }
      }
    } catch {}
  }, []);

  // Combined puzzle database
  const allPuzzles = useMemo(() => {
    return [...DEFAULT_PUZZLES, ...customPuzzles];
  }, [customPuzzles]);

  // Filtered puzzles
  const filteredPuzzles = useMemo(() => {
    if (categoryFilter === "all") return allPuzzles;
    return allPuzzles.filter((p) => p.category === categoryFilter);
  }, [allPuzzles, categoryFilter]);

  const puzzle = filteredPuzzles[currentIndex] || filteredPuzzles[0] || DEFAULT_PUZZLES[0];

  // Sync FEN on puzzle switch
  useEffect(() => {
    if (puzzle) {
      setFen(puzzle.fen);
      setSelectedSquare(null);
      setStatus("unsolved");
      setHintLevel(0);
    }
  }, [puzzle]);

  // Reset current puzzle
  const resetCurrentPuzzle = () => {
    if (puzzle) {
      setFen(puzzle.fen);
      setSelectedSquare(null);
      setStatus("unsolved");
      setHintLevel(0);
    }
  };

  // Reveal Move (Auto Solve)
  const revealSolution = () => {
    if (!puzzle) return;
    try {
      const chess = new Chess(puzzle.fen);
      const from = puzzle.solutionUci.slice(0, 2) as Square;
      const to = puzzle.solutionUci.slice(2, 4) as Square;
      chess.move({ from, to, promotion: "q" });
      setFen(chess.fen());
      setStatus("correct");
      setHintLevel(2);
      setSelectedSquare(null);
    } catch {}
  };

  // Click-to-Move Handler
  const onSquareClick = ({ square }: { square: string; piece?: any }) => {
    if (status === "correct" || !puzzle) return;

    let chess: Chess;
    try {
      chess = new Chess(fen);
    } catch {
      return;
    }

    const clickedSq = square.toLowerCase() as Square;

    // 1. If no piece selected yet
    if (!selectedSquare) {
      const piece = chess.get(clickedSq);
      if (piece && piece.color === puzzle.turn) {
        setSelectedSquare(square);
      }
      return;
    }

    // 2. If clicking same square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    // 3. If clicking another piece of our own side, switch selection
    const clickedPiece = chess.get(clickedSq);
    if (clickedPiece && clickedPiece.color === puzzle.turn) {
      setSelectedSquare(square);
      return;
    }

    // 4. Attempt move
    const from = selectedSquare.toLowerCase() as Square;
    const to = clickedSq;
    const attempt = `${from}${to}`;

    try {
      const moveRes = chess.move({ from, to, promotion: "q" });
      if (!moveRes) {
        setSelectedSquare(null);
        return;
      }

      if (attempt === puzzle.solutionUci.toLowerCase() || moveRes.san === puzzle.solutionSan) {
        setFen(chess.fen());
        setStatus("correct");
        setSelectedSquare(null);
      } else {
        setStatus("wrong");
        setSelectedSquare(null);
      }
    } catch {
      setSelectedSquare(null);
    }
  };

  // Dynamic board square highlights
  const customSquareStyles = useMemo(() => {
    if (!puzzle) return {};
    const styles: Record<string, React.CSSProperties> = {};
    const sourceSquare = puzzle.solutionUci.slice(0, 2);
    const targetSquare = puzzle.solutionUci.slice(2, 4);

    if (selectedSquare) {
      styles[selectedSquare] = {
        boxShadow: "inset 0 0 0 4px #facc15",
        backgroundColor: "rgba(250, 204, 21, 0.4)",
      };
    }

    if (hintLevel >= 1 && status === "unsolved") {
      styles[sourceSquare] = {
        boxShadow: "inset 0 0 0 4px #38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.45)",
      };
    }

    if (hintLevel >= 2 && status === "unsolved") {
      styles[targetSquare] = {
        boxShadow: "inset 0 0 0 4px #81b64c",
        backgroundColor: "rgba(129, 182, 76, 0.5)",
      };
    }

    if (status === "correct") {
      styles[sourceSquare] = {
        boxShadow: "inset 0 0 0 3px rgba(129, 182, 76, 0.6)",
        backgroundColor: "rgba(129, 182, 76, 0.3)",
      };
      styles[targetSquare] = {
        boxShadow: "inset 0 0 0 4px #81b64c",
        backgroundColor: "rgba(129, 182, 76, 0.6)",
      };
    }

    return styles;
  }, [selectedSquare, hintLevel, status, puzzle]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-14">
      {status === "correct" && <Confetti />}

      {/* HEADER & CATEGORY FILTER TABS */}
      <div className="bg-[#262421] p-4 rounded-2xl border border-[#36322d] shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h2 className="text-base md:text-xl font-black text-white flex items-center gap-2">
              <IconPuzzle3D size={24} />
              <span>{lang === "id" ? "Bank Teka-Teki Catur & Trik Master" : "Chess Puzzles & Master Tactics"}</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {lang === "id"
                ? "Pelajari taktik mulai dari pembukaan, pertahanan, babak tengah, hingga trik kiriman lawan."
                : "Master tactics from opening, defense, middlegame, to opponent tricks."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#81b64c] text-white font-bold text-xs">
              {filteredPuzzles.length} {lang === "id" ? "Teka-Teki Aktif" : "Active Puzzles"}
            </Badge>
          </div>
        </div>

        {/* CATEGORY FILTER BUTTONS */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-[#36322d]">
          {[
            { id: "all", labelId: "Semua Trik", labelEn: "All Tricks" },
            { id: "opening", labelId: "Pembukaan", labelEn: "Openings" },
            { id: "defense", labelId: "Pertahanan", labelEn: "Defense" },
            { id: "middlegame", labelId: "Babak Tengah", labelEn: "Middlegame" },
            { id: "endgame", labelId: "Babak Akhir / Mat", labelEn: "Endgame & Mate" },
            { id: "opponent", labelId: "Trik dari Lawan", labelEn: "Opponent Tactics" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setCategoryFilter(cat.id as PuzzleCategory);
                setCurrentIndex(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === cat.id
                  ? "bg-[#81b64c] text-white shadow-md"
                  : "bg-[#191816] text-neutral-400 hover:text-white border border-[#36322d]"
              }`}
            >
              {lang === "id" ? cat.labelId : cat.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* CHESSBOARD & CONTROLS */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* BOARD CONTAINER */}
        <div className="w-full max-w-[480px] mx-auto aspect-square shrink-0 rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl bg-[#1c1a18]">
          <Chessboard
            options={{
              id: `puzzle-board-${puzzle.id}`,
              position: fen,
              boardOrientation: puzzle.turn === "w" ? "white" : "black",
              allowDragging: false, // CLICK-TO-MOVE ONLY
              boardStyle: { borderRadius: "14px" },
              squareStyles: customSquareStyles,
              darkSquareStyle: { backgroundColor: "#b58863" },
              lightSquareStyle: { backgroundColor: "#f0d9b5" },
              onSquareClick,
            }}
          />
        </div>

        {/* TACTICAL DETAILS & CONTROLS */}
        <div className="flex-1 w-full space-y-4">
          <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 md:p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3 border-b border-[#36322d] pb-3">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  {puzzle.theme}
                </span>
                <h3 className="text-base md:text-lg font-black text-white">
                  Teka-Teki #{currentIndex + 1}
                </h3>
              </div>
              <Badge
                className={`text-xs font-bold ${
                  puzzle.difficulty === "Mudah"
                    ? "bg-emerald-600 text-white"
                    : puzzle.difficulty === "Sedang"
                    ? "bg-amber-600 text-white"
                    : "bg-rose-600 text-white"
                }`}
              >
                {puzzle.difficulty}
              </Badge>
            </div>

            <div className="p-3.5 rounded-xl bg-[#191816] border border-[#36322d] mb-4">
              <div className="text-xs font-bold text-neutral-300 mb-1">
                {lang === "id" ? "Tugas Taktis:" : "Tactical Objective:"}
              </div>
              <div className="text-sm font-semibold text-white">{puzzle.description}</div>
            </div>

            {/* HINTS */}
            {hintLevel >= 1 && status === "unsolved" && (
              <div className="p-3 rounded-xl bg-sky-950/50 border border-sky-600/50 text-sky-200 text-xs mb-3 space-y-1">
                <span className="font-bold block">💡 Petunjuk Level 1 (Bidak):</span>
                <span>{puzzle.hintPiece}</span>
              </div>
            )}

            {hintLevel >= 2 && status === "unsolved" && (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-600/50 text-emerald-200 text-xs mb-3 space-y-1">
                <span className="font-bold block">🎯 Petunjuk Level 2 (Petak Tujuan):</span>
                <span>{puzzle.hintExplanation}</span>
              </div>
            )}

            {/* STATUS ALERT */}
            {status === "correct" && (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs space-y-2 mb-4">
                <div className="font-black text-sm text-white flex items-center gap-2">
                  <IconMedal3D size={18} />
                  <span>Langkah Benar! ({puzzle.solutionSan})</span>
                </div>
                <div className="text-neutral-200 leading-relaxed">{puzzle.trickExplanation}</div>
              </div>
            )}

            {status === "wrong" && (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs mb-4">
                <div className="font-bold text-white mb-1">Langkah Kurang Akurat!</div>
                <div>Coba langkah taktis lain atau gunakan tombol Petunjuk.</div>
              </div>
            )}

            {/* CONTROLS */}
            <div className="flex flex-wrap gap-2.5 mb-5">
              <Button
                onClick={resetCurrentPuzzle}
                variant="outline"
                className="border-[#36322d] bg-[#1a1816] text-neutral-200 hover:text-white text-xs font-bold"
              >
                Ulangi Posisi
              </Button>

              {status === "unsolved" && (
                <>
                  <Button
                    onClick={() => setHintLevel((p) => Math.min(2, p + 1))}
                    variant="outline"
                    className="border-[#38bdf8]/40 bg-[#0f2231] text-sky-300 hover:bg-[#142e44] text-xs font-bold"
                  >
                    {hintLevel === 0 ? "Minta Petunjuk" : "Petunjuk Detail"}
                  </Button>

                  <Button
                    onClick={revealSolution}
                    variant="outline"
                    className="border-[#81b64c]/40 bg-[#1e2a14] text-[#81b64c] hover:bg-[#273819] text-xs font-bold ml-auto"
                  >
                    Buka Solusi
                  </Button>
                </>
              )}

              {status === "correct" && currentIndex < filteredPuzzles.length - 1 && (
                <Button
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs ml-auto shadow-lg"
                >
                  Teka-Teki Selanjutnya →
                </Button>
              )}
            </div>

            {/* PUZZLE NUMBER SELECTOR */}
            <div className="border-t border-[#36322d] pt-3">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                PILIH NOMOR TEKA-TEKI:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {filteredPuzzles.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-9 h-9 rounded-xl font-mono text-xs font-bold transition-all ${
                      currentIndex === idx
                        ? "bg-[#81b64c] text-white shadow-md"
                        : "bg-[#191816] text-neutral-400 hover:text-white border border-[#36322d]"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* TIPS & TRIK UNIK EDUKASI CARD */}
          <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2 font-bold text-sm text-white">
              <IconTrophy3D size={18} />
              <span>Pojok Teori: {puzzle.theme}</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {puzzle.trickExplanation}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
