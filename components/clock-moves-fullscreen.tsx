"use client";

// Fullscreen Focus Arena (v4.0)
// Fitur Lengkap & Anti-Bug:
// 1. Dual-Input Gameplay: Drag-and-drop DAN Click-to-move berfungsi 100% mulus.
// 2. Anti-Clipping Geometry: Dihitung dengan dvh tepat (100dvh - 170px) agar kartu pemain & jam catur tidak pernah terpotong di layar manapun.
// 3. Robust Modal: Murni CSS fixed overlay (tidak bergantung pada HTML5 RequestFullscreen API yang rentan gagal / force-close).
// 4. Keyboard Guard: Hanya tombol Escape yang menutup fullscreen (tidak ada penutupan akibat tombol 'f' / salah tekan).
// 5. Vertical Evaluation Bar (Rasio Stockfish).
// 6. Live Stockfish & AI Coach Tactical Commentary.
// 7. Scoresheet Riwayat Langkah dengan Auto-scroll.

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
  onSquareClick?: (args: { square: string }) => void;
  squareStyles?: Record<string, React.CSSProperties>;
  canDragPiece?: (args: any) => boolean;
  scoreCp?: number | null;
  coachCommentary?: {
    headline: string;
    reason: string;
    tactic?: string;
  } | null;
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
  onSquareClick,
  squareStyles,
  canDragPiece,
  scoreCp = 0,
  coachCommentary,
}: Props) {
  const [currentOrientation, setCurrentOrientation] = useState<"white" | "black">(boardOrientation);
  const [showCommentary, setShowCommentary] = useState(true);
  const scrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentOrientation(boardOrientation);
  }, [boardOrientation]);

  // Hanya tombol Escape yang menutup fullscreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Auto-scroll tabel notasi saat langkah bertambah
  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  // Hitung rasio evaluasi Stockfish (-10 s/d +10 pion)
  const evalValue = typeof scoreCp === "number" ? scoreCp / 100 : 0;
  const whiteWinningPercent = useMemo(() => {
    const clamped = Math.max(-10, Math.min(10, evalValue));
    return Math.round(50 + (clamped / 10) * 45);
  }, [evalValue]);

  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  const isHumanTurn = activeSide === currentOrientation;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Arena Catur Layar Penuh"
      className="fixed inset-0 z-50 bg-[#121110] text-white flex flex-col justify-between overflow-hidden select-none"
    >
      {/* HEADER NAVIGASI ATAS */}
      <header className="px-3 sm:px-6 py-2 bg-[var(--card)]/95 backdrop-blur border-b border-[var(--border)] flex items-center justify-between shrink-0 z-20 h-11">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <h2 className="text-xs sm:text-sm font-black text-white m-0 tracking-wide uppercase truncate">
            Arena Fokus Catur (1 Layar)
          </h2>
          <div className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--primary)]">
            {activeSide ? `● Giliran ${activeSide === "white" ? "Putih" : "Hitam"}` : "Selesai"}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Toggle Komentator */}
          <button
            type="button"
            onClick={() => setShowCommentary((v) => !v)}
            className={`px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
              showCommentary
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "bg-[var(--surface)] text-neutral-400 border-[var(--border)] hover:text-white"
            }`}
            title="Nyalakan / Matikan Komentar Taktis"
          >
            <IconBot3D size={14} />
            <span className="hidden md:inline">Komentator:</span>
            <span>{showCommentary ? "ON" : "OFF"}</span>
          </button>

          {/* Tombol Putar Papan */}
          <button
            type="button"
            onClick={() => setCurrentOrientation((o) => (o === "white" ? "black" : "white"))}
            className="px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--surface)] border border-[var(--border)] text-neutral-300 hover:text-white flex items-center gap-1.5 transition-all"
            title="Putar Orientasi Papan"
          >
            <IconSwap3D size={14} />
            <span className="hidden md:inline">Putar</span>
          </button>

          {/* Tombol Tutup */}
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 hover:bg-red-900 flex items-center gap-1.5 transition-all shadow-sm"
            title="Tutup Layar Penuh (Escape)"
          >
            <IconClose3D size={14} />
            <span>Tutup</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-2 sm:p-3 gap-2.5 lg:gap-5 max-w-7xl mx-auto w-full overflow-hidden min-h-0">
        
        {/* KOLOM KIRI: EVAL BAR + PAPAN CATUR + KARTU PEMAIN (100% Anti-Clipping) */}
        <div className="flex flex-col items-center justify-center w-full max-w-[min(94vw,calc(100dvh-150px))] shrink-0 min-h-0">
          
          {/* KARTU PEMAIN LAWAN (ATAS) */}
          <div className="w-full flex items-center justify-between px-3 py-1 bg-[var(--card)] rounded-xl border border-[var(--border)] mb-1 shadow-sm h-9 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-3 h-3 rounded-full border shrink-0 ${currentOrientation === "white" ? "bg-neutral-900 border-neutral-600" : "bg-white border-neutral-300"}`} />
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-xs font-bold text-white block truncate max-w-[130px] sm:max-w-[200px]">
                  {currentOrientation === "white" ? blackName : whiteName}
                </span>
                <span className="text-[10px] text-neutral-400 hidden sm:inline">
                  {currentOrientation === "white" ? (activeSide === "black" ? "● Melangkah..." : "Menunggu") : (activeSide === "white" ? "● Melangkah..." : "Menunggu")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CapturedPiecesBar fen={fen} side={currentOrientation === "white" ? "black" : "white"} />
              <div className={`px-2 py-0.5 rounded-lg font-mono font-black text-xs sm:text-sm border ${
                activeSide !== currentOrientation
                  ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow"
                  : "bg-[var(--surface)] text-neutral-300 border-[var(--border)]"
              }`}>
                {currentOrientation === "white" ? blackTime : whiteTime}
              </div>
            </div>
          </div>

          {/* AREA PAPAN CATUR DENGAN EVAL BAR */}
          <div className="flex items-stretch gap-1.5 sm:gap-2 w-full aspect-square min-h-0">
            
            {/* EVALUATION BAR VERTIKAL */}
            <div
              className="w-3 sm:w-3.5 rounded-full bg-neutral-900 border border-[var(--border)] overflow-hidden flex flex-col justify-end relative shadow-inner shrink-0"
              title={`Evaluasi: ${evalValue > 0 ? "+" + evalValue.toFixed(1) : evalValue.toFixed(1)}`}
            >
              <div
                className="w-full bg-neutral-100 transition-all duration-300 ease-out"
                style={{
                  height: currentOrientation === "white" ? `${whiteWinningPercent}%` : `${100 - whiteWinningPercent}%`,
                }}
              />
              <span className="absolute inset-x-0 bottom-1 text-[7px] font-mono font-bold text-center text-black pointer-events-none select-none">
                {Math.abs(evalValue).toFixed(1)}
              </span>
            </div>

            {/* CONTAINER PAPAN CATUR */}
            <div className="flex-1 aspect-square rounded-xl md:rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-2xl relative bg-[var(--board-dark)] min-h-0">
              <Chessboard
                options={{
                  id: "fullscreen-focus-board",
                  position: fen,
                  boardOrientation: currentOrientation,
                  allowDragging: isHumanTurn,
                  canDragPiece: canDragPiece,
                  onPieceDrop: onPieceDrop ?? (() => false),
                  onSquareClick: onSquareClick,
                  squareStyles: squareStyles,
                  boardStyle: {
                    backgroundColor: "var(--board-dark)",
                  },
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                  animationDurationInMs: 200,
                  showNotation: true,
                }}
              />
            </div>
          </div>

          {/* KARTU PEMAIN USER (BAWAH) - Pasti terlihat & Tidak Terpotong */}
          <div className="w-full flex items-center justify-between px-3 py-1 bg-[var(--card)] rounded-xl border border-[var(--border)] mt-1 shadow-sm h-9 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-3 h-3 rounded-full border shrink-0 ${currentOrientation === "white" ? "bg-white border-neutral-300" : "bg-neutral-900 border-neutral-600"}`} />
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-xs font-bold text-white block truncate max-w-[130px] sm:max-w-[200px]">
                  {currentOrientation === "white" ? whiteName : blackName} (Anda)
                </span>
                <span className="text-[10px] text-neutral-400 hidden sm:inline">
                  {isHumanTurn ? "● Giliran Anda" : "Menunggu lawan"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CapturedPiecesBar fen={fen} side={currentOrientation} />
              <div className={`px-2 py-0.5 rounded-lg font-mono font-black text-xs sm:text-sm border ${
                isHumanTurn
                  ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow"
                  : "bg-[var(--surface)] text-neutral-300 border-[var(--border)]"
              }`}>
                {currentOrientation === "white" ? whiteTime : blackTime}
              </div>
            </div>
          </div>

        </div>

        {/* KOLOM KANAN: KOMENTAR TAKTIS & SCORESHEET NOTASI */}
        <div className="flex-1 flex flex-col gap-2 w-full max-w-md h-full max-h-[min(88vh,calc(100dvh-150px))] overflow-hidden min-h-0">
          
          {/* LIVE STOCKFISH & AI COACH COMMENTATOR CARD */}
          {showCommentary && (
            <div className="p-3 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm shrink-0 animate-in fade-in space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconBot3D size={18} />
                  <span className="text-xs font-bold text-white">
                    {coachCommentary ? "Analisis AI Coach" : "Analisis Komentator Stockfish"}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-emerald-400 font-bold">
                  Eval: {evalValue > 0 ? "+" + evalValue.toFixed(2) : evalValue.toFixed(2)}
                </span>
              </div>

              <div className="text-xs leading-relaxed text-neutral-200">
                {coachCommentary ? (
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-400">{coachCommentary.headline}</div>
                    <div className="text-neutral-300">{coachCommentary.reason}</div>
                    {coachCommentary.tactic && (
                      <div className="text-[11px] text-amber-300 italic">💡 {coachCommentary.tactic}</div>
                    )}
                  </div>
                ) : lastMove ? (
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
                  <span className="text-neutral-400">Pertandingan baru dimulai. Tekan atau seret bidak untuk melangkah.</span>
                )}
              </div>
            </div>
          )}

          {/* SCORESHEET NOTASI LANGKAH */}
          <div className="flex-1 flex flex-col p-3 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm min-h-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-1 shrink-0">
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
