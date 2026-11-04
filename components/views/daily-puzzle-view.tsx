"use client";

/**
 * components/views/daily-puzzle-view.tsx (S3-T2 frontend — G10)
 * /daily: navigator ±hari (future disabled), Bagikan clipboard + toast,
 * banner selesai. Rotasi UTC server-side; UI hanya navigator & share.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PuzzleSolver } from "@/components/puzzle-solver";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { IconCheck3D } from "@/components/icons3d";
import { dailyShareText, formatDailyDate, utcDateKey, type PuzzleDto } from "@/lib/puzzle-solve";

type Props = { lang?: "id" | "en"; onGoPuzzles?: () => void };

type HintPayload = { from: string; to?: string; direction?: { files: number; ranks: number } } | null;

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

  const isFuture = dateKey > todayKey;
  const cannotGoNext = dateKey >= todayKey;
  const pastDisabled = dateKey <= "2000-01-01"; // batas bawah sejarah dump

  const fetchHint = useCallback(
    async (level: 1 | 2 | 3, moveIndex: number): Promise<HintPayload> => {
      if (!puzzle) return null;
      try {
        const res = await fetch(`/api/puzzles/${puzzle.id}/hint?level=${level}&moveIndex=${moveIndex}`, { cache: "no-store" });
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
    const disabled = dir === 1 ? cannotGoNext : pastDisabled;
    return (
      <button
        type="button"
        aria-label={dir === -1 ? (lang === "id" ? "Hari Sebelumnya" : "Previous day") : lang === "id" ? "Hari Berikutnya" : "Next day"}
        aria-disabled={disabled}
        aria-describedby={dir === 1 && cannotGoNext ? "daily-future-note" : undefined}
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
    <div className="view-root w-full min-h-0 flex flex-col">
      {/* Top Header Bar: Date switcher, Daily streak, & Bagikan button */}
      <div className="view-head flex items-center justify-between gap-3 shrink-0 px-3 py-1.5 mb-2 bg-[var(--card)] rounded-xl border border-[var(--border)]">
        {/* Navigator tanggal */}
        <div className="flex items-center gap-2">
          {navBtn(-1)}
          <div className="text-center min-w-36 sm:min-w-44">
            <div className="text-sm font-black text-white leading-tight">{formatDailyDate(dateKey)}</div>
            <div className="text-[10px] text-neutral-500">Waktu UTC</div>
          </div>
          {navBtn(1)}
          <span id="daily-future-note" className="sr-only">
            Tanggal masa depan belum tersedia
          </span>
        </div>

        {/* Streak & Bagikan */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-neutral-300 hidden sm:inline">
            Streak harian: <span className="text-amber-400 font-extrabold">{dailyStreak} hari</span>
          </span>
          <Button size="sm" onClick={() => void share()} className="ctl ctl-primary font-bold">
            {lang === "id" ? "Bagikan" : "Share"}
          </Button>
        </div>
      </div>

      {/* Banner Selesai Hari Ini */}
      {solvedToday && (
        <div className="rounded-xl border border-[var(--success)] bg-[var(--card)] px-4 py-2.5 flex items-center gap-2 text-sm text-white mb-2 shrink-0" role="status">
          <IconCheck3D size={16} aria-hidden="true" />
          <span>Sudah selesai hari ini — lihat solusi atau kembali besok.</span>
          {onGoPuzzles ? (
            <Button size="sm" className="ml-auto" onClick={onGoPuzzles}>
              {lang === "id" ? "Mainkan Teka-Teki Lain" : "Play another puzzle"}
            </Button>
          ) : null}
        </div>
      )}

      {/* Area Papan PuzzleSolver Lebar Penuh (Ukuran Seragam Mengikuti Menu Main) */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar">
        {isFuture ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-sm text-neutral-300 text-center" role="status">
            Tanggal belum tersedia.
            <Button variant="ghost" size="sm" className="ml-2" onClick={() => setDateKey(todayKey)}>
              {lang === "id" ? "Kembali ke hari ini" : "Back to today"}
            </Button>
          </div>
        ) : error ? (
          <ErrorState message={error} ctx="teka-teki harian" />
        ) : (
          <PuzzleSolver
            lang={lang}
            puzzle={puzzle}
            loading={loading}
            initialStreak={dailyStreak}
            fetchHint={fetchHint}
            submitAttempt={submitAttempt}
          />
        )}
      </div>

      {shareFallback ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs text-neutral-200 text-center mt-2 shrink-0" role="status">
          {shareFallback}
        </div>
      ) : null}

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
