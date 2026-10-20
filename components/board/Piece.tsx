"use client";

/**
 * Piece.tsx
 * SVG chess piece component following jev-chess design system.
 * No emoji — pure vector pieces with wood-consistent styling.
 * Inspired by chess.com piece set but with own identity (3D lighting, specular highlights).
 */

import React from "react";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceColor = "w" | "b";

export interface PieceProps {
  type: PieceType;
  color: PieceColor;
  size?: number;
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

// SVG piece paths — simplified silhouettes with 3D lighting gradients
const PIECE_PATHS: Record<PieceType, string> = {
  p: "M 12 22 Q 8 22 8 18 Q 8 14 12 14 Q 16 14 16 18 Q 16 22 12 22 Z M 10 14 Q 10 10 14 10 Q 18 10 18 14 Q 18 18 14 18 Q 14 22 10 18 Z",
  n: "M 14 22 Q 14 18 10 18 Q 6 18 6 14 Q 6 10 10 10 Q 14 10 14 14 Q 18 14 18 18 Q 18 22 14 22 Z",
  b: "M 12 22 Q 8 22 8 14 Q 12 10 16 14 Q 16 22 12 22 Z M 10 14 Q 10 10 14 10 Q 18 10 18 14 Q 14 18 10 14 Z",
  r: "M 8 22 Q 8 16 12 16 Q 12 10 16 10 Q 16 16 20 16 Q 20 22 16 22 Q 16 22 12 22 Q 8 22 8 22 Z M 10 16 Q 10 10 14 10 Q 18 10 18 16 Q 14 22 10 16 Z",
  q: "M 12 22 Q 8 22 8 16 Q 10 12 14 10 Q 18 12 20 16 Q 20 22 16 22 Q 16 22 12 22 Z M 11 14 Q 11 10 13 10 Q 15 12 15 16 Q 13 18 11 14 Z",
  k: "M 12 22 Q 8 22 8 16 Q 10 12 12 8 Q 14 12 16 16 Q 16 22 12 22 Z M 10 16 Q 10 12 12 10 Q 14 10 14 12 Q 12 16 10 16 Z M 11 8 Q 11 6 13 6 Q 15 6 15 8 Q 13 10 11 8 Z",
};

const PIECE_FILLS: Record<PieceColor, string> = {
  w: "#f0d9b5",
  b: "#b58863",
};

const PIECE_STROKES: Record<PieceColor, string> = {
  w: "#d4c4a8",
  b: "#8b5a3b",
};

export function Piece({
  type,
  color,
  size = 48,
  className = "",
  draggable = false,
  onDragStart,
  onDragEnd,
}: PieceProps) {
  const fill = PIECE_FILLS[color];
  const stroke = PIECE_STROKES[color];
  const isDark = color === "b";

  return (
    <svg
      role="img"
      aria-label={`${isDark ? "hitam" : "putih"} ${type}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: draggable ? "none" : "auto",
      }}
    >
      <defs>
        <linearGradient
          id={`piece-gradient-${type}-${color}`}
          x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isDark ? "#4a3f35" : "#e8e4d8"} stopOpacity={0.9} />
          <stop offset="100%" stopColor={isDark ? "#262421" : "#f0d9b5"} stopOpacity={0.9} />
        </linearGradient>
        <filter id={`piece-shadow-${color}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity={0.4} />
        </filter>
      </defs>
      <path
        d={PIECE_PATHS[type]}
        fill={`url(#piece-gradient-${type}-${color})`}
        stroke={stroke}
        strokeWidth="1"
        strokeLinejoin="round"
        filter={`url(#piece-shadow-${color})`}
      />
    </svg>
  );
}
