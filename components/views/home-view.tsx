"use client";

/**
 * components/views/home-view.tsx (Sprint 10: Parity Chess.com + JEV Scientific Innovation)
 * Layout 3-kolom responsif:
 *  1. Header: Greeting, Rating, dan Streak harian persisten.
 *  2. Quick Play Hero Grid: 10m Rapid, 3m Blitz, 5m Blitz + Mulai Permainan taktil 3D.
 *  3. Daily Retention Cards: Teka-Teki, Puzzle Harian, Ulas Partai.
 *  4. Inovasi Ilmiah JEV: Scanner OTB Fisik (YOLO11) & Neurosymbolic Bots (Stockfish 19/JEV).
 *  5. Permainan Aktif: Resume real-time tanpa mock.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IconFire3D,
  IconPuzzle3D,
  IconMedal3D,
  IconHistory3D,
  IconClock3D,
  IconPlay3D,
  IconCheck3D,
  IconTimeBlitz,
  IconTimeRapid,
  IconScan3D,
  IconAiBrain3D,
  IconTrophy3D,
} from "@/components/icons3d";
import { authErrorPayload, authErrorText } from "@/lib/use-session";

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

type LoadError = {
  message: string;
  retryable: boolean;
  code?: string;
  status?: number;
};

export type HomeNavTarget =
  | "puzzles"
  | "daily"
  | "review"
  | "archive"
  | "play"
  | "scan"
  | "bots"
  | "leaderboard"
  | "tournaments";

type Props = {
  onNavigate: (tab: HomeNavTarget) => void;
  onPlayGame?: (gameId: string) => void;
  onReviewGame?: (gameId: string) => void;
};

export function HomeView({ onNavigate, onPlayGame, onReviewGame }: Props) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [selectedTc, setSelectedTc] = useState<string>("10+0");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/home/dashboard", { cache: "no-store" });
      if (!res.ok) {
        const payload = await authErrorPayload(res);
        setError({
          message: authErrorText(res.status, payload, "dashboard"),
          retryable:
            res.status >= 500 ||
            res.status === 0 ||
            payload.code === "account_missing" ||
            payload.code === "service_unavailable",
          code: payload.code,
          status: res.status,
        });
        return;
      }
      setData((await res.json()) as Dashboard);
    } catch {
      setError({
        message: "Terjadi gangguan layanan. Data dashboard tidak dapat dimuat.",
        retryable: true,
      });
    }
  }, []);

  useEffect(() => {
    void load();
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  if (error) {
    const pending = error.code === "account_pending" || error.code === "account_rejected";
    const Icon = pending ? ShieldAlert : AlertTriangle;
    return (
      <div className="view-root w-full max-w-4xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0">
          <h1 className="text-sm font-black text-white">Beranda</h1>
        </div>
        <div
          className="view-body flex flex-col items-center gap-3 py-10"
          role={pending ? "status" : "alert"}
          aria-live={pending ? "polite" : "assertive"}
        >
          <Icon size={28} aria-hidden="true" />
          <p className="text-sm text-neutral-300 text-center">
            {error.message}
            {pending ? " Fitur beranda akan terbuka setelah admin menyetujui akunmu." : ""}
          </p>
          {error.retryable && (
            <Button variant="outline" onClick={() => void load()}>
              Coba Lagi
            </Button>
          )}
          {error.code ? (
            <span className="sr-only" aria-hidden="false">
              Kode {error.code}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="view-root w-full max-w-4xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0">
          <h1 className="text-sm font-black text-white">Beranda</h1>
        </div>
        <div className="view-body flex items-center justify-center py-10" role="status" aria-live="polite">
          <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat dashboard…</span>
        </div>
      </div>
    );
  }

  const t = data.tasksState;
  const tasks = [
    {
      key: "puzzle",
      label: "Jawab Teka-Teki",
      done: t.puzzleDone,
      icon: IconPuzzle3D,
      sub: "Latihan taktis tanpa batas sesuai rating",
      aria: "Jawab teka-teki taktik hari ini",
      go: () => onNavigate("puzzles"),
    },
    {
      key: "daily",
      label: "Teka-Teki Harian",
      done: t.dailyPuzzleDone,
      icon: IconMedal3D,
      sub: "Satu problem taktis resmi setiap hari",
      aria: "Mainkan teka-teki harian",
      go: () => onNavigate("daily"),
    },
    {
      key: "review",
      label: "Ulas Partai",
      done: !t.lastGameToReview,
      icon: IconHistory3D,
      sub: t.lastGameToReview
        ? `vs @${t.lastGameToReview.opponent} · evaluasi akurasi`
        : "Belum ada partai baru untuk diulas",
      aria: "Ulas partai terakhir dengan Stockfish 19",
      go: () => onNavigate(t.lastGameToReview ? "review" : "archive"),
    },
  ];

  return (
    <div className="view-root w-full max-w-5xl mx-auto space-y-4 pb-6">
      {/* Header bar: Greeting + Rating + Streak */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">
            Selamat datang, <span className="text-[var(--nav-accent-play)]">@{data.username}</span>
          </h1>
          <p className="text-xs text-neutral-400">Rating Elo: <span className="text-white font-bold">{data.rating}</span></p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-sm"
          aria-label={`Streak ${data.streakHarian} hari`}
        >
          <IconFire3D size={18} aria-hidden="true" />
          <span className="text-xs font-black text-white">Streak {data.streakHarian} Hari</span>
        </div>
      </div>

      {/* Hero Quick Play Grid (Parity Chess.com 01_Home_Dashboard) */}
      <section
        aria-labelledby="quick-play-heading"
        className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-md relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <IconPlay3D size={22} aria-hidden="true" />
              <h2 id="quick-play-heading" className="text-base font-black text-white tracking-tight">
                Main Catur Cepat
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              Pilih kontrol waktu favoritmu dan mulai bertanding di arena
            </p>
          </div>

          <div className="flex items-center flex-wrap justify-center gap-2">
            {[
              { tc: "10+0", label: "10 mnt", desc: "Rapid", icon: IconTimeRapid },
              { tc: "3+0", label: "3 mnt", desc: "Blitz", icon: IconTimeBlitz },
              { tc: "5+0", label: "5 mnt", desc: "Blitz", icon: IconTimeBlitz },
            ].map((item) => (
              <button
                key={item.tc}
                onClick={() => setSelectedTc(item.tc)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-left transition-all ${
                  selectedTc === item.tc
                    ? "bg-[var(--surface)] border-[var(--nav-accent-play)] shadow-sm text-white scale-[1.02]"
                    : "bg-[var(--surface)]/60 border-[var(--border)] text-neutral-400 hover:border-neutral-500"
                }`}
              >
                <item.icon size={16} aria-hidden="true" />
                <div>
                  <div className="text-xs font-black text-white leading-tight">{item.label}</div>
                  <div className="text-[10px] text-neutral-400">{item.desc}</div>
                </div>
              </button>
            ))}

            <button
              onClick={() => onNavigate("play")}
              className="ml-1 px-5 py-2.5 rounded-xl font-black text-black text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-[0_4px_0_#45753c]"
              style={{ backgroundColor: "#81b64c" }}
            >
              Mulai Permainan
            </button>
          </div>
        </div>
      </section>

      {/* 3 Task Cards Retensi Harian (Teka-teki, Daily, Review) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tasks.map((task) => (
          <button
            key={task.key}
            onClick={task.go}
            aria-label={task.aria}
            className={`text-left rounded-xl border p-3.5 transition-all duration-150 active:scale-[0.98] ${
              task.done
                ? "bg-[var(--card)] border-[var(--nav-accent-play)]/40 opacity-90"
                : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--nav-accent-play)]"
            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nav-accent-play)]`}
          >
            <div className="flex items-center justify-between">
              <task.icon size={24} aria-hidden="true" />
              {task.done ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--nav-accent-play)] bg-[var(--nav-accent-play)]/10 px-2 py-0.5 rounded-md">
                  <IconCheck3D size={12} aria-hidden="true" /> Selesai
                </span>
              ) : (
                <span className="text-[11px] font-bold text-neutral-400">Hari ini</span>
              )}
            </div>
            <div className="mt-2 text-sm font-black text-white">{task.label}</div>
            <p className="mt-1 text-xs text-neutral-400 line-clamp-2 leading-relaxed">{task.sub}</p>
            {!task.done && (
              <span className="mt-3 inline-block rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--nav-accent-play)] px-3 py-1 text-xs font-bold text-white transition-colors">
                {task.key === "puzzle" ? "Mulai Taktik →" : task.key === "daily" ? "Mainkan →" : "Buka Ulasan →"}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Inovasi Fitur Khas JEV-Chess (The Scientific Differentiators) */}
      <section aria-labelledby="jev-innovations-heading" className="space-y-2">
        <h2 id="jev-innovations-heading" className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Fitur Riset &amp; Inovasi JEV
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card Inovasi 1: OTB Scanner */}
          <div
            onClick={() => onNavigate("scan")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onNavigate("scan");
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 flex items-start gap-3 cursor-pointer hover:border-amber-400/60 transition-all active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
              <IconScan3D size={24} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">Scan Papan Catur Fisik</span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                  YOLO11
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Ambil foto papan catur turnamen nyata untuk diubah instan menjadi FEN dan dianalisis engine.
              </p>
            </div>
          </div>

          {/* Card Inovasi 2: Invincible Stockfish 19 & Connectome */}
          <div
            onClick={() => onNavigate("bots")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onNavigate("bots");
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 flex items-start gap-3 cursor-pointer hover:border-purple-400/60 transition-all active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
          >
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 shrink-0">
              <IconAiBrain3D size={24} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">Stockfish 19 &amp; Connectome</span>
                <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">
                  Elo 3550+
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Tantang engine tak terkalahkan atau amati visualisasi aktivasi kognitif FlyBrain secara realtime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Permainan Aktif (jika ada) */}
      {data.gamesAktif.length > 0 && (
        <section
          aria-labelledby="active-games-heading"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <h2 id="active-games-heading" className="text-xs font-bold uppercase tracking-wider text-white">
              Permainan Berjalan ({data.gamesAktif.length})
            </h2>
          </div>
          <ul className="flex flex-col gap-2">
            {data.gamesAktif.map((g) => (
              <li
                key={g.gameId}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--nav-accent-play)] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <IconClock3D size={16} aria-hidden="true" />
                  <div className="truncate">
                    <span className="text-sm font-bold text-white">vs @{g.opponent.username}</span>{" "}
                    <span className="text-xs text-neutral-400">({g.opponent.rating})</span>
                    <span
                      className={`ml-2 text-xs font-bold ${
                        g.myTurn ? "text-[var(--nav-accent-play)]" : "text-neutral-400"
                      }`}
                    >
                      {g.myTurn ? "• Giliranmu" : "• Menunggu lawan"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => (onPlayGame ? onPlayGame(g.gameId) : onNavigate("play"))}
                    className="bg-[var(--nav-accent-play)] text-black font-black hover:bg-[var(--nav-accent-play)]/90 text-xs"
                  >
                    Lanjutkan
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
