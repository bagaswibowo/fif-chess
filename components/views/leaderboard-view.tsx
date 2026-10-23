"use client";

/**
 * components/views/leaderboard-view.tsx (ticket S4-T3 + T4 WS-2.5)
 * Papan Peringkat: tab Pemain/Teman (segmented), chips kategori waktu
 * (Semua/Bullet/Blitz/Rapid → param game_type), top 50 dari
 * /api/leaderboard?scope=...&game_type=..., kolom Win-rate, row user sendiri
 * di-highlight (warna + bar 3px kiri, bukan warna saja), sticky bila di luar
 * 50 besar. Tabel semantik, ikon3d medali untuk 3 besar, no-mock.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { IconTrophy3D } from "@/components/icons3d";

type Entry = { rank: number; username: string; rating: number; games: number; winRate: number; isMe: boolean };
type Payload = { scope: "global" | "friends"; gameType?: string | null; entries: Entry[]; me: Entry | null };

type Props = {
  lang?: "id" | "en";
  /** Klik username → profil/stats (deep-link, signature UX #6). */
  onOpenProfile?: (username: string) => void;
  onPlayOnline?: () => void;
};

type GameType = "all" | "bullet" | "blitz" | "rapid";

const GAME_TYPE_CHIPS: { id: GameType; labelId: string; labelEn: string }[] = [
  { id: "all", labelId: "Semua", labelEn: "All" },
  { id: "bullet", labelId: "Bullet", labelEn: "Bullet" },
  { id: "blitz", labelId: "Blitz", labelEn: "Blitz" },
  { id: "rapid", labelId: "Rapid", labelEn: "Rapid" },
];

export function LeaderboardView({ lang = "id", onOpenProfile, onPlayOnline }: Props) {
  const [scope, setScope] = useState<"global" | "friends">("global");
  const [gameType, setGameType] = useState<GameType>("all");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tablistRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (s: "global" | "friends", gt: GameType) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ scope: s });
      if (gt !== "all") qs.set("game_type", gt);
      const res = await fetch(`/api/leaderboard?${qs.toString()}`, { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(authErrorText(res.status, await authErrorPayload(res), "papan peringkat"));
        setData(null);
        return;
      }
      setData(payload as Payload);
    } catch {
      setError("Gagal memuat papan peringkat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(scope, gameType);
  }, [scope, gameType, load]);

  // Arrow-key navigasi chips kategori (roving tabindex, DHH a11y).
  const onChipKey = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? (idx + 1) % GAME_TYPE_CHIPS.length : (idx - 1 + GAME_TYPE_CHIPS.length) % GAME_TYPE_CHIPS.length;
    const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
    setGameType(GAME_TYPE_CHIPS[next].id);
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="status">
        <p className="text-sm text-neutral-300">{error}</p>
        <button
          onClick={() => void load(scope, gameType)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--surface-hover)]"
        >
          Coba lagi
        </button>
      </div>
    );
  }
  if (!data || loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
        <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat papan peringkat…</span>
      </div>
    );
  }

  const entries = data.entries;
  const meOutside = data.me && !entries.some((e) => e.isMe) ? data.me : null;
  const winRateText = (wr: number) => `${Math.round((wr ?? 0) * 100)}%`;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-3">
        <IconTrophy3D size={28} aria-hidden="true" />
        <h1 className="text-xl font-black text-white">Papan Peringkat</h1>
      </div>

      {/* Segmented control Pemain | Teman */}
      <div className="flex bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] w-full max-w-xs shadow-md" role="tablist" aria-label="Cakupan papan peringkat">
        {([["global", "Pemain"], ["friends", "Teman"]] as const).map(([s, label]) => (
          <button
            key={s}
            role="tab"
            aria-selected={scope === s}
            onClick={() => setScope(s)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-150 ${
              scope === s ? "bg-[var(--primary)] text-black shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            {label}
            {scope === s && <span className="sr-only"> (tab aktif)</span>}
          </button>
        ))}
      </div>

      {/* Chips kategori waktu */}
      <div ref={tablistRef} className="flex flex-wrap gap-1.5" role="tablist" aria-label="Kategori waktu">
        {GAME_TYPE_CHIPS.map((c, i) => (
          <button
            key={c.id}
            role="tab"
            tabIndex={gameType === c.id ? 0 : -1}
            aria-selected={gameType === c.id}
            onKeyDown={(e) => onChipKey(e, i)}
            onClick={() => setGameType(c.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              gameType === c.id
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "bg-[var(--card)] text-neutral-300 border-[var(--border)] hover:text-white"
            }`}
          >
            {lang === "id" ? c.labelId : c.labelEn}
            {gameType === c.id && <span aria-hidden="true" className="ml-1">●</span>}
            {gameType === c.id && <span className="sr-only"> (kategori aktif)</span>}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center flex flex-col items-center gap-3">
          <p className="text-sm font-bold text-neutral-300">Papan masih kosong — main rated untuk masuk papan</p>
          {onPlayOnline && (
            <button
              onClick={onPlayOnline}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-black text-black shadow-[0_4px_0_#45753c] active:scale-[0.98]"
            >
              Main sekarang
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
                <th scope="col" className="px-2 py-2.5 text-right font-bold">Main</th>
                <th scope="col" className="px-4 py-2.5 text-right font-bold">Win-rate</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.username}
                  className={`relative border-b border-[var(--border)]/60 last:border-0 ${
                    e.isMe ? "bg-[var(--primary)]/10 border-y border-[var(--primary)]/40" : ""
                  }`}
                >
                  {/* Bar 3px kiri utk row sendiri — indikator non-warna (DHH). */}
                  {e.isMe && <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--primary)]" />}
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
                    {e.isMe && <span className="sr-only"> (Anda) — Peringkat kamu: {e.rank}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right font-bold text-white">{e.rating}</td>
                  <td className="px-2 py-2.5 text-right text-neutral-400">{e.games}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-neutral-200 font-semibold">
                      <span aria-hidden="true">📈 </span>
                      {winRateText(e.winRate)}
                    </span>
                    <span className="sr-only">Tingkat kemenangan {winRateText(e.winRate)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sticky row user sendiri bila di luar 50 besar */}
          {meOutside && (
            <div
              className="sticky bottom-0 border-t border-[var(--primary)]/40 bg-[var(--primary)]/10 backdrop-blur px-4 py-2.5 flex items-center text-sm relative"
              aria-label={`Posisi Anda: peringkat ${meOutside.rank}`}
            >
              <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--primary)]" />
              <span className="w-14 font-bold text-neutral-300">{meOutside.rank}</span>
              <span className="flex-1 font-bold text-[var(--primary)]">@{meOutside.username}</span>
              <span className="font-bold text-white">{meOutside.rating}</span>
              <span className="w-16 text-right text-neutral-400">{meOutside.games}</span>
              <span className="w-20 text-right text-neutral-200">{winRateText(meOutside.winRate)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
