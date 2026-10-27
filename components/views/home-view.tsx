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
      <div className="view-root w-full max-w-4xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-play)" }}>
          <h1 className="text-sm font-black text-white">Beranda</h1>
        </div>
        <div className="view-body flex flex-col items-center gap-3 py-10" role="status">
          <p className="text-sm text-neutral-300">{error}</p>
          <Button variant="outline" onClick={() => void load()}>Coba Lagi</Button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="view-root w-full max-w-4xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-play)" }}>
          <h1 className="text-sm font-black text-white">Beranda</h1>
        </div>
        <div className="view-body flex items-center justify-center py-10" role="status" aria-live="polite">
          <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat dashboard…</span>
        </div>
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
    <div className="view-root w-full max-w-4xl mx-auto">
      {/* Greeting + streak (head 44px) */}
      <div className="view-head flex items-center justify-between flex-wrap gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-play)" }}>
        <h1 className="text-base font-black text-white">
          Selamat datang, <span className="text-[var(--nav-accent-play)]">{data.username}</span>
        </h1>
        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] shrink-0"
          aria-label={`Streak ${data.streakHarian} hari`}
        >
          <IconFire3D size={16} aria-hidden="true" />
          <span className="text-xs font-bold text-white">Streak {data.streakHarian} hari</span>
        </div>
      </div>

      {/* S8 Pola D — kartu rapat (gap 12px, auto-rows-min), total tinggi ≤ area konten */}
      <div className="view-cards grid grid-cols-1 sm:grid-cols-3 gap-3 auto-rows-min">
        {tasks.map((task) => (
          <button
            key={task.key}
            onClick={task.go}
            aria-label={task.aria}
            className={`text-left rounded-xl border p-3 transition-all duration-150 active:scale-[0.98] ${
              task.done
                ? "bg-[var(--card)] border-[var(--nav-accent-play)]/40 opacity-80"
                : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--nav-accent-play)]"
            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nav-accent-play)]`}
          >
            <task.icon size={22} aria-hidden="true" />
            <div className="mt-1.5 flex items-center gap-2 min-w-0">
              <span className="text-sm font-black text-white">{task.label}</span>
              {task.done && (
                <span className="flex items-center gap-1 text-xs font-bold text-[var(--nav-accent-play)] shrink-0">
                  <IconCheck3D size={14} aria-hidden="true" /> Selesai
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{task.sub}</p>
            {!task.done && (
              <span className="mt-2 inline-block rounded-lg bg-[var(--nav-accent-play)] px-3 py-1 text-xs font-black text-black shadow-[0_3px_0_rgba(129,182,76,0.4)]">
                {task.key === "puzzle" ? "Mulai" : task.key === "daily" ? "Mainkan" : "Ulas"}
              </span>
            )}
          </button>
        ))}

        {/* Bermain Online — baris compact ≤44px di bawah kartu tugas */}
        <section
          aria-labelledby="home-playing-heading"
          className="sm:col-span-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 id="home-playing-heading" className="text-sm font-black text-white">Bermain Online</h2>
            <span className="text-xs font-bold text-neutral-400" aria-live="polite">
              {data.gamesAktif.length > 0 ? `${data.gamesAktif.length} partai aktif` : ""}
            </span>
          </div>

          {data.gamesAktif.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <IconPlay3D size={32} aria-hidden="true" />
              <p className="text-sm font-bold text-neutral-300">Tidak ada permainan aktif</p>
              <Button onClick={() => onNavigate("play")} className="bg-[var(--nav-accent-play)] text-black font-black hover:bg-[var(--nav-accent-play)]/90">
                Main Online
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {data.gamesAktif.map((g) => (
                <li key={g.gameId}>
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 hover:border-[var(--nav-accent-play)] transition-colors min-h-[44px]">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 shrink-0">
                      <IconClock3D size={14} aria-hidden="true" />
                      {g.timeControl ?? "∞"}
                    </span>
                    <span className="flex-1 min-w-0 text-sm truncate">
                      <span className="font-bold text-white">vs @{g.opponent.username}</span>{" "}
                      <span className="text-neutral-400">({g.opponent.rating})</span>{" "}
                      <span className={g.myTurn ? "text-[var(--nav-accent-play)] font-bold" : "text-neutral-400"}>
                        {g.myTurn ? "Giliranmu" : "Menunggu lawan…"}
                      </span>
                    </span>
                    <span className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => (onPlayGame ? onPlayGame(g.gameId) : onNavigate("play"))}
                        aria-label={`Main partai vs ${g.opponent.username}`}
                        className="bg-[var(--nav-accent-play)] text-black font-black hover:bg-[var(--nav-accent-play)]/90"
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
    </div>
  );
}
