"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Maximize2, Minimize2 } from "lucide-react";
import type { GameRecord } from "@/lib/game-history";
import { IconHistory3D, IconAiBrain3D, IconCoach3D } from "@/components/icons3d";
import { EvalBar } from "@/components/board/eval-bar";
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const handleCopyPgn = () => {
    const white = game.humanSide === "white" ? authorUsername : game.opponent;
    const black = game.humanSide === "black" ? authorUsername : game.opponent;
    const result = game.outcomeKind === "win"
      ? (game.humanSide === "white" ? "1-0" : "0-1")
      : game.outcomeKind === "loss"
        ? (game.humanSide === "white" ? "0-1" : "1-0")
        : "1/2-1/2";

    const movePairs: string[] = [];
    for (let i = 0; i < movesList.length; i += 2) {
      const moveNo = Math.floor(i / 2) + 1;
      const w = movesList[i] || "";
      const b = movesList[i + 1] || "";
      if (b) movePairs.push(`${moveNo}. ${w} ${b}`);
      else if (w) movePairs.push(`${moveNo}. ${w}`);
    }

    const pgn = [
      `[Event "Partai Komunitas FIF Chess"]`,
      `[Site "Telkom University (FIF)"]`,
      `[White "${white}"]`,
      `[Black "${black}"]`,
      `[Result "${result}"]`,
      "",
      `${movePairs.join(" ")} ${result}`,
    ].join("\n");

    navigator.clipboard.writeText(pgn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeStyle = (type?: string) => {
    switch (type) {
      case "best":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "good":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "inaccuracy":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "mistake":
        return "bg-orange-500/20 text-orange-300 border-orange-500/40";
      case "blunder":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      default:
        return "bg-neutral-800 text-neutral-300 border-neutral-700";
    }
  };

  const getBadgeLabel = (type?: string) => {
    switch (type) {
      case "best":
        return "🎯 LANGKAH TERBAIK";
      case "good":
        return "👍 LANGKAH BAGUS";
      case "inaccuracy":
        return "⚠️ KURANG AKURAT";
      case "mistake":
        return "❓ KESALAHAN";
      case "blunder":
        return "❌ BLUNDER";
      default:
        return "LANGKAH PERMAINAN";
    }
  };

  const content = (
    <div className={`stack-tight ${isFullscreen ? "w-full max-w-5xl h-full flex flex-col justify-between" : ""}`}>
      {/* Header bar */}
      <div className="row-between pb-1.5 border-b border-[var(--border)] gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <IconHistory3D size={18} />
          <span className="font-bold text-sm text-white truncate">
            Partai Lampiran: {authorUsername} ({game.humanSide === "white" ? "Putih" : "Hitam"}) vs {game.opponent}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="ctl ctl-sm font-bold text-xs"
            style={{
              borderColor: game.outcomeKind === "win" ? "var(--primary)" : game.outcomeKind === "loss" ? "var(--destructive)" : "var(--warning)",
              color: game.outcomeKind === "win" ? "var(--primary)" : game.outcomeKind === "loss" ? "var(--destructive)" : "var(--warning)",
            }}
          >
            {game.outcomeKind === "win" ? "Menang" : game.outcomeKind === "loss" ? "Kalah" : "Remis"} ({game.moves.length} langkah)
          </span>
          <button
            type="button"
            onClick={handleCopyPgn}
            className="px-2 py-1 rounded text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-[var(--border)] transition-colors cursor-pointer"
            title="Salin PGN lengkap"
          >
            {copied ? "✓ Tersalin" : "📋 PGN"}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-[var(--border)] transition-colors cursor-pointer"
            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh (Full Screen)"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Accuracy & Analysis Summary Bar */}
      <div className="p-2 rounded-lg border border-[var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="row-between flex-wrap gap-1.5 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <IconAiBrain3D size={16} />
            <span className="font-bold text-white">Akurasi {analysis.accuracy}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <span className="text-red-400">{analysis.blunders} Blunder</span>
            <span className="text-orange-400">{analysis.mistakes} Kesalahan</span>
            <span className="text-yellow-400">{analysis.missedWins} Terlewat</span>
          </div>
        </div>
      </div>

      {/* Main Arena: EvalBar + Board + Coach Feedback */}
      <div className={`grid ${isFullscreen ? "grid-cols-1 md:grid-cols-12 gap-6 items-center flex-1 min-h-0" : "grid-cols-1 lg:grid-cols-12 gap-3 items-center"} pt-1`}>
        {/* Left: EvalBar & Board */}
        <div className={`${isFullscreen ? "md:col-span-7" : "lg:col-span-7"} flex justify-center items-center gap-2 w-full`}>
          <div className="h-[280px] sm:h-[340px] md:h-[380px] shrink-0">
            <EvalBar fen={currentFen} orientation={game.humanSide} className="w-3.5 sm:w-4.5 h-full rounded-lg" />
          </div>
          <div className="aspect-square w-full max-w-[280px] sm:max-w-[340px] md:max-w-[380px] rounded-xl overflow-hidden border border-[var(--border)] shadow-lg bg-neutral-900">
            <Chessboard
              options={{
                id: `forum-board-${game.id}-${isFullscreen ? "fs" : "norm"}`,
                position: currentFen,
                boardOrientation: game.humanSide,
                allowDragging: false,
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
              }}
            />
          </div>
        </div>

        {/* Right: AI Coach Analysis & Controls */}
        <div className={`${isFullscreen ? "md:col-span-5" : "lg:col-span-5"} flex flex-col justify-between gap-2.5 h-full`}>
          {/* AI Coach Feedback Card */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <IconCoach3D size={18} />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Analisis Pelatih AI</span>
              </div>
              {activeFeedback && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeStyle(activeFeedback.type)}`}>
                  {getBadgeLabel(activeFeedback.type)}
                </span>
              )}
            </div>

            <div className="min-h-14 flex flex-col justify-center">
              {activeFeedback ? (
                <div className="space-y-1">
                  <div className="font-mono text-xs font-bold text-white">
                    Langkah #{activeFeedback.ply}: {activeFeedback.san}
                  </div>
                  <p className="text-xs text-neutral-300 m-0 leading-relaxed">
                    {activeFeedback.commentary}
                  </p>
                </div>
              ) : (
                <div className="text-center text-xs text-neutral-400 italic py-2">
                  {currentStep === 0
                    ? "Posisi Awal Pertandingan — Tekan 'Putar' atau tombol panah untuk menganalisis setiap langkah."
                    : `Langkah #${currentStep}: ${movesList[currentStep - 1]}`}
                </div>
              )}
            </div>
          </div>

          {/* Clickable Moves Notation Pills */}
          <div className="p-2 rounded-xl bg-[var(--surface)]/70 border border-[var(--border)] max-h-28 overflow-y-auto custom-scrollbar font-mono text-[11px]">
            <div className="flex flex-wrap gap-1">
              {movesList.map((m, idx) => {
                const ply = idx + 1;
                const isSelected = ply === currentStep;
                const fb = analysis.moveFeedback.find((f) => f.ply === ply);
                return (
                  <button
                    key={ply}
                    type="button"
                    onClick={() => { setIsPlaying(false); setCurrentStep(ply); }}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--primary)] text-white font-bold ring-1 ring-[var(--primary)]"
                        : fb?.type === "blunder"
                          ? "bg-rose-950/60 text-rose-300 border border-rose-700/50"
                          : fb?.type === "best"
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-700/50"
                            : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                    }`}
                  >
                    {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ""}{m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setCurrentStep(0); }}
              className="ctl ctl-sm justify-center font-bold text-xs"
              title="Awal"
            >
              |&lt;&lt;
            </button>
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setCurrentStep((p) => Math.max(0, p - 1)); }}
              className="ctl ctl-sm justify-center font-bold text-xs"
              title="Mundur"
            >
              &lt;&lt;
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="ctl ctl-sm ctl-primary justify-center font-bold text-xs"
            >
              {isPlaying ? "Jeda" : "Putar"}
            </button>
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setCurrentStep((p) => Math.min(movesList.length, p + 1)); }}
              className="ctl ctl-sm justify-center font-bold text-xs"
              title="Maju"
            >
              &gt;&gt;
            </button>
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setCurrentStep(movesList.length); }}
              className="ctl ctl-sm justify-center font-bold text-xs"
              title="Akhir"
            >
              &gt;&gt;|
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 p-4 sm:p-6 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200">
        <div
          className="panel p-4 sm:p-6 rounded-2xl border border-[var(--primary)]/70 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
          style={{ background: "var(--card)" }}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className="panel p-3 my-2 rounded-xl border border-[var(--primary)]/60 stack-tight shadow-md"
      style={{ background: "var(--card)" }}
    >
      {content}
    </div>
  );
}
