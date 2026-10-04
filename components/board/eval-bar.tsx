"use client";

import React, { useMemo } from "react";
import { calculateMaterialCp } from "@/lib/chess";

interface EvalBarProps {
  fen: string;
  scoreCp?: number | null;
  orientation?: "white" | "black";
  className?: string;
}

export function calculateEvalMetrics(fen: string, scoreCp?: number | null) {
  const matCp = calculateMaterialCp(fen);
  const effectiveCp = typeof scoreCp === "number" && !isNaN(scoreCp) ? scoreCp : matCp;

  const clampedCp = Math.max(-1500, Math.min(1500, effectiveCp));
  const rawPct = Math.round(((Math.tanh(clampedCp / 600) + 1) / 2) * 100);
  const whitePct = Math.max(5, Math.min(95, rawPct));

  const absScore = (Math.abs(effectiveCp) / 100).toFixed(1);
  const isW = effectiveCp > 25;
  const isB = effectiveCp < -25;
  const displayLabel = isW ? `+${absScore}` : isB ? `-${absScore}` : "0.0";

  return {
    barPct: whitePct,
    label: displayLabel,
    isWhiteAhead: isW,
  };
}

function getBarGeometry(isWhiteOrientation: boolean, barPct: number) {
  return {
    topHeight: isWhiteOrientation ? 100 - barPct : barPct,
    bottomHeight: isWhiteOrientation ? barPct : 100 - barPct,
    topColor: isWhiteOrientation ? "bg-neutral-900" : "bg-neutral-100",
    bottomColor: isWhiteOrientation ? "bg-neutral-100" : "bg-neutral-900",
  };
}

/**
 * Vertical Dual Black/White Eval Bar with Score Badge for all chessboards.
 * Dynamically expands and contracts as pieces are captured or advantage shifts.
 */
export function EvalBar({
  fen,
  scoreCp,
  orientation = "white",
  className = "",
}: EvalBarProps) {
  const { barPct, label, isWhiteAhead } = useMemo(
    () => calculateEvalMetrics(fen, scoreCp),
    [fen, scoreCp],
  );

  const isWhiteOrientation = orientation === "white";
  const { topHeight, bottomHeight, topColor, bottomColor } = getBarGeometry(isWhiteOrientation, barPct);

  return (
    <div
      className={`flex flex-col items-center justify-between self-stretch shrink-0 py-0.5 select-none gap-1.5 w-6 md:w-7 ${className}`}
      title={`Evaluasi: ${label} (${isWhiteAhead ? "Putih Unggul" : label === "0.0" ? "Seimbang" : "Hitam Unggul"})`}
      aria-label={`Evaluasi ${label}`}
    >
      {/* Dynamic Score Points Badge (Always clearly visible: 0.0, +1.0, -3.2) */}
      <div
        className={`text-[10px] md:text-[11px] font-mono font-black px-0.5 py-0.5 rounded border border-neutral-700 bg-neutral-900 shadow-sm leading-none shrink-0 w-full text-center tracking-tighter ${
          isWhiteAhead ? "text-emerald-400" : label === "0.0" ? "text-neutral-400" : "text-sky-400"
        }`}
      >
        {label}
      </div>

      {/* Dual-Color Vertical Bar (Black & White) */}
      <div className="w-3.5 md:w-4 flex-1 h-full min-h-[220px] bg-neutral-900 rounded-full overflow-hidden border border-neutral-700 flex flex-col justify-between shadow-inner relative">
        {/* Top Segment */}
        <div
          className={`w-full transition-all duration-300 ease-out ${topColor}`}
          style={{ height: `${topHeight}%` }}
        />

        {/* Center Divider Baseline */}
        <div className="w-full h-[2px] bg-neutral-500/90 shrink-0 z-10 shadow-sm" />

        {/* Bottom Segment */}
        <div
          className={`w-full transition-all duration-300 ease-out ${bottomColor}`}
          style={{ height: `${bottomHeight}%` }}
        />
      </div>
    </div>
  );
}
export { calculateMaterialCp };
