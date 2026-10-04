"use client";

import React from "react";
import { IconSwap3D } from "@/components/icons3d";
import { Maximize2, Minimize2 } from "lucide-react";

export interface BoardControlsProps {
  orientation: "white" | "black";
  onFlipOrientation: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  variant?: "toolbar" | "dock" | "compact";
  showShortcuts?: boolean;
  flipLabel?: string;
  fullscreenLabel?: string;
  className?: string;
  extra?: React.ReactNode;
}

export function BoardControls({
  orientation,
  onFlipOrientation,
  isFullscreen = false,
  onToggleFullscreen,
  variant = "toolbar",
  showShortcuts = true,
  flipLabel = "Putar Papan",
  fullscreenLabel = "Fokus 1 Layar",
  className = "",
  extra,
}: BoardControlsProps) {
  const currentSideLabel = orientation === "white" ? "Putih Bawah" : "Hitam Bawah";

  if (variant === "dock") {
    return (
      <div className={`w-full space-y-2 ${className}`}>
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            type="button"
            onClick={onFlipOrientation}
            className="h-10 px-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
            title={`Putar Orientasi Papan (${currentSideLabel})${showShortcuts ? " [Z]" : ""}`}
            aria-label={`Putar Orientasi Papan (${currentSideLabel})`}
          >
            <IconSwap3D size={16} />
            <span className="truncate">{flipLabel}</span>
            {showShortcuts && (
              <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-neutral-800 text-[11px] text-neutral-300 font-mono border border-neutral-700">
                Z
              </kbd>
            )}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`h-10 px-3 rounded-xl text-white flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md active:scale-[0.98] ${
                isFullscreen
                  ? "bg-red-950/80 border border-red-500/50 text-red-200 hover:bg-red-900 shadow-red-950/40"
                  : "bg-[var(--primary)] hover:opacity-90 text-white border border-[var(--primary)] shadow-sm"
              }`}
              title={isFullscreen ? "Keluar Layar Penuh (Esc)" : `${fullscreenLabel}${showShortcuts ? " [F]" : ""}`}
              aria-label={isFullscreen ? "Keluar Layar Penuh" : fullscreenLabel}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="truncate">{isFullscreen ? "Keluar Fokus" : fullscreenLabel}</span>
              {showShortcuts && (
                <kbd
                  className={`hidden sm:inline px-1.5 py-0.5 rounded text-[11px] font-mono border ${
                    isFullscreen
                      ? "bg-red-900/60 text-red-200 border-red-500/40"
                      : "bg-black/25 text-white border-white/20"
                  }`}
                >
                  {isFullscreen ? "Esc" : "F"}
                </kbd>
              )}
            </button>
          )}
        </div>
        {extra}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={onFlipOrientation}
          className="ctl ctl-sm bg-[var(--surface)] px-3 text-xs text-neutral-200"
          title={`Putar orientasi papan (${currentSideLabel})${showShortcuts ? " [Z]" : ""}`}
          aria-label={`Putar orientasi papan (${currentSideLabel})`}
        >
          <IconSwap3D size={14} />
          <span className="hidden sm:inline">Putar Papan</span>
          {showShortcuts && <kbd className="hidden lg:inline text-[10px]">Z</kbd>}
        </button>
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`ctl ctl-sm px-3 text-xs ${isFullscreen ? "bg-red-950/80 text-red-200" : "ctl-primary text-white"}`}
            title={isFullscreen ? "Keluar fokus (Esc)" : `Fokus 1 layar${showShortcuts ? " [F]" : ""}`}
            aria-label={isFullscreen ? "Keluar fokus" : "Fokus 1 layar"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? "Keluar Fokus" : "Fokus 1 Layar"}</span>
            {showShortcuts && <kbd className="hidden lg:inline text-[10px]">{isFullscreen ? "Esc" : "F"}</kbd>}
          </button>
        )}
      </div>
    );
  }

  // variant === "toolbar" (Sleek horizontal toolbar outside the board)
  return (
    <div className={`flex items-center gap-2 px-2.5 py-2 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm shrink-0 ${className}`}>
      <div className="flex-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onFlipOrientation}
          className="h-10 px-3 rounded-xl text-xs font-bold bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
          title={`Putar Orientasi Papan (${currentSideLabel})${showShortcuts ? " [Z]" : ""}`}
          aria-label={`Putar Orientasi Papan (${currentSideLabel})`}
        >
          <IconSwap3D size={16} />
          <span className="truncate">{flipLabel}</span>
          {showShortcuts && (
            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-300 font-mono border border-neutral-700">
              Z
            </kbd>
          )}
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] ${
              isFullscreen
                ? "bg-red-950/80 border border-red-500/50 text-red-200 hover:bg-red-900"
                : "bg-[var(--primary)] text-white hover:opacity-90 border border-[var(--primary)]"
            }`}
            title={isFullscreen ? "Keluar Layar Penuh (Esc)" : `${fullscreenLabel}${showShortcuts ? " [F]" : ""}`}
            aria-label={isFullscreen ? "Keluar Layar Penuh" : fullscreenLabel}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="truncate">{isFullscreen ? "Keluar Fokus" : fullscreenLabel}</span>
            {showShortcuts && (
              <kbd className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/25 text-white border border-white/20">
                {isFullscreen ? "Esc" : "F"}
              </kbd>
            )}
          </button>
        )}
      </div>
      {extra}
    </div>
  );
}
