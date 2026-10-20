"use client";

/**
 * GameView.tsx
 * Main game container: board + player strips + clock + move list + eval bar + controls.
 * Follows jev-chess design system: symmetric stage layout, rail eval left, board center, player strips top/bottom.
 */

import React, { useCallback, useMemo } from "react";
import { Chess } from "chess.js";
import {
  BoardProvider,
  useBoard,
  ChessBoard,
  PlayerStrip,
  EvalBar,
  GameClock,
  GameControls,
  MoveList,
} from "@/components";

export interface GameViewProps {
  whiteName: string;
  blackName: string;
  whiteRating?: number;
  blackRating?: number;
  initialFen?: string;
  onMove?: (san: string, fen: string) => void;
  onGameOver?: (result: string) => void;
  className?: string;
}

export function GameView({
  whiteName = "Putih",
  blackName = "Hitam",
  whiteRating = 1200,
  blackRating = 1200,
  initialFen,
  onMove,
  onGameOver,
  className = "",
}: {
  whiteName?: string;
  blackName?: string;
  whiteRating?: number;
  blackRating?: number;
  initialFen?: string;
  onMove?: (san: string, fen: string) => void;
  onGameOver?: (result: string) => void;
  className?: string;
}) {
  const [fen, setFen] = React.useState(initialFen ?? new Chess().fen());
  const [moveHistory, setMoveHistory] = React.useState<Array<{ ply: number; san: string; fen: string }>>([]);
  const [gameOver, setGameOver] = React.useState<boolean>(false);
  const [gameResult, setGameResult] = React.useState<string>("*");

  const chess = React.useMemo(() => new Chess(fen), [fen]);

  const handleBoardSquareClick = useCallback(
    (square: string) => {
      // Placeholder for selection/drag logic; wired to game engine later
      // eslint-disable-next-line no-console
      console.debug("[jev-chess] square clicked:", square);
    },
    []
  );

  const handlePieceDrag = useCallback(
    (from: string, to: string) => {
      const c = new Chess(fen);
      try {
        const mv = c.move({ from, to });
        if (mv) {
          setFen(c.fen());
          setMoveHistory((prev) => [
            ...prev,
            { ply: prev.length + 1, san: mv.san, fen: c.fen() },
          ]);
          onMove?.(mv.san, c.fen());
          if (c.isGameOver()) {
            setGameOver(true);
            setGameResult(c.isCheckmate() ? "checkmate" : c.isDraw() ? "draw" : "resign");
            onGameOver?.(c.isCheckmate() ? "checkmate" : c.isDraw() ? "draw" : "resign");
          }
        }
      } catch (err) {
        // invalid move — ignore
        // eslint-disable-next-line no-console
        console.debug("[jev-chess] invalid move:", err);
      }
    },
    [fen, onMove, onGameOver]
  );

  const sideToMove = chess.turn() === "w" ? "w" : "b";

  const latestMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;

  return (
    <BoardProvider initialOrientation="white">
      <div className={`relative min-h-[400px] flex flex-col sm:flex-row gap-4 p-4 sm:p-6 ${className}`}>
        {/* Left: Eval rail */}
        <EvalBar fen={fen} orientation="white" className="hidden sm:block self-stretch shrink-0" />

        {/* Center: Board */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <ChessBoard
            position={buildPositionMap(chess)}
            onSquareClick={handleBoardSquareClick}
            onPieceDrag={handlePieceDrag}
            squareSize={60}
            className="max-w-[560px] max-h-[560px]"
          />
        </div>

        {/* Right: Move list */}
        <MoveList
          moves={moveHistory.map((m, i) => ({
            ply: i + 1,
            san: m.san,
            uci: "",
            scoreCp: null,
            deltaCp: null,
            classification: i < 8 ? "book" : "good",
            isBestMove: true,
          }))}
          latestPly={latestMove?.ply ?? null}
          onSelect={() => {}}
          className="hidden sm:block"
        />
      </div>

      {/* Bottom: Player strips + clock + controls */}
      <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-4 sm:gap-6">
        <PlayerStrip
          name={whiteName}
          rating={whiteRating}
          clockFormatted="10:00"
          isActiveTurn={sideToMove === "w"}
          isCriticalTime={false}
        />
        <PlayerStrip
          name={blackName}
          rating={blackRating}
          clockFormatted="10:00"
          isActiveTurn={sideToMove === "b"}
          isCriticalTime={false}
        />
      </div>

      <div className="mt-3 sm:mt-4">
        <GameClock
          timeSeconds={600}
          isActive={!gameOver}
          className="w-full max-w-xs mx-auto"
        />
      </div>

      {gameOver && (
        <div className="mt-4 sm:mt-6 p-4 rounded-xl bg-red-950/20 border border-red-900/50 text-center">
          <h3 className="text-lg font-bold text-red-400 mb-1">
            Permainan Selesai
          </h3>
          <p className="text-neutral-300 text-sm">
            Hasil: {gameResult}
          </p>
        </div>
      )}

      <GameControls
        orientation="white"
        onFlipOrientation={() => {}}
        onResign={() => {}}
        onOfferDraw={() => {}}
        onRematch={() => {}}
      />
    </BoardProvider>
  );
}

function buildPositionMap(chess: Chess): Record<string, string> {
  const board = chess.board();
  const position: Record<string, string> = {};
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell) {
        const file = String.fromCharCode(97 + c);
        const rank = 8 - r;
        position[`${file}${rank}`] = `${cell.color === "w" ? "w" : "b"}${cell.type}`;
      }
    }
  }
  return position;
}
