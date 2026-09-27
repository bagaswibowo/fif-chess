"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconPawn3D } from "@/components/icons3d";
import type { PlayedMove } from "@/lib/types";

type Props = {
  moves: PlayedMove[];
  whiteName?: string;
  blackName?: string;
  currentPly?: number;
  onSelectMove?: (ply: number) => void;
};

export function MoveList({
  moves,
  whiteName = "Putih",
  blackName = "Hitam",
  currentPly,
  onSelectMove,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const rows: { number: number; white?: PlayedMove; black?: PlayedMove }[] = [];
  for (const move of moves) {
    const number = Math.ceil(move.ply / 2);
    let row = rows.find((entry) => entry.number === number);
    if (!row) {
      row = { number };
      rows.push(row);
    }
    if (move.ply % 2 === 1) row.white = move;
    else row.black = move;
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center p-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50">
        <IconPawn3D size={32} className="mb-2" />
        <p className="text-xs font-semibold text-neutral-300">Belum ada langkah</p>
        <p className="text-xs text-neutral-400 mt-1 max-w-[220px]">
          Gerakkan bidak di papan catur untuk mencatat notasi pertandingan.
        </p>
      </div>
    );
  }

  const latestPly = moves.length > 0 ? moves[moves.length - 1].ply : 0;
  const activePly = currentPly ?? latestPly;

  return (
    <div className="flex flex-col h-full rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
      {/* Header Tabel Notasi */}
      <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center px-3 py-2 border-b border-[var(--border)] bg-[var(--card)] text-xs font-bold text-neutral-400">
        <span className="text-center">#</span>
        <div className="flex items-center gap-1.5 truncate pr-1">
          <span className="w-2.5 h-2.5 rounded-full bg-white border border-neutral-400 shrink-0" />
          <span className="truncate text-white">{whiteName}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate pl-1">
          <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-600 shrink-0" />
          <span className="truncate text-white">{blackName}</span>
        </div>
      </div>

      {/* Isi Daftar Notasi */}
      <ScrollArea className="flex-1 h-56 px-2 py-1.5">
        <div className="space-y-0.5">
          {rows.map((row) => (
            <div
              key={row.number}
              className={`grid grid-cols-[2.5rem_1fr_1fr] items-center rounded-lg py-1 px-1 transition-colors ${
                row.number % 2 === 0 ? "bg-[var(--card)]/40" : "bg-transparent"
              } hover:bg-[var(--primary)]/10`}
            >
              {/* Nomor Langkah */}
              <span className="text-center font-mono text-xs font-bold text-neutral-400 select-none">
                {row.number}.
              </span>

              {/* Langkah Putih */}
              <MoveButton
                move={row.white}
                isActive={row.white?.ply === activePly}
                onClick={row.white && onSelectMove ? () => onSelectMove(row.white!.ply) : undefined}
              />

              {/* Langkah Hitam */}
              <MoveButton
                move={row.black}
                isActive={row.black?.ply === activePly}
                onClick={row.black && onSelectMove ? () => onSelectMove(row.black!.ply) : undefined}
              />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

function MoveButton({
  move,
  isActive,
  onClick,
}: {
  move?: PlayedMove;
  isActive: boolean;
  onClick?: () => void;
}) {
  if (!move) return <div className="h-6" />;

  const isEngine = move.by === "jev" || move.by === "jev-fly" || move.by === "fly" || move.by === "stockfish";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold text-left transition-all flex items-center justify-between group ${
        isActive
          ? "bg-[var(--primary)] text-white shadow-sm ring-1 ring-[var(--primary)]"
          : "text-neutral-200 hover:bg-neutral-800/80 hover:text-white"
      }`}
    >
      <span>{move.san}</span>
      {isEngine && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isActive ? "bg-white" : "bg-amber-400/80"
          }`}
          title="Langkah AI"
        />
      )}
    </button>
  );
}
