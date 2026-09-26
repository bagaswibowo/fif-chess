"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconTrophy3D, IconSkull3D, IconBalance3D, IconFlag3D, IconClock3D } from "@/components/icons3d";
import { Confetti } from "@/components/confetti";
import type { GameOutcome, Side } from "@/lib/chess";

type Props = {
  outcome: GameOutcome;
  humanSide: Side;
  lang?: "id" | "en";
  open: boolean;
  onClose: () => void;
  onNewGame: () => void;
};

export function GameOverModal({
  outcome,
  humanSide,
  lang = "id",
  open,
  onClose,
  onNewGame,
}: Props) {
  if (!open || !outcome.over) return null;

  const isWin = outcome.winner === humanSide;
  const isDraw = outcome.over && !outcome.winner;
  const isLoss = outcome.winner && outcome.winner !== humanSide;

  return (
    <>
      {isWin && <Confetti />}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl bg-[#262421] border-2 border-[#3d3a37] shadow-2xl p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
          {/* Visual Header with distinct 3D icons */}
          <div className="flex justify-center pt-2">
            {isWin && (
              <div className="relative">
                <div className="absolute -inset-3 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                <IconTrophy3D size={72} />
              </div>
            )}
            {isLoss && outcome.kind === "checkmate" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-rose-600/30 rounded-full blur-xl animate-pulse" />
                <IconSkull3D size={72} />
              </div>
            )}
            {isLoss && outcome.kind === "resigned" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-neutral-400/20 rounded-full blur-xl animate-pulse" />
                <IconFlag3D size={72} />
              </div>
            )}
            {isLoss && outcome.kind === "timeout" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                <IconClock3D size={72} />
              </div>
            )}
            {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-rose-600/20 rounded-full blur-xl animate-pulse" />
                <IconSkull3D size={72} />
              </div>
            )}
            {isDraw && (
              <div className="relative">
                <div className="absolute -inset-3 bg-blue-500/20 rounded-full blur-xl" />
                <IconBalance3D size={72} />
              </div>
            )}
          </div>

          {/* Title & Status: Jangan tampilkan Skakmat jika Menyerah */}
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-wide">
              {isWin && (lang === "id" ? "Kemenangan Gemilang!" : "Victory!")}
              {isLoss && outcome.kind === "checkmate" && (lang === "id" ? "Skakmat — Raja Tumbang!" : "Checkmate — Defeat!")}
              {isLoss && outcome.kind === "resigned" && (lang === "id" ? "Menyerah — Permainan Berakhir" : "Resigned — Game Over")}
              {isLoss && outcome.kind === "timeout" && (lang === "id" ? "Waktu Berpikir Habis" : "Time Out")}
              {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && (lang === "id" ? "Kekalahan" : "Defeat")}
              {isDraw && (lang === "id" ? "Pertandingan Remis" : "Draw Game")}
            </h2>

            <p className="text-sm text-neutral-300">
              {isWin && (lang === "id" ? "Selamat! Anda berhasil menumbangkan pertahanan lawan." : "Congratulations! You defeated your opponent.")}
              {isLoss && outcome.kind === "checkmate" && (lang === "id" ? "Raja Anda telah ditumbangkan mutlak dalam pertempuran ini." : "Your king has fallen in checkmate.")}
              {isLoss && outcome.kind === "resigned" && (lang === "id" ? "Anda telah memutuskan untuk menyerah dalam babak ini." : "You have resigned this game.")}
              {isLoss && outcome.kind === "timeout" && (lang === "id" ? "Waktu pada jam Anda telah habis." : "You ran out of time.")}
              {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && outcome.label}
              {isDraw && outcome.label}
            </p>
          </div>

          {/* ELO Rating Adjustment Card */}
          <div className="bg-[#1f1d1a] border border-[#36322d] rounded-xl p-3.5 flex items-center justify-between text-xs">
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
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              onClick={() => {
                onClose();
                onNewGame();
              }}
              className="ctl ctl-primary flex-1"
            >
              {lang === "id" ? "Main Lagi" : "Play Again"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-[#3d3a37] hover:bg-[#36322d] text-neutral-300 text-sm font-semibold"
            >
              {lang === "id" ? "Tinjau Papan" : "Review Board"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
