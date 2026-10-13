"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IconSkull3D, IconSwap3D, IconPlay3D } from "@/components/icons3d";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("FIF Chess Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/60 border border-rose-500/50 flex items-center justify-center shadow-inner">
          <IconSkull3D size={36} />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-white uppercase tracking-wide">
            Terjadi Kesalahan Aplikasi
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            Sesi catur mendeteksi kendala pada state atau koneksi engine. Anda dapat memuat ulang komponen atau kembali ke menu utama.
          </p>
          {error?.message && (
            <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] font-mono text-[11px] text-rose-300 break-all text-left">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 pt-2">
          <Button
            onClick={() => reset()}
            className="flex-1 ctl ctl-primary font-bold flex items-center justify-center gap-2"
          >
            <IconSwap3D size={16} />
            <span>Coba Lagi</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="flex-1 border-[var(--border)] text-neutral-300 hover:text-white hover:bg-[var(--surface)] font-bold flex items-center justify-center gap-2"
          >
            <IconPlay3D size={16} />
            <span>Muat Ulang</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
