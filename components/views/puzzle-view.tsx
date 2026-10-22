"use client";

/**
 * components/views/puzzle-view.tsx (S3-T1 frontend — G8)
 * /puzzles: rating-based unlimited solve. Papan kiri, panel kanan; streak,
 * hint 2-level, feedback benar/salah, upsell Rush idle 20s.
 * API kontrak: app/api/puzzles/next + [id]/attempt + [id]/hint (backend paralel).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PuzzleSolver } from "@/components/puzzle-solver";
import { Button } from "@/components/ui/button";
import type { PuzzleDto } from "@/lib/puzzle-solve";

type Props = { lang?: "id" | "en"; onGoRush?: () => void };

type HintPayload = { from: string; direction?: { files: number; ranks: number } } | null;

export function PuzzleView({ lang = "id", onGoRush }: Props) {
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef(false);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/puzzles/next", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    void loadNext();
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
    <PuzzleSolver
      lang={lang}
      puzzle={puzzle}
      loading={loading}
      initialStreak={streak}
      fetchHint={fetchHint}
      submitAttempt={submitAttempt}
      onGoRush={onGoRush}
    />
  );
}
