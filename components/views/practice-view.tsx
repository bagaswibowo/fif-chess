"use client";

/**
 * components/views/practice-view.tsx (S7-T3 frontend, ADR-010 D4)
 * Pusat Latihan di hash #/practice — thin router (1 pintu, 0 data drill baru):
 * 3 chip kategori memetakan ke view existing + kartu target mingguan RIIL
 * dari GET /api/practice/weekly (konstanta server target=20 — TIDAK
 * editable, hanya angka riil "riil"; tidak ada input target user di S7).
 *
 * Kategori (design §3.2, pola chip learning-hub `ctl ctl-choice`):
 *  - Motif Taktik   → #/puzzles?tab=themes (pool puzzle riil, /api/puzzles/next?theme=)
 *  - Permainan Akhir → #/drills (drill endgame S4, /api/endgames/drills)
 *  - Pembukaan      → #/learn/openings (pembukaan lesson + drill riil D3)
 *
 * No-mock: setiap % / hitung / baris leaderboard mengalir dari endpoint.
 * Guest: chip + drill list publik tetap tampil; kartu target "—" +
 * "Masuk untuk menghitung target mingguanmu" (design §3.4, login-wall
 * hanya di panel target — bukan seluruh view).
 */

import { useCallback, useEffect, useState } from "react";
import { Dumbbell, Loader2, NotebookText, Swords, Target } from "lucide-react";
import { DRILL_SETS } from "@/lib/endgame-drills";
import type { WeeklyTargetResponse } from "./learn-shared";
import type { CoursesAuthStatus } from "./courses-view";

type DrillRow = { id: string; title: string; total: number; solved: number; progressPct: number };

export function PracticeView({
  authStatus,
  onNavigate,
}: {
  authStatus: CoursesAuthStatus;
  onNavigate: (hash: string) => void;
}) {
  // ── Kartu target mingguan (GET /api/practice/weekly) ──
  const [weekly, setWeekly] = useState<WeeklyTargetResponse | null>(null);
  const [weeklyState, setWeeklyState] = useState<"loading" | "ready" | "auth" | "error">("loading");
  const [drillRows, setDrillRows] = useState<DrillRow[] | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setWeeklyState("loading");
    (async () => {
      try {
        const res = await fetch("/api/practice/weekly", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          if (!alive) return;
          setWeeklyState("auth");
          return;
        }
        if (!res.ok) {
          if (!alive) return;
          setWeeklyState("error");
          return;
        }
        const data = await res.json();
        if (!alive) return;
        setWeekly(data as WeeklyTargetResponse);
        setWeeklyState("ready");
      } catch {
        if (alive) setWeeklyState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [retryKey]);

  // "Latihan Terbuka" = baris set drill riil (pola daftar endgame-drills).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/endgames/drills", { cache: "no-store" });
        if (!res.ok) return; // login-wall di panel sendiri, tetap lanjut tanpa angka
        const data = await res.json();
        if (!alive) return;
        const sets = Array.isArray(data.sets) ? (data.sets as DrillRow[]) : [];
        setDrillRows(sets.length ? sets : DRILL_SETS.map((s) => ({ id: s.id, title: s.title, total: s.puzzleIds.length, solved: 0, progressPct: 0 })));
      } catch {
        if (alive) setDrillRows(DRILL_SETS.map((s) => ({ id: s.id, title: s.title, total: s.puzzleIds.length, solved: 0, progressPct: 0 })));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const retry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const categories = [
    {
      key: "tactics" as const,
      label: "Motif Taktik",
      icon: Swords,
      hint: "→ Latihan tema puzzle",
      hash: "#/puzzles?tab=themes",
    },
    {
      key: "endgame" as const,
      label: "Permainan Akhir",
      icon: Dumbbell,
      hint: "→ Drill endgame",
      hash: "#/drills",
    },
    {
      key: "openings" as const,
      label: "Pembukaan",
      icon: NotebookText,
      hint: "→ Pelajaran & drill pembukaan",
      hash: "#/learn?cat=openings",
    },
  ];

  const hasWeekly = weeklyState === "ready" && weekly !== null;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-3">
        <Target size={22} className="text-[var(--primary)] shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-black text-white leading-tight">Pusat Latihan</h1>
          <p className="text-xs text-neutral-400">Pilih jalur latihan — semua angka di sini dihitung dari soal yang sudah kamu kerjakan.</p>
        </div>
      </div>

      {/* KATEGORI — 3 chip saja (pola ctl ctl-choice, design §3.2) */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kategori latihan">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={`Lanjut ke ${c.label}`}
            onClick={() => onNavigate(c.hash)}
            className="ctl ctl-choice inline-flex items-center gap-2 px-3 py-2"
          >
            <c.icon size={15} className="text-[var(--primary)]" aria-hidden="true" />
            <span className="text-xs font-bold text-white">{c.label}</span>
          </button>
        ))}
      </div>

      {/* KARTU TARGET MINGGUAN — angka riil dari /api/practice/weekly (konstanta target server, tanpa input user) */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Target size={16} className="text-[var(--primary)]" aria-hidden="true" /> Target Mingguan
          </h2>
          {hasWeekly && (
            <span className="text-[10px] text-neutral-500">
              7 hari berjalan · target {weekly!.target} (konstan server)
            </span>
          )}
        </div>

        {weeklyState === "loading" && (
          <div className="flex items-center gap-2 py-3" role="status" aria-live="polite">
            <Loader2 size={15} className="animate-spin text-neutral-400" />
            <span className="text-xs font-bold text-neutral-400">Menghitung target mingguan…</span>
          </div>
        )}

        {weeklyState === "error" && (
          <div className="py-2" role="alert">
            <p className="text-xs font-bold text-neutral-300">Gagal memuat pusat latihan. Coba lagi.</p>
            <button className="ctl ctl-sm mt-2" onClick={retry}>
              <Loader2 size={13} aria-hidden="true" /> Coba lagi
            </button>
          </div>
        )}

        {weeklyState === "auth" && (
          <div className="py-2" role="status">
            <p className="text-xs font-bold text-neutral-300">
              {authStatus === "guest"
                ? "Masuk untuk menghitung target mingguanmu."
                : "Akun menunggu persetujuan admin — target tampil setelah disetujui."}
            </p>
            <div className="mt-2 h-2 rounded-full bg-[var(--muted)]" aria-hidden="true" />
            <p className="mt-1.5 text-xs font-bold text-neutral-500">— · target belum dihitung</p>
          </div>
        )}

        {hasWeekly && (
          <>
            <p className="text-xs font-bold text-neutral-300" role="status" aria-live="polite">
              Diselesaikan minggu ini: <span className="tabular-nums text-white">{weekly!.correct}</span> dari{" "}
              <span className="tabular-nums text-white">{weekly!.target}</span> soal
              {weekly!.onTrack ? " ✓" : ""}
            </p>
            <div
              className="h-2 rounded-full bg-[var(--muted)] overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.min(100, Math.round((weekly!.correct / Math.max(1, weekly!.target)) * 100))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Target mingguan ${weekly!.correct} dari ${weekly!.target}`}
            >
              <div
                className="h-full bg-[var(--primary)] transition-all duration-[var(--move-animation-duration)]"
                style={{ width: `${Math.min(100, Math.round((weekly!.correct / Math.max(1, weekly!.target)) * 100))}%` }}
              />
            </div>
            {weekly!.onTrack ? (
              <p className="text-xs font-bold text-[var(--primary)]" role="status">
                Target minggu ini tercapai ✓ — {weekly!.correct} soal.
              </p>
            ) : (
              <button className="ctl ctl-sm inline-flex items-center gap-1.5" onClick={() => onNavigate("#/drills")}>
                <Swords size={13} aria-hidden="true" /> Lanjut berlatih
              </button>
            )}
          </>
        )}
      </div>

      {/* LATIHAN TERBUKA — baris set drill riil (pola daftar endgame-drills) */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-black text-white mb-2">Latihan Terbuka</h2>
        {drillRows === null ? (
          <p className="text-xs text-neutral-400" role="status" aria-live="polite">Memuat set latihan…</p>
        ) : drillRows.length === 0 ? (
          <p className="text-xs text-neutral-400" role="status">Belum ada set latihan.</p>
        ) : (
          <div className="flex flex-col gap-1.5" role="list" aria-label="Set latihan terbuka">
            {drillRows.map((s) => (
              <button
                key={s.id}
                type="button"
                role="listitem"
                onClick={() => onNavigate(`#/drills/${s.id}`)}
                className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 hover:border-[var(--primary)] transition-all duration-[var(--move-animation-duration)]"
              >
                <span className="text-xs font-bold text-white truncate">{s.title}</span>
                <span className="text-[10px] font-mono text-neutral-400 tabular-nums shrink-0">
                  {s.solved}/{s.total} · {s.progressPct}%
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
