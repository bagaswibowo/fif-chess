"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameRecord } from "./game-record";

const KEY = "jev_chess_game_history";
const MAX = 100;

export type { GameRecord };

export function loadHistory(): GameRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGameRecord);
  } catch {
    return [];
  }
}

function isGameRecord(v: unknown): v is GameRecord {
  const g = v as GameRecord;
  return (
    !!g &&
    typeof g.id === "string" &&
    typeof g.playedAt === "number" &&
    typeof g.opponent === "string" &&
    (g.humanSide === "white" || g.humanSide === "black") &&
    Array.isArray(g.moves)
  );
}

export function saveHistory(history: GameRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX)));
  } catch {}
}

/**
 * Catat satu permainan selesai. Idempoten lewat fingerprint posisi akhir,
 * jadi re-render tidak menghasilkan baris duplikat.
 */
export function useGameHistory() {
  const [history, setHistory] = useState<GameRecord[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const record = useCallback((next: Omit<GameRecord, "id" | "playedAt"> & { playedAt?: number }) => {
    setHistory((prev) => {
      const entry: GameRecord = {
        ...next,
        id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        playedAt: next.playedAt ?? Date.now(),
      };
      // Sidik jari dari isi, bukan dari id, supaya aman dari duplikasi.
      const fp = (g: GameRecord) => `${g.humanSide}|${g.moves.join(" ")}|${g.outcomeKind}`;
      if (prev.some((g) => fp(g) === fp(entry))) return prev;
      const updated = [entry, ...prev].slice(0, MAX);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, record, clear };
}
