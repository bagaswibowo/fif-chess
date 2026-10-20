"use client";

/**
 * BoardContext.tsx
 * Port of chess.com board state management, adapted for jev-chess design system.
 * Manages board orientation, selected square, legal move highlights, and last move.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

export type BoardOrientation = "white" | "black";

export type BoardMove = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

export interface BoardContextValue {
  orientation: BoardOrientation;
  setOrientation: Dispatch<SetStateAction<BoardOrientation>>;
  selectedSquare: string | null;
  setSelectedSquare: Dispatch<SetStateAction<string | null>>;
  legalMoves: string[];
  setLegalMoves: Dispatch<SetStateAction<string[]>>;
  lastMove: BoardMove | null;
  setLastMove: Dispatch<SetStateAction<BoardMove | null>>;
  isFlipLocked: boolean;
  setIsFlipLocked: Dispatch<SetStateAction<boolean>>;
  squareSize: number;
  setSquareSize: Dispatch<SetStateAction<number>>;
}

const BoardContext = createContext<BoardContextValue | undefined>(undefined);

export function BoardProvider({
  children,
  initialOrientation = "white",
  initialSquareSize = 60,
}: {
  children: ReactNode;
  initialOrientation?: BoardOrientation;
  initialSquareSize?: number;
}) {
  const [orientation, setOrientation] = useState<BoardOrientation>(initialOrientation);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<BoardMove | null>(null);
  const [isFlipLocked, setIsFlipLocked] = useState<boolean>(false);
  const [squareSize, setSquareSize] = useState<number>(initialSquareSize);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  const value = useMemo(
    () => ({
      orientation,
      setOrientation,
      selectedSquare,
      setSelectedSquare,
      legalMoves,
      setLegalMoves,
      lastMove,
      setLastMove,
      isFlipLocked,
      setIsFlipLocked,
      squareSize,
      setSquareSize,
      clearSelection,
    }),
    [
      orientation,
      selectedSquare,
      legalMoves,
      lastMove,
      isFlipLocked,
      squareSize,
    ]
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard must be used within a BoardProvider");
  }
  return ctx;
}
