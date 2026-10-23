"use client";

/**
 * components/views/themes-mastery-view.tsx (S3-T4 frontend — G8b)
 * /puzzles/learning: grid 26 tema (THEME_LIST → label Indonesia), progress
 * bar mastery % (capped 100), filter rating number inputs. List-first —
 * papan muncul setelah memilih tema (masuk solve mode via PuzzleSolver).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconCheck3D } from "@/components/icons3d";
import { THEME_LIST } from "@/lib/puzzle-themes";
import type { PuzzleDto } from "@/lib/puzzle-solve";
import { PuzzleSolver } from "@/components/puzzle-solver";

type Props = { lang?: "id" | "en"; onBack?: () => void };

type ThemeProgress = { theme: string; attempted: number; correct: number; masteryPct: number };
type HintPayload = { from: string; to?: string; direction?: { files: number; ranks: number } } | null;

export function ThemesMasteryView({ lang = "id", onBack }: Props) {
  const [progress, setProgress] = useState<ThemeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxRating, setMaxRating] = useState<number | null>(null);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [rangeInvalid, setRangeInvalid] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/puzzles/themes", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setProgress(data.themes ?? []);
        }
      } catch {
        // progress tetap kosong → semua kartu 0%
      }
      setLoading(false);
    })();
  }, []);

  const progressMap = useMemo(() => {
    const m = new Map<string, ThemeProgress>();
    for (const p of progress) m.set(p.theme, p);
    return m;
  }, [progress]);

  // Urutan default: mastery tertinggi → terendah (mendorong melengkapi §4.2).
  const sorted = useMemo(() => {
    return [...THEME_LIST].sort(
      (a, b) => (progressMap.get(b.key)?.masteryPct ?? 0) - (progressMap.get(a.key)?.masteryPct ?? 0),
    );
  }, [progressMap]);

  const rangeOk = !rangeInvalid && (minRating === null || maxRating === null || minRating <= maxRating);

  const startTheme = useCallback(
    async (themeKey: string) => {
      setActiveTheme(themeKey);
      setSolveError(null);
      setPuzzle(null);
      try {
        const params = new URLSearchParams({ theme: themeKey });
        if (minRating !== null) params.set("minRating", String(minRating));
        if (maxRating !== null) params.set("maxRating", String(maxRating));
        const res = await fetch(`/api/puzzles/next?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setSolveError(
            res.status === 404
              ? "Tidak ada teka-teki di rentang ini."
              : "Gagal memuat teka-teki.",
          );
          return;
        }
        setPuzzle(data.puzzle as PuzzleDto);
      } catch {
        setSolveError("Gagal memuat teka-teki.");
      }
    },
    [minRating, maxRating],
  );

  const fetchHint = useCallback(
    async (level: 1 | 2 | 3, moveIndex: number): Promise<HintPayload> => {
      if (!puzzle) return null;
      const res = await fetch(`/api/puzzles/${puzzle.id}/hint?level=${level}&moveIndex=${moveIndex}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.hint as HintPayload) ?? null;
    },
    [puzzle],
  );

  const submitAttempt = useCallback(
    async (p: { correct: boolean; timeSpentSec: number }): Promise<number | null> => {
      if (!puzzle) return null;
      const res = await fetch(`/api/puzzles/${puzzle.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct: p.correct, time_spent_sec: p.timeSpentSec }),
      });
      if (res.ok && p.correct) {
        // refresh progress tema aktif
        void startTheme(activeTheme ?? "");
      }
      return res.ok ? ((await res.json()).streak ?? null) : null;
    },
    [puzzle, activeTheme, startTheme],
  );

  const clampMin = (v: number) => {
    const nv = Math.min(800, Math.max(100, Math.round(v)));
    setMinRating(nv);
    if (maxRating !== null && nv > maxRating) setRangeInvalid(true);
    else setRangeInvalid(false);
  };

  if (activeTheme) {
    return (
      <div className="w-full flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button variant="outline" size="sm" onClick={() => { setActiveTheme(null); setPuzzle(null); }}>
              {lang === "id" ? "Kembali" : "Back"}
            </Button>
          ) : null}
          <h2 className="text-sm font-black text-white">
            {THEME_LIST.find((t) => t.key === activeTheme)?.label ?? activeTheme}
          </h2>
        </div>
        {solveError ? (
          <div role="status" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-neutral-300 text-center">
            {solveError}{" "}
            <Button variant="ghost" size="sm" onClick={() => { setActiveTheme(null); setSolveError(null); }}>
              Sesuaikan Filter
            </Button>
          </div>
        ) : (
          <PuzzleSolver
            lang={lang}
            puzzle={puzzle}
            fetchHint={fetchHint}
            submitAttempt={submitAttempt}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full flex flex-col gap-3">
      {/* Filter (design §4.2) */}
      <div className="flex flex-wrap items-center gap-2">
        {onBack ? (
          <Button variant="outline" size="sm" onClick={onBack}>
            {lang === "id" ? "Kembali" : "Back"}
          </Button>
        ) : null}
        <label className="flex items-center gap-1 text-xs text-neutral-400">
          Rating
          <input
            type="number"
            min={800}
            max={2200}
            placeholder="800"
            aria-label="Rating minimum"
            onChange={(e) => clampMin(Number(e.target.value))}
            className="w-20 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-white"
          />
          –
          <input
            type="number"
            min={800}
            max={2200}
            placeholder="2200"
            aria-label="Rating maksimum"
            onChange={(e) => {
              const nv = Math.max(800, Math.min(3000, Math.round(Number(e.target.value))));
              setMaxRating(Number.isFinite(nv) && e.target.value ? nv : null);
              if (minRating !== null && nv < minRating) setRangeInvalid(true);
              else setRangeInvalid(false);
            }}
            className="w-20 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-white"
          />
        </label>
        {rangeInvalid ? (
          <span className="text-xs text-[var(--error)]" role="status">
            Rentang rating tidak valid
          </span>
        ) : null}
      </div>

      {/* Grid tema (2 kolom mobile, 3-4 desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 pb-4" role="list" aria-busy={loading}>
        {sorted.map((t) => {
          const p = progressMap.get(t.key);
          const pct = p?.masteryPct ?? 0;
          const complete = pct >= 100;
          return (
            <button
              key={t.key}
              type="button"
              role="listitem"
              disabled={!rangeOk}
              title={!rangeOk ? "Rentang rating tidak valid" : undefined}
              onClick={() => void startTheme(t.key)}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left hover:border-[var(--primary)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-white truncate">{t.label}</span>
                {complete ? <IconCheck3D size={14} aria-hidden="true" /> : null}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Mastery ${t.label}`}
                  className="flex-1 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden"
                >
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-neutral-400 tabular-nums">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
