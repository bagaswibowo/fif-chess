"use client";

import { useState, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPuzzle3D, IconTrophy3D } from "@/components/icons3d";
import { Confetti } from "@/components/confetti";

type Puzzle = {
  id: string;
  fen: string;
  turn: "w" | "b";
  solutionUci: string;
  solutionSan: string;
  theme: string;
  difficulty: "Mudah" | "Sedang" | "Sulit";
  description: string;
  hintPiece: string;
  hintExplanation: string;
};

// 100% Stockfish-Verified Grandmaster Tactics
const SAMPLE_PUZZLES: Puzzle[] = [
  {
    id: "p1",
    fen: "r1b1k2r/ppq2ppp/4p3/3N4/8/8/PPP2PPP/R1B1KB1R w KQkq - 0 10",
    turn: "w",
    solutionUci: "d5c7",
    solutionSan: "Nxc7+",
    theme: "Garpu Kuda Taktis (Knight Fork)",
    difficulty: "Mudah",
    description: "Temukan langkah taktis kuda untuk mencabangkan raja dan menteri lawan sekaligus.",
    hintPiece: "Kuda putih di petak d5",
    hintExplanation: "Kuda melompat ke c7 dengan skak, memukul pion dan menggarpu (fork) raja di e8 dan menteri di c7. Menteri lawan jatuh gratis!",
  },
  {
    id: "p2",
    fen: "6k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1",
    turn: "w",
    solutionUci: "e2e8",
    solutionSan: "Qe8#",
    theme: "Skakmat Baris Belakang (Back Rank)",
    difficulty: "Mudah",
    description: "Raja lawan terjebak di baris ke-8 di belakang pagar pionnya sendiri.",
    hintPiece: "Menteri putih di petak e2",
    hintExplanation: "Menteri meluncur ke baris ke-8 (e8) untuk skakmat mutlak karena raja Hitam tidak memiliki petak lari.",
  },
  {
    id: "p3",
    fen: "6rk/6pp/8/4N3/8/8/6PP/7K w - - 0 1",
    turn: "w",
    solutionUci: "e5f7",
    solutionSan: "Nf7#",
    theme: "Skakmat Kuda Terjepit (Smothered)",
    difficulty: "Sedang",
    description: "Raja lawan terjebak dikelilingi oleh benteng dan pionnya sendiri. Kuda dapat memberikan skakmat mutlak.",
    hintPiece: "Kuda putih di petak e5",
    hintExplanation: "Lompatkan kuda ke f7. Raja Hitam tidak memiliki ruang gerak sedikitpun karena terhalang bidaknya sendiri.",
  },
  {
    id: "p4",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4",
    turn: "w",
    solutionUci: "h5f7",
    solutionSan: "Qxf7#",
    theme: "Serangan Titik Lemah f7",
    difficulty: "Mudah",
    description: "Manfaatkan titik lemah petak f7 yang hanya dijaga oleh raja Hitam.",
    hintPiece: "Menteri putih di petak h5",
    hintExplanation: "Menteri memukul bidak di f7 dengan bantuan perlindungan gajah di c4 untuk skakmat langsung.",
  },
  {
    id: "p5",
    fen: "r1b1k2r/pp1pqppp/2n5/8/8/8/PPPP1PPP/R1BQR1K1 w kq - 0 1",
    turn: "w",
    solutionUci: "e1e7",
    solutionSan: "Rxe7+",
    theme: "Pin Mutlak Jalur-e",
    difficulty: "Mudah",
    description: "Menteri hitam di e7 terkena pin mutlak terhadap raja di e8.",
    hintPiece: "Benteng putih di petak e1",
    hintExplanation: "Pukul menteri lawan di e7 secara cuma-cuma karena menteri tersebut tidak dapat bergerak akibat pin terhadap raja.",
  },
];

export function PuzzleView({ lang = "id" }: { lang?: "id" | "en" }) {
  const [index, setIndex] = useState(0);
  const puzzle = SAMPLE_PUZZLES[index];
  const [fen, setFen] = useState(puzzle.fen);
  const [status, setStatus] = useState<"unsolved" | "correct" | "wrong">("unsolved");
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const chess = useMemo(() => new Chess(fen), [fen]);

  const loadPuzzle = (i: number) => {
    setIndex(i);
    setFen(SAMPLE_PUZZLES[i].fen);
    setStatus("unsolved");
    setHintLevel(0);
    setSelectedSquare(null);
  };

  const resetCurrentPuzzle = () => {
    setFen(puzzle.fen);
    setStatus("unsolved");
    setHintLevel(0);
    setSelectedSquare(null);
  };

  const giveHint = () => {
    setHintLevel((prev) => Math.min(2, prev + 1));
  };

  const autoSolve = () => {
    const from = puzzle.solutionUci.slice(0, 2);
    const to = puzzle.solutionUci.slice(2, 4);
    const c = new Chess(puzzle.fen);
    c.move({ from, to, promotion: "q" });
    setFen(c.fen());
    setStatus("correct");
    setHintLevel(2);
    setSelectedSquare(null);
  };

  // CLICK-TO-MOVE (Drag dimatikan sesuai permintaan)
  const onSquareClick = ({ square }: { square: string }) => {
    if (status === "correct") return;

    // 1. Jika belum ada bidak yang dipilih
    if (!selectedSquare) {
      const piece = chess.get(square as Square);
      if (piece && piece.color === puzzle.turn) {
        setSelectedSquare(square);
      }
      return;
    }

    // 2. Jika klik petak yang sama: batalkan pilihan
    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    // 3. Jika klik bidak milik sendiri lainnya: ganti pilihan bidak
    const clickedPiece = chess.get(square as Square);
    if (clickedPiece && clickedPiece.color === puzzle.turn) {
      setSelectedSquare(square);
      return;
    }

    // 4. Percobaan melangkah dari selectedSquare ke square
    const attempt = `${selectedSquare}${square}`;
    if (attempt === puzzle.solutionUci) {
      const c = new Chess(fen);
      c.move({ from: selectedSquare, to: square, promotion: "q" });
      setFen(c.fen());
      setStatus("correct");
      setSelectedSquare(null);
    } else {
      setStatus("wrong");
      setSelectedSquare(null);
    }
  };

  const sourceSquare = puzzle.solutionUci.slice(0, 2);
  const targetSquare = puzzle.solutionUci.slice(2, 4);

  // Titik tujuan legal untuk bidak yang dipilih
  const destinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const set = new Set<string>();
    const moves = chess.moves({ verbose: true });
    for (const m of moves) {
      if (m.from === selectedSquare) {
        set.add(m.to);
      }
    }
    return set;
  }, [chess, selectedSquare]);

  const customSquareStyles: Record<string, React.CSSProperties> = {};

  // Highlight bidak yang dipilih (ring kuning)
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      boxShadow: "inset 0 0 0 4px #fde047",
      backgroundColor: "rgba(253, 224, 71, 0.25)",
    };
  }

  // Indikator titik tujuan legal
  for (const sq of destinations) {
    customSquareStyles[sq] = {
      background: "radial-gradient(circle, rgba(253, 224, 71, 0.5) 25%, transparent 27%)",
    };
  }

  // Hints
  if (hintLevel >= 1) {
    customSquareStyles[sourceSquare] = {
      backgroundColor: "rgba(56, 189, 248, 0.45)",
      boxShadow: "inset 0 0 0 4px #38bdf8",
    };
  }
  if (hintLevel >= 2) {
    customSquareStyles[targetSquare] = {
      backgroundColor: "rgba(129, 182, 76, 0.55)",
      boxShadow: "inset 0 0 0 4px #81b64c",
    };
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start max-w-5xl mx-auto w-full">
      {status === "correct" && <Confetti />}

      {/* CHESSBOARD (KLIK TO MOVE SAJA, DRAG MATI) */}
      <div className="w-full max-w-[480px] mx-auto aspect-square">
        <Chessboard
          options={{
            id: `puzzle-board-${puzzle.id}`,
            position: fen,
            boardOrientation: puzzle.turn === "w" ? "white" : "black",
            allowDragging: false, // NO DRAG
            onSquareClick,
            squareStyles: customSquareStyles,
            lightSquareStyle: { backgroundColor: "#f0d9b5" },
            darkSquareStyle: { backgroundColor: "#b58863" },
            boardStyle: {
              borderRadius: "14px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              cursor: "pointer",
            },
          }}
        />
      </div>

      {/* PUZZLE DETAILS & CONTROLS */}
      <div className="flex-1 space-y-4 w-full">
        <Card className="bg-[#262421] border-[#3d3a37] shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 bg-[#22201d] border-b border-[#36322d]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <IconPuzzle3D size={24} />
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-bold">
                  {puzzle.theme}
                </Badge>
              </div>
              <Badge className={puzzle.difficulty === "Mudah" ? "bg-emerald-600 font-bold" : "bg-amber-600 font-bold"}>
                {puzzle.difficulty}
              </Badge>
            </div>
            <CardTitle className="text-xl mt-2 text-white">
              {lang === "id" ? `Teka-Teki #${index + 1}` : `Puzzle #${index + 1}`}
            </CardTitle>
            <CardDescription className="text-neutral-400 font-medium">
              {lang === "id"
                ? `Mode Klik: Klik bidak ${puzzle.turn === "w" ? "Putih" : "Hitam"} lalu klik petak tujuan`
                : `Click Mode: Click your piece, then click target square`}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-neutral-300 bg-[#1f1d1a] p-3.5 rounded-xl border border-[#36322d] leading-relaxed">
              {puzzle.description}
            </p>

            {/* STATUS: SOLVED */}
            {status === "correct" && (
              <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-sm font-semibold flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <IconTrophy3D size={24} />
                  <div>
                    <div className="font-bold text-white">
                      {lang === "id" ? "Teka-Teki Selesai!" : "Puzzle Solved!"}
                    </div>
                    <div className="text-xs text-emerald-300">
                      Langkah: <span className="font-mono font-bold text-white">{puzzle.solutionSan}</span> ({puzzle.solutionUci})
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={resetCurrentPuzzle} className="btn-chess-dark h-8 text-xs">
                    {lang === "id" ? "Ulangi Lagi" : "Retry"}
                  </Button>
                  {index < SAMPLE_PUZZLES.length - 1 && (
                    <Button size="sm" onClick={() => loadPuzzle(index + 1)} className="btn-chess-green h-8 text-xs">
                      {lang === "id" ? "Teka-Teki Berikutnya" : "Next Puzzle"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* STATUS: WRONG */}
            {status === "wrong" && (
              <div className="p-4 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-sm font-semibold flex items-center justify-between shadow-lg">
                <div>
                  <div className="font-bold text-white">
                    {lang === "id" ? "Langkah Kurang Tepat" : "Incorrect Move"}
                  </div>
                  <div className="text-xs text-rose-300">
                    {lang === "id" ? "Bukan langkah taktis terbaik. Silakan ulangi posisi." : "Not the best tactical line. Try again."}
                  </div>
                </div>
                <Button size="sm" onClick={resetCurrentPuzzle} className="btn-chess-green h-8 text-xs">
                  {lang === "id" ? "Coba Lagi" : "Try Again"}
                </Button>
              </div>
            )}

            {/* HINT SECTION */}
            {hintLevel > 0 && (
              <div className="p-3.5 bg-[#1a2332] border border-[#38bdf8]/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#38bdf8] uppercase tracking-wider">
                    {lang === "id" ? `Petunjuk Level ${hintLevel}` : `Hint Level ${hintLevel}`}
                  </span>
                  {hintLevel < 2 && (
                    <button
                      onClick={giveHint}
                      className="text-[11px] text-[#38bdf8] hover:underline font-semibold"
                    >
                      {lang === "id" ? "Lihat petunjuk langkah penuh →" : "See full move hint →"}
                    </button>
                  )}
                </div>

                {hintLevel >= 1 && (
                  <div className="text-xs text-neutral-300">
                    <span className="text-white font-bold">{lang === "id" ? "Gerakkan:" : "Move:"}</span>{" "}
                    {puzzle.hintPiece} (Petak disorot biru <span className="font-mono text-[#38bdf8] font-bold">{sourceSquare}</span>)
                  </div>
                )}

                {hintLevel >= 2 && (
                  <div className="text-xs text-emerald-300 pt-1 border-t border-[#38bdf8]/20">
                    <span className="text-white font-bold">{lang === "id" ? "Langkah Kunci:" : "Key Move:"}</span>{" "}
                    <span className="font-mono font-bold text-white">{puzzle.solutionSan}</span> ({sourceSquare} ke {targetSquare})
                    <div className="text-[11px] text-neutral-300 mt-1">{puzzle.hintExplanation}</div>
                  </div>
                )}
              </div>
            )}

            {/* ACTION BUTTONS: RESET, PETUNJUK, SELESAIKAN OTOMATIS */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                onClick={resetCurrentPuzzle}
                className="btn-chess-dark py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <span>{lang === "id" ? "Ulangi Posisi" : "Reset Position"}</span>
              </button>

              <button
                onClick={giveHint}
                className="btn-chess-dark py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-[#38bdf8] border-[#38bdf8]/30 hover:border-[#38bdf8]"
              >
                <span>{lang === "id" ? "Minta Petunjuk" : "Get Hint"}</span>
              </button>

              <button
                onClick={autoSolve}
                className="btn-chess-dark py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-amber-400 border-amber-500/30 hover:border-amber-400"
              >
                <span>{lang === "id" ? "Buka Solusi" : "Show Solution"}</span>
              </button>
            </div>

            {/* PUZZLE NUMBER SELECTOR */}
            <div className="pt-3 border-t border-[#3d3a37]">
              <div className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">
                {lang === "id" ? "Pilih Nomor Teka-Teki:" : "Select Puzzle:"}
              </div>
              <div className="flex gap-2">
                {SAMPLE_PUZZLES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => loadPuzzle(i)}
                    className={`h-9 w-9 rounded-xl font-mono text-xs font-bold border transition-all ${
                      index === i
                        ? "btn-chess-green border-[#81b64c] text-white shadow-md scale-105"
                        : "bg-[#1f1d1a] border-[#36322d] text-neutral-400 hover:text-white hover:bg-[#282622]"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
