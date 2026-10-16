"use client";
import React, { useState, useEffect } from "react";

export type BoardThemeId =
  | "wood"
  | "green"
  | "ocean"
  | "slate"
  | "cyber"
  | "ruby"
  | "amethyst"
  | "noir"
  | "amber";

export type PieceThemeId = "standard" | "staunty" | "chessnut" | "classic3d";

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  dark: string;
  light: string;
  accent: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "wood", name: "Walnut Wood", dark: "#b58863", light: "#f0d9b5", accent: "#81b64c" },
  { id: "green", name: "Turnamen Hijau", dark: "#769656", light: "#eeeed2", accent: "#a3e635" },
  { id: "ocean", name: "Biru Samudera", dark: "#4b7399", light: "#eae9d2", accent: "#38bdf8" },
  { id: "slate", name: "Dark Charcoal", dark: "#334155", light: "#64748b", accent: "#94a3b8" },
  { id: "cyber", name: "Cyberpunk Teal", dark: "#115e59", light: "#5eead4", accent: "#2dd4bf" },
  { id: "ruby", name: "Ruby Crimson", dark: "#881337", light: "#fecdd3", accent: "#fb7185" },
  { id: "amethyst", name: "Amethyst Ungu", dark: "#581c87", light: "#e9d5ff", accent: "#c084fc" },
  { id: "noir", name: "Monochrome Noir", dark: "#262626", light: "#e5e5e5", accent: "#ffffff" },
  { id: "amber", name: "Amber Emas", dark: "#92400e", light: "#fef3c7", accent: "#f59e0b" },
];

export const PIECE_THEMES: { id: PieceThemeId; name: string; desc: string }[] = [
  { id: "standard", name: "Vector 2D", desc: "Standar Lichess (SVG)" },
  { id: "staunty", name: "Staunton 3D", desc: "Kayu & Akrilik Realistis" },
  { id: "chessnut", name: "Chessnut 3D", desc: "Geometris Modern Solid" },
  { id: "classic3d", name: "Studio Render 3D", desc: "Render Studio Mengkilap" },
];

const PIECE_TYPES = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];

export function getCustomPieces(pieceTheme: PieceThemeId): any {
  if (pieceTheme === "standard") return undefined;
  const pieces: Record<string, (props?: any) => React.ReactElement> = {};
  for (const p of PIECE_TYPES) {
    pieces[p] = (props?: any) =>
      React.createElement("img", {
        src: `/pieces/${pieceTheme}/${p}.png`,
        alt: p,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
          userSelect: "none",
          pointerEvents: "none",
          ...props?.svgStyle,
        },
        draggable: false,
      });
  }
  return pieces;
}

export function getNotationStyles(theme: BoardTheme) {
  return {
    showNotation: true,
    numericNotationStyle: {
      fontSize: "13px",
      fontWeight: "800",
      top: "4px",
      left: "6px",
      userSelect: "none" as const,
      lineHeight: "1",
      fontFamily: "ui-monospace, monospace",
          },
    alphaNotationStyle: {
      fontSize: "13px",
      fontWeight: "800",
      bottom: "4px",
      right: "6px",
      userSelect: "none" as const,
      lineHeight: "1",
      fontFamily: "ui-monospace, monospace",
          },
    darkSquareNotationStyle: {
      color: theme.light,
      fontWeight: "800",
      opacity: 0.95,
    },
    lightSquareNotationStyle: {
      color: theme.dark,
      fontWeight: "800",
      opacity: 0.95,
    },
  };
}

export function applyGlobalChessTheme(boardThemeId: BoardThemeId, pieceThemeId: PieceThemeId) {
  if (typeof window === "undefined") return;
  const board = BOARD_THEMES.find((t) => t.id === boardThemeId) || BOARD_THEMES[0];
  document.documentElement.style.setProperty("--board-dark", board.dark);
  document.documentElement.style.setProperty("--board-light", board.light);
  document.documentElement.style.setProperty("--board-mark", board.accent);
  try {
    localStorage.setItem("jev_board_theme", boardThemeId);
    localStorage.setItem("jev_piece_theme", pieceThemeId);
    window.dispatchEvent(new CustomEvent("jev:theme-change", { detail: { boardThemeId, pieceThemeId } }));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export function useChessTheme() {
  const [boardThemeId, setBoardThemeId] = useState<BoardThemeId>(() => {
    if (typeof window === "undefined") return "wood";
    try {
      const b = localStorage.getItem("jev_board_theme") as BoardThemeId;
      if (BOARD_THEMES.some((t) => t.id === b)) return b;
    } catch {}
    return "wood";
  });
  const [pieceThemeId, setPieceThemeId] = useState<PieceThemeId>(() => {
    if (typeof window === "undefined") return "standard";
    try {
      const p = localStorage.getItem("jev_piece_theme") as PieceThemeId;
      if (PIECE_THEMES.some((t) => t.id === p)) return p;
    } catch {}
    return "standard";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => {
      try {
        const b = (localStorage.getItem("jev_board_theme") as BoardThemeId) || "wood";
        const p = (localStorage.getItem("jev_piece_theme") as PieceThemeId) || "standard";
        if (BOARD_THEMES.some((t) => t.id === b)) setBoardThemeId(b);
        if (PIECE_THEMES.some((t) => t.id === p)) setPieceThemeId(p);
        const board = BOARD_THEMES.find((t) => t.id === b) || BOARD_THEMES[0];
        document.documentElement.style.setProperty("--board-dark", board.dark);
        document.documentElement.style.setProperty("--board-light", board.light);
        document.documentElement.style.setProperty("--board-mark", board.accent);
      } catch {}
    };

    load();
    window.addEventListener("storage", load);
    window.addEventListener("jev:theme-change", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("jev:theme-change", load);
    };
  }, []);

  const boardTheme = BOARD_THEMES.find((t) => t.id === boardThemeId) || BOARD_THEMES[0];
  const customPieces = getCustomPieces(pieceThemeId);
  const notationStyles = getNotationStyles(boardTheme);

  return {
    boardThemeId,
    pieceThemeId,
    boardTheme,
    customPieces,
    notationStyles,
    setTheme: applyGlobalChessTheme,
  };
}
