"use client";

/**
 * components/views/openings-view.tsx (S7-T2 frontend, ADR-010 D3)
 * Pelajaran Pembukaan di hash #/learn/openings/{eco} — sub-view di bawah
 * navTab "learn". Machine 3-mode KLIEN (Terangkan → Tantangan → Kemahiran)
 * di atas data REUSE; TIDAK ada endpoint/field baru (kontrak §1.3):
 *   - Terangkan   : teks lesson (lib/lessons) + papan step-by-step dari SAN
 *                   book (lib/opening-book REUSE via openingByEco).
 *   - Tantangan   : drill riil tema puzzle "opening" — GET /api/puzzles/next?theme=opening
 *                   + POST /api/puzzles/[id]/attempt (pencatatan riil REUSE),
 *                   solver di-embed (pola themes-mastery-view).
 *   - Kemahiran   : mastery riil — GET /api/puzzles/themes?theme=opening → masteryPct.
 *                   Kemahiran per-ECO TIDAK ada sumber → tampilkan tema-level
 *                   saja + label jujur (no-mock, D3.2).
 * Anti-slop: semua %/hitung dari endpoint; tanpa video. Pola kartu/CTA reuse
 * endgame-drills-view + learning-hub (tanpa fork komponen baru).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  BookOpen, ChevronLeft, ChevronRight, Compass, Loader2, RotateCcw, Target,
} from "lucide-react";
import { LESSONS } from "@/lib/lessons";
import { openingByEco } from "@/lib/opening-book";
import { useChessTheme } from "@/lib/chess-themes";
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { themeLabel } from "@/lib/puzzle-themes";
import { PuzzleSolver } from "@/components/puzzle-solver";
import type { PuzzleDto } from "@/lib/puzzle-solve";
import type { CoursesAuthStatus } from "./courses-view";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type OpeningMode = "jelaskan" | "tantangan" | "kemahiran";

type ThemeMastery = { theme: string; total: number; correct: number; masteryPct: number };
type HintPayload = { from: string; to?: string; direction?: { files: number; ranks: number } } | null;

/** Nama + jalur SAN per ECO — dari modul data REUSE (openingByEco). */
function openingMeta(eco: string): { name: string; sans: string[] } {
  const info = openingByEco(eco);
  if (info) return { name: info.name, sans: info.moves };
  // ECO tidak ada di buku lokal: nama = kode, jalur kosong (papan hanya awal).
  return { name: eco, sans: [] };
}

export function OpeningsLessonsView({
  eco,
  authStatus,
  onNavigate,
}: {
  eco: string;
  authStatus: CoursesAuthStatus;
  onNavigate: (hash: string) => void;
}) {
  const { customPieces, notationStyles, boardTheme } = useChessTheme();
  const [mode, setMode] = useState<OpeningMode>("jelaskan");
  const [step, setStep] = useState(0);
  const [challengeTab, setChallengeTab] = useState<OpeningMode>("tantangan");

  const meta = useMemo(() => openingMeta(eco), [eco]);
  const lesson = useMemo(
    () => LESSONS.find((l) => l.openingEco?.toUpperCase() === eco.toUpperCase()) ?? null,
    [eco],
  );

  // ── Terangkan: FEN per langkah dari SAN book (chess.js, client-side) ──
  const line = useMemo(() => {
    const chess = new Chess(START_FEN);
    const fens = [chess.fen()];
    for (const san of meta.sans) {
      try {
        chess.move(san);
        fens.push(chess.fen());
      } catch {
        break;
      }
    }
    return fens;
  }, [meta.sans]);
  const activeFen = line[Math.min(step, line.length - 1)] ?? START_FEN;

  const modeButtons: { id: OpeningMode; label: string; sub: string }[] = [
    { id: "jelaskan", label: "Terangkan", sub: "Jalur langkah demi langkah, penjelasannya mengikuti papan." },
    { id: "tantangan", label: "Tantangan", sub: "Drill riil tema pembukaan — papan memvalidasi & mencatat." },
    { id: "kemahiran", label: "Kemahiran", sub: "Mastery riil tema pembukaan." },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          className="ctl ctl-sm flex items-center gap-1.5"
          onClick={() => onNavigate("#/learn")}
          aria-label="Kembali ke daftar pelajaran"
        >
          <ChevronLeft size={15} aria-hidden="true" /> Kembali ke daftar
        </button>
        <button
          className="ctl ctl-sm flex items-center gap-1.5"
          onClick={() => onNavigate(`#/explorer?opening=${encodeURIComponent(eco)}`)}
          aria-label="Buka di Penjelajah"
        >
          <Compass size={14} aria-hidden="true" /> Buka di Penjelajah
        </button>
      </div>

      <div className="flex items-center gap-3">
        <BookOpen size={22} className="text-[var(--primary)] shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-black text-white leading-tight">
            {meta.name} <span className="font-mono text-sm text-neutral-400">({eco})</span>
          </h1>
          <p className="text-xs text-neutral-400">
            Materi tertulis — tanpa video. Buka di Penjelajah untuk garis & hasil riil.
          </p>
        </div>
      </div>

      {/* 3-mode tab strip chip (pola ctl ctl-choice, ADR D3.2 state machine klien) */}
      <div className="flex bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] shadow-md w-full" role="tablist" aria-label="Mode belajar pembukaan">
        {modeButtons.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            title={m.sub}
            onClick={() => { setMode(m.id); setStep(0); }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              mode === m.id ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">{modeButtons.find((m) => m.id === mode)?.sub}</p>

      {mode === "jelaskan" && (
        <div className="grid md:grid-cols-[minmax(0,1fr)_24rem] gap-3 items-start">
          <div className="rounded-2xl p-2.5 bg-[var(--card)] border border-[var(--border)] shadow-xl w-full flex flex-col items-center">
            <div
              className="aspect-square w-full max-w-[min(100%,calc(100dvh-260px))] rounded-xl overflow-hidden border-2 border-[var(--board-dark)] relative"
              style={{ backgroundColor: boardTheme.dark }}
              aria-label={`Ilustrasi ${meta.name}, posisi langkah ${step}`}
            >
              <Chessboard
                key={`opening-${eco}-${step}`}
                options={{
                  id: `opening-board-${eco}`,
                  position: activeFen,
                  boardOrientation: "white",
                  allowDragging: false,
                  allowDrawingArrows: false,
                  boardStyle: { backgroundColor: boardTheme.dark, width: "100%", height: "100%" },
                  lightSquareStyle: { backgroundColor: boardTheme.light },
                  darkSquareStyle: { backgroundColor: boardTheme.dark },
                  pieces: customPieces,
                  ...notationStyles,
                }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2 w-full">
              <button
                className="ctl ctl-sm"
                disabled={step <= 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                aria-label="Langkah sebelumnya"
              >
                <ChevronLeft size={15} aria-hidden="true" /> Sebelumnya
              </button>
              <span className="flex-1 text-center font-mono text-xs text-neutral-300 tabular-nums">
                {meta.sans.length === 0
                  ? "Jalur buku belum tersedia untuk ECO ini"
                  : `Langkah ${step} dari ${line.length - 1}`}
              </span>
              <button
                className="ctl ctl-sm"
                disabled={step >= line.length - 1}
                onClick={() => setStep((s) => Math.min(line.length - 1, s + 1))}
                aria-label="Lanjut langkah"
              >
                Lanjut <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 font-mono text-xs text-neutral-400 w-full text-center break-words">
              {meta.sans.slice(0, step).join(" · ") || "posisi awal"}
            </p>
          </div>
          <div className="panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md w-full min-h-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <BookOpen size={15} className="text-[var(--primary)]" aria-hidden="true" /> Materi
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">Materi tertulis — tanpa video.</p>
            <div className="mt-2 text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {lesson?.body ??
                `Jalur langkah ${meta.name} (${eco}): ` + (meta.sans.join(" · ") || "belum ada di buku lokal") + "."}
            </div>
            {lesson && (
              <button
                className="ctl ctl-sm mt-3 inline-flex items-center gap-1.5"
                onClick={() => onNavigate(`#/learn/${lesson.id}`)}
                aria-label="Buka pelajaran lengkap"
              >
                Pelajaran lengkap <Target size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "tantangan" && (
        <OpeningChallenge authStatus={authStatus} active={challengeTab} />
      )}

      {mode === "kemahiran" && <OpeningMastery eco={eco} onSwitchToChallenge={() => setMode("tantangan")} />}
    </div>
  );
}

/* ── Tantangan: drill riil tema "opening" (PuzzleSolver + /api/puzzles) ── */
function OpeningChallenge({ authStatus, active }: { authStatus: CoursesAuthStatus; active: OpeningMode }) {
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const loadNext = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/puzzles/next?theme=opening", { cache: "no-store" });
      if (!res.ok) {
        if (gen === genRef.current) {
          const data = await res.json().catch(() => ({}));
          setError(
            res.status === 401
              ? authErrorText(401, undefined, "teka-teki")
              : res.status === 404
                ? "Tidak ada teka-teki tema pembukaan di rentang ini."
                : authErrorText(res.status, data, "teka-teki"),
          );
          setPuzzle(null);
        }
        return;
      }
      const data = await res.json();
      if (gen !== genRef.current) return;
      setPuzzle((data.puzzle as PuzzleDto) ?? null);
      setStreak(typeof data.streak === "number" ? data.streak : 0);
    } catch {
      if (gen === genRef.current) setError("Gagal memuat teka-teki. Coba lagi.");
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active !== "tantangan") return;
    void loadNext();
  }, [active, loadNext]);

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

  if (error && !puzzle) {
    return (
      <div className="flex flex-col items-center gap-3 py-8" role="alert">
        <p className="text-sm font-bold text-neutral-300">{error}</p>
        <button className="ctl ctl-sm" onClick={() => void loadNext()}>Coba lagi</button>
      </div>
    );
  }
  return (
    <div className="w-full">
      <PuzzleSolver
        puzzle={puzzle}
        loading={loading}
        initialStreak={streak}
        fetchHint={fetchHint}
        submitAttempt={submitAttempt}
        onSolved={() => void loadNext()}
        onNextPuzzle={() => void loadNext()}
      />
      <p className="mt-2 text-[11px] text-neutral-500" role="status">
        Tema: {themeLabel("opening")} — progres tercatat riil via POST /api/puzzles/[id]/attempt.
      </p>
    </div>
  );
}

/* ── Kemahiran: mastery riil tema "opening" (GET /api/puzzles/themes) ── */
function OpeningMastery({ eco, onSwitchToChallenge }: { eco: string; onSwitchToChallenge: () => void }) {
  const [mastery, setMastery] = useState<ThemeMastery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let alive = true;
    try {
      const res = await fetch("/api/puzzles/themes?theme=opening", { cache: "no-store" });
      if (!res.ok) {
        if (alive) setError(authErrorText(res.status, await authErrorPayload(res), "kemahiran pembukaan"));
        return;
      }
      const data = await res.json();
      if (!alive) return;
      const row = (data.themes ?? []).find((t: ThemeMastery) => t.theme === "opening");
      setMastery(row ?? null);
    } catch {
      if (alive) setError("Gagal memuat kemahiran. Coba lagi.");
    } finally {
      if (alive) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
        <span className="flex items-center gap-2 text-sm font-bold text-neutral-400 animate-pulse">
          <Loader2 size={16} className="animate-spin" /> Menghitung kemahiran…
        </span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8" role="alert">
        <p className="text-sm font-bold text-neutral-300">{error}</p>
        <button className="ctl ctl-sm" onClick={() => void load()}>Coba lagi</button>
      </div>
    );
  }
  const pct = mastery?.masteryPct ?? 0;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
      <p className="text-xs font-bold text-neutral-400" role="status">
        Kemahiran dihitung per tema pembukaan, bukan per {eco} — tidak ada sumber data riil per-ECO
        (no-mock). Angka di bawah riil dari pool puzzle tema {themeLabel("opening")}.
      </p>
      <div
        className="h-2 rounded-full bg-[var(--muted)] overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Kemahiran tema pembukaan ${pct} persen`}
      >
        <div
          className="h-full bg-[var(--primary)] transition-all duration-[var(--move-animation-duration)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs font-bold text-neutral-300 tabular-nums">
        {mastery ? `${mastery.correct}/${mastery.total} soal benar · ${pct}%` : "Belum ada data kemahiran."}
      </p>
      {pct < 100 && (
        <button className="ctl ctl-sm inline-flex items-center gap-1.5" onClick={onSwitchToChallenge}>
          <RotateCcw size={13} aria-hidden="true" /> Latih di mode Tantangan
        </button>
      )}
    </div>
  );
}
