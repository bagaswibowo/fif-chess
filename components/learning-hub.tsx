"use client";

// Belajar & Quest.
//
// Keputusan item 8: teka-teki yang SAMA dengan Bank Teka-Teki. Kalau seorang
// siswa menyelesaikan bab Quest, teka-teki itu langsung ditandai selesai di
// Bank juga, karena keduanya membaca daftar dan progres yang sama. Yang tetap
// terpisah: bab Quest punya urutan & kunci, Bank Teka-Teki tidak punya urutan
// dan bisa disaring. Satu sumber data, dua cara belajar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { QUEST_CHAPTERS, type Puzzle } from "@/lib/puzzle-data";
import { useSavedPuzzles } from "@/lib/puzzle-store";
import { HighlightedChessText } from "@/components/chess-text-highlight";
import { IconCheck3D } from "@/components/icons3d";

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

type Props = { lang?: "id" | "en" };

export function LearningHub({ lang = "id" }: Props) {
  const { progress, complete } = useQuestProgress();
  const { saved } = useSavedPuzzles();
  const [activeId, setActiveId] = useState<string>(QUEST_CHAPTERS[0]?.id ?? "");
  const [fen, setFen] = useState(QUEST_CHAPTERS[0]?.fen ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"unsolved" | "correct" | "wrong">("unsolved");
  const [hint, setHint] = useState(0);
  const [playAsBlack, setPlayAsBlack] = useState(false);

  // Bab Quest adalah subset dari bank; teka-teki live yang disimpan pemain
  // ditampilkan sebagai bab tambahan supaya tidak ada materi yang tersembunyi.
  const chapters = useMemo<Puzzle[]>(() => {
    const seen = new Set(QUEST_CHAPTERS.map((c) => c.id));
    const live = saved
      .filter((s) => !seen.has(s.id))
      .map((s) => ({ ...s, id: s.id, track: "quest" as const }));
    return [...QUEST_CHAPTERS, ...live];
  }, [saved]);

  const chapter = useMemo(
    () => chapters.find((c) => c.id === activeId) ?? chapters[0],
    [chapters, activeId]
  );

  // Mode sisi: soal selalu played by side yang giliran di FEN; toggle hanya
  // membalik tampilan papan supaya pemain bisa latihan dari sisi yang jarang.
  const boardSide = playAsBlack ? (chapter?.turn === "w" ? "black" : "white") : chapter?.turn === "w" ? "white" : "black";

  const load = useCallback((c: Puzzle | undefined) => {
    if (!c) return;
    setFen(c.fen);
    setSelected(null);
    setStatus("unsolved");
    setHint(0);
  }, []);

  useEffect(() => {
    load(chapter);
  }, [chapter?.id, load]);

  const onSquareClick = ({ square }: { square: string }) => {
    if (!chapter || status === "correct") return;
    const c = new Chess(fen);
    const sq = square.toLowerCase() as Square;

    if (!selected) {
      const p = c.get(sq);
      if (p && p.color === chapter.turn) setSelected(square);
      return;
    }
    if (selected.toLowerCase() === sq) {
      setSelected(null);
      return;
    }
    const target = c.get(sq);
    if (target && target.color === chapter.turn) {
      setSelected(square);
      return;
    }

    const from = selected.toLowerCase() as Square;
    let m = null;
    try {
      m = c.move({ from, to: sq, promotion: chapter.solutionUci[4] || "q" });
    } catch {
      m = null;
    }
    if (!m) {
      setSelected(null);
      return;
    }
    if (m.san === chapter.solutionSan) {
      setFen(c.fen());
      setStatus("correct");
      setSelected(null);
      complete(chapter.id, chapter.xp);
    } else {
      setStatus("wrong");
      setSelected(null);
    }
  };

  const handlePieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }): boolean => {
    if (!chapter || !targetSquare || status === "correct") return false;
    const c = new Chess(fen);
    const from = sourceSquare.toLowerCase() as Square;
    const to = targetSquare.toLowerCase() as Square;
    let m = null;
    try {
      m = c.move({ from, to, promotion: chapter.solutionUci[4] || "q" });
    } catch {
      m = null;
    }
    if (!m) return false;
    if (m.san === chapter.solutionSan) {
      setFen(c.fen());
      setStatus("correct");
      setSelected(null);
      complete(chapter.id, chapter.xp);
      return true;
    } else {
      setStatus("wrong");
      setSelected(null);
      return false;
    }
  };

  if (!chapter) return <p className="prose-note">Belum ada bab.</p>;

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selected) squareStyles[selected] = { boxShadow: "inset 0 0 0 3px var(--board-mark)" };
  const from = chapter.solutionUci.slice(0, 2);
  const to = chapter.solutionUci.slice(2, 4);
  if (hint >= 1 && status === "unsolved") squareStyles[from] = { boxShadow: "inset 0 0 0 3px var(--accent)" };
  if (hint >= 2 && status === "unsolved") squareStyles[to] = { boxShadow: "inset 0 0 0 3px var(--primary)" };
  if (status === "correct") {
    squareStyles[from] = { backgroundColor: "color-mix(in srgb, var(--primary) 35%, transparent)" };
    squareStyles[to] = { backgroundColor: "color-mix(in srgb, var(--primary) 55%, transparent)" };
  }

  const doneCount = chapters.filter((c) => progress.completed.includes(c.id)).length;
  const curIdx = chapters.findIndex((c) => c.id === chapter?.id);
  const currentIndex = curIdx >= 0 ? curIdx : 0;

  const diffBadgeClass =
    chapter.difficulty === "Mudah"
      ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
      : chapter.difficulty === "Sedang"
        ? "bg-amber-950/70 text-amber-300 border-amber-500/50"
        : "bg-rose-950/70 text-rose-300 border-rose-500/50";

  return (
    <div className="stack" style={{ maxWidth: "72rem", margin: "0 auto" }}>
      <div className="row-between">
        <div>
          <h2 className="section-title text-xl sm:text-2xl font-black text-white tracking-wide">
            {lang === "id" ? "Belajar & Quest Taktik" : "Learn & Tactical Quests"}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Jalur Progresi Terstruktur CT-ART 4.0: Selesaikan Misi untuk Meningkatkan Rating ELO
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 shadow-sm">
            <IconCheck3D size={16} />
            {doneCount}/{chapters.length} bab · {progress.xp} Total XP
          </span>
        </div>
      </div>

      {/* COMPACT MINIMALIST CHAPTER PAGER */}
      <div className="panel px-3 py-2.5 row-between items-center gap-2 flex-wrap bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
        <button
          className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white shrink-0"
          disabled={currentIndex <= 0}
          onClick={() => {
            if (currentIndex > 0) setActiveId(chapters[currentIndex - 1].id);
          }}
          title={lang === "id" ? "Bab Sebelumnya" : "Previous"}
        >
          ← Prev
        </button>

        <div className="row items-center gap-2 min-w-0 flex-1 justify-center">
          <span className="text-xs shrink-0 font-bold uppercase tracking-wider text-neutral-400">
            {progress.completed.includes(chapter?.id || "") ? "✓ " : ""}Bab {currentIndex + 1} / {chapters.length}:
          </span>
          <select
            value={chapter?.id || ""}
            onChange={(e) => setActiveId(e.target.value)}
            className="ctl ctl-sm text-xs font-bold truncate max-w-[210px] sm:max-w-[360px] py-1.5 px-2.5 cursor-pointer bg-[var(--surface)] text-white border border-[var(--border)] rounded-lg"
            aria-label="Pilih Bab Quest"
          >
            {chapters.map((c, i) => {
              const isDone = progress.completed.includes(c.id);
              return (
                <option key={c.id} value={c.id}>
                  {isDone ? "✓ " : ""}{i + 1}. {c.theme} ({c.difficulty})
                </option>
              );
            })}
          </select>
        </div>

        <button
          className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white shrink-0"
          disabled={currentIndex >= chapters.length - 1}
          onClick={() => {
            if (currentIndex < chapters.length - 1) setActiveId(chapters[currentIndex + 1].id);
          }}
          title={lang === "id" ? "Bab Berikutnya" : "Next"}
        >
          Next →
        </button>
      </div>

      <div className="row gap-4 items-start">
        {/* LEFT: BOARD */}
        <div className="panel p-2.5 flex-1 max-w-[36rem] bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl">
          <div className="aspect-square rounded-xl overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--board-dark)] shadow-inner">
            <Chessboard
              options={{
                id: `quest-${chapter.id}`,
                position: fen,
                boardOrientation: boardSide,
                allowDragging: status !== "correct",
                canDragPiece: ({ piece }) => (chapter.turn === "w" ? piece.pieceType.startsWith("w") : piece.pieceType.startsWith("b")),
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

        {/* RIGHT: QUEST, HINTS & TRIK EXPLANATION */}
        <div className="panel p-4 stack gap-3.5 flex-1 min-w-[18rem] bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl">
          {/* Header Metadata */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider bg-[var(--surface)] text-neutral-300 border border-[var(--border)]">
                Bab {currentIndex + 1} · {chapter.category}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${diffBadgeClass}`}>
                {chapter.difficulty}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black text-amber-300 bg-amber-950/70 border border-amber-500/50 shadow-sm flex items-center gap-1">
                ⭐ +{chapter.xp} XP
              </span>
              <button
                className="ctl ctl-xs px-2 py-0.5 text-[10px] font-bold border border-[var(--border)] rounded-md text-neutral-300 hover:text-white"
                onClick={() => setPlayAsBlack((v) => !v)}
                aria-pressed={playAsBlack}
                title="Balik orientasi papan catur"
              >
                {boardSide === "white" ? "Putih Bawah" : "Hitam Bawah"}
              </button>
            </div>
          </div>

          {/* Theme Title */}
          <div>
            <h3 className="text-base sm:text-lg font-black text-white leading-snug tracking-tight">
              {chapter.theme}
            </h3>
            <span className="text-xs font-semibold text-emerald-400 mt-0.5 block">
              Giliran {chapter.turn === "w" ? "Putih Melangkah & Menang" : "Hitam Melangkah & Menang"}
            </span>
          </div>

          {/* QUEST CARD (Misi Taktik) */}
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <span>🎯</span>
              <span>Misi Quest Taktik</span>
            </div>
            <p className="text-sm text-neutral-200 leading-relaxed font-normal">
              <HighlightedChessText text={chapter.description} />
            </p>
          </div>

          {/* HINTS */}
          {hint >= 1 && status === "unsolved" && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-sm leading-relaxed text-amber-100 animate-in fade-in">
              <strong className="text-amber-300 block mb-0.5 text-xs uppercase tracking-wider font-mono">
                🔍 Petunjuk 1 (Bidak):
              </strong>
              <HighlightedChessText text={chapter.hintPiece} />
            </div>
          )}
          {hint >= 2 && status === "unsolved" && (
            <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/40 text-sm leading-relaxed text-sky-100 animate-in fade-in">
              <strong className="text-sky-300 block mb-0.5 text-xs uppercase tracking-wider font-mono">
                🎯 Petunjuk 2 (Petak Tujuan):
              </strong>
              <HighlightedChessText text={chapter.hintExplanation} />
            </div>
          )}

          {/* TRIK PENJELASAN (Saat Benar) */}
          {status === "correct" && (
            <div className="p-4 rounded-xl bg-emerald-950/70 border-2 border-emerald-500/70 shadow-xl shadow-emerald-950/40 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 font-black text-base">
                  <IconCheck3D size={20} />
                  <span>{chapter.solutionSan} Benar!</span>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-emerald-900/80 border border-emerald-400/50 text-emerald-200">
                  +{chapter.xp} XP Didapat
                </span>
              </div>
              
              <div className="pt-1 border-t border-emerald-800/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block mb-1">
                  💡 Rahasia Trik & Motif Taktik (CT-ART 4.0):
                </span>
                <p className="text-sm text-emerald-50 leading-relaxed font-normal">
                  <HighlightedChessText text={chapter.trickExplanation} />
                </p>
              </div>
            </div>
          )}

          {status === "wrong" && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/60 text-sm text-rose-200 flex items-center gap-2 animate-in fade-in">
              <span className="font-bold">✕ Langkah belum tepat.</span>
              <span className="text-xs text-rose-300">Coba analisa ulang atau buka petunjuk.</span>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center gap-2.5 pt-1 flex-wrap">
            <button
              className="ctl ctl-sm px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border)] text-neutral-300 hover:text-white"
              onClick={() => load(chapter)}
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
                    const c = new Chess(chapter.fen);
                    c.move({ from: from as Square, to: to as Square, promotion: chapter.solutionUci[4] || "q" });
                    setFen(c.fen());
                    setStatus("correct");
                    setHint(2);
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
                if (currentIndex < chapters.length - 1) setActiveId(chapters[currentIndex + 1].id);
              }}
              disabled={currentIndex >= chapters.length - 1}
            >
              <span>Bab Berikutnya →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
