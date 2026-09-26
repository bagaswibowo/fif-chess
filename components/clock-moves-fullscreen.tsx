"use client";

// Tampilan Fullscreen Mode Fokus Pertandingan (Waktu & Riwayat Langkah)
// Dirancang khusus untuk fokus tanpa gangguan visual papan di layar (cocok untuk over-the-board / fokus jam digital & scoresheet)
// Fitur:
// 1. Jam Digital Raksasa Putih & Hitam dengan Indikator Giliran Melangkah Aktif.
// 2. Baris Pion/Perwira yang Sudah Dimakan Lawan (Captured Pieces).
// 3. Tabel 2-Kolom Riwayat Notasi Langkah Catur (Scoresheet) dengan auto-scroll ke langkah terbaru.
// 4. Shortcut Keluar Fullscreen (Esc / F).

import { useEffect, useRef, useMemo } from "react";
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

  const renderClockCard = (side: "white" | "black", name: string, time: string) => {
    const isActive = activeSide === side;
    return (
      <div
        className="panel p-5 md:p-7 flex-1 flex flex-col justify-between rounded-2xl transition-all"
        style={{
          background: isActive
            ? "color-mix(in srgb, var(--primary) 14%, var(--card))"
            : "var(--card)",
          borderColor: isActive ? "var(--primary)" : "var(--border)",
          boxShadow: isActive ? "0 0 24px color-mix(in srgb, var(--primary) 20%, transparent)" : "none",
        }}
      >
        <div className="row-between items-center mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-4 h-4 rounded-full border shrink-0 ${
                side === "white" ? "bg-white border-neutral-300" : "bg-neutral-900 border-neutral-600"
              }`}
            />
            <span className="text-sm md:text-base font-bold text-white truncate max-w-[200px]">{name}</span>
          </div>
          {isActive ? (
            <span className="text-xs text-[var(--primary)] font-bold animate-pulse px-2.5 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--primary)]">
              ● Giliran Melangkah
            </span>
          ) : (
            <span className="text-xs text-neutral-500 font-medium">Menunggu</span>
          )}
        </div>

        <div
          className="font-mono text-center font-black tracking-tight my-4 md:my-6 select-none"
          style={{
            fontSize: "clamp(3rem, 8vw, 5.5rem)",
            lineHeight: 1,
            color: isActive ? "var(--primary)" : "var(--foreground)",
          }}
        >
          {time}
        </div>

        <div className="pt-2 border-t border-[var(--border)] flex justify-center">
          <CapturedPiecesBar fen={fen} side={side} />
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mode Fokus Jam dan Riwayat Langkah"
      className="fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between p-4 md:p-8"
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div className="w-full max-w-4xl mx-auto stack gap-5 my-auto">
        {/* HEADER BAR */}
        <div className="row-between pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="section-title text-base md:text-lg" style={{ margin: 0 }}>
              Mode Fokus: Jam &amp; Riwayat Notasi
            </h2>
            <div className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--primary)]">
              {activeSide ? `● Giliran ${activeSide === "white" ? "Putih" : "Hitam"} Melangkah` : "Permainan Selesai / Jeda"}
            </div>
          </div>

          <button
            ref={closeRef}
            className="ctl ctl-sm ctl-quiet flex items-center gap-1.5"
            onClick={onClose}
            title="Tekan Esc atau F untuk keluar"
          >
            <IconClose3D size={14} />
            <span>Tutup (Esc / F)</span>
          </button>
        </div>

        {/* DUAL DIGITAL CLOCKS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderClockCard("white", whiteName, whiteTime)}
          {renderClockCard("black", blackName, blackTime)}
        </div>

        {/* 2-COLUMN MOVE HISTORY SCORESHEET */}
        <div className="panel p-4 stack-tight rounded-2xl" style={{ background: "var(--card)" }}>
          <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Riwayat Notasi Langkah ({moves.length} Ply)
            </span>
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              Total Babak: {rows.length}
            </span>
          </div>

          <div
            className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
            style={{ maxHeight: "35vh", overflowY: "auto" }}
          >
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card)] text-neutral-400 text-[11px]">
                  <th className="py-2 px-3 text-center w-12">#</th>
                  <th className="py-2 px-4 text-left">Putih ({whiteName})</th>
                  <th className="py-2 px-4 text-left">Hitam ({blackName})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/60">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-neutral-500 italic text-xs">
                      Belum ada langkah yang dicatat.
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
                        <td className="py-1.5 px-3 text-center text-neutral-500 font-bold">
                          {r.n}.
                        </td>
                        <td
                          className={`py-1.5 px-4 font-bold ${
                            !r.black && isLatest ? "text-[var(--primary)] font-black" : "text-white"
                          }`}
                        >
                          {r.white ?? "—"}
                        </td>
                        <td
                          className={`py-1.5 px-4 font-bold ${
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
            <span>*Tampilan fokus murni untuk jam digital &amp; scoresheet</span>
            <span>Tekan Esc atau F untuk kembali ke papan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
