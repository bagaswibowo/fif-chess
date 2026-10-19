"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconTrophy3D, IconSkull3D, IconBalance3D, IconFlag3D, IconClock3D } from "@/components/icons3d";
import { Confetti } from "@/components/confetti";
import type { GameOutcome, Side } from "@/lib/chess";
import type { PlayerGameSummary } from "@/lib/caps-evaluator";

type Props = {
  outcome: GameOutcome;
  humanSide: Side;
  lang?: "id" | "en";
  open: boolean;
  onClose: () => void;
  onNewGame: () => void;
  onExportPgn?: () => void;
  onReview?: () => void;
  history?: string[];
};

export function GameOverModal({
  outcome,
  humanSide,
  lang = "id",
  open,
  onClose,
  onNewGame,
  onExportPgn,
  onReview,
  history = [],
}: Props) {
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [whiteCaps, setWhiteCaps] = useState<PlayerGameSummary | null>(null);
  const [blackCaps, setBlackCaps] = useState<PlayerGameSummary | null>(null);

  useEffect(() => {
    if (!open || history.length === 0) return;
    let active = true;
    setAnalysisLoading(true);

    fetch("/api/twirp/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.white && data.black) {
          setWhiteCaps(data.white);
          setBlackCaps(data.black);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAnalysisLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, history]);

  if (!open || !outcome.over) return null;

  const isWin = outcome.winner === humanSide;
  const isDraw = outcome.over && !outcome.winner;
  const isLoss = outcome.winner && outcome.winner !== humanSide;

  const playerSummary = humanSide === "white" ? whiteCaps : blackCaps;
  const opponentSummary = humanSide === "white" ? blackCaps : whiteCaps;

  return (
    <>
      {isWin && <Confetti />}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl bg-neutral-900 border-2 border-neutral-800 shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
          {/* Header 3D Icon */}
          <div className="flex justify-center pt-1">
            {isWin && (
              <div className="relative">
                <div className="absolute -inset-3 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                <IconTrophy3D size={64} />
              </div>
            )}
            {isLoss && outcome.kind === "checkmate" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-rose-600/30 rounded-full blur-xl animate-pulse" />
                <IconSkull3D size={64} />
              </div>
            )}
            {isLoss && outcome.kind === "resigned" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-neutral-400/20 rounded-full blur-xl animate-pulse" />
                <IconFlag3D size={64} />
              </div>
            )}
            {isLoss && outcome.kind === "timeout" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                <IconClock3D size={64} />
              </div>
            )}
            {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-rose-600/20 rounded-full blur-xl animate-pulse" />
                <IconSkull3D size={64} />
              </div>
            )}
            {isDraw && (
              <div className="relative">
                <div className="absolute -inset-3 bg-blue-500/20 rounded-full blur-xl" />
                <IconBalance3D size={64} />
              </div>
            )}
          </div>

          {/* Title & Status */}
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {isWin && (lang === "id" ? "Kemenangan Gemilang!" : "Victory!")}
              {isLoss && outcome.kind === "checkmate" && (lang === "id" ? "Skakmat — Raja Tumbang!" : "Checkmate — Defeat!")}
              {isLoss && outcome.kind === "resigned" && (lang === "id" ? "Menyerah — Permainan Berakhir" : "Resigned — Game Over")}
              {isLoss && outcome.kind === "timeout" && (lang === "id" ? "Waktu Berpikir Habis" : "Time Out")}
              {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && (lang === "id" ? "Kekalahan" : "Defeat")}
              {isDraw && (lang === "id" ? "Pertandingan Remis" : "Draw Game")}
            </h2>

            <p className="text-xs sm:text-sm text-neutral-300">
              {isWin && (lang === "id" ? "Selamat! Anda berhasil menumbangkan pertahanan lawan." : "Congratulations! You defeated your opponent.")}
              {isLoss && outcome.kind === "checkmate" && (lang === "id" ? "Raja Anda telah ditumbangkan mutlak dalam pertempuran ini." : "Your king has fallen in checkmate.")}
              {isLoss && outcome.kind === "resigned" && (lang === "id" ? "Anda telah memutuskan untuk menyerah dalam babak ini." : "You have resigned this game.")}
              {isLoss && outcome.kind === "timeout" && (lang === "id" ? "Waktu pada jam Anda telah habis." : "You ran out of time.")}
              {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && outcome.label}
              {isDraw && outcome.label}
            </p>
          </div>

          {/* CAPS Accuracy Score Card (Chess.com Style) */}
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
              <span>{lang === "id" ? "Akurasi Langkah (CAPS)" : "Accuracy (CAPS)"}</span>
              {analysisLoading && <span className="text-[10px] text-amber-400 animate-pulse">Kalkulasi Stockfish...</span>}
            </div>

            {playerSummary && opponentSummary ? (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                  <div className="text-[11px] text-neutral-400">{lang === "id" ? "Anda" : "You"}</div>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {playerSummary.accuracy}%
                  </div>
                  <div className="text-[10px] text-neutral-400 flex justify-center gap-1 mt-0.5">
                    {playerSummary.brilliantCount > 0 && <span className="text-cyan-400 font-bold">!! {playerSummary.brilliantCount}</span>}
                    <span className="text-emerald-400">✓ {playerSummary.bestCount}</span>
                    {playerSummary.blunderCount > 0 && <span className="text-rose-400 font-bold">?? {playerSummary.blunderCount}</span>}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                  <div className="text-[11px] text-neutral-400">{lang === "id" ? "Lawan" : "Opponent"}</div>
                  <div className="text-lg font-black text-neutral-200 font-mono">
                    {opponentSummary.accuracy}%
                  </div>
                  <div className="text-[10px] text-neutral-400 flex justify-center gap-1 mt-0.5">
                    {opponentSummary.brilliantCount > 0 && <span className="text-cyan-400 font-bold">!! {opponentSummary.brilliantCount}</span>}
                    <span className="text-emerald-400">✓ {opponentSummary.bestCount}</span>
                    {opponentSummary.blunderCount > 0 && <span className="text-rose-400 font-bold">?? {opponentSummary.blunderCount}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2 text-xs text-neutral-400 font-mono">
                {analysisLoading ? "Menganalisis kualitas langkah..." : "Siap untuk review akurasi"}
              </div>
            )}
          </div>

          {/* ELO Rating Adjustment Card */}
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-neutral-400 font-semibold">
              {lang === "id" ? "Penyesuaian Rating ELO:" : "Rating Adjustment:"}
            </span>
            {isWin && (
              <Badge className="bg-emerald-600 text-white font-mono font-bold text-xs px-2.5 py-0.5">
                +16 ELO
              </Badge>
            )}
            {isLoss && (
              <Badge className="bg-rose-600 text-white font-mono font-bold text-xs px-2.5 py-0.5">
                -10 ELO
              </Badge>
            )}
            {isDraw && (
              <Badge variant="outline" className="border-neutral-600 text-neutral-300 font-mono text-xs px-2.5 py-0.5">
                +0 ELO
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              onClick={() => {
                onClose();
                onNewGame();
              }}
              className="ctl ctl-primary flex-1"
            >
              {lang === "id" ? "Main Lagi" : "Play Again"}
            </Button>
            {onReview && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onReview();
                }}
                className="border-amber-500/50 hover:bg-amber-500/10 text-amber-400 text-xs sm:text-sm font-semibold"
              >
                {lang === "id" ? "Tinjau Game (Review)" : "Game Review"}
              </Button>
            )}
            {onExportPgn && (
              <Button
                variant="outline"
                onClick={onExportPgn}
                className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs sm:text-sm font-semibold"
              >
                PGN
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
