"use client";

/**
 * components/board-chrome.tsx (V1 — ui-parity-v2, P1)
 * Wrapper chrome di sekitar papan existing: bar atas (avatar/label player +
 * gear popover settings) dan bar bawah (lawan/bot), koordinat file a-h edge
 * bawah + rank 1-8 edge kiri dirender absolute di dalam container — board
 * engine TIDAK diubah, koordinat tidak menggeser square.
 *
 * Gear popover: flip board, tema warna (BOARD_THEMES via applyGlobalChessTheme),
 * sound toggle (lib/sound.ts setSoundMuted — V7). Board TIDAK PERNAH telanjang.
 *
 * Dipakai: puzzle-view, daily-puzzle-view, rush-view, endgame-drills-view
 * (melalui PuzzleSolver board frame) dan view game lain.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BOARD_THEMES, applyGlobalChessTheme, type BoardThemeId, type PieceThemeId } from "@/lib/chess-themes";
import { isSoundMuted, setSoundMuted } from "@/lib/sound";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

type Props = {
  /** Label pemain sisi atas papan (dari sudut pandang orientasi). */
  topLabel: string;
  /** Label pemain sisi bawah papan. */
  bottomLabel: string;
  /** Rating/elo opsional yang ditampilkan di bar. */
  topRating?: number | string | null;
  bottomRating?: number | string | null;
  /** Balik koordinat (board flipped). */
  flipped?: boolean;
  children: React.ReactNode;
  /** Kelas tambahan untuk container luar. */
  className?: string;
};

function PlayerBar({ label, rating, side, onOpenSettings }: { label: string; rating?: number | string | null; side: "top" | "bottom"; onOpenSettings?: () => void }) {
  const initial = (label || "?").trim().slice(0, 2).toUpperCase();
  return (
    <div
      className={`flex items-center gap-2 px-1 py-1.5 ${side === "top" ? "order-1" : "order-3"}`}
      data-board-chrome-bar={side}
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-[10px] font-black text-white shadow shrink-0" aria-hidden="true">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-black text-white truncate">{label || "Pemain"}</div>
        {rating !== null && rating !== undefined && rating !== "" ? (
          <div className="text-[10px] font-semibold text-neutral-400 tabular-nums leading-tight">{rating} rating</div>
        ) : null}
      </div>
      {onOpenSettings ? (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Pengaturan papan"
          aria-haspopup="dialog"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] transition-all cursor-pointer"
        >
          {/* gear icon — SVG original, bukan aset eksternal */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function GearPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const id = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  const [themeId, setThemeId] = useState<BoardThemeId>("wood");
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isSoundMuted());
    try {
      const b = window.localStorage.getItem("jev_board_theme") as BoardThemeId | null;
      if (b && BOARD_THEMES.some((t) => t.id === b)) setThemeId(b);
    } catch {}
  }, [open]);

  // Esc menutup popover; klik luar juga.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Pengaturan papan"
      className="absolute right-1 top-10 z-50 w-56 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-3 shadow-2xl"
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Tema Papan</p>
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {BOARD_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={themeId === t.id}
            title={t.name}
            onClick={() => {
              setThemeId(t.id);
              applyGlobalChessTheme(t.id, (window.localStorage.getItem("jev_piece_theme") as PieceThemeId) || "standard");
            }}
            className={`h-8 rounded-lg border-2 overflow-hidden flex ${themeId === t.id ? "border-[var(--primary)]" : "border-[var(--border)]"}`}
          >
            <span className="w-1/2 h-full" style={{ background: t.light }} />
            <span className="w-1/2 h-full" style={{ background: t.dark }} />
            <span className="sr-only">{t.name}</span>
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between gap-2 text-xs font-bold text-neutral-200 cursor-pointer">
        <span>Suara</span>
        <input
          id={`${id}-sound`}
          type="checkbox"
          checked={!muted}
          onChange={(e) => {
            setMuted(!e.target.checked);
            setSoundMuted(!e.target.checked);
          }}
          className="accent-[var(--primary)] w-4 h-4"
        />
      </label>
      <p className="mt-2 text-[10px] text-neutral-500">Tema &amp; suara tersimpan otomatis.</p>
    </div>
  );
}

export function BoardChrome({ topLabel, bottomLabel, topRating, bottomRating, flipped = false, children, className = "" }: Props) {
  const [gearOpen, setGearOpen] = useState(false);
  const fileOrder = useMemo(() => (flipped ? [...FILES].reverse() : [...FILES]), [flipped]);
  const rankOrder = useMemo(() => (flipped ? [...RANKS].reverse() : [...RANKS]), [flipped]);

  return (
    <div className={`relative flex flex-col ${className}`} data-board-chrome="">
      <PlayerBar label={topLabel} rating={topRating} side="top" onOpenSettings={() => setGearOpen((v) => !v)} />
      <GearPopover open={gearOpen} onClose={() => setGearOpen(false)} />

      {/* Container papan + koordinat overlay — koordinat absolute, tidak menggeser square */}
      <div className="relative order-2">
        {children}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" data-board-coords="">
          <div className="absolute left-0.5 bottom-0.5 flex h-full items-end justify-between flex-col pb-[2px]" style={{ width: "14px" }}>
            {rankOrder.map((r) => (
              <span key={r} className="board-coord-text">{r}</span>
            ))}
          </div>
          <div className="absolute bottom-0.5 left-0.5 flex w-full justify-end items-center gap-[calc(12.5%-14px)]" style={{ height: "14px" }}>
            {fileOrder.map((f) => (
              <span key={f} className="board-coord-text">{f}</span>
            ))}
          </div>
        </div>
      </div>

      <PlayerBar label={bottomLabel} rating={bottomRating} side="bottom" />
    </div>
  );
}
