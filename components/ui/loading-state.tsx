"use client";

/**
 * components/ui/loading-state.tsx (S9-T3 — standarisasi state components, G6.2)
 * Satu komponen loading untuk SEMUA view: skeleton blok animate-pulse
 * (token existing) + label sr-only role="status" aria-live="polite"
 * (pola leaderboard-view :143 yang sudah benar). Skeleton TIDAK menampilkan
 * angka palsu (no-mock) — placeholder abu-abu saja.
 */

import { cn } from "cn";

export type LoadingStateProps = {
  /** Label teks untuk screen reader (mis. "Memuat papan peringkat…"). */
  label: string;
  /** Pola skeleton: baris list / grid kartu / papan catur. Default "row". */
  skeleton?: "row" | "grid" | "board";
  /** Jumlah baris utk pola "row". Default 6. */
  rows?: number;
  className?: string;
};

function RowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="w-full max-w-2xl flex flex-col gap-2 px-4 py-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-[44px] rounded-lg border border-[var(--border)] bg-[var(--card)] animate-pulse flex items-center gap-3 px-3">
          <div className="h-3.5 w-24 rounded bg-[var(--surface)]" />
          <div className="h-2.5 w-40 rounded bg-[var(--surface)]" />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="view-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-28 rounded-xl border border-[var(--border)] bg-[var(--card)] animate-pulse p-3 flex flex-col gap-2">
          <div className="h-3.5 w-3/4 rounded bg-[var(--surface)]" />
          <div className="h-2.5 w-full rounded bg-[var(--surface)]" />
          <div className="h-2.5 w-2/3 rounded bg-[var(--surface)] mt-auto" />
        </div>
      ))}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex items-center justify-center gap-3 w-full" aria-hidden="true">
      <div className="aspect-square w-full max-w-[min(100%,480px)] rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] animate-pulse" />
      <div className="hidden sm:block w-40 h-40 rounded-xl border border-[var(--border)] bg-[var(--card)] animate-pulse" />
    </div>
  );
}

export function LoadingState({ label, skeleton = "row", rows, className }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center w-full", className)}>
      <span className="sr-only">{label}</span>
      {skeleton === "grid" ? <GridSkeleton /> : skeleton === "board" ? <BoardSkeleton /> : <RowSkeleton rows={rows} />}
    </div>
  );
}
