"use client";

/**
 * components/views/endgame-drills-view.tsx (ticket S4-T4 — Sprint 4)
 * Permainan Akhir: 6 set kurasi dari /api/endgames/drills (progress %),
 * klik set → solve mode PuzzleSolver (S3-T1) dengan pool dari
 * /api/endgames/drills/[setId]/next. Attempt tetap via puzzles/[id]/attempt.
 */

import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PuzzleSolver } from "@/components/puzzle-solver";
import { Button } from "@/components/ui/button";
import { IconTrophy3D, IconShield3D } from "@/components/icons3d";
import { Clock, SlidersHorizontal, Users, X } from "lucide-react";
import { DRILL_SETS } from "@/lib/endgame-drills";
import type { EndgameLeaderboardResponse } from "./learn-shared";
import type { CoursesAuthStatus } from "./courses-view";
import type { PuzzleDto } from "@/lib/puzzle-solve";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

type DrillSet = {
  id: string;
  title: string;
  description: string;
  total: number;
  solved: number;
  progressPct: number;
};

type HintPayload = { from: string; to?: string; direction?: { files: number; ranks: number } } | null;

export function EndgameDrillsView({
  onExit,
  authStatus,
  username,
  initialSetId,
  onOpenPlayer,
}: {
  onExit?: () => void;
  /** S7-T5: status akun utk panel leaderboard (guest/pending) — default null. */
  authStatus?: CoursesAuthStatus;
  /** Username session utk highlight baris sendiri di leaderboard. */
  username?: string;
  /** S7-T5: deep-link set #/drills/{setId} → buka solve mode set tsb langsung. */
  initialSetId?: string | null;
  /** Klik nama pemain di leaderboard → #/insights/{username} (jalur keluar §5.1). */
  onOpenPlayer?: (username: string) => void;
}) {
  const [sets, setSets] = useState<DrillSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState<DrillSet | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  // S7-T5 (design §5.2/§5.3, kontrak §1.6): filter row — tema (6 drill theme
  // riil dari DRILL_SETS, sumber taksonomi tunggal) + progress min slider
  // (0..100, floor = "minProgress" di sisi SQL, guardrail no-client-filter).
  // state filter → param ?theme=&minProgress= pada /api/endgames/drills.
  const [theme, setTheme] = useState<string>("");
  const [minProgress, setMinProgress] = useState<number>(0);
  // Leaderboard panel (riil top-20 dari /api/endgames/drills/leaderboard).
  const [board, setBoard] = useState<EndgameLeaderboardResponse | null>(null);
  const [boardState, setBoardState] = useState<"loading" | "ready" | "auth" | "error">("loading");
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  const loadSets = useCallback(
    async (filter?: { theme?: string; minProgress?: number }): Promise<DrillSet[]> => {
      // Kembalikan data hasil fetch agar pemanggil (refresh) tidak membaca
      // state `sets` lama (stale closure) sebelum React meng-commit update.
      // S7-T5: filter param diteruskan server-side (?theme=&minProgress=) —
      // respons shape { sets } tetap; tanpa filter = behavior S4-T4 exact.
      try {
        const qs = new URLSearchParams();
        if (filter?.theme) qs.set("theme", filter.theme);
        if (filter?.minProgress) qs.set("minProgress", String(filter.minProgress));
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        const res = await fetch(`/api/endgames/drills${suffix}`, { cache: "no-store" });
        if (!res.ok) {
          setError(authErrorText(res.status, await authErrorPayload(res), "latihan permainan akhir"));
          return [];
        }
        const data = await res.json();
        const next = (data.sets ?? []) as DrillSet[];
        setSets(next);
        setError(null);
        return next;
      } catch {
        setError("Gagal memuat set permainan akhir.");
        return [];
      }
    },
    [],
  );

  useEffect(() => {
    void loadSets({ theme, minProgress });
  }, [loadSets, theme, minProgress]);

  // S7-T5: deep-link #/drills/{setId} → buka solve mode set tsb (jalur masuk §5.1).
  useEffect(() => {
    if (!initialSetId) return;
    let alive = true;
    (async () => {
      const all = await loadSets();
      if (!alive) return;
      const target = all.find((s) => s.id === initialSetId);
      if (target) openSet(target);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSetId]);

  // S7-T5: leaderboard riil dari /api/endgames/drills/leaderboard (publik;
  // 503 = DB down; 404 set tak dikenal — panel saja, grid tetap tampil §5.4).
  useEffect(() => {
    let alive = true;
    setBoardState("loading");
    setBoardError(null);
    (async () => {
      try {
        const res = await fetch(`/api/endgames/drills/leaderboard?limit=20`, { cache: "no-store" });
        if (!alive) return;
        if (res.status === 401 || res.status === 403) {
          setBoardState("auth");
          return;
        }
        if (!res.ok) {
          setBoardError(res.status === 503 ? "Server sedang sibuk." : "Gagal memuat peringkat latihan. Coba lagi.");
          setBoardState("error");
          return;
        }
        const data = (await res.json()) as EndgameLeaderboardResponse;
        if (!alive) return;
        setBoard(data);
        setBoardState("ready");
      } catch {
        if (alive) {
          setBoardError("Gagal memuat peringkat latihan. Coba lagi.");
          setBoardState("error");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [boardKey]);

  const loadBoard = useCallback(() => setBoardKey((k) => k + 1), []);

  const resetFilters = useCallback(() => {
    setTheme("");
    setMinProgress(0);
  }, []);

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

  const fetchHint = useCallback(async (level: 1 | 2 | 3, moveIndex: number): Promise<HintPayload> => {
    if (!puzzle) return null;
    try {
      const res = await fetch(`/api/puzzles/${puzzle.id}/hint?level=${level}&moveIndex=${moveIndex}`, { cache: "no-store" });
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

  // S8 (audit F1/P0): SEMUA hook WAJIB di atas setiap early return. useMemo ini
  // tadinya berada DI BAWAH `if (error)`/`if (activeSet)` → saat fetch 401/403
  // setError memicu cabang `error` yang return sebelum useMemo ter-execute
  // → jumlah hook render ≠ render sebelumnya → React #300 (crash total).
  // S7-T5: tema filter = 6 drill theme riil (DrillSet.theme, sumber taksonomi
  // tunggal lib/endgame-drills.ts — design §5.2, jangan bikin taksonomi baru).
  const themeChips = useMemo(
    () => [
      { key: "", label: "Semua" },
      ...DRILL_SETS.map((s) => ({ key: s.theme, label: s.title })),
    ],
    [],
  );

  // ===== Solve mode =====
  if (activeSet) {
    const refresh = async () => {
      // S7-T5: jaga filter aktif agar progress bar konsisten saat kembali.
      const next = await loadSets({ theme, minProgress });
      const updated = next.find((s) => s.id === activeSet.id) ?? activeSet;
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
          <Button variant="outline" size="sm" onClick={() => { setActiveSet(null); setPuzzle(null); void loadSets({ theme, minProgress }); }} aria-label="Kembali ke daftar set">
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
          />
        )}
      </div>
    );
  }

  // ===== Daftar set =====
  // S8 Pola B (spec §3): .view-head 44px + .view-body scroll internal.
  // P0/F1: cabang error/loading ini in-render — SEMUA hook sudah di atas
  // (useMemo themeChips dipindah) → hook konsisten, tidak crash.
  if (error) {
    return (
      <div className="view-root w-full max-w-4xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0">
          <IconShield3D size={20} aria-hidden="true" />
          <h1 className="text-sm font-black text-white">Permainan Akhir</h1>
        </div>
        <div className="view-body flex flex-col items-center py-10">
          <ErrorState message={error} ctx="latihan permainan akhir" onRetry={() => void loadSets({ theme, minProgress })} />
        </div>
      </div>
    );
  }

  const filterActive = theme !== "" || minProgress > 0;
  const setCountLabel = `Tampil ${sets?.length ?? 0} set${filterActive ? ` untuk tema ${theme ? themeChips.find((c) => c.key === theme)?.label ?? theme : "Semua"}, progress ≥ ${minProgress}%` : ""}.`;

  return (
    <div className="view-root w-full max-w-4xl mx-auto">
      {/* S8 Pola B (spec §3): .view-head 44px (judul section, aksen --nav-accent-drill)
          + .view-body satu-satunya region scroll internal (filter + grid set + peringkat). */}
      <div className="view-head flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <IconShield3D size={22} aria-hidden="true" />
          <h1 className="text-sm font-black text-white">Permainan Akhir</h1>
        </div>
        <p className="text-xs font-bold text-neutral-400">Kurasi teka-teki akhir per tema</p>
      </div>

      <div className="view-body flex flex-col gap-4 pb-4" style={{ scrollbarWidth: "thin" }}>
        {/* S7-T5 FILTER ROW (design §5.2): tema chip + progress min slider.
            Param ?theme=&minProgress= dihitung SQL-SIDE (guardrail D6.2). */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-[var(--primary)]" aria-hidden="true" />
          <span className="text-xs font-black text-white">Filter set</span>
          {filterActive && (
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-neutral-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              onClick={resetFilters}
              aria-label="Reset filter"
            >
              <X size={12} aria-hidden="true" /> Reset filter
            </button>
          )}
        </div>

        {/* Tema — chip ctl ctl-choice (pola learning-hub), himpunan kecil & tetap */}
        <div>
          <span className="label">Tema</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Filter tema drill">
            {themeChips.map((c) => {
              const active = theme === c.key;
              return (
                <button
                  key={c.key || "all"}
                  type="button"
                  className={`ctl ctl-choice ${active ? "ctl-active" : ""} px-2.5 py-1`}
                  aria-pressed={active}
                  onClick={() => setTheme(active ? "" : c.key)}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress min — slider 0..100 (floor minProgress server-side) */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="drills-min-progress" className="label">Progress minimum</label>
            <span className="text-xs font-mono text-neutral-300 tabular-nums" role="status" aria-live="polite">
              ≥ {minProgress}%
            </span>
          </div>
          <input
            id="drills-min-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={minProgress}
            onChange={(e) => setMinProgress(Number(e.target.value))}
            className="mt-1.5 w-full accent-[var(--primary)]"
            aria-valuetext={`Progress minimum ${minProgress} persen`}
          />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{setCountLabel}</p>

      {!sets ? (
        <LoadingState label="Mencocokkan filter…" skeleton="grid" className="items-stretch self-stretch" />
      ) : sets.length === 0 ? (
        <EmptyState
          title="Belum ada set untuk filter ini."
          ctaLabel={filterActive ? "Reset filter" : undefined}
          onCta={filterActive ? resetFilters : undefined}
        />
      ) : (
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
      )}

      {/* S7-T5 PANEL PERINGKAT (design §5.2/§5.3): tabel teks 4 kolom, riil
          dari /api/endgames/drills/leaderboard (top-20). No-mock: baris hanya
          dari payload; empty = copy §5.3, guest = login-wall panel saja. */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users size={16} className="text-[var(--primary)]" aria-hidden="true" />
          <h2 className="text-sm font-black text-white">Peringkat Latihan</h2>
          <span className="text-[10px] text-neutral-500">skor drill riil dari jawaban benar</span>
          {boardState === "error" && (
            <button type="button" className="ml-auto text-[11px] font-bold text-neutral-400 hover:text-white" onClick={loadBoard} aria-label="Coba lagi memuat peringkat">
              Coba lagi
            </button>
          )}
        </div>

        {boardState === "loading" && (
          <p className="py-3 text-xs font-bold text-neutral-400" role="status" aria-live="polite">Mengambil peringkat…</p>
        )}

        {boardState === "error" && (
          <p className="py-2 text-xs font-bold text-[var(--destructive)]" role="alert">{boardError}</p>
        )}

        {boardState === "auth" && (
          <div className="py-2" role="status">
            <p className="text-xs font-bold text-neutral-300">
              {authStatus === "pending" ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                  <Clock size={13} aria-hidden="true" />
                  Menunggu
                </span>
              ) : (
                "Akun membutuhkan akses untuk melihat peringkat latihan."
              )}
            </p>
            {authStatus === "pending" ? (
              <p className="mt-1 text-xs font-bold text-neutral-400">Peringkat tampil setelah akun disetujui admin.</p>
            ) : (
              // T1 (G0.3): guest/rejected = bukan pending → CTA login sah via
              // satu sumber pemetaan (authErrorText(401)), bukan literal.
              <p className="mt-1 text-xs font-bold text-neutral-400">{authErrorText(401, undefined, "peringkat")}</p>
            )}
          </div>
        )}

        {boardState === "ready" && board && (
          <>
            {board.entries.length === 0 ? (
              <p className="py-2 text-xs text-neutral-400" role="status">
                Belum ada data — selesaikan satu set latihan dulu, lalu namamu akan muncul di sini.
              </p>
            ) : (
              <div
                role="table"
                aria-label={`Peringkat latihan endgame — ${board.set.title} (top ${board.entries.length})`}
                className="overflow-x-auto"
              >
                <span className="sr-only" role="caption">
                  Peringkat latihan endgame, {board.set.title}. Skor = soal berbeda yang dijawab benar.
                </span>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                      <th scope="col" className="py-1.5 pr-2 w-8">#</th>
                      <th scope="col" className="py-1.5 pr-2">Pemain</th>
                      <th scope="col" className="py-1.5 pr-2">Set fokus</th>
                      <th scope="col" className="py-1.5 text-right">Skor drill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.entries.map((e, i) => {
                      const isSelf = username && e.username === username;
                      return (
                        <tr
                          key={e.username}
                          aria-current={isSelf ? "true" : undefined}
                          className={`border-t border-[var(--border)] text-xs ${isSelf ? "bg-[var(--primary-strong)]/20" : i % 2 === 1 ? "bg-[var(--surface)]/40" : ""}`}
                        >
                          <td className="py-2 pr-2 text-neutral-400 tabular-nums">{i + 1}</td>
                          <td className="py-2 pr-2">
                            <button
                              type="button"
                              className="font-bold text-neutral-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                              onClick={() => onOpenPlayer?.(e.username)}
                              aria-label={`${isSelf ? "Kamu" : e.username} (rating ${e.rating}) — buka insight`}
                            >
                              {isSelf ? "Kamu" : `@${e.username}`}
                            </button>
                            <span className="text-neutral-500 font-mono text-[10px] ml-1.5">{e.rating}</span>
                          </td>
                          <td className="py-2 pr-2 text-neutral-300">{board.set.title}</td>
                          <td className="py-2 text-right font-mono tabular-nums text-neutral-300">{e.solved} soal</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
