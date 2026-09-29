"use client";

// Trik & Quest Gabungan
//
// Menggabungkan fitur "Belajar & Quest" (jalur progresi terstruktur) dengan
// "Bank Teka-Teki" (eksplorasi bebas) menjadi satu komponen unified.
// Data teka-teki diperkaya dengan konten dari Buku Pintar Catur-Pedia
// (Fienso Suharsono): Jebakan (Bab 11), Taktik Skak Mat (Bab 12),
// dan Taktik Catur (Bab 7).

import { useCallback, useEffect, useMemo, useState } from "react";
import { BoardControls } from "@/components/board-controls";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { QUEST_CHAPTERS, PUZZLE_CATEGORIES, type Puzzle, type PuzzleCategory } from "@/lib/puzzle-data";
import { mergePuzzles, useSavedPuzzles, filterPuzzles } from "@/lib/puzzle-store";
import { HighlightedChessText } from "@/components/chess-text-highlight";
import {
  IconCheck3D,
  IconStar3D,
  IconTarget3D,
  IconSearch3D,
  IconLightbulb3D,
  IconClose3D,
} from "@/components/icons3d";

const KEY = "jev_chess_quest_progress";

type Progress = { completed: string[]; xp: number };

function loadProgress(): Progress {
  if (typeof window === "undefined") return { completed: [], xp: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { completed: [], xp: 0 };
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      xp: typeof parsed.xp === "number" ? parsed.xp : 0,
    };
  } catch {
    return { completed: [], xp: 0 };
  }
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function useQuestProgress() {
  const [progress, setProgress] = useState<Progress>({ completed: [], xp: 0 });
  useEffect(() => {
    setProgress(loadProgress());
  }, []);
  const complete = useCallback((id: string, xp: number) => {
    setProgress((prev) => {
      if (prev.completed.includes(id)) return prev;
      const next = { completed: [...prev.completed, id], xp: prev.xp + xp };
      saveProgress(next);
      return next;
    });
  }, []);
  return { progress, complete };
}

type ViewMode = "quest" | "bank";
type Props = { lang?: "id" | "en" };

export function LearningHub({ lang = "id" }: Props) {
  const { progress, complete } = useQuestProgress();
  const { saved } = useSavedPuzzles();
  const [viewMode, setViewMode] = useState<ViewMode>("quest");
  const [activeId, setActiveId] = useState<string>(QUEST_CHAPTERS[0]?.id ?? "");
  const [fullscreen, setFullscreen] = useState(false);
  const [category, setCategory] = useState<PuzzleCategory | "all">("all");
  const [bankIndex, setBankIndex] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        setFullscreen((v) => !v);
      } else if (e.key === "z" || e.key === "Z") {
        setPlayAsBlack((v) => !v);
      } else if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const [fen, setFen] = useState(QUEST_CHAPTERS[0]?.fen ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"unsolved" | "correct" | "wrong">("unsolved");
  const [hint, setHint] = useState(0);
  const [playAsBlack, setPlayAsBlack] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(new Set());

  // Quest chapters
  const chapters = useMemo<Puzzle[]>(() => {
    const seen = new Set(QUEST_CHAPTERS.map((c) => c.id));
    const live = saved
      .filter((s) => !seen.has(s.id))
      .map((s) => ({ ...s, id: s.id, track: "quest" as const }));
    return [...QUEST_CHAPTERS, ...live];
  }, [saved]);

  // Bank puzzles
  const allBank = useMemo(() => mergePuzzles(saved), [saved]);
  const bankList = useMemo(() => filterPuzzles(allBank, category), [allBank, category]);

  // Currently active puzzle depending on mode
  const chapter = useMemo(
    () => (viewMode === "quest" ? chapters.find((c) => c.id === activeId) ?? chapters[0] : undefined),
    [chapters, activeId, viewMode]
  );
  const bankPuzzle = useMemo(
    () => (viewMode === "bank" ? bankList[Math.min(bankIndex, bankList.length - 1)] : undefined),
    [bankList, bankIndex, viewMode]
  );
  const puzzle = viewMode === "quest" ? chapter : bankPuzzle;

  const boardSide = playAsBlack
    ? (puzzle?.turn === "w" ? "black" : "white")
    : puzzle?.turn === "w" ? "white" : "black";

  const load = useCallback((c: Puzzle | undefined) => {
    if (!c) return;
    setFen(c.fen);
    setSelected(null);
    setStatus("unsolved");
    setHint(0);
  }, []);

  useEffect(() => {
    load(puzzle);
  }, [puzzle?.id, load]);

  useEffect(() => {
    setBankIndex(0);
  }, [category]);

  const onSquareClick = ({ square }: { square: string }) => {
    if (!puzzle || status === "correct") return;
    const c = new Chess(fen);
    const sq = square.toLowerCase() as Square;

    if (!selected) {
      const p = c.get(sq);
      if (p && p.color === puzzle.turn) setSelected(square);
      return;
    }
    if (selected.toLowerCase() === sq) {
      setSelected(null);
      return;
    }
    const target = c.get(sq);
    if (target && target.color === puzzle.turn) {
      setSelected(square);
      return;
    }

    const from = selected.toLowerCase() as Square;
    let m = null;
    try {
      m = c.move({ from, to: sq, promotion: puzzle.solutionUci[4] || "q" });
    } catch {
      m = null;
    }
    if (!m) {
      setSelected(null);
      return;
    }
    if (m.san === puzzle.solutionSan) {
      setFen(c.fen());
      setStatus("correct");
      setSelected(null);
      if (viewMode === "quest") complete(puzzle.id, puzzle.xp);
      setSolved((prev) => new Set(prev).add(puzzle.id));
    } else {
      setStatus("wrong");
      setSelected(null);
    }
  };

  const handlePieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }): boolean => {
    if (!puzzle || !targetSquare || status === "correct") return false;
    const c = new Chess(fen);
    const from = sourceSquare.toLowerCase() as Square;
    const to = targetSquare.toLowerCase() as Square;
    let m = null;
    try {
      m = c.move({ from, to, promotion: puzzle.solutionUci[4] || "q" });
    } catch {
      m = null;
    }
    if (!m) return false;
    if (m.san === puzzle.solutionSan) {
      setFen(c.fen());
      setStatus("correct");
      setSelected(null);
      if (viewMode === "quest") complete(puzzle.id, puzzle.xp);
      setSolved((prev) => new Set(prev).add(puzzle.id));
      return true;
    } else {
      setStatus("wrong");
      setSelected(null);
      return false;
    }
  };

  if (!puzzle) return <p className="prose-note">Belum ada teka-teki.</p>;

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selected) squareStyles[selected] = { boxShadow: "inset 0 0 0 3px var(--board-mark)" };
  const from = puzzle.solutionUci.slice(0, 2);
  const to = puzzle.solutionUci.slice(2, 4);
  if (hint >= 1 && status === "unsolved") squareStyles[from] = { boxShadow: "inset 0 0 0 3px var(--accent)" };
  if (hint >= 2 && status === "unsolved") squareStyles[to] = { boxShadow: "inset 0 0 0 3px var(--primary)" };
  if (status === "correct") {
    squareStyles[from] = { backgroundColor: "color-mix(in srgb, var(--primary) 35%, transparent)" };
    squareStyles[to] = { backgroundColor: "color-mix(in srgb, var(--primary) 55%, transparent)" };
  }

  const doneCount = chapters.filter((c) => progress.completed.includes(c.id)).length;
  const curIdx = viewMode === "quest" ? chapters.findIndex((c) => c.id === puzzle?.id) : bankIndex;
  const currentIndex = curIdx >= 0 ? curIdx : 0;
  const currentList = viewMode === "quest" ? chapters : bankList;

  const diffBadgeClass =
    puzzle.difficulty === "Mudah"
      ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
      : puzzle.difficulty === "Sedang"
        ? "bg-amber-950/70 text-amber-300 border-amber-500/50"
        : "bg-rose-950/70 text-rose-300 border-rose-500/50";

  const isBPCaturPedia = puzzle.source === "bpcaturpedia" || puzzle.theme?.includes("BPCaturPedia");

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-[var(--background)] text-white flex flex-col p-2 sm:p-3 overflow-hidden animate-in fade-in duration-200"
          : "stack"
      }
      style={fullscreen ? undefined : { maxWidth: "64rem", margin: "0 auto" }}
    >
      {/* HEADER */}
      <div className="row-between items-center gap-2 shrink-0">
        <div>
          <h2 className="section-title text-xl sm:text-2xl font-black text-white tracking-wide">
            {lang === "id" ? "Trik & Quest Taktik" : "Tricks & Tactical Quests"}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Konten diperkaya dari Buku Pintar Catur-Pedia (Fienso Suharsono) & CT-ART 4.0
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 shadow-sm">
            <IconCheck3D size={16} />
            {doneCount}/{chapters.length} bab · {progress.xp} XP
          </span>
        </div>
      </div>

      {/* MODE TOGGLE: Quest vs Bank */}
      <div className="panel px-3 py-2 flex items-center gap-2 flex-wrap bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode("quest")}
            className={`px-4 py-1.5 text-xs font-bold transition-all ${
              viewMode === "quest"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface)] text-neutral-400 hover:text-white"
            }`}
          >
            ⚔️ Quest (Progresi)
          </button>
          <button
            onClick={() => setViewMode("bank")}
            className={`px-4 py-1.5 text-xs font-bold transition-all ${
              viewMode === "bank"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface)] text-neutral-400 hover:text-white"
            }`}
          >
            📚 Bank Teka-Teki
          </button>
        </div>

        {/* Quest Pager or Bank Filter */}
        {viewMode === "quest" ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white shrink-0"
              disabled={currentIndex <= 0}
              onClick={() => {
                if (currentIndex > 0) setActiveId(chapters[currentIndex - 1].id);
              }}
              title="Bab Sebelumnya"
            >
              ← Prev
            </button>

            <select
              value={puzzle?.id || ""}
              onChange={(e) => setActiveId(e.target.value)}
              className="ctl ctl-sm text-xs font-bold truncate max-w-[210px] sm:max-w-[360px] py-1.5 px-2.5 cursor-pointer bg-[var(--surface)] text-white border border-[var(--border)] rounded-lg flex-1 min-w-0"
              aria-label="Pilih Bab Quest"
            >
              {chapters.map((c, i) => {
                const isDone = progress.completed.includes(c.id);
                const srcLabel = c.source === "bpcaturpedia" ? " 📖" : "";
                return (
                  <option key={c.id} value={c.id}>
                    {isDone ? "[✓] " : ""}{i + 1}. {c.theme}{srcLabel} ({c.difficulty})
                  </option>
                );
              })}
            </select>

            <button
              className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white shrink-0"
              disabled={currentIndex >= chapters.length - 1}
              onClick={() => {
                if (currentIndex < chapters.length - 1) setActiveId(chapters[currentIndex + 1].id);
              }}
              title="Bab Berikutnya"
            >
              Next →
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PuzzleCategory | "all")}
              className="ctl ctl-sm text-xs font-bold py-1.5 px-2.5 cursor-pointer bg-[var(--surface)] text-neutral-200 border border-[var(--border)] rounded-lg"
              aria-label="Pilih Kategori"
            >
              {PUZZLE_CATEGORIES.map((c) => {
                const count = c.id === "all" ? allBank.length : allBank.filter((p) => p.category === c.id).length;
                if (count === 0) return null;
                return (
                  <option key={c.id} value={c.id}>
                    {c.label} ({count})
                  </option>
                );
              })}
            </select>

            <button
              className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white shrink-0"
              disabled={bankIndex <= 0}
              onClick={() => setBankIndex((i) => Math.max(0, i - 1))}
              title="Sebelumnya"
            >
              ← Prev
            </button>

            <select
              value={bankIndex}
              onChange={(e) => setBankIndex(Number(e.target.value))}
              className="ctl ctl-sm text-xs font-bold py-1.5 px-2.5 cursor-pointer truncate max-w-[170px] sm:max-w-[240px] bg-[var(--surface)] text-white border border-[var(--border)] rounded-lg"
              aria-label="Pilih Posisi"
            >
              {bankList.map((p, idx) => {
                const isSolved = solved.has(p.id);
                const srcLabel = p.source === "bpcaturpedia" ? " 📖" : "";
                return (
                  <option key={p.id} value={idx}>
                    {isSolved ? "[✓] " : ""}#{idx + 1}: {p.theme}{srcLabel}
                  </option>
                );
              })}
            </select>

            <button
              className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white shrink-0"
              disabled={bankIndex >= bankList.length - 1}
              onClick={() => setBankIndex((i) => Math.min(bankList.length - 1, i + 1))}
              title="Berikutnya"
            >
              Next →
            </button>

            <span className="px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-emerald-400 shrink-0">
              {solved.size}/{allBank.length} selesai
            </span>
          </div>
        )}
      </div>

      <div
        className={
          fullscreen
            ? "flex-1 grid lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_430px] gap-3 items-stretch min-h-0 overflow-hidden pt-1"
            : "grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-4 items-start w-full"
        }
      >
        {/* LEFT: BOARD */}
        <div
          className={
            fullscreen
              ? "flex flex-col items-center justify-center h-full min-h-0 w-full max-w-[min(96vw,calc(100dvh-140px))] mx-auto py-0.5"
              : "rounded-2xl p-2.5 bg-[var(--card)] border border-[var(--border)] shadow-xl w-full"
          }
        >
          <BoardControls
            variant="toolbar"
            orientation={boardSide}
            onFlipOrientation={() => setPlayAsBlack((v) => !v)}
            isFullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            showShortcuts={true}
            className="w-full shrink-0"
          />

          <div
            className={
              fullscreen
                ? "aspect-square rounded-2xl overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--board-dark)] shadow-2xl w-full max-h-[calc(100dvh-150px)] flex items-center justify-center min-h-0"
                : "aspect-square rounded-2xl overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--board-dark)] shadow-2xl w-full"
            }
          >
            <Chessboard
              options={{
                id: `trikquest-${puzzle.id}`,
                position: fen,
                boardOrientation: boardSide,
                allowDragging: status !== "correct",
                canDragPiece: ({ piece }) => (puzzle.turn === "w" ? piece.pieceType.startsWith("w") : piece.pieceType.startsWith("b")),
                onPieceDrop: handlePieceDrop,
                squareStyles,
                onSquareClick,
                boardStyle: {
                  backgroundColor: "var(--board-dark)",
                },
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
              }}
            />
          </div>
        </div>

        {/* RIGHT: QUEST / TRIK INFO PANEL */}
        <div
          className={
            fullscreen
              ? "panel p-4 stack gap-3.5 h-full overflow-y-auto pr-1.5 custom-scrollbar min-h-0 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl"
              : "panel p-4 stack gap-3.5 flex-1 min-w-[18rem] bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl"
          }
        >
          {/* Header Metadata */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider bg-[var(--surface)] text-neutral-300 border border-[var(--border)]">
                {viewMode === "quest" ? `Bab ${currentIndex + 1}` : `#${currentIndex + 1}`} · {puzzle.category}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${diffBadgeClass}`}>
                {puzzle.difficulty}
              </span>
              {isBPCaturPedia && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-950/60 text-amber-200 border border-amber-500/40">
                  📖 BPCaturPedia
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black text-amber-300 bg-amber-950/70 border border-amber-500/50 shadow-sm flex items-center gap-1.5">
                <IconStar3D size={14} className="shrink-0" />
                <span>+{puzzle.xp} XP</span>
              </span>
            </div>
          </div>

          {/* Theme Title */}
          <div>
            <h3 className="text-base sm:text-lg font-black text-white leading-snug tracking-tight">
              {puzzle.theme}
            </h3>
            <span className="text-xs font-semibold text-emerald-400 mt-0.5 block">
              Giliran {puzzle.turn === "w" ? "Putih Melangkah & Menang" : "Hitam Melangkah & Menang"}
            </span>
          </div>

          {/* QUEST / TRIK CARD (Misi Taktik) */}
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <IconTarget3D size={16} className="shrink-0" />
              <span>{viewMode === "quest" ? "Misi Quest Taktik" : "Misi Trik & Taktik"}</span>
            </div>
            <p className="text-sm text-neutral-200 leading-relaxed font-normal">
              <HighlightedChessText text={puzzle.description} />
            </p>
          </div>

          {/* HINTS */}
          {hint >= 1 && status === "unsolved" && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-sm leading-relaxed text-amber-100 animate-in fade-in">
              <strong className="text-amber-300 mb-0.5 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
                <IconSearch3D size={14} />
                <span>Petunjuk 1 (Bidak):</span>
              </strong>
              <HighlightedChessText text={puzzle.hintPiece} />
            </div>
          )}
          {hint >= 2 && status === "unsolved" && (
            <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/40 text-sm leading-relaxed text-sky-100 animate-in fade-in">
              <strong className="text-sky-300 mb-0.5 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
                <IconTarget3D size={14} />
                <span>Petunjuk 2 (Petak Tujuan):</span>
              </strong>
              <HighlightedChessText text={puzzle.hintExplanation} />
            </div>
          )}

          {/* TRIK PENJELASAN (Saat Benar) */}
          {status === "correct" && (
            <div className="p-4 rounded-xl bg-emerald-950/70 border-2 border-emerald-500/70 shadow-xl shadow-emerald-950/40 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 font-black text-base">
                  <IconCheck3D size={20} />
                  <span>{puzzle.solutionSan} Benar!</span>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-emerald-900/80 border border-emerald-400/50 text-emerald-200">
                  +{puzzle.xp} XP Didapat
                </span>
              </div>
              
              <div className="pt-1 border-t border-emerald-800/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1 flex items-center gap-1.5">
                  <IconLightbulb3D size={14} />
                  <span>
                    {isBPCaturPedia
                      ? "Penjelasan Trik · Buku Pintar Catur-Pedia:"
                      : "Rahasia Trik & Motif Taktik (CT-ART 4.0):"}
                  </span>
                </span>
                <p className="text-sm text-emerald-50 leading-relaxed font-normal">
                  <HighlightedChessText text={puzzle.trickExplanation} />
                </p>
              </div>
            </div>
          )}

          {status === "wrong" && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/60 text-sm text-rose-200 flex items-center gap-2 animate-in fade-in">
              <span className="font-bold flex items-center gap-1.5">
                <IconClose3D size={16} />
                <span>Langkah belum tepat.</span>
              </span>
              <span className="text-xs text-rose-300">Coba analisa ulang atau buka petunjuk.</span>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center gap-2.5 pt-1 flex-wrap">
            <button
              className="ctl ctl-sm px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border)] text-neutral-300 hover:text-white"
              onClick={() => load(puzzle)}
            >
              Ulangi
            </button>
            {status === "unsolved" && (
              <>
                <button
                  className="ctl ctl-sm px-3.5 py-2 text-xs font-bold rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-950/30"
                  onClick={() => setHint((h) => Math.min(2, h + 1))}
                >
                  Petunjuk {hint + 1}
                </button>
                <button
                  className="ctl ctl-sm px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border)] text-neutral-400 hover:text-white"
                  onClick={() => {
                    try {
                      const c = new Chess(puzzle.fen);
                      const move = c.move({ from: from as Square, to: to as Square, promotion: puzzle.solutionUci[4] || "q" });
                      if (!move || move.san !== puzzle.solutionSan) return;
                      setFen(c.fen());
                      setStatus("correct");
                      setHint(2);
                    } catch {}
                  }}
                >
                  Buka solusi
                </button>
              </>
            )}
            <button
              className={`ctl ctl-sm px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 ${
                status === "correct"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400"
                  : "border border-[var(--border)] text-neutral-300 hover:text-white"
              }`}
              onClick={() => {
                if (viewMode === "quest") {
                  if (currentIndex < chapters.length - 1) setActiveId(chapters[currentIndex + 1].id);
                } else {
                  setBankIndex((i) => Math.min(bankList.length - 1, i + 1));
                }
              }}
              disabled={currentIndex >= currentList.length - 1}
            >
              <span>{viewMode === "quest" ? "Bab Berikutnya →" : "Berikutnya →"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
