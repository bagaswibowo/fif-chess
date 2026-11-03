"use client";

import React from "react";
import { User, Bot } from "lucide-react";

export interface PlayerStripProps {
  name: string;
  rating: string | number;
  title?: string;
  isBot?: boolean;
  materialDiff?: number;
  clockFormatted: string;
  isCriticalTime?: boolean;
  isActiveTurn?: boolean;
  capturedElements?: React.ReactNode;
  className?: string;
}

export function PlayerStrip({
  name,
  rating,
  title,
  isBot = false,
  materialDiff = 0,
  clockFormatted,
  isCriticalTime = false,
  isActiveTurn = false,
  capturedElements,
  className = "",
}: PlayerStripProps) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 rounded-lg bg-neutral-900/90 border transition-all duration-200 ${
        isActiveTurn
          ? "border-amber-500/60 ring-1 ring-amber-500/30 bg-neutral-900 shadow-sm"
          : "border-neutral-800/80"
      } ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
            isBot
              ? "bg-purple-950/60 border-purple-800/50 text-purple-300"
              : "bg-neutral-800 border-neutral-700 text-neutral-300"
          }`}
        >
          {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          {title && (
            <span className="bg-amber-600 text-white text-[9px] font-black uppercase px-1 py-0.5 rounded leading-none">
              {title}
            </span>
          )}
          <span className="text-xs font-semibold text-neutral-100 truncate max-w-[110px] sm:max-w-[160px]">
            {name}
          </span>
          <span className="text-[11px] font-mono text-neutral-400 shrink-0">
            ({rating})
          </span>
          {materialDiff > 0 && (
            <span className="text-[11px] font-mono font-bold text-amber-400 shrink-0">
              +{materialDiff}
            </span>
          )}
        </div>

        {capturedElements && (
          <div className="hidden sm:flex items-center gap-0.5 ml-2 overflow-hidden">
            {capturedElements}
          </div>
        )}
      </div>

      <div
        className={`font-mono text-xs sm:text-sm font-black px-2.5 py-1 rounded-md border transition-all ${
          isCriticalTime
            ? "bg-red-500/20 text-red-400 border-red-500 shadow-md animate-pulse ring-1 ring-red-400/50"
            : isActiveTurn
            ? "bg-white text-black border-white shadow-md"
            : "bg-[#181715] text-[#989795] border-[#363431]"
        }`}
      >
        {clockFormatted}
      </div>
    </div>
  );
}
