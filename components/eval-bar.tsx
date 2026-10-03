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

function getSegmentText(isWhiteOrientation: boolean, isWhiteAhead: boolean, label: string, isTop: boolean) {
  if (label === "0.0") return "";
  if (isTop) {
    return isWhiteOrientation ? (!isWhiteAhead ? label : "") : (isWhiteAhead ? label : "");
  }
  return isWhiteOrientation ? (isWhiteAhead ? label : "") : (!isWhiteAhead ? label : "");
}

/**
 * Vertical Dual Black/White Eval Bar for all chessboards.
 * Dynamically moves when a piece is captured, a player gains advantage,
 * or engine evaluation changes.
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

  const topText = getSegmentText(isWhiteOrientation, isWhiteAhead, label, true);
  const bottomText = getSegmentText(isWhiteOrientation, isWhiteAhead, label, false);

  return (
    <div
      className={`w-3 md:w-3.5 bg-neutral-900 rounded-full overflow-hidden border border-[var(--border)] flex flex-col justify-between shrink-0 shadow-inner relative select-none group ${className}`}
      title={`Evaluasi: ${label} (${isWhiteAhead ? "Putih Unggul" : label === "0.0" ? "Seimbang" : "Hitam Unggul"})`}
      aria-label={`Evaluasi ${label}`}
    >
      {/* Top Half */}
      <div
        className={`w-full transition-all duration-300 ease-out ${topColor} relative flex items-start justify-center overflow-hidden`}
        style={{ height: `${topHeight}%` }}
      >
        {topHeight > 25 && topText && (
          <span
            className={`text-[9px] font-black font-mono pt-1 leading-none ${
              isWhiteOrientation ? "text-neutral-400" : "text-neutral-800"
            }`}
          >
            {topText}
          </span>
        )}
      </div>

      {/* Dividing Baseline Indicator */}
      <div className="w-full h-[1.5px] bg-neutral-600/60 shrink-0 z-10" />

      {/* Bottom Half */}
      <div
        className={`w-full transition-all duration-300 ease-out ${bottomColor} relative flex items-end justify-center overflow-hidden`}
        style={{ height: `${bottomHeight}%` }}
      >
        {bottomHeight > 25 && bottomText && (
          <span
            className={`text-[9px] font-black font-mono pb-1 leading-none ${
              isWhiteOrientation ? "text-neutral-800" : "text-neutral-400"
            }`}
          >
            {bottomText}
          </span>
        )}
      </div>
    </div>
  );
}
export { calculateMaterialCp };
