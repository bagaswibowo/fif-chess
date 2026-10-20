"use client";

/**
 * ChessBoard.tsx
 * 8x8 chess board component for jev-chess.
 * Drag-and-drop piece movement, orientation flip, responsive square sizing.
 * Integrates with BoardContext for state.
 */

import React, { useCallback, useMemo } from "react";
import { Square } from "./Square";
import { Piece } from "./Piece";
import { useBoard } from "./BoardContext";

export interface ChessBoardProps {
  position: Record<string, string>; // square -> piece id (e.g. {"e4": "wp"})
  onSquareClick?: (square: string) => void;
  onPieceDrag?: (from: string, to: string) => void;
  className?: string;
  squareSize?: number;
}

export function ChessBoard({
  position,
  onSquareClick,
  onPieceDrag,
  className = "",
  squareSize: propSquareSize,
}: ChessBoardProps) {
  const { orientation, squareSize: ctxSquareSize, selectedSquare } = useBoard();
  const squareSize = propSquareSize ?? ctxSquareSize ?? 60;
  const boardSize = squareSize * 8;

  const files = useMemo(() => ["a", "b", "c", "d", "e", "f", "g", "h"], []);
  const ranks = useMemo(() => [8, 7, 6, 5, 4, 3, 2, 1], []);

  const handleSquareClick = useCallback(
    (square: string) => {
      onSquareClick?.(square);
    },
    [onSquareClick]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, square: string) => {
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toSquare: string) => {
      e.preventDefault();
      const fromSquare = e.dataTransfer.getData("text/plain");
      if (fromSquare && fromSquare !== toSquare) {
        onPieceDrag?.(fromSquare, toSquare);
      }
    },
    [onPieceDrag]
  );

  return (
    <div
      className={`relative bg-[#1a1714] rounded-xl border border-[#3d3a34] shadow-lg p-2 ${className}`}
      style={{
        width: boardSize,
        height: boardSize,
        touchAction: "none",
      }}
    >
      {/* Rank labels (left side) */}
      <div className="absolute left-[-24px] top-0 bottom-0 flex flex-col justify-between items-center pointer-events-none text-[10px] text-neutral-500 font-mono font-bold leading-[60px]">
        {ranks.map((rank) => (
          <div key={rank} className="text-center w-4">
            {rank}
          </div>
        ))}
      </div>

      {/* File labels (bottom) */}
      <div className="absolute bottom-[-24px] left-0 right-0 flex justify-center items-end pointer-events-none text-[10px] text-neutral-500 font-mono font-bold">
        {files.map((file) => (
          <div key={file} className="text-center h-4">
            {file}
          </div>
        ))}
      </div>

      <div
        className="relative w-full h-full grid grid-cols-8"
        style={{
          gridTemplateColumns: `repeat(8, ${squareSize}px)`,
          gridTemplateRows: `repeat(8, ${squareSize}px)`,
        }}
      >
        {orientation === "white"
          ? ranks.flatMap((rank) =>
              files.map((file) => {
                const square = `${file}${rank}`;
                const pieceId = position[square];
                return (
                  <Square
                    key={square}
                    square={square}
                    piece={
                      pieceId ? (
                        <Piece
                          type={pieceId[1] as "p" | "n" | "b" | "r" | "q" | "k"}
                          color={pieceId[0] as "w" | "b"}
                          size={squareSize - 8}
                          draggable
                          onDragStart={(e: React.DragEvent) => handleDragStart(e, square)}
                          onDragEnd={() => {}}
                        />
                      ) : undefined
                    }
                    className="cursor-pointer"
                    onClick={() => handleSquareClick(square)}
                    onDragOver={handleDragOver}
                    onDrop={(e: React.DragEvent) => handleDrop(e, square)}
                  />
                );
              })
            )
          : ranks.reverse().flatMap((rank) =>
              files.reverse().map((file) => {
                const square = `${file}${rank}`;
                const pieceId = position[square];
                return (
                  <Square
                    key={square}
                    square={square}
                    piece={
                      pieceId ? (
                        <Piece
                          type={pieceId[1] as "p" | "n" | "b" | "r" | "q" | "k"}
                          color={pieceId[0] as "w" | "b"}
                          size={squareSize - 8}
                          draggable
                          onDragStart={(e: React.DragEvent) => handleDragStart(e, square)}
                          onDragEnd={() => {}}
                        />
                      ) : undefined
                    }
                    className="cursor-pointer"
                    onClick={() => handleSquareClick(square)}
                    onDragOver={handleDragOver}
                    onDrop={(e: React.DragEvent) => handleDrop(e, square)}
                  />
                );
              })
            )}
      </div>
    </div>
  );
}
