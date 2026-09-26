"use client";

// Bank Teka-Teki: 60 posisi terverifikasi (chess.js) berdasarkan Master Motifs Maxim Blokh (CT-Art 4.0)
// Menyediakan Quick Jump Tap Grid sehingga pemain bisa langsung melompat ke nomor puzzle tertentu.

import { useMemo, useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { PUZZLE_CATEGORIES, type Puzzle, type PuzzleCategory } from "@/lib/puzzle-data";
import { mergePuzzles, useSavedPuzzles, filterPuzzles } from "@/lib/puzzle-store";
import { IconCheck3D } from "@/components/icons3d";
import { HighlightedChessText } from "@/components/chess-text-highlight";

type Props = { lang?: "id" | "en" };

export function PuzzleView({ lang = "id" }: Props) {
  const { saved } = useSavedPuzzles();
  const [category, setCategory] = useState<PuzzleCategory | "all">("all");
  const [index, setIndex] = useState(0);
  const [fen, setFen] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"unsolved" | "correct" | "wrong">("unsolved");
  const [hint, setHint] = useState(0);
  const [solved, setSolved] = useState<Set<string>>(new Set());

  const all = useMemo(() => mergePuzzles(saved), [saved]);
  const list = useMemo(() => filterPuzzles(all, category), [all, category]);
  const puzzle: Puzzle | undefined = list[Math.min(index, list.length - 1)];

  useEffect(() => {
    setIndex(0);
  }, [category]);

  useEffect(() => {
    if (!puzzle) return;
    setFen(puzzle.fen);
    setSelected(null);
    setStatus("unsolved");
    setHint(0);
  }, [puzzle?.id]);

  const reset = useCallback(() => {
    if (!puzzle) return;
    setFen(puzzle.fen);
    setSelected(null);
    setStatus("unsolved");
    setHint(0);
  }, [puzzle]);

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
      setSolved((prev) => new Set(prev).add(puzzle.id));
    } else {
      setStatus("wrong");
      setSelected(null);
    }
  };

  if (!puzzle) {
    return <p className="prose-note">Belum ada teka-teki.</p>;
  }

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

  // Difficulty badge styling
  const diffBadgeClass =
    puzzle.difficulty === "Mudah"
      ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
      : puzzle.difficulty === "Sedang"
        ? "bg-amber-950/70 text-amber-300 border-amber-500/50"
        : "bg-rose-950/70 text-rose-300 border-rose-500/50";

  return (
    <div className="stack" style={{ maxWidth: "72rem", margin: "0 auto" }}>
      <div className="row-between">
        <div>
          <h2 className="section-title text-xl sm:text-2xl font-black text-white tracking-wide">
            {lang === "id" ? "Bank Teka-Teki CT-ART 4.0" : "CT-ART 4.0 Puzzle Bank"}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Metode Master Motifs Maxim Blokh: Taktik Pembukaan, Babak Tengah, dan Skakmat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 shadow-sm">
            <IconCheck3D size={16} />
            {solved.size}/{all.length} selesai
          </span>
        </div>
      </div>

      {/* COMPACT MINIMALIST FILTER & PUZZLE PAGER */}
      <div className="panel px-3 py-2.5 row-between items-center gap-2 flex-wrap bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
        {/* Category Dropdown */}
        <div className="row items-center gap-2">
          <span className="text-xs shrink-0 font-bold uppercase tracking-wider text-neutral-400">Kategori:</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PuzzleCategory | "all")}
            className="ctl ctl-sm text-xs font-bold py-1.5 px-2.5 cursor-pointer bg-[var(--surface)] text-neutral-200 border border-[var(--border)] rounded-lg"
            aria-label="Pilih Kategori Teka-Teki"
          >
            {PUZZLE_CATEGORIES.map((c) => {
              const count = c.id === "all" ? all.length : all.filter((p) => p.category === c.id).length;
              if (count === 0) return null;
              return (
                <option key={c.id} value={c.id}>
                  {c.label} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Puzzle Pager */}
        <div className="row items-center gap-2">
          <button
            className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            title="Teka-teki Sebelumnya"
          >
            ← Prev
          </button>

          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="ctl ctl-sm text-xs font-bold py-1.5 px-2.5 cursor-pointer truncate max-w-[170px] sm:max-w-[240px] bg-[var(--surface)] text-white border border-[var(--border)] rounded-lg"
            aria-label="Pilih Posisi Teka-Teki"
          >
            {list.map((p, idx) => {
              const isSolved = solved.has(p.id);
              return (
                <option key={p.id} value={idx}>
                  {isSolved ? "✓ " : ""}#{idx + 1}: {p.theme}
                </option>
              );
            })}
          </select>

          <button
            className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white"
            disabled={index >= list.length - 1}
            onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))}
            title="Teka-teki Berikutnya"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="row gap-4 items-start">
        {/* LEFT: BOARD */}
        <div className="panel p-2.5 flex-1 max-w-[36rem] bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl">
          <div className="aspect-square rounded-xl overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--board-dark)] shadow-inner">
            <Chessboard
              options={{
                id: `puzzle-${puzzle.id}`,
                position: fen,
                boardOrientation: puzzle.turn === "w" ? "white" : "black",
                allowDragging: false,
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
                #{index + 1} · {puzzle.category}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${diffBadgeClass}`}>
                {puzzle.difficulty}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black text-amber-300 bg-amber-950/70 border border-amber-500/50 shadow-sm flex items-center gap-1">
              ⭐ +{puzzle.xp} XP
            </span>
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

          {/* QUEST CARD (Misi Taktik) */}
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <span>🎯</span>
              <span>Misi Taktik (Quest)</span>
            </div>
            <p className="text-sm text-neutral-200 leading-relaxed font-normal">
              <HighlightedChessText text={puzzle.description} />
            </p>
          </div>

          {/* HINTS */}
          {hint >= 1 && status === "unsolved" && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-sm leading-relaxed text-amber-100 animate-in fade-in">
              <strong className="text-amber-300 block mb-0.5 text-xs uppercase tracking-wider font-mono">
                🔍 Petunjuk 1 (Bidak):
              </strong>
              <HighlightedChessText text={puzzle.hintPiece} />
            </div>
          )}
          {hint >= 2 && status === "unsolved" && (
            <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/40 text-sm leading-relaxed text-sky-100 animate-in fade-in">
              <strong className="text-sky-300 block mb-0.5 text-xs uppercase tracking-wider font-mono">
                🎯 Petunjuk 2 (Petak Tujuan):
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block mb-1">
                  💡 Rahasia Trik & Motif Taktik (CT-ART 4.0):
                </span>
                <p className="text-sm text-emerald-50 leading-relaxed font-normal">
                  <HighlightedChessText text={puzzle.trickExplanation} />
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
              onClick={reset}
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
                    const c = new Chess(puzzle.fen);
                    c.move({ from: from as Square, to: to as Square, promotion: puzzle.solutionUci[4] || "q" });
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
              onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))}
              disabled={index >= list.length - 1}
            >
              <span>Berikutnya →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
