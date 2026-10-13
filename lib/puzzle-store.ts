"use client";

// Penyimpanan teka-teki yang disimpan pemain (trik lawan dari pertandingan
// live) dan satu helper untuk menggabungkan Bank Teka-Teki dengan bab Quest
// sehingga keduanya dibaca dari sumber yang sama.

import { useCallback, useEffect, useState } from "react";
import { Chess } from "chess.js";
import { PUZZLES, QUEST_CHAPTERS, byCategory, type Puzzle, type PuzzleCategory, type PuzzleSource } from "./puzzle-data.ts";

const KEY = "jev_chess_saved_puzzles";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type SavedPuzzle = Puzzle & { savedAt: number; source: PuzzleSource };

export function isPlayablePuzzle(value: unknown): value is SavedPuzzle {
  if (!value || typeof value !== "object") return false;
  const puzzle = value as Partial<SavedPuzzle>;
  if (
    typeof puzzle.id !== "string" ||
    typeof puzzle.fen !== "string" ||
    (puzzle.turn !== "w" && puzzle.turn !== "b") ||
    typeof puzzle.solutionUci !== "string" ||
    typeof puzzle.solutionSan !== "string"
  ) return false;

  try {
    const chess = new Chess(puzzle.fen);
    if (chess.turn() !== puzzle.turn) return false;
    const promotion = puzzle.solutionUci.length > 4 ? puzzle.solutionUci[4] : undefined;
    const move = chess.move({
      from: puzzle.solutionUci.slice(0, 2),
      to: puzzle.solutionUci.slice(2, 4),
      promotion,
    });
    return move.lan === puzzle.solutionUci && move.san === puzzle.solutionSan;
  } catch {
    return false;
  }
}

export type LivePuzzleMove = { by: string; uci: string; san: string };

export function buildLivePuzzle(
  currentFen: string,
  lastMove: LivePuzzleMove,
  opponentName: string,
  history: string[] = [],
  startFen = START_FEN,
  id = `opp-${Date.now()}`,
): Puzzle | null {
  if (lastMove.by === "human") return null;

  try {
    const beforeMove = new Chess(startFen);
    for (const san of history.slice(0, -1)) beforeMove.move(san);
    const applied = beforeMove.move(lastMove.san);
    if (!applied || applied.lan !== lastMove.uci) return null;
    if (beforeMove.fen() !== currentFen) {
      const positionBeforeSolution = new Chess(startFen);
      for (const san of history.slice(0, -1)) positionBeforeSolution.move(san);
      return buildLivePuzzle(currentFen, lastMove, opponentName, [], positionBeforeSolution.fen(), id);
    }
    beforeMove.undo();

    const motif: Puzzle["motif"] = lastMove.san.includes("#")
      ? "mate"
      : lastMove.san.includes("+")
        ? "check"
        : lastMove.san.includes("=")
          ? "promotion"
          : lastMove.san.includes("x")
            ? "capture"
            : "tactic";

    return {
      id,
      category: "opponent",
      difficulty: "Sedang",
      track: "puzzle",
      motif,
      fen: beforeMove.fen(),
      turn: beforeMove.turn(),
      solutionUci: lastMove.uci,
      solutionSan: lastMove.san,
      theme: "Trik Taktis Lawan (Live Match)",
      description: `Langkah taktis ${lastMove.san} yang dilancarkan oleh ${opponentName} saat pertandingan langsung.`,
      hintPiece: `Mulai dari bidak di ${lastMove.uci.slice(0, 2)}.`,
      hintExplanation: `Arahkan bidak tersebut ke ${lastMove.uci.slice(2, 4)} untuk mengulangi ide taktis lawan.`,
      xp: 15,
      trickExplanation: `Taktik dari Lawan: Langkah ${lastMove.san} berhasil mengubah dinamika papan. Menganalisis dan memecahkan kembali langkah ini melatih refleks taktis menghadapi serangan serupa di turnamen nyata.`,
    };
  } catch {
    return null;
  }
}

export function loadSaved(): SavedPuzzle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPlayablePuzzle) : [];
  } catch {
    return [];
  }
}

export function persistSaved(list: SavedPuzzle[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60)));
  } catch {}
}

export function useSavedPuzzles() {
  const [saved, setSaved] = useState<SavedPuzzle[]>([]);

  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  const save = useCallback((puzzle: Puzzle, source: PuzzleSource) => {
    setSaved((prev) => {
      if (prev.some((p) => p.id === puzzle.id)) return prev;
      const next = [{ ...puzzle, savedAt: Date.now(), source }, ...prev].slice(0, 60);
      persistSaved(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistSaved(next);
      return next;
    });
  }, []);

  return { saved, save, remove };
}

/** Gabungkan teka-teki bawaan dengan yang disimpan pemain, tanpa duplikat id. */
export function mergePuzzles(extra: SavedPuzzle[]): Puzzle[] {
  const seen = new Set(PUZZLES.map((p) => p.id));
  return [...PUZZLES, ...extra.filter((p) => !seen.has(p.id))];
}

export function filterPuzzles(all: Puzzle[], category: PuzzleCategory | "all") {
  return byCategory(all, category);
}

export { QUEST_CHAPTERS };
