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
import { BoardChrome } from "@/components/board-chrome";
import { playCue } from "@/lib/sound";

type Props = {
  lang?: "id" | "en";
  puzzle: PuzzleDto | null;
  /** Hint berjenjang: level 1 kotak asal, 2 panah arah, 3 panah penuh dari solution[moveIndex]. */
  fetchHint: (level: 1 | 2 | 3, moveIndex: number) => Promise<{
    from: string;
    to?: string;
    direction?: { files: number; ranks: number };
  } | null>;
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
  /** V3: langkah yang sudah dimainkan (SAN) utk move list di side panel. */
  playedMoves?: string[];
};

type Phase = "solving" | "opponent" | "solved" | "revealed" | "error";
type Arrow = { startSquare: string; endSquare: string; color: string };

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
  onNextPuzzle,
  loading = false,
  playedMoves,
}: Props) {
  const { customPieces, notationStyles, boardTheme } = useChessTheme();
  // V3: move list lokal — dari langkah tervalidasi (SAN dari validateSolutionStep).
  const [moveList, setMoveList] = useState<string[]>([]);
  const [fen, setFen] = useState<string>(puzzle?.fen ?? "");
  const [phase, setPhase] = useState<Phase>("solving");
  const [streak, setStreak] = useState(initialStreak);
  const [status, setStatus] = useState("Giliranmu — cari langkah terbaik.");
  const [shake, setShake] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintFrom, setHintFrom] = useState<string | null>(null);
  const [hintTo, setHintTo] = useState<string | null>(null);
  const [hintDirection, setHintDirection] = useState<{ files: number; ranks: number } | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [upsellVisible, setUpsellVisible] = useState(false);
  const [solutionArrows, setSolutionArrows] = useState<Arrow[]>([]);
  const [solutionSquares, setSolutionSquares] = useState<string[]>([]);
  // W1: solution moves (UCI) + progress index; selected square utk click-move.
  const [solution, setSolution] = useState<string[]>([]);
  const [solutionLoaded, setSolutionLoaded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  // V4: feedback overlay — hijau benar (~200ms fade), merah salah; last-move amber.
  const [flash, setFlash] = useState<{ squares: string[]; kind: "correct" | "wrong"; key: number } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const flashTimerRef = useRef<number | null>(null);
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
    setHintTo(null);
    setHintDirection(null);
    setFailCount(0);
    setUpsellVisible(false);
    setSolutionArrows([]);
    setSolutionSquares([]);
    setSolution([]);
    setSolutionLoaded(false);
    setStepIndex(0);
    setSelected(null);
    setPromotion(null);
    setFlash(null);
    setLastMove(null);
    setMoveList([]);
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
          const moves = data.solutionMoves.filter((m): m is string => typeof m === "string");
          setSolution(moves);
          setSolutionLoaded(moves.length > 0);
          if (moves.length === 0) {
            setStatus("Solusi tidak tersedia — puzzle dilewati.");
          }
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
    async (stage: 1 | 2 | 3) => {
      if (!puzzle) return;
      const hint = await fetchHint(stage, stepIndex);
      if (!hint) return;
      setHintFrom(hint.from);
      setHintTo(hint.to ?? null);
      setHintDirection(hint.direction ?? null);
      setHintLevel(stage);
      if (stage >= 2 && hint.to) {
        setStatus(`Petunjuk: langkah dari ${hint.from} ke ${hint.to}.`);
      } else if (stage >= 2 && hint.direction) {
        setStatus("Arah langkah terlihat — targetnya tetap rahasia.");
      } else {
        setStatus(`Petunjuk: perhatikan kotak ${hint.from}.`);
      }
    },
    [puzzle, fetchHint, stepIndex],
  );

  const finishPuzzle = useCallback(async () => {
    if (finishRef.current) return;
    finishRef.current = true;
    setPhase("solved");
    setStatus("Puzzle selesai!");
    // V7: cue game-end bersama ring hijau solved (pasangan visual).
    playCue("game-end", { visual: true });
    setStreak((s) => s + 1);
    onSolved?.();
    const spent = Math.round((Date.now() - startRef.current) / 1000);
    await submitAttempt({ correct: true, timeSpentSec: spent });
    scheduleUpsell();
  }, [onSolved, submitAttempt, scheduleUpsell]);

  // P2: reveal solusi — animasikan seluruh solution[] di papan (applyUci bertahap),
  // tandai gagal (correct:false, streak tidak naik), lalu tawarkan Coba lagi/Berikutnya.
  const revealSolution = useCallback(async () => {
    if (!puzzle || solution.length === 0) return;
    setHintFrom(null);
    setHintTo(null);
    setHintDirection(null);
    setHintLevel(0);
    setSelected(null);
    setPromotion(null);
    setPhase("revealed");
    setStatus("Memutar solusi…");
    if (!finishRef.current) {
      finishRef.current = true;
      onFailed?.();
      const spent = Math.round((Date.now() - startRef.current) / 1000);
      await submitAttempt({ correct: false, timeSpentSec: spent });
    }
    let curFen = puzzle.fen;
    for (let i = 0; i < solution.length; i++) {
      const uci = solution[i];
      await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 60 : 700));
      const nextFen = applyUci(curFen, uci);
      if (!nextFen) break;
      curFen = nextFen;
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      setFen(curFen);
      setLastMove({ from, to });
      setSolutionSquares([from, to]);
      setSolutionArrows([{ startSquare: from, endSquare: to, color: "#f0b429" }]);
      playCue(uci.length > 4 ? "capture" : "move", { visual: true });
    }
    setStatus("Ini solusinya — pelajari langkahnya, lalu coba lagi atau lanjut.");
    if (variant !== "rush") {
      scheduleUpsell();
    }
  }, [puzzle, solution, reducedMotion, onFailed, submitAttempt, variant, scheduleUpsell]);

  // P2: "Coba lagi" setelah solusi dilihat — reset papan ke FEN awal tanpa ganti puzzle.
  const retryPuzzle = useCallback(() => {
    if (!puzzle) return;
    setFen(puzzle.fen);
    setPhase("solving");
    setStatus("Giliranmu — cari langkah terbaik.");
    setSolutionArrows([]);
    setSolutionSquares([]);
    setLastMove(null);
    setMoveList([]);
    setStepIndex(0);
    setSelected(null);
    setHintFrom(null);
    setHintTo(null);
    setHintDirection(null);
    setHintLevel(0);
    setFlash(null);
    finishRef.current = false;
    startRef.current = Date.now();
  }, [puzzle]);

  // W1: inti validasi — dipakai onPieceDrop (drag) & onSquareClick (click-move).
  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!puzzle || phase !== "solving") return false;
      // P1 (RC1.3): solusi belum termuat — jangan nilai "illegal"; tunggu fetch selesai.
      if (!solutionLoaded) {
        setStatus("Memuat solusi…");
        return false;
      }
      const uci = `${from}${to}${promotion ?? ""}`;
      // P1 (RC1.1): parity — langkah user = solution index GENAP; lawan = GANJIL.
      const expected = solution[stepIndex * 2];
      const step = validateSolutionStep(fen, uci, expected);
      if (!step.ok) {
        if (step.reason === "illegal") {
          return false; // drag/klik ilegal: papan menolak senyap (design §1.6)
        }
        // Legal tapi bukan langkah solusi → merah + shake + counter + teks (bukan warna saja).
        setShake(true);
        window.setTimeout(() => setShake(false), reducedMotion ? 0 : 300);
        // V4: overlay merah pada square asal+tujuan (pasangan visual shake — DHH).
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setFlash({ squares: [from, to], kind: "wrong", key: Date.now() });
        flashTimerRef.current = window.setTimeout(() => setFlash(null), reducedMotion ? 0 : 500);
        // V7: cue error hanya bersama highlight merah yang tampil di frame sama.
        playCue("error", { visual: true });
        setFailCount((c) => c + 1);
        setSelected(null);
        setStatus(`Langkah salah (${step.san ?? uci}) — coba lagi.`);
        onFailed?.();
        return true; // konsumsi drop supaya bidak tidak menghilang; posisi tak berubah
      }
      // Benar: maju ke langkah user berikutnya; reply lawan = solution[stepIndex*2+1].
      const nextStep = stepIndex + 1;
      setStepIndex(nextStep);
      setSelected(null);
      setHintFrom(null);
      setHintTo(null);
      setHintDirection(null);
      setHintLevel(0);
      // V4: highlight hijau square asal+tujuan (~200ms fade) + last-move amber.
      setLastMove({ from, to });
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setFlash({ squares: [from, to], kind: "correct", key: Date.now() });
      flashTimerRef.current = window.setTimeout(() => setFlash(null), reducedMotion ? 0 : 200);
      // V7: cue move/capture hanya bersama highlight hijau (pasangan visual, DHH).
      playCue(step.san?.includes("x") ? "capture" : "move", { visual: true });
      const lastStep = nextStep * 2 >= solution.length;
      // V3: update move list tiap langkah benar (SAN + auto-reply).
      if (step.san) {
        const nextMoves = [...moveList, step.san];
        if (!lastStep) {
          nextMoves.push("…");
        }
        setMoveList(nextMoves);
      }
      if (lastStep) {
        void finishPuzzle();
        return true;
      }
      setPhase("opponent");
      setStatus("Lawan menjawab…");
      const reply = solution[stepIndex * 2 + 1];
      window.setTimeout(() => {
        const nextFen = applyUci(step.nextFen, reply);
        if (nextFen) {
          setFen(nextFen);
          // V4/V7: auto-reply lawan — highlight amber pasangan + cue bersama.
          setLastMove({ from: reply.slice(0, 2), to: reply.slice(2, 4) });
          playCue(reply.length > 4 ? "capture" : "move", { visual: true });
          // V3: catat auto-reply di move list.
          setMoveList((m) => (m.length > 0 && m[m.length - 1] === "…" ? [...m.slice(0, -1), reply.slice(0, 2) + "-" + reply.slice(2, 4)] : m));
        } else {
          // P1: reply lawan gagal diterapkan → jangan biarkan index loncat; selesai apa adanya.
          void finishPuzzle();
          return;
        }
        setPhase("solving");
        setStatus("Giliranmu — cari langkah terbaik.");
      }, reducedMotion ? 60 : 550);
      return true;
    },
    [puzzle, phase, fen, solution, solutionLoaded, stepIndex, moveList, reducedMotion, finishPuzzle, onFailed],
  );

  // P3: panah hint — level 2 panah pendek searah vektor, level 3 panah penuh from→to.
  const boardArrows: Arrow[] = useMemo(() => {
    const arrows: Arrow[] = [];
    if (solutionArrows.length > 0) return solutionArrows;
    if (hintFrom && hintTo) {
      arrows.push({ startSquare: hintFrom, endSquare: hintTo, color: hintLevel >= 3 ? "#38bdf8" : "rgba(129,182,76,0.85)" });
    } else if (hintFrom && hintDirection && hintLevel >= 2) {
      const FILES = "abcdefgh";
      const fi = FILES.indexOf(hintFrom[0]);
      const ri = Number(hintFrom[1]);
      const nf = FILES[Math.min(7, Math.max(0, fi + Math.sign(hintDirection.files)))];
      const nr = Math.min(8, Math.max(1, ri + Math.sign(hintDirection.ranks)));
      if (nf !== hintFrom[0] || String(nr) !== hintFrom[1]) {
        arrows.push({ startSquare: hintFrom, endSquare: `${nf}${nr}`, color: "rgba(129,182,76,0.85)" });
      }
    }
    return arrows;
  }, [solutionArrows, hintFrom, hintTo, hintDirection, hintLevel]);

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
  // P1 (RC1.4): bila langkah butuh promosi, tampilkan pilihan bidak dulu.
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
      let needsPromotion = false;
      try {
        const chess = new Chess(fen);
        const pieceObj = chess.get(selected as never);
        const rank = selected[1];
        const lastRank = pieceObj?.color === "w" ? "8" : "1";
        needsPromotion = pieceObj?.type === "p" && sq[1] === lastRank && rank === (pieceObj?.color === "w" ? "7" : "2");
      } catch {
        needsPromotion = false;
      }
      if (needsPromotion) {
        setPromotion({ from: selected, to: sq });
        return;
      }
      handleMove(selected, sq);
    },
    [phase, selected, fen, isOwnPiece, handleMove],
  );

  const onPromotionPick = useCallback(
    (piece: "q" | "r" | "b" | "n") => {
      if (!promotion) return;
      const { from, to } = promotion;
      setPromotion(null);
      handleMove(from, to, piece);
    },
    [promotion, handleMove],
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
  // P2: highlight amber langkah solusi yang sedang dianimasikan (pasangan panah).
  if (solutionSquares.length > 0) {
    for (const sq of solutionSquares) {
      squareStyles[sq] = {
        backgroundColor: "rgba(240,180,41,0.45)",
        boxShadow: "inset 0 0 0 4px rgba(240,180,41,0.9)",
      };
    }
  }
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
  // V4: last-move amber tetap menyala setelah flash hilang.
  if (lastMove) {
    for (const sq of [lastMove.from, lastMove.to]) {
      squareStyles[sq] = {
        ...squareStyles[sq],
        backgroundColor: "rgba(250,173,20,0.35)",
        boxShadow: squareStyles[sq]?.boxShadow ?? "inset 0 0 0 3px rgba(250,173,20,0.8)",
      };
    }
  }
  // V4: flash benar (hijau) / salah (merah) — animasi CSS murni via kelas.
  if (flash) {
    for (const sq of flash.squares) {
      squareStyles[sq] = {
        ...squareStyles[sq],
        backgroundColor: flash.kind === "correct" ? "rgba(82,196,26,0.45)" : "rgba(245,34,45,0.45)",
        transition: "background-color 200ms ease-out",
      };
    }
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start w-full">
      {/* PAPAN (board-first — design §1.1) — V1: chrome wrapper, papan tidak pernah telanjang */}
      <div className="flex flex-col gap-1">
        <BoardChrome
          topLabel={lang === "id" ? "Lawan" : "Opponent"}
          bottomLabel={lang === "id" ? "Kamu" : "You"}
          topRating={puzzle.rating}
          flipped={orientation === "black"}
          className="board-card rounded-2xl p-3 bg-[var(--card)] border border-[var(--border)] shadow-xl relative"
        >
          <div
            className={`aspect-square w-full max-w-[min(100%,var(--board-cap))] mx-auto relative ${
              shake ? "puzzle-shake" : ""
            } ${phase === "solved" ? "ring-2 ring-[var(--success)]" : ""} ${phase === "revealed" ? "ring-2 ring-[#f0b429]" : ""}`}
            id="board-primary"
          >
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
              arrows: boardArrows,
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
        </BoardChrome>
      </div>

      {/* PANEL SOLVE */}
      <div className="flex flex-col gap-3 w-full">
        {/* V3: banner header panel */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 flex items-center gap-2" data-testid="puzzle-banner-header">
          {/* icon puzzle orange — SVG original */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" aria-hidden="true">
            <path d="M20.5 11h-2a1.5 1.5 0 0 1-1.5-1.5V8a1 1 0 0 0-1-1h-1.5A1.5 1.5 0 0 1 13 5.5v-2a2.5 2.5 0 0 0-5 0v2A1.5 1.5 0 0 1 6.5 7H5a1 1 0 0 0-1 1v2.5A1.5 1.5 0 0 1 2.5 12h-2a.5.5 0 0 0 0 1h2A1.5 1.5 0 0 1 4 14.5V17a1 1 0 0 0 1 1h1.5a1.5 1.5 0 0 1 1.5 1.5v2a2.5 2.5 0 0 0 5 0v-2a1.5 1.5 0 0 1 1.5-1.5H16a1 1 0 0 0 1-1v-2.5a1.5 1.5 0 0 1 1.5-1.5h2a2.5 2.5 0 0 0 0-5z" />
          </svg>
          <h2 className="text-sm font-black uppercase tracking-wider text-white">Puzzle</h2>
          <span className="ml-auto text-xs font-bold text-neutral-400">{lang === "id" ? "Beruntun" : "Streak"}: <span className="text-[var(--primary)]">{streak}</span></span>
        </div>

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
              : phase === "revealed"
                ? "border-[#f0b429] text-white bg-[var(--card)]"
                : phase === "error"
                  ? "border-[var(--error)] text-white bg-[var(--card)]"
                  : "border-[var(--border)] text-neutral-200 bg-[var(--card)]"
          }`}
        >
          {status}
        </p>

        {/* P1 (RC1.4): dialog pilihan promosi untuk click-to-move. */}
        {promotion ? (
          <div className="rounded-xl border border-[var(--primary)]/60 bg-[var(--card)] px-4 py-3" role="dialog" aria-label="Pilih bidak promosi">
            <p className="text-sm font-bold text-white mb-2">{lang === "id" ? "Promosi pion — pilih bidak:" : "Pawn promotion — pick a piece:"}</p>
            <div className="flex gap-2">
              {(["q", "r", "b", "n"] as const).map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => onPromotionPick(p)} aria-label={`Promosi ke ${p.toUpperCase()}`}>
                  {p === "q" ? "Ratu (Q)" : p === "r" ? "Benteng (R)" : p === "b" ? "Gajah (B)" : "Kuda (N)"}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setPromotion(null)}>
                {lang === "id" ? "Batal" : "Cancel"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Counter kegagalan — teks eksplisit, bukan warna saja (DHH a11y) */}
        {failCount > 0 && phase === "solving" ? (
          <p className="rounded-lg border border-[var(--error)] px-3 py-1.5 text-xs font-bold text-neutral-200 flex items-center gap-1.5">
            <IconAlert3D size={14} aria-hidden="true" />
            Percobaan gagal: {failCount}× — langkah legal tapi belum tepat.
          </p>
        ) : null}

        {/* V3: kartu rating puzzle */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 flex items-center justify-between" data-testid="puzzle-rating-card">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Rating Puzzle</div>
            <div className="text-xl font-black text-white tabular-nums">{puzzle.rating}</div>
          </div>
          {puzzle.themes[0] ? <span className="text-xs font-bold text-[var(--primary)] truncate max-w-32">{puzzle.themes[0]}</span> : null}
        </div>

        {/* V3: move list — update tiap langkah, scrollable */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" data-testid="puzzle-move-list">
          <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Langkah</div>
          <ol className="max-h-28 overflow-y-auto text-xs font-mono text-neutral-200 grid grid-cols-2 gap-x-2" aria-label="Daftar langkah yang sudah dimainkan">
            {moveList.length === 0 ? (
              <li className="text-neutral-500 col-span-2">Belum ada langkah.</li>
            ) : (
              moveList.map((m, i) => (
                <li key={`${i}-${m}`} className={i % 2 === 0 ? "text-white" : "text-neutral-400"}>
                  {Math.floor(i / 2) + 1}. {m}
                </li>
              ))
            )}
          </ol>
        </div>

        {/* V3: aksi Hint / Solution (secondary) */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void armHint((hintLevel >= 3 ? 3 : hintLevel + 1) as 1 | 2 | 3)}
            disabled={phase !== "solving"}
            className="flex-1"
          >
            <IconLightbulb3D size={16} aria-hidden="true" />
            {lang === "id" ? "Hint" : "Hint"}
          </Button>
          <Button
            variant="outline"
            disabled={phase === "solved" || phase === "revealed" || solution.length === 0}
            onClick={() => void revealSolution()}
            className="flex-1"
          >
            {lang === "id" ? "Solution" : "Solution"}
          </Button>
        </div>

        {/* P2: setelah solusi diputar — Coba lagi / Berikutnya. */}
        {phase === "revealed" ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={retryPuzzle}>
              {lang === "id" ? "Coba lagi" : "Try again"}
            </Button>
            {variant === "solo" ? (
              <Button
                className="flex-1"
                onClick={() => {
                  if (onNextPuzzle) onNextPuzzle(null);
                }}
              >
                {lang === "id" ? "Puzzle berikutnya" : "Next puzzle"}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* P2: auto-reveal tersedia setelah 3x gagal — menggantikan Skip mati. */}
        {failCount >= 3 && phase === "solving" && solution.length > 0 ? (
          <Button variant="outline" className="w-full" onClick={() => void revealSolution()}>
            {lang === "id" ? "Lihat solusi" : "See solution"}
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

        {/* V3: tombol besar hijau Next Puzzle — aktif setelah solved ATAU solusi dilihat */}
        {variant === "solo" ? (
          <button
            type="button"
            data-testid="puzzle-next-button"
            disabled={!(phase === "solved" || phase === "revealed")}
            onClick={() => {
              if (!(phase === "solved" || phase === "revealed")) return;
              // Muat puzzle baru tanpa reload — parent mengontrol fetch.
              if (onNextPuzzle) onNextPuzzle(null);
            }}
            aria-disabled={!(phase === "solved" || phase === "revealed")}
            className={`w-full rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide transition-all ${
              phase === "solved" || phase === "revealed"
                ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-lg cursor-pointer"
                : "bg-[var(--muted)] text-neutral-500 cursor-not-allowed"
            }`}
          >
            {lang === "id" ? "Teka-Teki Berikutnya" : "Next Puzzle"}
          </button>
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
