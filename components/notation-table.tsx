"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type NotationRow = {
  /** Nomor langkah (1., 2., ...) */
  no: number;
  /** Notasi SAN langkah Putih, bila ada */
  white?: string;
  /** Notasi SAN langkah Hitam, bila ada */
  black?: string;
  /** Evaluasi (centipion) langkah Putih — opsional, ditampilkan sebagai +x.x */
  whiteScoreCp?: number | null;
  /** Evaluasi (centipion) langkah Hitam — opsional */
  blackScoreCp?: number | null;
  /** Penanda langkah terakhir yang baru dimainkan */
  latest?: boolean;
};

type Props = {
  title: string;
  whiteLabel: string;
  blackLabel: string;
  rows: NotationRow[];
  emptyText?: string;
  /** Aksi saat sebuah langkah diklik (opsional — mis. lompat ke posisi di review) */
  onSelect?: (ply: number) => void;
  /** Total ply (langkah setengah) untuk judul "(n)" */
  plyCount?: number;
  /** Tinggi maksimum area isi sebelum scroll (class Tailwind, mis. "max-h-48") */
  bodyMaxHeightClass?: string;
  /** Konten tambahan di kanan header (mis. badge hasil akhir) */
  headerExtra?: ReactNode;
  className?: string;
};

export function NotationTable({
  title,
  whiteLabel,
  blackLabel,
  rows,
  emptyText = "Belum ada langkah yang dimainkan.",
  onSelect,
  plyCount,
  bodyMaxHeightClass = "max-h-64",
  headerExtra,
  className = "",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalPly = plyCount ?? rows.reduce((acc, r) => acc + (r.white ? 1 : 0) + (r.black ? 1 : 0), 0);
  const selectable = typeof onSelect === "function";

  // Auto-scroll ke baris terakhir saat ada langkah baru
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [totalPly]);

  return (
    <div
      className={`rounded-xl border border-[var(--border)] overflow-hidden flex flex-col min-h-0 shadow-sm ${className}`}
      style={{ background: "var(--card)" }}
    >
      {/* Header kartu */}
      <div
        className="py-1.5 px-3.5 border-b border-[var(--border)] flex flex-row items-center justify-between shrink-0"
        style={{ background: "var(--surface)" }}
      >
        <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
          {title} ({totalPly})
        </span>
        {headerExtra}
      </div>

      {/* Isi tabel */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div ref={scrollRef} className={`flex-1 min-h-0 overflow-y-auto font-mono text-[12px] custom-scrollbar ${bodyMaxHeightClass}`}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-[10px] text-neutral-400 font-sans uppercase tracking-wider">
                <th className="py-1 px-2 text-center w-8">#</th>
                <th className="py-1 px-2.5 text-left border-r border-[var(--border)]">
                  Putih: <strong className="text-white">{whiteLabel}</strong>
                </th>
                <th className="py-1 px-2.5 text-left">
                  Hitam: <strong className="text-white">{blackLabel}</strong>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60 text-[11px]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-neutral-500 italic text-[11px]">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.no}
                    className={`${r.latest ? "bg-[var(--primary)]/10" : ""} hover:bg-neutral-800/40 transition-colors`}
                  >
                    <td className="py-1 px-2 text-center text-neutral-500 font-bold">{r.no}.</td>
                    <td className="py-1 px-2.5 border-r border-[var(--border)]">
                      {r.white ? (
                        selectable ? (
                          <button
                            type="button"
                            onClick={() => onSelect((r.no - 1) * 2 + 1)}
                            className="w-full flex items-center justify-between text-left cursor-pointer"
                            title={`Lompat ke langkah ${r.no}. ${r.white}`}
                          >
                            <MoveCell san={r.white} scoreCp={r.whiteScoreCp} latest={r.latest} />
                          </button>
                        ) : (
                          <MoveCell san={r.white} scoreCp={r.whiteScoreCp} latest={r.latest} />
                        )
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-1 px-2.5">
                      {r.black ? (
                        selectable ? (
                          <button
                            type="button"
                            onClick={() => onSelect((r.no - 1) * 2 + 2)}
                            className="w-full flex items-center justify-between text-left cursor-pointer"
                            title={`Lompat ke langkah ${r.no}... ${r.black}`}
                          >
                            <MoveCell san={r.black} scoreCp={r.blackScoreCp} latest={r.latest} />
                          </button>
                        ) : (
                          <MoveCell san={r.black} scoreCp={r.blackScoreCp} latest={r.latest} />
                        )
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MoveCell({ san, scoreCp, latest }: { san: string; scoreCp?: number | null; latest?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`font-bold ${latest ? "text-[var(--primary)]" : "text-white"}`}>{san}</span>
      <span className="text-[10px] text-neutral-400 font-mono">
        {scoreCp !== null && scoreCp !== undefined
          ? `${scoreCp > 0 ? "+" : ""}${(scoreCp / 100).toFixed(1)}`
          : ""}
      </span>
    </div>
  );
}
