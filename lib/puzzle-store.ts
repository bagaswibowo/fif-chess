"use client";

// Penyimpanan teka-teki yang disimpan pemain (trik lawan dari pertandingan
// live) dan satu helper untuk menggabungkan Bank Teka-Teki dengan bab Quest
// sehingga keduanya dibaca dari sumber yang sama.

import { useCallback, useEffect, useState } from "react";
import { PUZZLES, QUEST_CHAPTERS, byCategory, type Puzzle, type PuzzleCategory } from "@/lib/puzzle-data";

const KEY = "jev_chess_saved_puzzles";

export type SavedPuzzle = Puzzle & { savedAt: number; source: string };

export function loadSaved(): SavedPuzzle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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

  const save = useCallback((puzzle: Puzzle, source: string) => {
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
