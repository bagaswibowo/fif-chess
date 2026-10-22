"use client";

/**
 * components/views/endgame-drills-view.tsx (ticket S4-T4 — Sprint 4)
 * Permainan Akhir: 6 set kurasi dari /api/endgames/drills (progress %),
 * klik set → solve mode PuzzleSolver (S3-T1) dengan pool dari
 * /api/endgames/drills/[setId]/next. Attempt tetap via puzzles/[id]/attempt.
 */

import { useCallback, useEffect, useState } from "react";
import { PuzzleSolver } from "@/components/puzzle-solver";
import { Button } from "@/components/ui/button";
import { IconTrophy3D, IconShield3D } from "@/components/icons3d";
import type { PuzzleDto } from "@/lib/puzzle-solve";

type DrillSet = {
  id: string;
  title: string;
  description: string;
  total: number;
  solved: number;
  progressPct: number;
};

type HintPayload = { from: string; direction?: { files: number; ranks: number } } | null;

export function EndgameDrillsView({ onExit }: { onExit?: () => void }) {
  const [sets, setSets] = useState<DrillSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState<DrillSet | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  const loadSets = useCallback(async () => {
    try {
      const res = await fetch("/api/endgames/drills", { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 401 ? "Masuk untuk melihat latihan permainan akhir." : "Gagal memuat set permainan akhir.");
        return;
      }
      const data = await res.json();
      setSets(data.sets as DrillSet[]);
      setError(null);
    } catch {
      setError("Gagal memuat set permainan akhir.");
    }
  }, []);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const loadNext = useCallback(async (set: DrillSet) => {
    setLoading(true);
    setSolveError(null);
    try {
      const res = await fetch(`/api/endgames/drills/${set.id}/next`, { cache: "no-store" });
      const data = await res.json();
      if (res.status === 404 && data?.done) {
        setPuzzle(null);
        setSolveError("Semua puzzle di set ini sudah selesai.");
        return;
      }
      if (!res.ok) {
        setSolveError(data?.error ?? "Gagal memuat puzzle.");
        return;
      }
      setPuzzle(data.puzzle as PuzzleDto);
      setStreak(typeof data.streak === "number" ? data.streak : 0);
    } catch {
      setSolveError("Gagal memuat puzzle.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openSet = useCallback(
    (set: DrillSet) => {
      setActiveSet(set);
      setPuzzle(null);
      void loadNext(set);
    },
    [loadNext],
  );

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

  // ===== Solve mode =====
  if (activeSet) {
    const refresh = async () => {
      await loadSets();
      const updated = sets?.find((s) => s.id === activeSet.id) ?? activeSet;
      setActiveSet(updated);
      void loadNext(updated);
    };
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <h1 className="text-base md:text-lg font-black text-white truncate">
            {activeSet.title}
            <span className="ml-2 text-xs font-bold text-neutral-400">Progress {activeSet.progressPct} persen</span>
          </h1>
          <Button variant="outline" size="sm" onClick={() => { setActiveSet(null); setPuzzle(null); void loadSets(); }} aria-label="Kembali ke daftar set">
            Kembali
          </Button>
        </div>
        {solveError && !puzzle ? (
          <div className="flex flex-col items-center gap-3 py-10" role="status">
            <p className="text-sm text-neutral-300">{solveError}</p>
            <Button variant="outline" onClick={() => void refresh()}>Segarkan</Button>
          </div>
        ) : (
          <PuzzleSolver
            puzzle={puzzle}
            loading={loading}
            initialStreak={streak}
            fetchHint={fetchHint}
            submitAttempt={submitAttempt}
            onSolved={() => void refresh()}
            onFailed={() => void loadNext(activeSet)}
          />
        )}
      </div>
    );
  }

  // ===== Daftar set =====
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="status">
        <p className="text-sm text-neutral-300">{error}</p>
      </div>
    );
  }
  if (!sets) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
        <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat set permainan akhir…</span>
      </div>
    );
  }
  if (sets.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
        <p className="text-sm font-bold text-neutral-300">Belum ada set permainan akhir yang tersedia</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <IconShield3D size={28} aria-hidden="true" />
          <h1 className="text-xl font-black text-white">Permainan Akhir</h1>
        </div>
        <p className="text-xs font-bold text-neutral-400">Kurasi teka-teki akhir per tema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sets.map((s) => {
          const done = s.progressPct >= 100;
          return (
            <div
              key={s.id}
              className={`relative rounded-2xl border p-4 bg-[var(--card)] transition-all duration-150 ${
                done ? "border-[var(--primary)]/60" : "border-[var(--border)] hover:border-[var(--primary)]"
              }`}
            >
              {done && (
                <span className="absolute top-3 right-3 text-[var(--primary)]" aria-hidden="true">
                  <IconTrophy3D size={18} />
                </span>
              )}
              <h2 className="text-sm font-black text-white">{s.title}</h2>
              <p className="mt-1 text-xs text-neutral-400 line-clamp-2 min-h-8">{s.description}</p>
              <div
                className="mt-3 h-2 rounded-full bg-[var(--muted)] overflow-hidden"
                role="progressbar"
                aria-valuenow={s.progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress ${s.progressPct} persen`}
              >
                <div className="h-full bg-[var(--primary)] transition-all duration-150" style={{ width: `${s.progressPct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400">
                  {s.solved}/{s.total} · {s.progressPct}%
                </span>
                <Button
                  size="sm"
                  variant={done ? "outline" : "default"}
                  onClick={() => openSet(s)}
                  aria-label={`${done ? "Ulangi" : s.progressPct > 0 ? "Lanjutkan" : "Mulai"} set ${s.title}, progress ${s.progressPct} persen`}
                  className={!done ? "bg-[var(--primary)] text-black font-black hover:bg-[var(--primary)]/90 shadow-[0_4px_0_#45753c]" : ""}
                >
                  {done ? "Ulangi" : s.progressPct > 0 ? "Lanjutkan" : "Mulai"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
