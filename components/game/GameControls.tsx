"use client";

/**
 * GameControls.tsx
 * Flip board, resign, offer draw, rematch buttons.
 * Follows jev-chess design system (charcoal surface, primary green accent).
 */

import React from "react";
import { Maximize2, Minimize2, RotateCcw, Flag, Hand, RefreshCw } from "lucide-react";

export interface GameControlsProps {
  orientation: "white" | "black";
  onFlipOrientation: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onRematch: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  className?: string;
}

export function GameControls({
  orientation,
  onFlipOrientation,
  onResign,
  onOfferDraw,
  onRematch,
  isFullscreen = false,
  onToggleFullscreen,
  className = "",
}: GameControlsProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row gap-2 px-3 py-2 bg-[#262421] rounded-xl border border-[#3d3a34] shadow-sm ${className}`}
    >
      <div className="flex-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onFlipOrientation}
          className="h-10 px-3 rounded-xl text-xs font-bold bg-[#211f1d] hover:bg-[#262421] border border-[#3d3a34] text-neutral-200 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          title="Putar orientasi papan (Z)"
          aria-label="Putar orientasi papan"
        >
          <RotateCcw size={16} />
          <span className="hidden sm:inline">Putar Papan</span>
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] ${
              isFullscreen
                ? "bg-red-950/80 border border-red-500/50 text-red-200 hover:bg-red-900"
                : "bg-[#211f1d] hover:bg-[#262421] border border-[#3d3a34] text-neutral-200 hover:text-white"
            }`}
            title={isFullscreen ? "Keluar layar penuh (Esc)" : "Fokus 1 layar (F)"}
            aria-label={isFullscreen ? "Keluar layar penuh" : "Fokus 1 layar"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden sm:inline">
              {isFullscreen ? "Keluar Fokus" : "Fokus Layar"}
            </span>
          </button>
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2 mt-2 sm:mt-0">
        <button
          type="button"
          onClick={onResign}
          className="h-10 rounded-xl text-xs font-bold bg-red-950/80 border border-red-800/60 text-red-200 hover:bg-red-900 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          title="Serahkan permainan"
          aria-label="Serahkan permainan"
        >
          <Flag size={16} />
          <span className="hidden sm:inline">Serah</span>
        </button>

        <button
          type="button"
          onClick={onOfferDraw}
          className="h-10 rounded-xl text-xs font-bold bg-[#211f1d] hover:bg-[#262421] border border-[#3d3a34] text-neutral-200 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          title="Tawar remis"
          aria-label="Tawar remis"
        >
          <Hand size={16} />
          <span className="hidden sm:inline">Remis</span>
        </button>
      </div>

      <div className="flex-1">
        <button
          type="button"
          onClick={onRematch}
          className="w-full h-10 rounded-xl text-xs font-bold bg-[#81b64c] text-white hover:bg-[#72a342] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          title="Main lagi"
          aria-label="Main lagi"
        >
          <RefreshCw size={16} />
          <span className="hidden sm:inline">Main Lagi</span>
        </button>
      </div>
    </div>
  );
}
