"use client";

/**
 * components/views/puzzle-view.tsx (S3-T1 frontend — G8, T6 WS-2.5)
 * /puzzles: rating-based unlimited solve. Papan kiri, panel kanan; streak,
 * hint 2-level, feedback benar/salah, upsell Rush idle 20s.
 * T6: bar filter tema (/api/puzzles/themes) + preset rating chips +
 * Terapkan/Reset → /api/puzzles/next?theme=&minRating=&maxRating=;
 * banner hasil inline aria-live + tombol "Lanjut" eksplisit; tanpa
 * auto-advance saat prefers-reduced-motion.
 * API kontrak: app/api/puzzles/next + [id]/attempt + [id]/hint (backend paralel).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PuzzleSolver } from "@/components/puzzle-solver";
import { Button } from "@/components/ui/button";
import type { PuzzleDto } from "@/lib/puzzle-solve";
import { TierLadder } from "@/components/views/tier-ladder";

type Props = { lang?: "id" | "en"; onGoRush?: () => void };

type HintPayload = { from: string; direction?: { files: number; ranks: number } } | null;

type RatingPreset = { id: string; label: string; min: number | null; max: number | null };

const RATING_PRESETS: RatingPreset[] = [
  { id: "any", label: "Semua rating", min: null, max: null },
  { id: "easy", label: "<1200", min: null, max: 1199 },
  { id: "mid", label: "1200–1800", min: 1200, max: 1800 },
  { id: "hard", label: "1800+", min: 1801, max: null },
];

export function PuzzleView({ lang = "id", onGoRush }: Props) {
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef(false);

  // T6: filter state
  const [themes, setThemes] = useState<string[]>([]);
  const [theme, setTheme] = useState("");
  const [preset, setPreset] = useState("any");
  const [applied, setApplied] = useState<{ theme: string; min: number | null; max: number | null }>({ theme: "", min: null, max: null });
  // W3: tier terpilih (progression rating 800..2200) — null = tanpa filter tier.
  const [tier, setTier] = useState<number | null>(null);
  // T6: banner hasil inline (aria-live) + tombol Lanjut
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  const [bestStep, setBestStep] = useState<string | null>(null);

  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/puzzles/themes", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        const list = (d?.themes ?? d ?? []) as unknown;
        if (!cancelled && Array.isArray(list)) {
          setThemes(list.map((t) => (typeof t === "string" ? t : String((t as { name?: string; theme?: string })?.name ?? (t as { theme?: string })?.theme ?? ""))).filter(Boolean));
        }
      } catch {
        /* dropdown kosong */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNext = useCallback(
    async (override?: { theme: string; min: number | null; max: number | null }) => {
      setLoading(true);
      setError(null);
      setLastResult(null);
      setBestStep(null);
      try {
        const f = override ?? applied;
        const qs = new URLSearchParams();
        if (f.theme) qs.set("theme", f.theme);
        if (f.min !== null) qs.set("minRating", String(f.min));
        if (f.max !== null) qs.set("maxRating", String(f.max));
        const res = await fetch(`/api/puzzles/next?${qs.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Gagal memuat teka-teki.");
          if (!retryRef.current) {
            retryRef.current = true;
            setLoading(false);
            return;
          }
        } else {
          retryRef.current = false;
          setPuzzle(data.puzzle as PuzzleDto);
          setStreak(typeof data.streak === "number" ? data.streak : 0);
        }
      } catch {
        setError("Gagal memuat teka-teki.");
      }
      setLoading(false);
    },
    [applied],
  );

  useEffect(() => {
    void loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // W3: pilih tier → muat puzzle di rentang rating tier tersebut.
  const pickTier = useCallback(
    (t: number) => {
      setTier(t);
      const f = { theme, min: t, max: t + 199 };
      setApplied(f);
      void loadNext(f);
    },
    [theme, loadNext],
  );

  const applyFilters = useCallback(() => {
    const p = RATING_PRESETS.find((x) => x.id === preset) ?? RATING_PRESETS[0];
    const f = { theme, min: p.min, max: p.max };
    setApplied(f);
    void loadNext(f);
  }, [theme, preset, loadNext]);

  const resetFilters = useCallback(() => {
    setTheme("");
    setPreset("any");
    const f = { theme: "", min: null, max: null };
    setApplied(f);
    void loadNext(f);
  }, [loadNext]);

  const fetchHint = useCallback(async (stage: 1 | 2): Promise<HintPayload> => {
    if (!puzzle) return null;
    try {
      const res = await fetch(`/api/puzzles/${puzzle.id}/hint?stage=${stage}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.hint as HintPayload) ?? null;
    } catch {
      return null;
    }
  }, [puzzle]);

  const submitAttempt = useCallback(
    async (p: { correct: boolean; timeSpentSec: number }): Promise<number | null> => {
      if (!puzzle) return null;
      setLastResult(p.correct ? "correct" : "wrong");
      if (!p.correct) {
        // Langkah terbaik utk banner ✕ (dari solusi puzzle).
        const sol = (puzzle as unknown as { solution_moves?: string[] }).solution_moves;
        setBestStep(Array.isArray(sol) && sol.length > 0 ? String(sol[0]) : null);
      }
      try {
        const res = await fetch(`/api/puzzles/${puzzle.id}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correct: p.correct, time_spent_sec: p.timeSpentSec }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data.streak === "number") setStreak(data.streak);
        return data.streak ?? null;
      } catch {
        return null;
      }
    },
    [puzzle],
  );

  if (error && !puzzle) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="status">
        <p className="text-sm text-neutral-300">{error}</p>
        <Button variant="outline" onClick={() => void loadNext()}>
          {lang === "id" ? "Coba Lagi" : "Retry"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* W3: progression tier rating — unlock via akurasi tier sebelumnya */}
      <div className="max-w-3xl mx-auto w-full">
        <TierLadder lang={lang} onPickTier={pickTier} selectedTier={tier} />
      </div>

      {/* T6: bar filter tema + preset rating */}
      <div className="max-w-3xl mx-auto w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-neutral-400 flex items-center gap-1">
          <span aria-hidden="true">🏷️</span> Tema
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="ml-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-white"
          >
            <option value="">Semua tema</option>
            {themes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-1" role="radiogroup" aria-label="Preset rating">
          {RATING_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={`px-2 py-1 rounded-full text-xs font-bold border ${
                preset === p.id
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "border-[var(--border)] text-neutral-300 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          <Button size="sm" onClick={applyFilters}>Terapkan</Button>
          <Button size="sm" variant="outline" onClick={resetFilters}>Reset</Button>
        </div>
      </div>

      <PuzzleSolver
        lang={lang}
        puzzle={puzzle}
        loading={loading}
        initialStreak={streak}
        fetchHint={fetchHint}
        submitAttempt={submitAttempt}
        onGoRush={onGoRush}
        // V3: Next Puzzle — muat puzzle baru via API eksisting tanpa reload.
        onNextPuzzle={() => void loadNext()}
      />

      {/* T6: banner hasil inline aria-live — selalu teks + ikon, bukan warna saja */}
      {lastResult && (
        <div
          role="status"
          aria-live="polite"
          className={`max-w-3xl mx-auto w-full rounded-xl border px-4 py-2.5 text-sm font-semibold flex items-center justify-between gap-3 ${
            lastResult === "correct"
              ? "border-[var(--success)] text-emerald-300 bg-[var(--card)]"
              : "border-[var(--error)] text-red-300 bg-[var(--card)]"
          }`}
        >
          <span>
            <span aria-hidden="true">{lastResult === "correct" ? "✓ " : "✕ "}</span>
            {lastResult === "correct" ? "Benar!" : bestStep ? `Kurang tepat — langkah terbaik: ${bestStep}` : "Kurang tepat."}
          </span>
          <Button size="sm" onClick={() => void loadNext()}>
            {lang === "id" ? "Lanjut" : "Next"} <span className="sr-only"> (tekan Enter)</span>
          </Button>
        </div>
      )}
      {reducedMotion && !lastResult && <p className="sr-only" aria-live="polite">Mode gerak minimal aktif.</p>}
    </div>
  );
}
