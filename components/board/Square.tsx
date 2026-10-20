"use client";

/**
 * Square.tsx
 * Individual chess board square.
 * Wood light/dark colors, selection highlight, legal move dot, last-move indicator.
 */

import React from "react";
import { useBoard } from "./BoardContext";

export interface SquareProps {
  square: string; // e.g. "e4"
  piece?: React.ReactNode; // e.g. <Piece ... />
  className?: string;
  onClick?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const LIGHT_SQUARE = "#f0d9b5";
const DARK_SQUARE = "#b58863";
const SELECTED_BG = "#81b64c";
const LEGAL_MOVE_BG = "rgba(129, 182, 76, 0.35)";
const LAST_MOVE_BG = "rgba(250, 173, 20, 0.25)";

export function Square({
  square,
  piece,
  className = "",
  onClick,
  onDragOver,
  onDrop,
}: SquareProps) {
  const { orientation, selectedSquare, legalMoves, lastMove } = useBoard();

  // Compute board coordinates (0-7)
  const file = square.charCodeAt(0) - 97; // a=0
  const rank = 8 - parseInt(square[1], 10); // 8=0

  // Adjust for orientation
  const displayFile = orientation === "white" ? file : 7 - file;
  const displayRank = orientation === "white" ? rank : 7 - rank;

  const isLight = (displayFile + displayRank) % 2 === 0;
  const baseColor = isLight ? LIGHT_SQUARE : DARK_SQUARE;

  const isSelected = selectedSquare === square;
  const isLegalMove = legalMoves.includes(square);
  const isLastMove =
    lastMove && (lastMove.from === square || lastMove.to === square);

  let bgColor = baseColor;
  if (isLastMove) bgColor = LAST_MOVE_BG;
  if (isSelected) bgColor = SELECTED_BG;
  if (isLegalMove && !isSelected) bgColor = LEGAL_MOVE_BG;

  return (
    <div
      data-square={square}
      className={`
        relative aspect-square overflow-hidden border border-transparent transition-colors duration-100
        ${className}
      `}
      style={{
        backgroundColor: bgColor,
      }}
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {piece && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {piece}
        </div>
      )}
      {isLegalMove && !piece && !isSelected && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="w-3 h-3 rounded-full bg-[#81b64c]/60 shadow-sm"
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "rgba(129, 182, 76, 0.6)",
              borderRadius: "50%",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          />
        </div>
      )}
    </div>
  );
}
