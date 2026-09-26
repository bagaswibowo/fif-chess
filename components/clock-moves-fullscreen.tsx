"use client";

// Fullscreen Focus Arena (v3.0)
// Fitur Lengkap:
// 1. Papan Catur Utama Interaktif & Responsif (100dvh).
// 2. Vertical Evaluation Bar (Garis Hitam & Putih dinamis rasio keunggulan Stockfish).
// 3. Jam Digital & Status Giliran Melangkah Putih vs Hitam.
// 4. Baris Bidak yang Dimakan (Captured Pieces).
// 5. Live Stockfish Commentator & Blunder Detector (Toggle ON/OFF).
// 6. Scoresheet Riwayat Langkah dengan Auto-scroll.
// 7. Tombol Putar Papan (Flip Board) & Shortcut Keluar (Esc / F / ✕).

import { useState, useEffect, useRef, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { CapturedPiecesBar } from "@/components/captured-pieces";
import { IconClose3D, IconSwap3D, IconBot3D } from "@/components/icons3d";
import type { PlayedMove } from "@/lib/types";

type Props = {
  onClose: () => void;
  whiteName: string;
  blackName: string;
  whiteTime: string;
  blackTime: string;
  activeSide: "white" | "black" | null;
  moves: PlayedMove[];
  fen: string;
  boardOrientation?: "white" | "black";
  onPieceDrop?: (args: any) => boolean;
  scoreCp?: number | null;
};

export function ClockMovesFullscreen({
  onClose,
  whiteName,
  blackName,
  whiteTime,
  blackTime,
  activeSide,
  moves,
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  boardOrientation = "white",
  onPieceDrop,
  scoreCp = 0,
}: Props) {
  const [currentOrientation, setCurrentOrientation] = useState<"white" | "black">(boardOrientation);
  const [showCommentary, setShowCommentary] = useState(true);
  const scrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentOrientation(boardOrientation);
  }, [boardOrientation]);

  useEffect(() => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "f" || e.key === "F") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
    };
  }, [onClose]);

  // Auto-scroll move table when moves change
  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  // Calculate Eval Bar ratio (clamped -10 to +10 pawns)
  const evalValue = typeof scoreCp === "number" ? scoreCp / 100 : 0;
  // Sigmoid-like conversion for eval percentage: 50% = 0.0, 95% = +10.0, 5% = -10.0
  const whiteWinningPercent = useMemo(() => {
    const clamped = Math.max(-10, Math.min(10, evalValue));
    return Math.round(50 + (clamped / 10) * 45);
  }, [evalValue]);

  // Determine latest move status / commentary
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  const isHumanTurn = activeSide === currentOrientation;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mode Fokus Pertandingan Layar Penuh"
      className="fixed inset-0 z-50 bg-[var(--background)] text-white flex flex-col justify-between overflow-hidden"
    >
      {/* TOP HEADER CONTROLS */}
      <header className="px-4 py-2 bg-[var(--card)]/90 backdrop-blur border-b border-[var(--border)] flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs md:text-sm font-black text-white m-0 tracking-wide uppercase">
              Arena Fokus Penuh (1 Layar)
            </h2>
          </div>
          <div className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--primary)]">
            {activeSide ? `● Giliran ${activeSide === "white" ? "Putih" : "Hitam"}` : "Permainan Selesai"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Komentator */}
          <button
            type="button"
            onClick={() => setShowCommentary((v) => !v)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
              showCommentary
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "bg-[var(--surface)] text-neutral-400 border-[var(--border)] hover:text-white"
            }`}
            title="Nyalakan / Matikan Komentar Taktis Stockfish"
          >
            <IconBot3D size={14} />
            <span className="hidden sm:inline">Komentator:</span>
            <span>{showCommentary ? "ON" : "OFF"}</span>
          </button>

          {/* Tombol Putar Papan */}
          <button
            type="button"
            onClick={() => setCurrentOrientation((o) => (o === "white" ? "black" : "white"))}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--surface)] border border-[var(--border)] text-neutral-300 hover:text-white flex items-center gap-1.5 transition-all"
            title="Putar Orientasi Papan"
          >
            <IconSwap3D size={14} />
            <span className="hidden sm:inline">Putar</span>
          </button>

          {/* Tombol Keluar */}
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-950/70 border border-red-500/50 text-red-200 hover:bg-red-900 flex items-center gap-1.5 transition-all"
            title="Keluar Fullscreen (Esc / F)"
          >
            <IconClose3D size={14} />
            <span>Tutup</span>
          </button>
        </div>
      </header>

      {/* MAIN ARENA (CHESSBOARD + EVAL BAR + CLOCKS + MOVES) */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-2 sm:p-4 gap-3 lg:gap-6 max-w-7xl mx-auto w-full overflow-hidden">
        
        {/* LEFT / CENTER: EVAL BAR + BOARD + PLAYER CARDS */}
        <div className="flex flex-col items-center justify-center w-full max-w-[min(96vw,84vh)] flex-shrink-0">
          
          {/* TOP PLAYER CARD (OPPONENT) */}
          <div className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--card)] rounded-xl border border-[var(--border)] mb-1.5 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${currentOrientation === "white" ? "bg-neutral-900 border-neutral-600" : "bg-white border-neutral-300"}`} />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate max-w-[140px] sm:max-w-[200px]">
                  {currentOrientation === "white" ? blackName : whiteName}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {currentOrientation === "white" ? (activeSide === "black" ? "● Berpikir..." : "Menunggu") : (activeSide === "white" ? "● Berpikir..." : "Menunggu")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CapturedPiecesBar fen={fen} side={currentOrientation === "white" ? "black" : "white"} />
              <div className={`px-2.5 py-1 rounded-lg font-mono font-black text-sm sm:text-base border ${
                activeSide !== currentOrientation
                  ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow"
                  : "bg-[var(--surface)] text-neutral-300 border-[var(--border)]"
              }`}>
                {currentOrientation === "white" ? blackTime : whiteTime}
              </div>
            </div>
          </div>

          {/* CHESSBOARD WITH VERTICAL EVAL BAR */}
          <div className="flex items-stretch gap-1.5 sm:gap-2 w-full aspect-square">
            
            {/* VERTICAL EVAL BAR */}
            <div
              className="w-3.5 sm:w-4 rounded-full bg-neutral-900 border border-[var(--border)] overflow-hidden flex flex-col justify-end relative shadow-inner flex-shrink-0"
              title={`Evaluasi: ${evalValue > 0 ? "+" + evalValue.toFixed(1) : evalValue.toFixed(1)}`}
            >
              <div
                className="w-full bg-neutral-100 transition-all duration-300 ease-out"
                style={{
                  height: currentOrientation === "white" ? `${whiteWinningPercent}%` : `${100 - whiteWinningPercent}%`,
                }}
              />
              <span className="absolute inset-x-0 bottom-1 text-[8px] font-mono font-bold text-center text-black pointer-events-none select-none">
                {Math.abs(evalValue).toFixed(1)}
              </span>
            </div>

            {/* BOARD CONTAINER */}
            <div className="flex-1 aspect-square rounded-xl md:rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-2xl relative bg-[var(--board-dark)]">
              <Chessboard
                options={{
                  id: "fullscreen-focus-board",
                  position: fen,
                  boardOrientation: currentOrientation,
                  allowDragging: isHumanTurn,
                  onPieceDrop: onPieceDrop ?? (() => false),
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                }}
              />
            </div>
          </div>

          {/* BOTTOM PLAYER CARD (USER) */}
          <div className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--card)] rounded-xl border border-[var(--border)] mt-1.5 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${currentOrientation === "white" ? "bg-white border-neutral-300" : "bg-neutral-900 border-neutral-600"}`} />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate max-w-[140px] sm:max-w-[200px]">
                  {currentOrientation === "white" ? whiteName : blackName} (Anda)
                </span>
                <span className="text-[10px] text-neutral-400">
                  {isHumanTurn ? "● Giliran Anda" : "Menunggu lawan"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CapturedPiecesBar fen={fen} side={currentOrientation} />
              <div className={`px-2.5 py-1 rounded-lg font-mono font-black text-sm sm:text-base border ${
                isHumanTurn
                  ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow"
                  : "bg-[var(--surface)] text-neutral-300 border-[var(--border)]"
              }`}>
                {currentOrientation === "white" ? whiteTime : blackTime}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT SIDE: LIVE COMMENTARY & BLUNDER DETECTOR + COMPACT MOVES LOG */}
        <div className="flex-1 flex flex-col gap-2.5 w-full max-w-md h-full max-h-[66vh] overflow-hidden">
          
          {/* LIVE STOCKFISH COMMENTATOR CARD */}
          {showCommentary && (
            <div className="p-3 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm stack-tight flex-shrink-0 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconBot3D size={18} />
                  <span className="text-xs font-bold text-white">Analisis Komentator Stockfish</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-emerald-400 font-bold">
                  Eval: {evalValue > 0 ? "+" + evalValue.toFixed(2) : evalValue.toFixed(2)}
                </span>
              </div>

              <div className="text-xs leading-relaxed text-neutral-300 pt-1">
                {lastMove ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Langkah {lastMove.san}:</span>
                    {Math.abs(evalValue) < 0.8 ? (
                      <span className="text-emerald-400 font-bold">● Posisi seimbang &amp; terkontrol</span>
                    ) : (evalValue > 1.5 && currentOrientation === "white") || (evalValue < -1.5 && currentOrientation === "black") ? (
                      <span className="text-blue-400 font-bold">● Posisi Anda sangat unggul!</span>
                    ) : (
                      <span className="text-amber-400 font-bold">● Lawan menekan, pertahankan petak sentral</span>
                    )}
                  </div>
                ) : (
                  <span className="text-neutral-400">Pertandingan baru dimulai. Tekan perwira untuk melangkah.</span>
                )}
              </div>
            </div>
          )}

          {/* COMPACT MOVE HISTORY SCORESHEET */}
          <div className="flex-1 flex flex-col p-3 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-1 flex-shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Notasi Langkah ({moves.length})
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                Babak ke-{Math.floor(moves.length / 2) + 1}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto rounded-lg bg-[var(--surface)] border border-[var(--border)] p-1">
              <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                {moves.map((m, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded flex items-center justify-between ${
                      i === moves.length - 1 ? "bg-[var(--primary)]/20 text-[var(--primary)] font-black" : "text-neutral-300 hover:bg-neutral-800/40"
                    }`}
                  >
                    <span className="text-[10px] text-neutral-500 w-6">
                      {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""}
                    </span>
                    <span className="font-bold">{m.san}</span>
                    <span className="text-[9px] opacity-60 uppercase">{m.by === "human" ? "User" : "Bot"}</span>
                  </div>
                ))}
                <div ref={scrollBottomRef} />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
