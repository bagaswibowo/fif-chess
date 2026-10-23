"use client";

/**
 * components/review-analysis-board.tsx (BUG-1 QA Sprint 5)
 * Papan analisis inline untuk view #/review: merender hasil paste PGN/FEN
 * dari PasteBar (fast-path analisis S2-T4) tanpa redirect ke play.
 * Replay SAN list dari startFen (chess.js), navigasi ply maju/mundur.
 */

import { useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export type ReviewGameInput = {
  startFen: string;
  moves: { san: string; uci: string }[];
};

type Props = {
  game: ReviewGameInput;
  ply: number;
  onPly: (p: number) => void;
};

function replay(startFen: string, moves: { san: string }[]) {
  const c = new Chess(startFen);
  const fens: string[] = [c.fen()];
  const played: { san: string; from: string; to: string }[] = [];
  for (const m of moves) {
    try {
      const r = c.move(m.san);
      if (!r) break;
      fens.push(c.fen());
      played.push({ san: r.san, from: r.from, to: r.to });
    } catch {
      break;
    }
  }
  return { fens, played };
}

export function ReviewAnalysisBoard({ game, ply, onPly }: Props) {
  const { fens, played } = useMemo(
    () => replay(game.startFen, game.moves),
    [game.startFen, game.moves],
  );

  const clamped = Math.max(0, Math.min(ply, fens.length - 1));
  const currentFen = fens[clamped] ?? fens[0];
  const lastMove = clamped > 0 ? played[clamped - 1] : null;

  return (
    <div className="panel p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md w-full max-w-xl mx-auto mb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="section-title m-0 text-sm">
          {langLabel(game.moves.length > 0)}
        </h3>
        <span className="text-xs text-neutral-400 font-semibold">
          {clamped}/{fens.length - 1}
        </span>
      </div>

      <div className="aspect-square w-full rounded-xl overflow-hidden border border-[var(--border-strong)] bg-[var(--board-dark)]">
        <Chessboard
          key={`review-board-${game.startFen}`}
          options={{
            id: "review-analysis-board",
            position: currentFen,
            boardOrientation: game.startFen.includes(" b ") ? "black" : "white",
            allowDragging: false,
            allowDrawingArrows: true,
            boardStyle: { width: "100%", height: "100%" },
            lightSquareStyle: { backgroundColor: "var(--board-light, #ebecd0)" },
            darkSquareStyle: { backgroundColor: "var(--board-dark, #739552)" },
            squareStyles: lastMove
              ? {
                  [lastMove.from]: { boxShadow: "inset 0 0 0 3px rgba(255,213,79,0.9)" },
                  [lastMove.to]: { boxShadow: "inset 0 0 0 3px rgba(255,213,79,0.9)" },
                }
              : undefined,
            showNotation: true,
          }}
        />
      </div>

      {played.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto custom-scrollbar text-xs">
            {played.map((m, i) => (
              <button
                key={`${m.san}-${i}`}
                type="button"
                onClick={() => onPly(i + 1)}
                aria-current={clamped === i + 1 ? "page" : undefined}
                className={`px-2 py-0.5 rounded-md font-mono transition-all ${
                  clamped === i + 1
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--surface)] text-neutral-300 hover:text-white"
                }`}
              >
                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""} {m.san}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ctl ctl-sm"
              onClick={() => onPly(Math.max(0, clamped - 1))}
              disabled={clamped === 0}
              aria-label="Langkah sebelumnya"
            >
              ‹ Mundur
            </button>
            <button
              type="button"
              className="ctl ctl-sm"
              onClick={() => onPly(0)}
              disabled={clamped === 0}
              aria-label="Ke posisi awal"
            >
              ⇤ Awal
            </button>
            <button
              type="button"
              className="ctl ctl-sm ctl-primary"
              onClick={() => onPly(Math.min(fens.length - 1, clamped + 1))}
              disabled={clamped >= fens.length - 1}
              aria-label="Langkah berikutnya"
            >
              Maju ›
            </button>
            <button
              type="button"
              className="ctl ctl-sm"
              onClick={() => onPly(fens.length - 1)}
              disabled={clamped >= fens.length - 1}
              aria-label="Ke langkah terakhir"
            >
              Akhir ⇥
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function langLabel(hasMoves: boolean): string {
  return hasMoves ? "Papan Analisis" : "Posisi Analisis";
}
