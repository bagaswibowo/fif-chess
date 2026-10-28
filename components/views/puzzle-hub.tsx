"use client";

/**
 * components/views/puzzle-hub.tsx (S3-T1..T4, S5-T3, T6 WS-2.5)
 * Hub Teka-Teki: tab Tantangan Harian / Gegas / Latihan Tema / Tanpa Batas
 * di atas solve mode. Sub-navigasi ringan — navTab game.tsx hanya "puzzles".
 * S5-T3: terima initialTab dari deep-link lama (#/daily|#/rush|#/themes).
 * T6: stats strip personal di atas (rating/streak/solved/failed hari ini dari
 * /api/home/dashboard) — angka sebagai teks berlabel; guest melihat strip
 * kosong + CTA masuk, tanpa memblokir mencoba 1 puzzle.
 */

import { useEffect, useState } from "react";
import { PuzzleView } from "./puzzle-view";
import { DailyPuzzleView } from "./daily-puzzle-view";
import { RushView } from "./rush-view";
import { ThemesMasteryView } from "./themes-mastery-view";
import { MissedPuzzlesView } from "./missed-puzzles-view";
import { PuzzleStatsView } from "./puzzle-stats-view";
import type { TierRow } from "./puzzle-tier-strip";

type Props = { lang?: "id" | "en"; onBack?: () => void; initialTab?: PuzzleTab };
type PuzzleTab = "unlimited" | "daily" | "rush" | "themes" | "missed" | "stats";

const TABS: { id: PuzzleTab; labelId: string; labelEn: string }[] = [
  { id: "unlimited", labelId: "Teka-Teki", labelEn: "Puzzles" },
  { id: "daily", labelId: "Harian", labelEn: "Daily" },
  { id: "rush", labelId: "Gegas", labelEn: "Rush" },
  { id: "themes", labelId: "Latihan Tema", labelEn: "Theme Training" },
  { id: "missed", labelId: "Koreksi", labelEn: "Corrections" },
  { id: "stats", labelId: "Statistik", labelEn: "Stats" },
];

type PuzzleStats = {
  tierProgress?: TierRow | null;
  puzzleRating: number | null;
  streak: number;
  solvedToday: number;
  failedToday: number;
};

export function PuzzleHub({ lang = "id", onBack, initialTab = "unlimited" }: Props) {
  const [tab, setTab] = useState<PuzzleTab>(initialTab);
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [guest, setGuest] = useState(false);

  // BUG-2 (QA S5): initialTab bisa berubah setelah mount (hashchange ke
  // #/daily|#/rush|#/themes saat PuzzleHub sudah terpasang, atau fresh load
  // di mana ref terisi belakangan). Re-sync tab setiap kali prop berubah.
  useEffect(() => {
    if (initialTab && initialTab !== "unlimited") setTab(initialTab);
  }, [initialTab]);

  // T6: stats strip dari /api/home/dashboard (T1 fields). 401 → guest strip
  // (bukan blokir); 403 pending → strip kosong; 503 → strip kosong.
  // W3: progress tier aktif utk stats strip (ringkas: tier & akurasi).
  useEffect(() => {
    if (guest) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/puzzles/tiers", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled || !Array.isArray(d.tiers)) return;
        const open = (d.tiers as TierRow[]).filter((t) => t.unlocked);
        const activeTier = open[open.length - 1] ?? null;
        if (!cancelled) setStats((s) => (s ? { ...s, tierProgress: activeTier } : s));
      } catch {
        /* strip tanpa tier */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guest, tab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/home/dashboard", { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelled) setGuest(true);
          return;
        }
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        setGuest(false);
        setStats({
          puzzleRating: typeof d.rating === "number" ? d.rating : null,
          streak: typeof d.streakHarian === "number" ? d.streakHarian : 0,
          solvedToday: typeof d.solvedToday === "number" ? d.solvedToday : 0,
          failedToday: typeof d.failedToday === "number" ? d.failedToday : 0,
        });
      } catch {
        /* strip tetap kosong */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    /* S8 Pola B (spec §3): .view-root + .view-head (tab strip pin 44px, aksen
       --nav-accent-puzzle section Teka-Teki) + .view-body scroll internal
       (stats strip + sub-view aktif). Sub-view embed memakai .view-* sendiri. */
    <div className="view-root w-full">
      <div className="view-head flex items-center gap-2 shrink-0 px-1">
      <div className="flex bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] w-full shadow-md shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.id ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            {lang === "id" ? t.labelId : t.labelEn}
          </button>
        ))}
      </div>
      </div>

      <div className="view-body flex flex-col gap-2 min-h-0 py-1" style={{ scrollbarWidth: "thin" }}>
      {/* T6: stats strip personal — angka sebagai teks berlabel */}
      <div
        className="max-w-xl mx-auto w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 flex items-center justify-between gap-3 text-sm shrink-0 mb-2"
        role="status"
        aria-label="Statistik teka-teki pribadi"
      >
        {guest ? (
          <>
            <span className="text-xs text-neutral-400">Statistik tersimpan setelah masuk.</span>
            <button
              onClick={() => (window.location.hash = "#/auth")}
              className="text-xs font-bold text-[var(--primary)] underline"
            >
              Masuk untuk menyimpan rating
            </button>
          </>
        ) : (
          <>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-black text-white tabular-nums">{stats?.puzzleRating ?? "—"}</span>
              <span className="text-[10px] text-neutral-400">Rating puzzle</span>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-black text-white tabular-nums">{stats?.streak ?? "—"}</span>
              <span className="text-[10px] text-neutral-400">Beruntun harian</span>
            </span>
            {/* W3: progress tier aktif (teks berlabel, bukan warna saja) */}
            <span className="flex flex-col leading-tight">
              <span className="text-base font-black text-white tabular-nums">
                {stats?.tierProgress ? stats.tierProgress.tier : "—"}
              </span>
              <span className="text-[10px] text-neutral-400">
                {stats?.tierProgress
                  ? `Tier ${stats.tierProgress.tier}–${stats.tierProgress.tier + 199} · akurasi ${stats.tierProgress.accuracy}% (${stats.tierProgress.solved}/${stats.tierProgress.attempted} teka-teki)`
                  : "Tier rating"}
              </span>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-black text-emerald-400 tabular-nums">{stats?.solvedToday ?? "—"}</span>
              <span className="text-[10px] text-neutral-400">Benar hari ini</span>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-black text-red-400 tabular-nums">{stats?.failedToday ?? "—"}</span>
              <span className="text-[10px] text-neutral-400">Gagal hari ini</span>
            </span>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {tab === "unlimited" && <PuzzleView lang={lang} onGoRush={() => setTab("rush")} />}
        {tab === "daily" && <DailyPuzzleView lang={lang} onGoPuzzles={() => setTab("unlimited")} />}
        {tab === "rush" && <RushView lang={lang} onBack={onBack} />}
        {tab === "themes" && <ThemesMasteryView lang={lang} onBack={onBack} />}
        {tab === "missed" && <MissedPuzzlesView lang={lang} />}
        {tab === "stats" && <PuzzleStatsView lang={lang} />}
      </div>
      </div>
    </div>
  );
}
