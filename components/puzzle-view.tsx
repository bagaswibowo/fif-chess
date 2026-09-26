"use client";

// Bank Teka-Teki: 60 posisi terverifikasi (chess.js) berdasarkan Master Motifs Maxim Blokh (CT-Art 4.0)
// Menyediakan Quick Jump Tap Grid sehingga pemain bisa langsung melompat ke nomor puzzle tertentu.

import { useMemo, useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { PUZZLE_CATEGORIES, type Puzzle, type PuzzleCategory } from "@/lib/puzzle-data";
import { mergePuzzles, useSavedPuzzles, filterPuzzles } from "@/lib/puzzle-store";
import { IconCheck3D } from "@/components/icons3d";

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

  return (
    <div className="stack" style={{ maxWidth: "70rem", margin: "0 auto" }}>
      <div className="row-between">
        <h2 className="section-title">{lang === "id" ? "Bank Teka-Teki CT-ART 4.0" : "CT-ART 4.0 Puzzle Bank"}</h2>
        <span className="prose-note clock flex items-center gap-1.5">
          <IconCheck3D size={16} />
          {solved.size}/{all.length} selesai
        </span>
      </div>

      {/* COMPACT MINIMALIST FILTER & PUZZLE PAGER */}
      <div className="panel px-3 py-2 row-between items-center gap-2 flex-wrap" style={{ background: "var(--card)" }}>
        {/* Category Dropdown */}
        <div className="row items-center gap-1.5">
          <span className="prose-note text-xs shrink-0 font-medium">Kategori:</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PuzzleCategory | "all")}
            className="ctl ctl-sm text-xs font-bold py-1 px-2 cursor-pointer"
            style={{ background: "var(--surface)" }}
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
        <div className="row items-center gap-1.5">
          <button
            className="ctl ctl-sm px-2.5 py-1 text-xs font-bold"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            title="Teka-teki Sebelumnya"
          >
            ← Prev
          </button>

          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="ctl ctl-sm text-xs font-bold py-1 px-2 cursor-pointer truncate max-w-[150px] sm:max-w-[220px]"
            style={{ background: "var(--surface)" }}
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
            className="ctl ctl-sm px-2.5 py-1 text-xs font-bold"
            disabled={index >= list.length - 1}
            onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))}
            title="Teka-teki Berikutnya"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: "var(--gap-2)", alignItems: "flex-start" }}>
        <div className="panel p-2" style={{ flex: "1 1 22rem", maxWidth: "36rem" }}>
          <div className="aspect-square" style={{ borderRadius: "var(--radius)", overflow: "hidden" }}>
            <Chessboard
              options={{
                id: `puzzle-${puzzle.id}`,
                position: fen,
                boardOrientation: puzzle.turn === "w" ? "white" : "black",
                allowDragging: false,
                squareStyles,
                onSquareClick,
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
              }}
            />
          </div>
        </div>

        <div className="panel p-3 stack" style={{ flex: "1 1 18rem" }}>
          <div className="row-between">
            <div className="min-w-0">
              <div className="label">Posisi #{index + 1} · {puzzle.category}</div>
              <div className="font-bold wrap-anywhere" style={{ fontFamily: "var(--font-display)" }}>
                {puzzle.theme}
              </div>
            </div>
            <span className="ctl ctl-xs shrink-0" aria-label={`Kesulitan ${puzzle.difficulty}`}>
              {puzzle.difficulty}
            </span>
          </div>

          <p className="prose-note">{puzzle.description}</p>

          {hint >= 1 && status === "unsolved" && (
            <p className="panel p-2 prose-note" style={{ borderColor: "var(--accent)" }}>
              <strong>Bidak:</strong> {puzzle.hintPiece}
            </p>
          )}
          {hint >= 2 && status === "unsolved" && (
            <p className="panel p-2 prose-note" style={{ borderColor: "var(--primary)" }}>
              <strong>Petak:</strong> {puzzle.hintExplanation}
            </p>
          )}

          {status === "correct" && (
            <div className="panel p-2.5 prose-note stack-tight" style={{ borderColor: "var(--primary)", background: "color-mix(in srgb, var(--primary) 10%, var(--card))" }}>
              <div className="flex items-center gap-1.5 font-bold" style={{ color: "var(--primary)" }}>
                <IconCheck3D size={16} />
                <span>{puzzle.solutionSan} Benar! (+{puzzle.xp} XP)</span>
              </div>
              <p style={{ margin: 0, fontSize: "var(--text-xs)" }}>{puzzle.trickExplanation}</p>
            </div>
          )}
          {status === "wrong" && <p className="prose-note" style={{ color: "var(--destructive)" }}>Belum tepat. Buka petunjuk atau ulangi posisinya.</p>}

          <div className="row flex-wrap" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
            <button className="ctl ctl-sm" onClick={reset}>
              Ulangi
            </button>
            {status === "unsolved" && (
              <>
                <button className="ctl ctl-sm" onClick={() => setHint((h) => Math.min(2, h + 1))}>
                  Petunjuk {hint + 1}
                </button>
                <button
                  className="ctl ctl-sm"
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
            <button className="ctl ctl-sm" onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))} disabled={index >= list.length - 1}>
              Berikutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
