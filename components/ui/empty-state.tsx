"use client";

/**
 * components/ui/empty-state.tsx (S9-T3 — standarisasi state components, G6.4)
 * Satu komponen empty untuk SEMUA view: ilustrasi line-art orisinal (inline
 * SVG, stroke 2px, aksen token — BUKAN aset chess.com/NeueDeutsche), judul,
 * hint opsional, dan maksimal 1 CTA. Template referensi = empty-state
 * leaderboard-view (card rounded-2xl bg-[var(--card)]).
 */

import { cn } from "cn";
import { Button } from "@/components/ui/button";

export type EmptyStateProps = {
  /** Judul singkat (mis. "Belum ada partai"). */
  title: string;
  /** Petunjuk opsional (teks kecil). */
  hint?: string;
  /** Label CTA — bila diisi bersama onCta, 1 tombol tampil. */
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
};

/**
 * Ilustrasi orisinal S9-T3 (D3.1): line-art abstrak "papan + bidak".
 * 4×4 grid kecil (abstraksi daftar) + 1 bidak abstrak (raja: lingkaran
 * bertopi) yang miring keluar dari grid. Maksimal 4–5 bentuk, stroke 2px,
 * aksen var(--primary) (token, bukan hex baru).
 */
function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width="96"
      height="96"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn("text-neutral-500", className)}
    >
      {/* Papan: kotak + garis grid 4×4 (satu path, abstraksi daftar) */}
      <rect x="14" y="30" width="46" height="46" rx="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M26 30v46 M38 30v46 M50 30v46 M14 42h46 M14 54h46 M14 66h46"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.45"
      />
      {/* Bidak abstrak (raja): lingkaran + mahkota, miring keluar dari grid */}
      <g transform="rotate(10 74 58)">
        <circle cx="74" cy="58" r="13" fill="var(--primary)" fillOpacity="0.16" stroke="var(--primary)" strokeWidth="2" />
        <path
          d="M66 49 L69 44 L72 48 L74 43 L76 48 L79 44 L82 49"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

export function EmptyState({ title, hint, ctaLabel, onCta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center flex flex-col items-center gap-3",
        className,
      )}
    >
      <EmptyIllustration className="shrink-0" />
      <p className="text-sm font-bold text-neutral-300">{title}</p>
      {hint ? <p className="max-w-xs text-xs text-neutral-400">{hint}</p> : null}
      {ctaLabel && onCta ? (
        <Button onClick={onCta} className="bg-[var(--primary)] text-black font-black hover:bg-[var(--primary)]/90 shadow-[0_4px_0_rgba(69,117,60,0.4)] active:scale-[0.98]">
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
