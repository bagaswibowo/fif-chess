"use client";

/**
 * components/views/leaderboard-view.tsx (ticket S4-T3 — Sprint 4)
 * Papan Peringkat: tab Global/Teman (segmented), top 50 dari
 * /api/leaderboard?scope=..., row user sendiri di-highlight (sticky bila di
 * luar 50 besar). Tabel semantik, ikon3d medali untuk 3 besar, no-mock.
 */

import { useCallback, useEffect, useState } from "react";
import { IconTrophy3D } from "@/components/icons3d";

type Entry = { rank: number; username: string; rating: number; games: number; isMe: boolean };
type Payload = { scope: "global" | "friends"; entries: Entry[]; me: Entry | null };

type Props = {
  lang?: "id" | "en";
  /** Klik username → profil/stats (deep-link, signature UX #6). */
  onOpenProfile?: (username: string) => void;
  onPlayOnline?: () => void;
};

export function LeaderboardView({ onOpenProfile, onPlayOnline }: Props) {
  const [scope, setScope] = useState<"global" | "friends">("global");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: "global" | "friends") => {
    setError(null);
    try {
      const res = await fetch(`/api/leaderboard?scope=${s}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 401 ? "Masuk untuk melihat papan peringkat." : "Gagal memuat papan peringkat.");
        return;
      }
      setData((await res.json()) as Payload);
    } catch {
      setError("Gagal memuat papan peringkat.");
    }
  }, []);

  useEffect(() => {
    void load(scope);
  }, [scope, load]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="status">
        <p className="text-sm text-neutral-300">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
        <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat papan peringkat…</span>
      </div>
    );
  }

  const entries = data.entries;
  const meOutside = data.me && !entries.some((e) => e.isMe) ? data.me : null;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-3">
        <IconTrophy3D size={28} aria-hidden="true" />
        <h1 className="text-xl font-black text-white">Papan Peringkat</h1>
      </div>

      {/* Segmented control */}
      <div className="flex bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] w-full max-w-xs shadow-md" role="tablist" aria-label="Cakupan papan peringkat">
        {(["global", "friends"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={scope === s}
            onClick={() => setScope(s)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-150 ${
              scope === s ? "bg-[var(--primary)] text-black shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            {s === "global" ? "Global" : "Teman"}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center flex flex-col items-center gap-3">
          <p className="text-sm font-bold text-neutral-300">Papan peringkat masih kosong — mainkan partai pertamamu!</p>
          {onPlayOnline && (
            <button
              onClick={onPlayOnline}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-black text-black shadow-[0_4px_0_#45753c] active:scale-[0.98]"
            >
              Main Online
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-neutral-400">
                <th scope="col" className="px-4 py-2.5 text-left w-14 font-bold">#</th>
                <th scope="col" className="px-2 py-2.5 text-left font-bold">Pemain</th>
                <th scope="col" className="px-2 py-2.5 text-right font-bold">Rating</th>
                <th scope="col" className="px-4 py-2.5 text-right font-bold">Main</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.username}
                  className={`border-b border-[var(--border)]/60 last:border-0 ${
                    e.isMe ? "bg-[var(--primary)]/10 border-y border-[var(--primary)]/40" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-bold text-neutral-300">
                    {e.rank <= 3 ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${e.rank === 1 ? "bg-yellow-400" : e.rank === 2 ? "bg-neutral-300" : "bg-amber-600"}`}
                          aria-hidden="true"
                        />
                        {e.rank}
                      </span>
                    ) : (
                      e.rank
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      onClick={() => onOpenProfile?.(e.username)}
                      className={`font-bold hover:text-[var(--primary)] transition-colors ${e.isMe ? "text-[var(--primary)]" : "text-white"}`}
                      aria-label={`Profil @${e.username}${e.isMe ? " (Anda)" : ""}`}
                    >
                      @{e.username}
                    </button>
                    {e.isMe && <span className="sr-only"> (Anda)</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right font-bold text-white">{e.rating}</td>
                  <td className="px-4 py-2.5 text-right text-neutral-400">{e.games}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sticky row user sendiri bila di luar 50 besar */}
          {meOutside && (
            <div
              className="sticky bottom-0 border-t border-[var(--primary)]/40 bg-[var(--primary)]/10 backdrop-blur px-4 py-2.5 flex items-center text-sm"
              aria-label={`Posisi Anda: peringkat ${meOutside.rank}`}
            >
              <span className="w-14 font-bold text-neutral-300">{meOutside.rank}</span>
              <span className="flex-1 font-bold text-[var(--primary)]">@{meOutside.username}</span>
              <span className="font-bold text-white">{meOutside.rating}</span>
              <span className="w-16 text-right text-neutral-400">{meOutside.games}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
