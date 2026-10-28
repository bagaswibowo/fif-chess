"use client";

/**
 * components/views/rush-view.tsx (S3-T3 frontend — G9)
 * /puzzles/rush: pre-game rules screen (3 baris verbatim), chips durasi
 * 3/5/Sintasan, HUD timer+skor+3 hati (icons3d), end screen skor+rekor+
 * leaderboard. Timer/skor/strike dihitung server-side — UI hanya mirror.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconClock3D, IconFire3D, IconInfinity3D, IconLightning3D, IconTrophy3D } from "@/components/icons3d";
import { formatClock, type PuzzleDto } from "@/lib/puzzle-solve";
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { PuzzleSolver } from "@/components/puzzle-solver";

type Props = { lang?: "id" | "en"; onBack?: () => void; onOpenAuth?: () => void };

type Mode = "3" | "5" | "endless";

type HintPayload = { from: string; to?: string; direction?: { files: number; ranks: number } } | null;

/** S9-T1: error rush jujur per status — pending deterministik (tanpa retry),
 *  login = CTA sah, busy/transien = boleh "Coba lagi". */
type RushAuthError =
  | { kind: "pending"; message: string }
  | { kind: "login"; message: string }
  | { kind: "busy"; message: string };

function rushAuthError(status: number, payload: { code?: string; error?: string }): RushAuthError {
  if (status === 403) {
    // account_pending / account_rejected — bukan CTA login, bukan "disconnect".
    return {
      kind: "pending",
      message:
        payload.code === "account_rejected"
          ? "Akun Anda ditolak admin."
          : "Akun menunggu persetujuan admin — selesai setelah disetujui.",
    };
  }
  if (status === 401) {
    return { kind: "login", message: authErrorText(401, payload, "sesi rush") };
  }
  return { kind: "busy", message: "Server sedang sibuk. Coba lagi." };
}

const RULES = [
  "1. Selesaikan teka-teki sebanyak mungkin.",
  "2. Dimulai dari yang mudah dan akan bertambah sulit.",
  "3. Jika gagal menjawab 3 kali, berakhir.",
];

const MODE_SECONDS: Record<Exclude<Mode, "endless">, number> = { "3": 180, "5": 300 };

export function RushView({ lang = "id", onBack, onOpenAuth }: Props) {
  const [stage, setStage] = useState<"pregame" | "playing" | "over">("pregame");
  const [mode, setMode] = useState<Mode>("3");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [remaining, setRemaining] = useState(MODE_SECONDS["3"]);
  const [elapsed, setElapsed] = useState(0);
  const [disconnect, setDisconnect] = useState(false);
  // S9-T1: error jujur per status (pending/rejected/401/5xx) — menggantikan
  // setDisconnect(true) mentah yang menelan 403 pending jadi "koneksi terputus".
  const [authError, setAuthError] = useState<RushAuthError | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ username: string; score: number }[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const mainCtaRef = useRef<HTMLButtonElement | null>(null);
  const announceRef = useRef<string | null>(null);
  // T6: pause saat tab blur (document.visibilitychange hidden) — timer berhenti.
  const [paused, setPaused] = useState(false);
  // T6: breakdown end-screen (benar/salah/best-streak) dari attempt log lokal.
  const [breakdown, setBreakdown] = useState({ correct: 0, wrong: 0, bestStreak: 0 });
  const breakStreakRef = useRef({ cur: 0, best: 0 });

  const applyPause = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") setPaused(true);
  }, []);
  const applyResume = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") setPaused(false);
  }, []);

  useEffect(() => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") applyPause();
      else applyResume();
    });
    window.addEventListener("blur", applyPause);
    window.addEventListener("focus", applyResume);
    return () => {
      window.removeEventListener("blur", applyPause);
      window.removeEventListener("focus", applyResume);
    };
  }, [applyPause, applyResume]);

  // Timer client hanya mirror — server tetap sumber kebenaran (guardrail S3-T3).
  // T6: berhenti berjalan saat paused (tab blur).
  useEffect(() => {
    if (stage !== "playing" || mode === "endless" || paused) return;
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [stage, mode, paused]);

  useEffect(() => {
    if (stage !== "playing" || mode !== "endless" || paused) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [stage, mode, paused]);

  // Timer habis → game over (strike dicek dulu server-side; end tunggal §3.5).
  useEffect(() => {
    if (stage === "playing" && mode !== "endless" && remaining <= 0) void endSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, stage, mode]);

  const announce = useCallback((msg: string) => {
    announceRef.current = msg; // aria-live region di HUD
  }, []);

  const startSession = useCallback(async () => {
    setLoadingBoard(true);
    setBreakdown({ correct: 0, wrong: 0, bestStreak: 0 });
    breakStreakRef.current = { cur: 0, best: 0 };
    setPaused(false);
    setAuthError(null);
    setDisconnect(false);
    try {
      const res = await fetch("/api/puzzles/rush/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // S9-T1 (G0.1): 403 pending/rejected ≠ "koneksi terputus" — map jujur
        // via authErrorText; 401 = CTA login sah; 5xx/busy = boleh retry.
        setAuthError(rushAuthError(res.status, { code: (data as { code?: string }).code, error: (data as { error?: string }).error }));
        setLoadingBoard(false);
        return;
      }
      setSessionId(String(data.sessionId));
      setScore(0);
      setStrikes(0);
      setRemaining(MODE_SECONDS[mode as "3" | "5"] ?? 0);
      setElapsed(0);
      setStage("playing");
      setPuzzle((data.puzzle as PuzzleDto) ?? null);
    } catch {
      setDisconnect(true);
    }
    setLoadingBoard(false);
  }, [mode]);

  const endSession = useCallback(async () => {
    setStage("over");
    setLoadingBoard(true);
    try {
      const res = await fetch("/api/puzzles/rush/leaderboard", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.entries ?? []);
        setBest(typeof data.rushBest === "number" ? data.rushBest : null);
        setNewRecord(data.newRecord === true);
        setFinalScore(typeof data.score === "number" ? data.score : score);
      } else {
        setFinalScore(score);
      }
    } catch {
      setFinalScore(score);
    }
    setLoadingBoard(false);
    requestAnimationFrame(() => mainCtaRef.current?.focus());
  }, [score]);

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
      if (!puzzle || !sessionId) return null;
      try {
        const res = await fetch("/api/puzzles/rush/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            puzzle_id: puzzle.id,
            correct: p.correct,
            time_spent_sec: p.timeSpentSec,
          }),
        });
        if (!res.ok) {
          // S9-T1: 403 pending/rejected → panel pending, bukan "koneksi terputus".
          const payload = await authErrorPayload(res);
          setAuthError(rushAuthError(res.status, payload));
          setDisconnect(res.status >= 500 || payload.code === "account_missing" || payload.code === "service_unavailable");
          return null;
        }
        const data = await res.json();
        setScore(typeof data.score === "number" ? data.score : score);
        setStrikes(typeof data.strikes === "number" ? data.strikes : strikes);
        // T6: breakdown log lokal utk end-screen.
        setBreakdown((b) => {
          const st = breakStreakRef.current;
          if (p.correct) {
            st.cur += 1;
            st.best = Math.max(st.best, st.cur);
            return { ...b, correct: b.correct + 1, bestStreak: st.best };
          }
          st.cur = 0;
          return { ...b, wrong: b.wrong + 1 };
        });
        if (data.gameOver === true) {
          void endSession();
          return null;
        }
        // Puzzle berikutnya langsung slide in — tanpa layar antara (§3.3).
        setPuzzle((data.puzzle as PuzzleDto) ?? null);
        return data.strikes ?? null;
      } catch {
        setDisconnect(true);
        return null;
      }
    },
    [puzzle, sessionId, score, strikes, endSession],
  );

  // HUD aria: timer ≤30s diumumkan SEKALI (a11y checklist §7).
  const lowTimeAnnounced = useRef(false);
  useEffect(() => {
    if (stage === "playing" && mode !== "endless" && remaining <= 30 && !lowTimeAnnounced.current) {
      lowTimeAnnounced.current = true;
      announce("30 detik tersisa");
    }
  }, [remaining, stage, mode, announce]);

  if (stage === "pregame") {
    // S8 Pola B (spec §3): .view-head 44px (judul, aksen --nav-accent-puzzle)
    // + .view-body rules/chips/CTA scroll internal.
    return (
      <div className="view-root w-full max-w-2xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-puzzle)" }}>
          <IconLightning3D size={18} aria-hidden="true" />
          <h2 className="text-sm font-black text-white m-0">{lang === "id" ? "Teka-Teki Gegas" : "Puzzle Rush"}</h2>
        </div>
        <div className="view-body flex flex-col items-center" style={{ scrollbarWidth: "thin" }}>
      <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-xl">
        <div className="text-left mt-4 text-sm text-neutral-300 space-y-1" aria-label="Aturan">
          {RULES.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
        {mode === "endless" ? (
          <p className="text-[11px] text-neutral-500 mt-2">
            Menutup tab mengakhiri sesi tanpa menyimpan skor.
          </p>
        ) : null}

        {/* Chips durasi (design §3.2) */}
        <div className="flex justify-center gap-2 mt-4" role="radiogroup" aria-label="Durasi">
          {([
            { id: "3", label: "3 menit" },
            { id: "5", label: "5 menit" },
            { id: "endless", label: "Sintasan" },
          ] as { id: Mode; label: string }[]).map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={mode === c.id}
              onClick={() => setMode(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all duration-[180ms] ${
                mode === c.id
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "border-[var(--border)] text-neutral-300 hover:bg-[var(--surface-hover)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {authError ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex flex-col items-center gap-1.5 text-center"
          >
            {authError.kind === "pending" ? (
              <ShieldAlert size={20} aria-hidden="true" className="text-amber-400" />
            ) : (
              <AlertTriangle size={20} aria-hidden="true" className="text-[var(--error)]" />
            )}
            <p className="text-sm text-neutral-300">{authError.message}</p>
            {authError.kind === "pending" ? (
              <p className="text-xs text-neutral-500">Fitur rush akan terbuka setelah admin menyetujui akunmu.</p>
            ) : null}
            {authError.kind === "login" && onOpenAuth ? (
              <button type="button" className="text-sm font-bold underline underline-offset-2 text-[var(--primary)]" onClick={onOpenAuth}>
                Masuk atau Daftar
              </button>
            ) : null}
            {authError.kind === "busy" ? (
              <button type="button" className="text-sm font-bold underline underline-offset-2" onClick={() => void startSession()}>
                Coba Lagi
              </button>
            ) : null}
          </div>
        ) : disconnect ? (
          <p role="status" aria-live="polite" className="text-sm text-[var(--error)] mt-3">
            Koneksi terputus.{" "}
            <button className="underline" onClick={() => void startSession()}>
              Coba Lagi
            </button>
          </p>
        ) : null}

        <div className="flex justify-center gap-2 mt-6">
          {onBack ? (
            <Button variant="outline" onClick={onBack}>
              {lang === "id" ? "Kembali" : "Back"}
            </Button>
          ) : null}
          <Button onClick={() => void startSession()} disabled={loadingBoard}>
            {lang === "id" ? "Bermain" : "Play"}
          </Button>
          <Button variant="outline" onClick={() => setStage("over")}>
            {lang === "id" ? "Papan Peringkat" : "Leaderboard"}
          </Button>
        </div>
      </div>
        </div>
      </div>
    );
  }

  if (stage === "over") {
    // S8 Pola B: .view-head (judul Game Over) + .view-body skor/rekor/leaderboard.
    return (
      <div className="view-root w-full max-w-2xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-puzzle)" }}>
          <IconTrophy3D size={18} aria-hidden="true" />
          <h2 className="text-sm font-black text-white m-0">Game Over</h2>
        </div>
        <div className="view-body" style={{ scrollbarWidth: "thin" }}>
      <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-xl">
        <p className="text-3xl font-black text-white mt-2 tabular-nums">Skor: {finalScore}</p>
        {newRecord ? (
          <p className="text-sm font-bold text-[var(--primary)] mt-1">Rekor pribadi baru!</p>
        ) : best !== null ? (
          <p className="text-sm text-neutral-400 mt-1">Rekor pribadi: {best}</p>
        ) : null}

        {/* T6: breakdown rinci — benar/salah/best-streak (teks berlabel, bukan warna saja) */}
        <div className="flex justify-center gap-6 mt-4" role="status" aria-label="Rincian sesi">
          <span className="flex flex-col leading-tight">
            <span className="text-xl font-black text-emerald-400 tabular-nums">✓ {breakdown.correct}</span>
            <span className="text-[10px] text-neutral-400">Benar</span>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-xl font-black text-red-400 tabular-nums">✕ {breakdown.wrong}</span>
            <span className="text-[10px] text-neutral-400">Salah</span>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-xl font-black text-white tabular-nums">🔥 {breakdown.bestStreak}</span>
            <span className="text-[10px] text-neutral-400">Best streak</span>
          </span>
        </div>

        <h3 className="text-sm font-bold text-neutral-300 mt-5 mb-2">Papan Peringkat</h3>
        <ol className="text-sm text-neutral-300 space-y-1 max-h-56 overflow-y-auto custom-scrollbar text-left px-4">
          {leaderboard.slice(0, 20).map((e, i) => (
            <li key={`${e.username}-${i}`} className="flex justify-between">
              <span>
                {i + 1}. {e.username}
              </span>
              <span className="tabular-nums">{e.score}</span>
            </li>
          ))}
          {leaderboard.length === 0 && !loadingBoard ? <li className="text-neutral-500">Belum ada skor.</li> : null}
        </ol>

        <div className="flex justify-center gap-2 mt-6">
          <Button ref={mainCtaRef} onClick={() => void startSession()}>
            {lang === "id" ? "Main Lagi" : "Play again"}
          </Button>
          {onBack ? (
            <Button variant="outline" onClick={onBack}>
              {lang === "id" ? "Kembali" : "Back"}
            </Button>
          ) : null}
        </div>
      </div>
        </div>
      </div>
    );
  }

  // PLAYING — HUD strip di atas papan (design §3.3)
  const lowTime = mode !== "endless" && remaining <= 30;
  const heartsLeft = 3 - strikes;
  if (paused) {
    // T6: overlay pause saat tab blur — waktu tidak berkurang; resume via klik.
    // S8: tetap di dalam .view-root/.view-body agar tidak memicu scroll halaman.
    return (
      <div className="view-root w-full max-w-3xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-puzzle)" }}>
          <IconClock3D size={18} aria-hidden="true" />
          <h2 className="text-sm font-black text-white m-0">Teka-Teki Gegas</h2>
        </div>
        <div className="view-body flex flex-col items-center" style={{ scrollbarWidth: "thin" }}>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 text-center" role="status" aria-live="polite">
            <IconClock3D size={40} className="mx-auto" aria-hidden="true" />
            <h2 className="text-lg font-black text-white mt-2 m-0">Sesi dijeda</h2>
            <p className="text-sm text-neutral-400 mt-1 m-0">Tab tidak aktif — waktu dihentikan sementara.</p>
            <div className="flex justify-center mt-5">
              <Button onClick={applyResume}>Lanjutkan</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    /* S8 Pola A (spec §3): .view-head 44px (HUD timer/skor/heart/stop, aksen
       --nav-accent-puzzle) + .view-grid-board (PuzzleSolver: papan kiri ≤540px
       + panel .view-body scroll internal kanan; F8 papan muat utuh). */
    <div className="view-root w-full min-h-0">
      <div className="view-head flex items-center justify-between gap-3 shrink-0 px-1" style={{ borderLeft: "3px solid var(--nav-accent-puzzle)" }}>
        <div className="flex items-center justify-between gap-3 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3">
          <span
            className={`flex items-center gap-1.5 text-base font-black tabular-nums ${lowTime ? "text-[var(--error)] animate-pulse" : "text-white"}`}
            aria-label={mode === "endless" ? "Durasi tanpa batas" : `Sisa waktu ${formatClock(remaining)}`}
          >
            {mode === "endless" ? <IconInfinity3D size={18} aria-hidden="true" /> : <IconClock3D size={18} aria-hidden="true" />}
            {mode === "endless" ? formatClock(elapsed) : formatClock(remaining)}
          </span>
          <span className="flex items-center gap-1.5 text-base font-black text-white tabular-nums" key={score}>
            <IconFire3D size={16} aria-hidden="true" /> Skor: {score}
          </span>
          <span
            className="flex items-center gap-1 text-base"
            role="img"
            aria-label={`Kesempatan tersisa: ${heartsLeft} dari 3`}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={i < heartsLeft ? "text-[var(--primary)]" : "text-neutral-600"}
                aria-hidden="true"
              >
                ♥
              </span>
            ))}
          </span>
          {confirmStop ? (
            <span className="flex items-center gap-1 text-xs text-neutral-300">
              Akhiri sesi?
              <button className="underline font-bold" onClick={() => void endSession()}>
                Ya
              </button>
              <button className="underline" onClick={() => setConfirmStop(false)}>
                Lanjut
              </button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmStop(true)}>
              {lang === "id" ? "Berhenti" : "Stop"}
            </Button>
          )}
          <span className="sr-only" aria-live="polite">{announceRef.current}</span>
        </div>
      </div>

      <div className="view-grid-board flex-1 min-h-0 mt-1.5">
        {/* LEFT: papan PuzzleSolver — F8/Pola A §3: papan self-cap internal
            solver (max-w calc(100dvh-260px) ≈ 508px @ 768dvh ≤ 540) width-driven. */}
        <div className="flex flex-col gap-1.5 min-h-0">
          <PuzzleSolver
            lang={lang}
            puzzle={puzzle}
            variant="rush"
            fetchHint={fetchHint}
            submitAttempt={submitAttempt}
          />
        </div>
        {/* RIGHT: panel .view-body — banner koneksi + region scroll internal (Pola A §3). */}
        <div className="view-body pr-1 space-y-1.5 custom-scrollbar min-h-0">
          {authError ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border bg-[var(--card)] px-4 py-3 text-sm text-white text-center flex flex-col items-center gap-1.5"
              style={{ borderColor: authError.kind === "pending" ? "var(--nav-accent-puzzle)" : "var(--error)" }}
            >
              {authError.kind === "pending" ? (
                <ShieldAlert size={18} aria-hidden="true" className="text-amber-400" />
              ) : (
                <AlertTriangle size={18} aria-hidden="true" />
              )}
              <p className="text-sm text-neutral-300 m-0">{authError.message}</p>
              {authError.kind === "pending" ? (
                <p className="text-xs text-neutral-500 m-0">Fitur rush akan terbuka setelah admin menyetujui akunmu.</p>
              ) : null}
              {authError.kind === "busy" ? (
                <button className="underline" onClick={() => setAuthError(null)}>
                  Coba Lagi
                </button>
              ) : null}
            </div>
          ) : null}
          {disconnect ? (
            <div role="status" aria-live="polite" className="rounded-xl border border-[var(--error)] bg-[var(--card)] px-4 py-3 text-sm text-white text-center">
              Koneksi terputus.{" "}
              <button className="underline" onClick={() => setDisconnect(false)}>
                Coba Lagi
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
