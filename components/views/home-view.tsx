"use client";

/**
 * components/views/home-view.tsx (ticket S4-T2 — Sprint 4)
 * Home Dashboard: greeting + streak, 3 task cards (todo/done), section
 * Bermain Online dengan dual-aksi Main/Review. Data: GET /api/home/dashboard
 * (backend S4-T2). Empty state jujur — no-mock. Copy Indonesia, icons3d.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconFire3D, IconPuzzle3D, IconMedal3D, IconHistory3D, IconClock3D, IconPlay3D, IconCheck3D } from "@/components/icons3d";

type GameAktif = {
  gameId: string;
  timeControl: string | null;
  gameType: string | null;
  opponent: { username: string; rating: number };
  myColor: "white" | "black";
  myTurn: boolean;
};

type Dashboard = {
  username: string;
  rating: number;
  solvedToday: number;
  streakHarian: number;
  gamesAktif: GameAktif[];
  tasksState: {
    puzzleDone: boolean;
    dailyPuzzleDone: boolean;
    lastGameToReview: { gameId: string; opponent: string; endedAt: string } | null;
  };
};

type Props = {
  onNavigate: (tab: "puzzles" | "daily" | "review" | "archive" | "play") => void;
  /** Game aktif dipilih untuk dimainkan (user klik Main) → ke papan. */
  onPlayGame?: (gameId: string) => void;
  /** Game aktif di-review → game-review. */
  onReviewGame?: (gameId: string) => void;
};

export function HomeView({ onNavigate, onPlayGame, onReviewGame }: Props) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/home/dashboard", { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 401 ? "Sesi berakhir — masuk kembali." : "Gagal memuat dashboard.");
        return;
      }
      setData((await res.json()) as Dashboard);
      setError(null);
    } catch {
      setError("Gagal memuat dashboard.");
    }
  }, []);

  useEffect(() => {
    void load();
    // Refresh ringan saat tab kembali fokus (game aktif berubah realtime di server).
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="status">
        <p className="text-sm text-neutral-300">{error}</p>
        <Button variant="outline" onClick={() => void load()}>Coba Lagi</Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
        <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat dashboard…</span>
      </div>
    );
  }

  const t = data.tasksState;
  const tasks: {
    key: string; label: string; done: boolean; icon: typeof IconPuzzle3D;
    sub: string; aria: string; go: () => void;
  }[] = [
    {
      key: "puzzle", label: "Jawab Teka-Teki", done: t.puzzleDone, icon: IconPuzzle3D,
      sub: "Latihan tanpa batas sesuai ratingmu", aria: "Jawab teka-teki hari ini", go: () => onNavigate("puzzles"),
    },
    {
      key: "daily", label: "Teka-Teki Harian", done: t.dailyPuzzleDone, icon: IconMedal3D,
      sub: "Satu puzzle baru setiap hari", aria: "Mainkan teka-teki harian", go: () => onNavigate("daily"),
    },
    {
      key: "review", label: "Ulas Partai", done: !t.lastGameToReview, icon: IconHistory3D,
      sub: t.lastGameToReview
        ? `vs @${t.lastGameToReview.opponent} · partai terakhirmu`
        : "Belum ada partai untuk diulas",
      aria: "Ulas partai terakhir", go: () => onNavigate(t.lastGameToReview ? "review" : "archive"),
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-5 pb-4">
      {/* Greeting + streak */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl md:text-2xl font-black text-white">
          Selamat datang, <span className="text-[var(--primary)]">{data.username}</span>
        </h1>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--card)] border border-[var(--border)]"
          aria-label={`Streak ${data.streakHarian} hari`}
        >
          <IconFire3D size={20} aria-hidden="true" />
          <span className="text-sm font-bold text-white">Streak {data.streakHarian} hari</span>
        </div>
      </div>

      {/* 3 task cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 snap-x sm:snap-none overflow-x-auto sm:overflow-visible flex sm:flex-nowrap sm:snap-x">
        {tasks.map((task) => (
          <button
            key={task.key}
            onClick={task.go}
            aria-label={task.aria}
            className={`snap-center shrink-0 sm:shrink text-left rounded-2xl border p-4 transition-all duration-150 active:scale-[0.98] ${
              task.done
                ? "bg-[var(--card)] border-[var(--primary)]/40 opacity-80"
                : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)]"
            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]`}
          >
            <task.icon size={28} aria-hidden="true" />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-black text-white">{task.label}</span>
              {task.done && (
                <span className="flex items-center gap-1 text-xs font-bold text-[var(--primary)]">
                  <IconCheck3D size={14} aria-hidden="true" /> Selesai
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{task.sub}</p>
            {!task.done && (
              <span className="mt-3 inline-block rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-black text-black shadow-[0_4px_0_#45753c]">
                {task.key === "puzzle" ? "Mulai" : task.key === "daily" ? "Mainkan" : "Ulas"}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bermain Online */}
      <section aria-labelledby="home-playing-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="home-playing-heading" className="text-base font-black text-white">Bermain Online</h2>
          <span className="text-xs font-bold text-neutral-400" aria-live="polite">
            {data.gamesAktif.length > 0 ? `${data.gamesAktif.length} partai aktif` : ""}
          </span>
        </div>

        {data.gamesAktif.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 flex flex-col items-center gap-3 text-center">
            <IconPlay3D size={40} aria-hidden="true" />
            <p className="text-sm font-bold text-neutral-300">Tidak ada permainan aktif</p>
            <Button onClick={() => onNavigate("play")} className="bg-[var(--primary)] text-black font-black hover:bg-[var(--primary)]/90 shadow-[0_4px_0_#45753c]">
              Main Online
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.gamesAktif.map((g) => (
              <li key={g.gameId}>
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 hover:border-[var(--primary)] transition-colors animate-in fade-in duration-150">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 shrink-0">
                    <IconClock3D size={16} aria-hidden="true" />
                    {g.timeControl ?? "∞"}
                  </span>
                  <span className="flex-1 min-w-0 text-sm truncate">
                    <span className="font-bold text-white">vs @{g.opponent.username}</span>{" "}
                    <span className="text-neutral-400">({g.opponent.rating})</span>{" "}
                    <span className={g.myTurn ? "text-[var(--primary)] font-bold" : "text-neutral-400"}>
                      {g.myTurn ? "Giliranmu" : "Menunggu lawan…"}
                    </span>
                  </span>
                  <span className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => (onPlayGame ? onPlayGame(g.gameId) : onNavigate("play"))}
                      aria-label={`Main partai vs ${g.opponent.username}`}
                      className="bg-[var(--primary)] text-black font-black hover:bg-[var(--primary)]/90 shadow-[0_4px_0_#45753c]"
                    >
                      Main
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => (onReviewGame ? onReviewGame(g.gameId) : onNavigate("review"))}
                      aria-label={`Review partai vs ${g.opponent.username}`}
                    >
                      Review
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
