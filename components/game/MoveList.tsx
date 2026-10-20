"use client";

/**
 * MoveList.tsx
 * Scrollable move list with alternating white/black rows, quality symbols, eval column.
 */

import React, { useEffect, useRef } from "react";
import { MoveItem } from "./MoveItem";

export type MoveRow = {
  ply: number;
  san: string;
  uci: string;
  scoreCp: number | null;
  deltaCp: number | null;
  classification: "brilliant" | "great" | "good" | "book" | "mistake" | "blunder" | "inaccuracy";
  isBestMove: boolean;
};

export interface MoveListProps {
  moves: MoveRow[];
  latestPly: number | null;
  onSelect: (ply: number) => void;
  className?: string;
  height?: string;
}

export function MoveList({
  moves,
  latestPly,
  onSelect,
  className = "",
  height = "h-64 md:h-80",
}: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [moves.length, latestPly]);

  return (
    <div
      className={`rounded-xl border border-[#3d3a34] overflow-hidden flex flex-col min-h-0 shadow-sm ${className}`}
      style={{ background: "#262421" }}
    >
      <div className="px-3 py-2 border-b border-[#3d3a34] bg-[#211f1d] flex items-center justify-between shrink-0">
        <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
          Riwayat Langkah
        </span>
        <span className="text-xs text-neutral-500 font-mono">{moves.length} ply</span>
      </div>
      <div
        ref={scrollRef}
        className={`flex-1 min-h-0 overflow-y-auto font-mono ${height}`}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#3d3a34]/60 text-xs text-neutral-400 font-sans uppercase tracking-wider">
              <th className="py-1 px-2 text-center w-8">#</th>
              <th className="py-1 px-2.5 text-left">Putih</th>
              <th className="py-1 px-2.5 text-left">Hitam</th>
              <th className="py-1 px-2 text-right w-16">Eval</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3d3a34]/40 text-xs">
            {moves.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-neutral-500 italic text-xs">
                  Belum ada langkah yang dimainkan.
                </td>
              </tr>
            ) : (
              moves.map((m) => {
                const isWhite = m.ply % 2 === 1;
                const moveNumber = Math.ceil(m.ply / 2);
                const isLatest = m.ply === latestPly;
                return (
                  <tr
                    key={m.ply}
                    className={`${isLatest ? "bg-[#81b64c]/10" : ""} hover:bg-neutral-800/40 transition-colors`}
                  >
                    <td className="py-1 px-2 text-center text-neutral-500 font-bold">
                      {moveNumber}.
                    </td>
                    {isWhite ? (
                      <>
                        <td className="py-1 px-2.5 border-r border-[#3d3a34]/60">
                          <MoveItem {...m} isLatest={isLatest} onSelect={onSelect} />
                        </td>
                        <td className="py-1 px-2.5">
                          <span className="text-neutral-600">—</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-1 px-2.5 border-r border-[#3d3a34]/60">
                          <span className="pl-2 text-neutral-600">—</span>
                        </td>
                        <td className="py-1 px-2.5">
                          <MoveItem {...m} isLatest={isLatest} onSelect={onSelect} />
                        </td>
                      </>
                    )}
                    <td className="py-1 px-2 text-right font-mono">
                      {m.scoreCp !== null ? (
                        <span className={m.scoreCp > 0 ? "text-emerald-400" : m.scoreCp < 0 ? "text-orange-400" : "text-neutral-400"}>
                          {m.scoreCp > 0 ? `+` : m.scoreCp < 0 ? `-` : ""}${(Math.abs(m.scoreCp) / 100).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
