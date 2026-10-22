"use client";

/**
 * components/views/daily-puzzle-view.tsx (S3-T2 frontend — G10)
 * /daily: navigator ±hari (future disabled), Bagikan clipboard + toast,
 * banner selesai. Rotasi UTC server-side; UI hanya navigator & share.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PuzzleSolver } from "@/components/puzzle-solver";
import { Button } from "@/components/ui/button";
import { IconCheck3D } from "@/components/icons3d";
import { dailyShareText, formatDailyDate, utcDateKey, type PuzzleDto } from "@/lib/puzzle-solve";

type Props = { lang?: "id" | "en"; onGoPuzzles?: () => void };

type HintPayload = { from: string; direction?: { files: number; ranks: number } } | null;

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return utcDateKey(dt);
}

export function DailyPuzzleView({ lang = "id", onGoPuzzles }: Props) {
  const todayKey = utcDateKey(new Date());
  const [dateKey, setDateKey] = useState(todayKey);
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [solvedToday, setSolvedToday] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shareFallback, setShareFallback] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/puzzles/daily?date=${key}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400) setError("Tanggal belum tersedia.");
        else setError("Belum tersedia — kembali besok.");
        setPuzzle(null);
      } else {
        setPuzzle(data.puzzle as PuzzleDto);
        setSolvedToday(data.solvedToday === true);
        setDailyStreak(typeof data.streakHarian === "number" ? data.streakHarian : 0);
      }
    } catch {
      setError("Belum tersedia — kembali besok.");
      setPuzzle(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(dateKey);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("date", dateKey);
      window.history.replaceState(null, "", url.toString());
    }
  }, [dateKey, load]);

  const future = dateKey >= todayKey;
  const pastDisabled = dateKey <= "2000-01-01"; // batas bawah sejarah dump

  const fetchHint = useCallback(
    async (stage: 1 | 2): Promise<HintPayload> => {
      if (!puzzle) return null;
      try {
        const res = await fetch(`/api/puzzles/${puzzle.id}/hint?stage=${stage}`, { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        return (data.hint as HintPayload) ?? null;
      } catch {
        return null;
      }
    },
    [puzzle],
  );

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
        if (p.correct) setSolvedToday(true);
        void load(dateKey); // refresh streak harian dari server
        return data.streak ?? null;
      } catch {
        return null;
      }
    },
    [puzzle, dateKey, load],
  );

  const share = useCallback(async () => {
    const text = dailyShareText(dateKey, solvedToday);
    try {
      await navigator.clipboard.writeText(text);
      showToast(lang === "id" ? "Hasil disalin" : "Result copied");
      setShareFallback(null);
    } catch {
      // Fallback clipboard gagal (permission): teks ditampilkan untuk copy manual.
      setShareFallback(text);
    }
  }, [dateKey, solvedToday, showToast, lang]);

  const navBtn = (dir: -1 | 1) => {
    const disabled = dir === 1 ? future : pastDisabled;
    return (
      <button
        type="button"
        aria-label={dir === -1 ? (lang === "id" ? "Hari Sebelumnya" : "Previous day") : lang === "id" ? "Hari Berikutnya" : "Next day"}
        aria-disabled={disabled}
        aria-describedby={dir === 1 && future ? "daily-future-note" : undefined}
        onClick={() => {
          if (disabled) return;
          setDateKey((k) => shiftDateKey(k, dir));
        }}
        className={`px-3 py-2 rounded-lg border text-sm font-bold transition-colors ${
          disabled
            ? "border-[var(--border)] text-neutral-600 cursor-default"
            : "border-[var(--border)] text-neutral-200 hover:bg-[var(--surface-hover)]"
        }`}
      >
        {dir === -1 ? "←" : "→"}
      </button>
    );
  };

  return (
    <div className="max-w-5xl mx-auto w-full flex flex-col gap-3">
      {/* Navigator tanggal (design §2.2) */}
      <div className="flex items-center justify-center gap-3 py-1" role="navigation" aria-label="Navigator tanggal harian">
        {navBtn(-1)}
        <div className="text-center min-w-48">
          <div className="text-sm font-black text-white">{formatDailyDate(dateKey)}</div>
          <div className="text-[10px] text-neutral-500">Waktu UTC</div>
        </div>
        {navBtn(1)}
        <span id="daily-future-note" className="sr-only">
          Tanggal masa depan belum tersedia
        </span>
      </div>

      {future ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-neutral-300 text-center" role="status">
          Tanggal belum tersedia.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => setDateKey(todayKey)}>
            {lang === "id" ? "Kembali ke hari ini" : "Back to today"}
          </Button>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-neutral-300 text-center" role="status">
          {error}
        </div>
      ) : (
        <>
          {/* Streak harian */}
          <p className="text-center text-xs text-neutral-400">
            Streak harian: {dailyStreak} hari
          </p>

          {/* Banner selesai (design §2.2) */}
          {solvedToday ? (
            <div className="rounded-xl border border-[var(--success)] bg-[var(--card)] px-4 py-3 flex items-center gap-2 text-sm text-white" role="status">
              <IconCheck3D size={16} aria-hidden="true" />
              Sudah selesai hari ini — lihat solusi atau kembali besok.
              {onGoPuzzles ? (
                <Button size="sm" className="ml-auto" onClick={onGoPuzzles}>
                  {lang === "id" ? "Mainkan Teka-Teki Lain" : "Play another puzzle"}
                </Button>
              ) : null}
            </div>
          ) : null}

          <PuzzleSolver
            lang={lang}
            puzzle={puzzle}
            loading={loading}
            fetchHint={fetchHint}
            submitAttempt={submitAttempt}
          />

          {/* Bagikan */}
          <div className="flex justify-center pb-2">
            <Button onClick={() => void share()}>{lang === "id" ? "Bagikan" : "Share"}</Button>
          </div>
          {shareFallback ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs text-neutral-200 text-center" role="status">
              {shareFallback}
            </div>
          ) : null}
        </>
      )}

      {/* Toast non-blocking (pola toast Sprint 1) */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl border border-[var(--primary)]/40 bg-[var(--card)] px-4 py-2 text-sm font-semibold text-white shadow-2xl"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
