"use client";

// Tampilan Fullscreen Mode Fokus Pertandingan (v2.0)
// Fitur Khusus:
// 1. Papan Catur Utama Interaktif / Live.
// 2. Indikator Keunggulan Evaluasi Stockfish (Eval Bar di samping papan).
// 3. Jam Digital & Status Giliran Melangkah Putih vs Hitam.
// 4. Baris Pion/Perwira yang Sudah Dimakan Lawan (Captured Pieces).
// 5. Tabel 2-Kolom Riwayat Notasi Langkah yang Rapi & Minimalis.
// 6. Tombol / Shortcut Keluar Fullscreen (Esc / F).

import { useEffect, useRef, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { CapturedPiecesBar } from "@/components/captured-pieces";
import { IconClose3D } from "@/components/icons3d";

type Props = {
  onClose: () => void;
  whiteName: string;
  blackName: string;
  whiteTime: string;
  blackTime: string;
  activeSide: "white" | "black" | null;
  moves: { san: string }[];
  fen?: string;
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
  scoreCp = null,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

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

  // Prepare 2-column move table rows
  const rows: { n: number; white?: string; black?: string }[] = useMemo(() => {
    const r: { n: number; white?: string; black?: string }[] = [];
    moves.forEach((m, i) => {
      const n = Math.floor(i / 2) + 1;
      if (!r[n - 1]) r[n - 1] = { n };
      if (i % 2 === 0) r[n - 1].white = m.san;
      else r[n - 1].black = m.san;
    });
    return r;
  }, [moves]);

  // Dynamic Stockfish Evaluation percentage for vertical bar
  const { barPct, evalText, isWhiteAhead } = useMemo(() => {
    if (scoreCp === null || scoreCp === undefined) {
      return { barPct: 50, evalText: "+0.0", isWhiteAhead: true };
    }
    const pct = Math.round(((Math.tanh(scoreCp / 400) + 1) / 2) * 100);
    const clampedPct = Math.max(5, Math.min(95, pct));
    const scoreValue = (scoreCp / 100).toFixed(1);
    const text = scoreCp > 0 ? `+${scoreValue} Putih` : scoreCp < 0 ? `${scoreValue} Hitam` : "0.0 Seimbang";
    return { barPct: clampedPct, evalText: text, isWhiteAhead: scoreCp >= 0 };
  }, [scoreCp]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mode Fokus Layar Penuh"
      className="fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between p-3 md:p-6"
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div className="w-full max-w-6xl mx-auto stack">
        {/* TOP COMPACT HEADER */}
        <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="section-title text-sm md:text-base" style={{ margin: 0 }}>
              Mode Layar Penuh (Fokus Catur)
            </h2>
            <div className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--primary)]">
              ● {activeSide === "white" ? "Giliran Putih Melangkah" : "Giliran Hitam Melangkah"}
            </div>
          </div>

          <button
            ref={closeRef}
            className="ctl ctl-xs ctl-quiet flex items-center gap-1.5"
            onClick={onClose}
            title="Tekan Esc atau F untuk keluar"
          >
            <IconClose3D size={14} />
            <span>Tutup Fullscreen (Esc / F)</span>
          </button>
        </div>

        {/* MAIN FULLSCREEN ARENA: EVAL BAR + BOARD + MOVE LIST & CLOCKS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-center pt-2">
          
          {/* LEFT/CENTER (7 cols): TOP CLOCK -> (EVAL BAR + BOARD) -> BOTTOM CLOCK */}
          <div className="lg:col-span-7 stack-tight max-w-[540px] mx-auto w-full">
            
            {/* BLACK PLAYER BAR (TOP) */}
            <div
              className="panel px-3 py-2 row-between rounded-xl transition-all"
              style={{
                background: activeSide === "black" ? "color-mix(in srgb, var(--primary) 12%, var(--card))" : "var(--card)",
                borderColor: activeSide === "black" ? "var(--primary)" : "var(--border)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3.5 h-3.5 rounded-full bg-neutral-900 border border-neutral-600 inline-block shrink-0" />
                <span className="text-xs font-bold text-white truncate">{blackName}</span>
                {activeSide === "black" && (
                  <span className="text-[10px] text-[var(--primary)] font-bold animate-pulse">
                    ● Melangkah
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <CapturedPiecesBar fen={fen} side="black" />
                <div
                  className="font-mono text-base md:text-lg font-black tracking-tight"
                  style={{ color: activeSide === "black" ? "var(--primary)" : "var(--foreground)" }}
                >
                  {blackTime}
                </div>
              </div>
            </div>

            {/* BOARD WITH SIDE STOCKFISH EVAL BAR */}
            <div className="flex gap-2.5 items-stretch w-full aspect-square">
              
              {/* SLIM VERTICAL STOCKFISH EVAL BAR */}
              <div
                className="w-3.5 md:w-4 rounded-full overflow-hidden border border-[var(--border)] flex flex-col justify-end shrink-0 relative shadow-inner"
                style={{ background: "var(--surface)" }}
                title={`Evaluasi Engine: ${evalText}`}
              >
                {/* White advantage filled from bottom */}
                <div
                  className="w-full bg-neutral-100 transition-all duration-500 rounded-b-full"
                  style={{ height: `${barPct}%` }}
                />
                <span
                  className="absolute inset-x-0 bottom-1 text-[8px] font-mono font-bold text-center select-none"
                  style={{ color: isWhiteAhead ? "var(--card)" : "var(--foreground)" }}
                >
                  {Math.abs(scoreCp ? scoreCp / 100 : 0).toFixed(1)}
                </span>
              </div>

              {/* CHESSBOARD */}
              <div className="flex-1 rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-2xl bg-[var(--card)] w-full h-full">
                <Chessboard
                  options={{
                    id: "fullscreen-focus-board",
                    position: fen,
                    boardOrientation,
                    allowDragging: Boolean(onPieceDrop),
                    onPieceDrop,
                    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                    lightSquareStyle: { backgroundColor: "var(--board-light)" },
                    animationDurationInMs: 250,
                  }}
                />
              </div>
            </div>

            {/* WHITE PLAYER BAR (BOTTOM) */}
            <div
              className="panel px-3 py-2 row-between rounded-xl transition-all"
              style={{
                background: activeSide === "white" ? "color-mix(in srgb, var(--primary) 12%, var(--card))" : "var(--card)",
                borderColor: activeSide === "white" ? "var(--primary)" : "var(--border)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3.5 h-3.5 rounded-full bg-white border border-neutral-300 inline-block shrink-0" />
                <span className="text-xs font-bold text-white truncate">{whiteName}</span>
                {activeSide === "white" && (
                  <span className="text-[10px] text-[var(--primary)] font-bold animate-pulse">
                    ● Melangkah
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <CapturedPiecesBar fen={fen} side="white" />
                <div
                  className="font-mono text-base md:text-lg font-black tracking-tight"
                  style={{ color: activeSide === "white" ? "var(--primary)" : "var(--foreground)" }}
                >
                  {whiteTime}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT (5 cols): MOVE HISTORY TABLE (2-COLUMN WHITE VS BLACK) */}
          <div className="lg:col-span-5 panel p-3 md:p-4 stack-tight" style={{ background: "var(--card)" }}>
            <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Notasi Langkah ({moves.length})
              </span>
              <span className="text-[11px] font-mono text-[var(--primary)] font-bold">
                Eval: {evalText}
              </span>
            </div>

            <div
              className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
              style={{ maxHeight: "calc(65vh - 2rem)", overflowY: "auto" }}
            >
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card)] text-neutral-400 text-[11px]">
                    <th className="py-2 px-2.5 text-center w-10">#</th>
                    <th className="py-2 px-3 text-left">Putih ({whiteName})</th>
                    <th className="py-2 px-3 text-left">Hitam ({blackName})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-10 text-neutral-500 italic text-xs">
                        Belum ada langkah yang dimainkan.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => {
                      const isLatest = idx === rows.length - 1;
                      return (
                        <tr
                          key={r.n}
                          className={`transition-colors ${
                            isLatest ? "bg-[var(--primary)]/10" : "hover:bg-neutral-800/40"
                          }`}
                        >
                          <td className="py-1.5 px-2.5 text-center text-neutral-500 font-bold">
                            {r.n}.
                          </td>
                          <td
                            className={`py-1.5 px-3 font-bold ${
                              !r.black && isLatest ? "text-[var(--primary)] font-black" : "text-white"
                            }`}
                          >
                            {r.white ?? "—"}
                          </td>
                          <td
                            className={`py-1.5 px-3 font-bold ${
                              r.black && isLatest ? "text-[var(--primary)] font-black" : "text-neutral-300"
                            }`}
                          >
                            {r.black ?? "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div ref={scrollBottomRef} />
            </div>

            <div className="pt-2 text-[10px] text-[var(--muted-foreground)] row-between">
              <span>*Gunakan mouse/touch untuk melangkah</span>
              <span>Tekan Esc/F untuk keluar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
