"use client";

/**
 * components/views/lessons-exercises.tsx (S7-T2 frontend, ADR-010 D2.2)
 * Kartu latihan per jenis LessonExercise — semua sumber REUSE:
 *  - SinglePuzzleCard : teka-teki riil pool tema (PuzzleSolver + /api/puzzles/next?theme=),
 *                       catatan via POST /api/puzzles/[id]/attempt.
 *  - BookMoveCard     : validasi KLIEN terhadap kandidat lib/engines/opening-book
 *                       (tanpa pencatatan server — label jujur "tidak tercatat").
 *  - ThemeDrillCard   : drill riil /api/puzzles/next?theme=<t> (count soal berturutan).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Check, Loader2, RotateCcw, Target } from "lucide-react";
import { OPENING_BOOK } from "@/lib/engines/opening-book";
import { useChessTheme } from "@/lib/chess-themes";
import { themeLabel } from "@/lib/puzzle-themes";
import { PuzzleSolver } from "@/components/puzzle-solver";
import type { PuzzleDto } from "@/lib/puzzle-solve";

type HintPayload = { from: string; to?: string; direction?: { files: number; ranks: number } } | null;

/** Kandidat UCI book move untuk satu FEN — data REUSE lib/engines/opening-book. */
function bookMoveCandidates(fen: string): string[] {
  const key = fen.trim().split(/\s+/).slice(0, 4).join(" ");
  const entry = OPENING_BOOK[key];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

/* ── Teka-teki riil satu soal (pool tema) — PuzzleSolver + /api/puzzles ── */
export function SinglePuzzleCard({ label, theme }: { label: string; theme: string }) {
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
      const res = await fetch(`/api/puzzles/next?theme=${encodeURIComponent(theme)}`, { cache: "no-store" });
      if (!res.ok) {
        if (gen === genRef.current) setError(res.status === 404 ? "Tidak ada teka-teki di tema ini." : "Gagal memuat teka-teki.");
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
  }, [theme]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

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

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 rounded-xl border border-[var(--border)] bg-[var(--card)]" role="alert">
        <p className="text-xs font-bold text-neutral-300">{error}</p>
        <button className="ctl ctl-sm" onClick={() => void loadNext()}>
          <RotateCcw size={13} aria-hidden="true" /> Coba lagi
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black text-white flex items-center gap-2">
          <Target size={13} className="text-[var(--primary)]" aria-hidden="true" /> {label}
          <span className="text-[10px] text-neutral-500 font-mono">{themeLabel(theme)}</span>
        </h3>
        <span className="text-[10px] text-neutral-500">Tercatat otomatis</span>
      </div>
      <PuzzleSolver
        puzzle={puzzle}
        loading={loading}
        initialStreak={streak}
        fetchHint={fetchHint}
        submitAttempt={submitAttempt}
        onSolved={() => void loadNext()}
        onNextPuzzle={() => void loadNext()}
      />
    </div>
  );
}

/* ── Drill tema N soal (pool puzzle bertema) — berturutan, tercatat ── */
export function ThemeDrillCard({ theme, count, authStatus }: { theme: string; count: number; authStatus: string | null }) {
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);
  void authStatus;

  const loadNext = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/puzzles/next?theme=${encodeURIComponent(theme)}`, { cache: "no-store" });
      if (!res.ok) {
        if (gen === genRef.current) setError(res.status === 404 ? "Tidak ada soal di tema ini." : "Gagal memuat soal.");
        return;
      }
      const data = await res.json();
      if (gen !== genRef.current) return;
      setPuzzle((data.puzzle as PuzzleDto) ?? null);
      setStreak(typeof data.streak === "number" ? data.streak : 0);
    } catch {
      if (gen === genRef.current) setError("Gagal memuat soal. Coba lagi.");
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [theme]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

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
      let streakOut: number | null = null;
      try {
        const res = await fetch(`/api/puzzles/${puzzle.id}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correct: p.correct, time_spent_sec: p.timeSpentSec }),
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.streak === "number") {
            setStreak(data.streak);
            streakOut = data.streak;
          }
          if (p.correct) setDone((d) => d + 1);
        }
      } catch {
        /* jaringan — biarkan progres lokal */
      }
      return streakOut;
    },
    [puzzle],
  );

  if (done >= count) {
    return (
      <div className="rounded-2xl border border-[var(--primary)]/60 bg-[var(--card)] p-3" role="status">
        <div className="flex items-center gap-2 text-xs font-black text-[var(--primary)]">
          <Check size={15} aria-hidden="true" /> Drill {themeLabel(theme)} selesai — {count} soal.
        </div>
        <button className="ctl ctl-sm mt-2" onClick={() => { setDone(0); void loadNext(); }}>
          <RotateCcw size={13} aria-hidden="true" /> Ulangi
        </button>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 rounded-xl border border-[var(--border)] bg-[var(--card)]" role="alert">
        <p className="text-xs font-bold text-neutral-300">{error}</p>
        <button className="ctl ctl-sm" onClick={() => void loadNext()}>
          <RotateCcw size={13} aria-hidden="true" /> Coba lagi
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black text-white flex items-center gap-2">
          <Target size={13} className="text-[var(--primary)]" aria-hidden="true" />
          Drill {themeLabel(theme)}
        </h3>
        <span className="text-[10px] font-mono text-neutral-400 tabular-nums" role="status">
          {Math.min(done, count)}/{count} selesai
        </span>
      </div>
      <PuzzleSolver
        puzzle={puzzle}
        loading={loading}
        initialStreak={streak}
        fetchHint={fetchHint}
        submitAttempt={submitAttempt}
        onSolved={() => void loadNext()}
        onNextPuzzle={() => void loadNext()}
      />
    </div>
  );
}

/* ── Book move: validasi KLIEN vs kandidat lib/engines/opening-book ──
 *    TANPA pencatatan server (kontrak §1.2) → label jujur "tidak tercatat". */
export function BookMoveCard({ fen }: { fen: string }) {
  const { customPieces, boardTheme } = useChessTheme();
  const [boardFen, setBoardFen] = useState(fen);
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [played, setPlayed] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [fromSq, setFromSq] = useState<string | null>(null);

  const candidates = useMemo(() => bookMoveCandidates(fen), [fen]);

  // Klik petak asal (bidak sisi giliran) → simpan; klik petak tujuan → play.
  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (status === "correct") return;
      if (!fromSq) {
        try {
          const c = new Chess(boardFen);
          const piece = c.get(square as Parameters<typeof c.get>[0]);
          if (piece) setFromSq(square);
        } catch {
          /* FEN invalid — papan tidak berubah */
        }
        return;
      }
      void play(fromSq, square);
    },
    [fromSq, boardFen, status],
  );

  const play = useCallback(
    (from: string, to: string) => {
      const uci = `${from}${to}`;
      let nextFen: string | null = null;
      try {
        const c = new Chess(boardFen);
        const m = c.move({ from, to, promotion: "q" });
        nextFen = m ? c.fen() : null;
      } catch {
        nextFen = null;
      }
      setFromSq(null);
      if (!nextFen) return;
      const isBook = candidates.length > 0 && candidates.some((k) => k === uci);
      setStatus(isBook ? "correct" : "wrong");
      setBoardFen(nextFen);
      setPlayed((p) => [...p, uci]);
      setShowAnswer(false);
    },
    [boardFen, candidates],
  );

  const reset = () => {
    setBoardFen(fen);
    setStatus("idle");
    setPlayed([]);
    setShowAnswer(false);
    setFromSq(null);
  };

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (fromSq) squareStyles[fromSq] = { boxShadow: "inset 0 0 0 3px var(--board-mark, var(--primary))" };
  if (showAnswer && candidates[0]) {
    squareStyles[candidates[0].slice(0, 2)] = { boxShadow: "inset 0 0 0 3px var(--accent)" };
    squareStyles[candidates[0].slice(2, 4)] = {
      boxShadow: "inset 0 0 0 3px var(--primary)",
      backgroundColor: "rgba(129,182,76,0.35)",
    };
  }

  const lastUci = played[played.length - 1];
  const arrows =
    status === "correct" && lastUci
      ? [{ startSquare: lastUci.slice(0, 2), endSquare: lastUci.slice(2, 4), color: "rgb(34,197,94)" }]
      : [];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black text-white flex items-center gap-2">
          <Check size={13} className="text-[var(--primary)]" aria-hidden="true" /> Cari book move
        </h3>
        <span className="text-[10px] text-neutral-500">Tanpa pencatatan — tidak tercatat di progres</span>
      </div>
      <div
        className="aspect-square w-full max-w-sm rounded-xl overflow-hidden border-2 border-[var(--board-dark)] relative mx-auto"
        style={{ backgroundColor: boardTheme.dark }}
        aria-label={`Papan book move, ${candidates.length} kandidat langkah buku`}
      >
        <Chessboard
          key={`bookmove-${fen}-${boardFen}`}
          options={{
            id: `bookmove-${fen}`,
            position: boardFen,
            boardOrientation: "white",
            allowDragging: false,
            allowDrawingArrows: false,
            arrows,
            squareStyles,
            onSquareClick,
            boardStyle: { backgroundColor: boardTheme.dark, width: "100%", height: "100%" },
            lightSquareStyle: { backgroundColor: boardTheme.light },
            darkSquareStyle: { backgroundColor: boardTheme.dark },
            pieces: customPieces,
          }}
        />
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <button className="ctl ctl-sm" onClick={reset} aria-label="Reset papan book move">
          <RotateCcw size={13} aria-hidden="true" /> Ulangi
        </button>
        <button className="ctl ctl-sm" onClick={() => setShowAnswer((v) => !v)} aria-label="Tampilkan langkah buku">
          {showAnswer ? "Sembunyikan" : "Tampilkan petunjuk"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={`text-xs font-bold ${status === "correct" ? "text-[var(--primary)]" : status === "wrong" ? "text-[var(--destructive)]" : "text-neutral-400"}`}
        >
          {status === "correct"
            ? "Betul — cocok dengan jalur buku."
            : status === "wrong"
              ? "Bukan jalur buku. Coba lagi."
              : candidates.length === 0
                ? "Posisi ini tidak ada di buku lokal — tanpa pencatatan."
                : "Giliranmu: mainkan book move di papan."}
        </p>
      </div>
    </div>
  );
}
