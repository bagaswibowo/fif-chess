import React, { useState, useMemo, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import type { GameRecord } from "@/lib/game-history";
import { IconHistory3D, IconAiBrain3D } from "@/components/icons3d";
import { analyzeGameMoves } from "./game-evaluator";

export function EmbeddedMatchPlayer({
  game,
  authorUsername,
}: {
  game: GameRecord;
  authorUsername: string;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const movesList = useMemo(() => game.moves || [], [game.moves]);

  const currentFen = useMemo(() => {
    const c = new Chess();
    for (let i = 0; i < currentStep && i < movesList.length; i++) {
      try {
        c.move(movesList[i]);
      } catch {
        break;
      }
    }
    return c.fen();
  }, [movesList, currentStep]);

  const analysis = useMemo(() => {
    return analyzeGameMoves(movesList, game.humanSide);
  }, [movesList, game.humanSide]);

  const activeFeedback = useMemo(() => {
    if (currentStep === 0) return null;
    return analysis.moveFeedback.find((f) => f.ply === currentStep) || null;
  }, [analysis, currentStep]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= movesList.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, movesList.length]);

  return (
    <div
      className="panel p-3 my-2 rounded-xl border border-[var(--primary)]/60 stack-tight shadow-md"
      style={{ background: "var(--card)" }}
    >
      <div className="row-between pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <IconHistory3D size={16} />
          <span className="font-bold text-sm text-white">
            Partai Lampiran: {authorUsername} ({game.humanSide === "white" ? "Putih" : "Hitam"}) vs {game.opponent}
          </span>
        </div>
        <span
          className="ctl ctl-sm font-bold"
          style={{
            borderColor: game.outcomeKind === "win" ? "var(--primary)" : game.outcomeKind === "loss" ? "var(--destructive)" : "var(--warning)",
            color: game.outcomeKind === "win" ? "var(--primary)" : game.outcomeKind === "loss" ? "var(--destructive)" : "var(--warning)",
          }}
        >
          {game.outcomeKind === "win" ? "Menang" : game.outcomeKind === "loss" ? "Kalah" : "Remis"} ({game.moves.length} langkah)
        </span>
      </div>

      {/* Analysis Bar */}
      <div className="p-2 rounded-lg border border-[var(--border)] stack-tight" style={{ background: "var(--surface)" }}>
        <div className="row-between flex-wrap gap-1.5 text-sm">
          <div className="flex items-center gap-1.5">
            <IconAiBrain3D size={14} />
            <span className="font-bold text-white">Akurasi {analysis.accuracy}%</span>
          </div>
          <div className="row gap-2 text-sm font-bold">
            <span className="text-red-400">{analysis.blunders} Blunder</span>
            <span className="text-orange-400">{analysis.mistakes} Kesalahan</span>
            <span className="text-yellow-400">{analysis.missedWins} Terlewat</span>
          </div>
        </div>
      </div>

      {/* Compact Board & Step Feedback */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center pt-1">
        <div className="aspect-square max-w-[240px] mx-auto w-full rounded-xl overflow-hidden border border-[var(--border)] shadow-md">
          <Chessboard
            options={{
              id: `forum-board-${game.id}`,
              position: currentFen,
              boardOrientation: game.humanSide,
              allowDragging: false,
              darkSquareStyle: { backgroundColor: "var(--board-dark)" },
              lightSquareStyle: { backgroundColor: "var(--board-light)" },
            }}
          />
        </div>

        <div className="stack-tight justify-between h-full text-sm">
          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] min-h-16 stack-tight justify-center">
            {activeFeedback ? (
              <>
                <div className="row-between">
                  <span className="font-mono font-bold text-white">#{activeFeedback.ply}: {activeFeedback.san}</span>
                  <span className="text-sm font-bold text-[var(--primary)]">{activeFeedback.type.toUpperCase()}</span>
                </div>
                <p className="text-sm text-neutral-300 m-0">{activeFeedback.commentary}</p>
              </>
            ) : (
              <div className="text-center text-sm text-neutral-400 italic">
                {currentStep === 0 ? "Posisi Awal" : `Langkah #${currentStep}: ${movesList[currentStep - 1]}`}
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1 pt-1">
            <button onClick={() => { setIsPlaying(false); setCurrentStep(0); }} className="ctl ctl-sm justify-center font-bold" title="Awal">|&lt;&lt;</button>
            <button onClick={() => { setIsPlaying(false); setCurrentStep((p) => Math.max(0, p - 1)); }} className="ctl ctl-sm justify-center font-bold" title="Mundur">&lt;&lt;</button>
            <button onClick={() => setIsPlaying(!isPlaying)} className="ctl ctl-sm ctl-primary justify-center font-bold">{isPlaying ? "Jeda" : "Putar"}</button>
            <button onClick={() => { setIsPlaying(false); setCurrentStep((p) => Math.min(movesList.length, p + 1)); }} className="ctl ctl-sm justify-center font-bold" title="Maju">&gt;&gt;</button>
            <button onClick={() => { setIsPlaying(false); setCurrentStep(movesList.length); }} className="ctl ctl-sm justify-center font-bold" title="Akhir">&gt;&gt;|</button>
          </div>
        </div>
      </div>
    </div>
  );
}