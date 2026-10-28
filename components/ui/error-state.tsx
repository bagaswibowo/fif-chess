"use client";

/**
 * components/ui/error-state.tsx (S9-T3 — standarisasi state components, G6.2–G6.4)
 * Satu komponen error untuk SEMUA view: pesan generik + tombol "Coba lagi"
 * (bila onRetry) + kode error sr-only. role="alert". Aksen dari
 * var(--destructive) (token CSS, anti-slop — tanpa hex baru).
 */

import { cn } from "cn";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ErrorStateProps = {
  /** Copy Indonesia penuh (biasanya hasil authErrorText). */
  message: string;
  /** Disediakan → tombol "Coba lagi" tampil. */
  onRetry?: () => void;
  /** Kode sr-only (mis. "503", "account_missing"). */
  code?: string;
  /** Nama area ("papan peringkat", "arsip partai") → sub-copy "Data {ctx}…". */
  ctx?: string;
  className?: string;
};

export function ErrorState({ message, onRetry, code, ctx, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center gap-3 py-10 text-center", className)}
    >
      <CircleAlert size={32} strokeWidth={2} aria-hidden="true" style={{ color: "var(--destructive)" }} />
      <p className="max-w-xs text-sm font-bold text-neutral-300">{message}</p>
      {ctx ? <p className="text-xs text-neutral-400">Data {ctx} tidak dapat dimuat.</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      ) : null}
      {code ? <span className="sr-only">Kode error: {code}</span> : null}
    </div>
  );
}
