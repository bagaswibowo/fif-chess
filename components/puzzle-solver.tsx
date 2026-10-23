"use client";

/**
 * components/puzzle-solver.tsx (S3-T1..T4 frontend, W1 interaksi papan)
 * Solve mode papan+kpanel: validasi langkah real-time vs solution_moves
 * (chess.js), streak, hint 2-level, feedback benar/salah (shake 180ms,
 * auto-reply lawan), upsell Rush idle 20s. Design: docs/design/sprint3.md §1.
 *
 * W1 (pm-board-training-plan.md): papan kini interaktif — canDragPiece (hanya
 * bidak sisi giliran saat phase solving), onPieceDrop (drag), onSquareClick
 * (click-to-move: klik asal → klik tujuan). Validasi via
 * validateSolutionStep (lib/puzzle-solve.ts) vs solution_moves yang diambil
 * dari GET /api/puzzles/[id]/solution. Benar → maju FEN + auto-reply lawan
 * (applyUci) / selesai → finishPuzzle (submitAttempt + streak); salah (legal
 * tapi bukan solusi) → shake + failCount + status aria-live teks eksplisit
 * (bukan warna saja — DHH a11y); ilegal → papan menolak senyap (design §1.6).
 *
 * Dipakai ulang: PuzzleView (unlimited), DailyPuzzleView (single),
 * RushView (beruntun + HUD props), ThemesMasteryView (per tema),
 * EndgameDrillsView (S4-T4) — semua view sembuh otomatis dari perbaikan ini.
 * TIDAK menyentuh bank statis lib/puzzle-data.ts (quest BPCaturPedia).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { useChessTheme } from "@/lib/chess-themes";
import {
  IconAlert3D,
  IconCheck3D,
  IconFire3D,
  IconLightbulb3D,
  IconLightning3D,
} from "@/components/icons3d";
import {
  applyUci,
  sideToMove,
  validateSolutionStep,
  type PuzzleDto,
} from "@/lib/puzzle-solve";

type Props = {
  lang?: "id" | "en";
  puzzle: PuzzleDto | null;
  /** UCI solution moves; TIDAK dikirim ke client oleh API (server-validated). */
  fetchHint: (stage: 1 | 2) => Promise<{ from: string; direction?: { files: number; ranks: number } } | null>;
  /** POST attempt; return streak terbaru dari server. */
  submitAttempt: (p: { correct: boolean; timeSpentSec: number }) => Promise<number | null>;
  /** Streak awal dari server (refresh di tengah puzzle — design §1.6). */
  initialStreak?: number;
  /** Mode Rush: sembunyikan upsell & tombol berikutnya (aliran dikontrol parent). */
  variant?: "solo" | "rush";
  /** Rush: callback setiap langkah tervalidasi. */
  onSolved?: () => void;
  onFailed?: () => void;
  /** Rush: parent mengelola pindah puzzle berikutnya otomatis. */
  onNextPuzzle?: (puzzle: PuzzleDto | null) => void;
  onGoRush?: () => void;
  loading?: boolean;
};

type Phase = "solving" | "opponent" | "solved" | "error";

export function PuzzleSolver({
  lang = "id",
  puzzle,
  fetchHint,
  submitAttempt,
  initialStreak = 0,
  variant = "solo",
  onSolved,
  onFailed,
  onGoRush,
  loading = false,
}: Props) {
  const { customPieces, notationStyles, boardTheme } = useChessTheme();
  const [fen, setFen] = useState<string>(puzzle?.fen ?? "");
  const [phase, setPhase] = useState<Phase>("solving");
  const [streak, setStreak] = useState(initialStreak);
  const [status, setStatus] = useState("Giliranmu — cari langkah terbaik.");
  const [shake, setShake] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintFrom, setHintFrom] = useState<string | null>(null);
  const [hintArrow, setHintArrow] = useState(false);
  const [hintCaption, setHintCaption] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [upsellVisible, setUpsellVisible] = useState(false);
  // W1: solution moves (UCI) + progress index; selected square utk click-move.
  const [solution, setSolution] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const upsellCountRef = useRef(0);
  const upsellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<number>(Date.now());
  const finishRef = useRef(false);
  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Muat puzzle baru: reset state posisi & interaksi + ambil solusi.
  useEffect(() => {
    if (!puzzle) return;
    setFen(puzzle.fen);
    setPhase("solving");
    setStatus("Giliranmu — cari langkah terbaik.");
    setHintLevel(0);
    setHintFrom(null);
    setHintArrow(false);
    setHintCaption(null);
    setFailCount(0);
    setUpsellVisible(false);
    setSolution([]);
    setStepIndex(0);
    setSelected(null);
    finishRef.current = false;
    upsellCountRef.current = 0;
    startRef.current = Date.now();
    if (upsellTimerRef.current) clearTimeout(upsellTimerRef.current);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/puzzles/${puzzle.id}/solution`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { solutionMoves?: unknown };
        if (!cancelled && Array.isArray(data.solutionMoves)) {
          setSolution(data.solutionMoves.filter((m): m is string => typeof m === "string"));
        }
      } catch {
        /* solusi kosong → langkah tak tervalidasi; hint tetap jalan */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [puzzle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleUpsell = useCallback(() => {
    if (variant === "rush" || upsellCountRef.current >= 2) return;
    if (upsellTimerRef.current) clearTimeout(upsellTimerRef.current);
    upsellTimerRef.current = setTimeout(() => {
      setUpsellVisible(true);
      upsellCountRef.current += 1;
    }, 20_000);
  }, [variant]);

  const armHint = useCallback(
    async (stage: 1 | 2) => {
      if (!puzzle) return;
      const hint = await fetchHint(stage);
      if (!hint) return;
      setHintFrom(hint.from);
      setHintLevel(stage);
      if (stage >= 2 && hint.direction) {
        setHintArrow(true);
        setHintCaption("Arah langkah terlihat — targetnya tetap rahasia.");
      } else {
        setHintCaption(null);
      }
    },
    [puzzle, fetchHint],
  );

  const finishPuzzle = useCallback(async () => {
    if (finishRef.current) return;
    finishRef.current = true;
    setPhase("solved");
    setStatus("Puzzle selesai!");
    setStreak((s) => s + 1);
    onSolved?.();
    const spent = Math.round((Date.now() - startRef.current) / 1000);
    await submitAttempt({ correct: true, timeSpentSec: spent });
    scheduleUpsell();
  }, [onSolved, submitAttempt, scheduleUpsell]);

  // W1: inti validasi — dipakai onPieceDrop (drag) & onSquareClick (click-move).
  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!puzzle || phase !== "solving") return false;
      const uci = `${from}${to}${promotion ?? ""}`;
      const expected = solution[stepIndex];
      const step = validateSolutionStep(fen, uci, expected);
      if (!step.ok) {
        if (step.reason === "illegal") {
          return false; // drag/klik ilegal: papan menolak senyap (design §1.6)
        }
        // Legal tapi bukan langkah solusi → shake + counter + teks (bukan warna saja).
        setShake(true);
        window.setTimeout(() => setShake(false), reducedMotion ? 0 : 200);
        setFailCount((c) => c + 1);
        setSelected(null);
        setStatus(`Langkah salah (${step.san ?? uci}) — coba lagi.`);
        onFailed?.();
        return true; // konsumsi drop supaya bidak tidak menghilang; posisi tak berubah
      }
      // Benar: maju FEN; bila masih ada langkah → auto-reply lawan (applyUci).
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      setSelected(null);
      setHintFrom(null);
      setHintArrow(false);
      setHintCaption(null);
      if (nextIndex >= solution.length) {
        void finishPuzzle();
        return true;
      }
      setPhase("opponent");
      setStatus("Lawan menjawab…");
      const reply = solution[nextIndex];
      window.setTimeout(() => {
        const nextFen = applyUci(step.nextFen, reply);
        if (nextFen) {
          setFen(nextFen);
          setStepIndex(nextIndex + 1);
        }
        setPhase("solving");
        setStatus("Giliranmu — cari langkah terbaik.");
      }, reducedMotion ? 60 : 550);
      return true;
    },
    [puzzle, phase, fen, solution, stepIndex, reducedMotion, finishPuzzle, onFailed],
  );

  // W1: hanya bidak sisi giliran (sideToMove FEN aktif) yang bisa didrag,
  // dan hanya saat phase "solving".
  const isOwnPiece = useCallback(
    (pieceType: string): boolean => {
      let turn: "w" | "b";
      try {
        turn = new Chess(fen).turn();
      } catch {
        return false;
      }
      return turn === "w" ? pieceType.startsWith("w") : pieceType.startsWith("b");
    },
    [fen],
  );

  const canDragPiece = useCallback(
    ({ piece }: PieceHandlerArgs): boolean => phase === "solving" && isOwnPiece(piece.pieceType),
    [phase, isOwnPiece],
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare || phase !== "solving") return false;
      return handleMove(sourceSquare.toLowerCase(), targetSquare.toLowerCase());
    },
    [phase, handleMove],
  );

  // W1: click-to-move — klik bidak sendiri (asal), lalu klik kotak tujuan.
  const onSquareClick = useCallback(
    ({ square, piece }: SquareHandlerArgs): void => {
      if (phase !== "solving") return;
      const sq = square.toLowerCase();
      // Kotak asal: hanya bidak sisi giliran yang bisa dipilih.
      if (!selected) {
        if (piece && isOwnPiece(piece.pieceType)) setSelected(sq);
        return;
      }
      if (sq === selected) {
        setSelected(null);
        return;
      }
      let targetPieceType: string | null = null;
      try {
        const p = new Chess(fen).get(sq as never);
        targetPieceType = p ? `${p.color === "w" ? "w" : "b"}${p.type.toUpperCase()}` : null;
      } catch {
        targetPieceType = null;
      }
      if (targetPieceType && isOwnPiece(targetPieceType)) {
        setSelected(sq); // ganti kotak asal
        return;
      }
      handleMove(selected, sq);
    },
    [phase, selected, fen, isOwnPiece, handleMove],
  );

  if (loading || !puzzle) {
    return (
      <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6" role="status" aria-busy="true">
        <div className="h-4 w-40 rounded bg-[var(--muted)] animate-pulse mb-3" />
        <div className="aspect-square w-full max-w-md mx-auto rounded-xl bg-[var(--surface)] animate-pulse" />
        <p className="sr-only">Memuat teka-teki…</p>
      </div>
    );
  }

  const orientation = sideToMove(puzzle.fen);
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (hintFrom) {
    squareStyles[hintFrom] = {
      boxShadow: "inset 0 0 0 4px var(--board-mark, #81b64c)",
      backgroundColor: "rgba(129,182,76,0.3)",
    };
  }
  if (selected) {
    squareStyles[selected] = {
      boxShadow: "inset 0 0 0 4px rgba(129,182,76,0.9)",
      backgroundColor: "rgba(129,182,76,0.25)",
    };
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start w-full">
      {/* PAPAN (board-first — design §1.1) */}
      <div
        className={`board-card rounded-2xl p-3 bg-[var(--card)] border border-[var(--border)] shadow-xl relative ${
          shake ? "puzzle-shake" : ""
        } ${phase === "solved" ? "ring-2 ring-[var(--success)]" : ""}`}
        id="board-primary"
      >
        <div className="aspect-square w-full max-w-[min(100%,calc(100dvh-260px))] mx-auto">
          <Chessboard
            key={`puzzle-${puzzle.id}`}
            options={{
              id: `puzzle-${puzzle.id}`,
              position: fen,
              boardOrientation: orientation,
              allowDragging: phase === "solving",
              canDragPiece,
              onPieceDrop,
              onSquareClick,
              squareStyles,
              arrows: hintArrow && hintFrom ? [] : [],
              boardStyle: {
                backgroundColor: boardTheme.dark,
                width: "100%",
                height: "100%",
              },
              darkSquareStyle: { backgroundColor: boardTheme.dark },
              lightSquareStyle: { backgroundColor: boardTheme.light },
              pieces: customPieces,
              animationDurationInMs: reducedMotion ? 0 : 180,
              ...notationStyles,
            }}
          />
        </div>
        {reducedMotion && shake ? (
          <div className="absolute inset-0 rounded-2xl border-2 border-[var(--error)] pointer-events-none" />
        ) : null}
      </div>

      {/* PANEL SOLVE */}
      <div className="flex flex-col gap-3 w-full">
        {/* Streak — selalu terlihat di panel, tidak pernah di atas papan */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 flex items-center gap-3">
          <IconFire3D size={24} aria-hidden="true" />
          <div>
            <div className="text-2xl font-black text-white tabular-nums" key={streak} data-testid="streak-value">
              {streak}
            </div>
            <div className="text-xs text-neutral-400">{lang === "id" ? "Beruntun" : "Streak"}</div>
          </div>
        </div>

        {/* Status aria-live */}
        <p
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
            phase === "solved"
              ? "border-[var(--success)] text-white bg-[var(--card)]"
              : phase === "error"
                ? "border-[var(--error)] text-white bg-[var(--card)]"
                : "border-[var(--border)] text-neutral-200 bg-[var(--card)]"
          }`}
        >
          {status}
        </p>

        {/* Counter kegagalan — teks eksplisit, bukan warna saja (DHH a11y) */}
        {failCount > 0 && phase === "solving" ? (
          <p className="rounded-lg border border-[var(--error)] px-3 py-1.5 text-xs font-bold text-neutral-200 flex items-center gap-1.5">
            <IconAlert3D size={14} aria-hidden="true" />
            Percobaan gagal: {failCount}× — langkah legal tapi belum tepat.
          </p>
        ) : null}

        {/* Info puzzle */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs text-neutral-400">
          Rating puzzle {puzzle.rating} · {puzzle.themes[0] ? puzzle.themes[0] : "Teka-teki"}
        </div>

        {/* Aksi */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void armHint((hintLevel >= 2 ? 2 : hintLevel + 1) as 1 | 2)}
            disabled={phase !== "solving"}
            className="flex-1"
          >
            <IconLightbulb3D size={16} aria-hidden="true" />
            {lang === "id" ? "Petunjuk" : "Hint"}
          </Button>
        </div>
        {hintCaption ? (
          <p className="text-xs text-neutral-400 -mt-1">{hintCaption}</p>
        ) : null}

        {failCount >= 3 ? (
          <Button variant="ghost" className="w-full">
            {lang === "id" ? "Lewati teka-teki ini?" : "Skip this puzzle?"}
          </Button>
        ) : null}

        {/* Upsell Rush — kartu kecil, bukan modal (design §1.5) */}
        {upsellVisible && onGoRush ? (
          <div className="rounded-xl border border-[var(--primary)]/40 bg-[var(--card)] px-4 py-3">
            <IconLightning3D size={22} aria-hidden="true" />
            <p className="text-sm font-bold text-white mt-1">{lang === "id" ? "Ingin yang lebih cepat?" : "Want something faster?"}</p>
            <p className="text-xs text-neutral-400 mb-2">
              {lang === "id"
                ? "Coba Teka-Teki Gegas — lawan waktu, selesaikan sebanyak mungkin."
                : "Try Puzzle Rush — race the clock, solve as many as you can."}
            </p>
            <Button size="sm" onClick={onGoRush}>{lang === "id" ? "Coba Teka-Teki Gegas" : "Try Puzzle Rush"}</Button>
          </div>
        ) : null}

        {phase === "error" ? (
          <p className="text-xs text-neutral-400 flex items-center gap-1">
            <IconAlert3D size={14} aria-hidden="true" /> Gagal memuat teka-teki.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { IconCheck3D };
