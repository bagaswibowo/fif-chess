"use client";

import React from "react";
import { IconSwap3D } from "@/components/icons3d";
import { Maximize2, Minimize2, BookmarkPlus, Check } from "lucide-react";

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
  onSaveTrick?: () => void;
  trickSaved?: boolean;
  canSaveTrick?: boolean;
  trickLabel?: string;
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
  onSaveTrick,
  trickSaved = false,
  canSaveTrick = false,
  trickLabel = "Simpan Trik",
}: BoardControlsProps) {
  const currentSideLabel = orientation === "white" ? "Putih Bawah" : "Hitam Bawah";
  const hasTrickButton = typeof onSaveTrick === "function";

  if (variant === "dock") {
    return (
      <div className={`w-full space-y-2 ${className}`}>
        <div className={`grid ${hasTrickButton ? "grid-cols-3" : "grid-cols-2"} gap-2 w-full`}>
          <button
            type="button"
            onClick={onFlipOrientation}
            className="h-10 px-2 sm:px-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
            title={`Putar Orientasi Papan (${currentSideLabel})${showShortcuts ? " [Z]" : ""}`}
            aria-label={`Putar Orientasi Papan (${currentSideLabel})`}
          >
            <IconSwap3D size={16} />
            <span className="truncate">{flipLabel}</span>
            {showShortcuts && (
              <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-neutral-800 text-[11px] text-neutral-300 font-mono border border-neutral-700">
                Z
              </kbd>
            )}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`h-10 px-2 sm:px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-[0.98] ${
                isFullscreen
                  ? "bg-red-950/80 border border-red-500/50 text-red-200 hover:bg-red-900 shadow-red-950/40"
                  : "bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white"
              }`}
              title={isFullscreen ? "Keluar Layar Penuh (Esc)" : `${fullscreenLabel}${showShortcuts ? " [F]" : ""}`}
              aria-label={isFullscreen ? "Keluar Layar Penuh" : fullscreenLabel}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="truncate">{isFullscreen ? "Keluar Fokus" : fullscreenLabel}</span>
              {showShortcuts && (
                <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-neutral-800 text-[11px] text-neutral-300 font-mono border border-neutral-700">
                  {isFullscreen ? "Esc" : "F"}
                </kbd>
              )}
            </button>
          )}

          {hasTrickButton && (
            <button
              type="button"
              onClick={onSaveTrick}
              disabled={!canSaveTrick || trickSaved}
              className={`h-10 px-2 sm:px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-[0.98] ${
                trickSaved
                  ? "bg-emerald-950/80 border border-emerald-500 text-emerald-300 cursor-default"
                  : !canSaveTrick
                    ? "bg-[var(--surface)]/50 border border-[var(--border)] text-neutral-500 cursor-not-allowed opacity-60"
                    : "bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white hover:border-[var(--primary)]"
              }`}
              title={trickSaved ? "Trik tersimpan di Bank Teka-Teki" : "Simpan trik langkah lawan"}
            >
              {trickSaved ? <Check size={16} className="text-emerald-400" /> : <BookmarkPlus size={16} />}
              <span className="truncate">{trickSaved ? "Trik Tersimpan" : trickLabel}</span>
            </button>
          )}
        </div>
        {extra}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={onFlipOrientation}
          className="ctl ctl-sm bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] px-3 text-xs font-bold text-neutral-200 hover:text-white rounded-lg flex items-center gap-1.5 transition-all"
          title={`Putar orientasi papan (${currentSideLabel})${showShortcuts ? " [Z]" : ""}`}
          aria-label={`Putar orientasi papan (${currentSideLabel})`}
        >
          <IconSwap3D size={14} />
          <span className="hidden sm:inline">Putar Papan</span>
          {showShortcuts && <kbd className="hidden lg:inline text-xs text-neutral-400 font-mono">Z</kbd>}
        </button>
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`ctl ctl-sm px-3 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
              isFullscreen
                ? "bg-red-950/80 border-red-500/50 text-red-200"
                : "bg-[var(--surface)] hover:bg-[var(--card)] border-[var(--border)] text-neutral-200 hover:text-white"
            }`}
            title={isFullscreen ? "Keluar fokus (Esc)" : `Fokus 1 layar${showShortcuts ? " [F]" : ""}`}
            aria-label={isFullscreen ? "Keluar fokus" : "Fokus 1 layar"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? "Keluar Fokus" : "Fokus 1 Layar"}</span>
            {showShortcuts && <kbd className="hidden lg:inline text-xs text-neutral-400 font-mono">{isFullscreen ? "Esc" : "F"}</kbd>}
          </button>
        )}
        {hasTrickButton && (
          <button
            type="button"
            onClick={onSaveTrick}
            disabled={!canSaveTrick || trickSaved}
            className={`ctl ctl-sm px-3 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
              trickSaved
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                : !canSaveTrick
                  ? "bg-[var(--surface)]/50 border border-[var(--border)] text-neutral-500 cursor-not-allowed opacity-60"
                  : "bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white"
            }`}
          >
            {trickSaved ? <Check size={14} className="text-emerald-400" /> : <BookmarkPlus size={14} />}
            <span className="hidden sm:inline">{trickSaved ? "Tersimpan" : trickLabel}</span>
          </button>
        )}
      </div>
    );
  }

  // variant === "toolbar" (Sleek horizontal toolbar outside the board)
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm shrink-0 ${className}`}>
      <div className={`flex-1 grid ${hasTrickButton ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
        <button
          type="button"
          onClick={onFlipOrientation}
          className="h-9 px-2 sm:px-3 rounded-xl text-xs font-bold bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
          title={`Putar Orientasi Papan (${currentSideLabel})${showShortcuts ? " [Z]" : ""}`}
          aria-label={`Putar Orientasi Papan (${currentSideLabel})`}
        >
          <IconSwap3D size={16} />
          <span className="truncate">{flipLabel}</span>
          {showShortcuts && (
            <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-neutral-800 text-[11px] text-neutral-300 font-mono border border-neutral-700">
              Z
            </kbd>
          )}
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`h-9 px-2 sm:px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] ${
              isFullscreen
                ? "bg-red-950/80 border border-red-500/50 text-red-200 hover:bg-red-900"
                : "bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white"
            }`}
            title={isFullscreen ? "Keluar Layar Penuh (Esc)" : `${fullscreenLabel}${showShortcuts ? " [F]" : ""}`}
            aria-label={isFullscreen ? "Keluar Layar Penuh" : fullscreenLabel}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="truncate">{isFullscreen ? "Keluar Fokus" : fullscreenLabel}</span>
            {showShortcuts && (
              <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-neutral-800 text-[11px] text-neutral-300 font-mono border border-neutral-700">
                {isFullscreen ? "Esc" : "F"}
              </kbd>
            )}
          </button>
        )}

        {hasTrickButton && (
          <button
            type="button"
            onClick={onSaveTrick}
            disabled={!canSaveTrick || trickSaved}
            className={`h-9 px-2 sm:px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] ${
              trickSaved
                ? "bg-emerald-950/80 border border-emerald-500 text-emerald-300 cursor-default"
                : !canSaveTrick
                  ? "bg-[var(--surface)]/50 border border-[var(--border)] text-neutral-500 cursor-not-allowed opacity-60"
                  : "bg-[var(--surface)] hover:bg-[var(--card)] border border-[var(--border)] text-neutral-200 hover:text-white hover:border-[var(--primary)]"
            }`}
            title={
              trickSaved
                ? "Trik lawan sudah tersimpan di Bank Teka-Teki"
                : !canSaveTrick
                  ? "Mulai permainan & tunggu langkah untuk simpan trik"
                  : "Simpan trik lawan ke Bank Teka-Teki"
            }
          >
            {trickSaved ? <Check size={15} className="text-emerald-400 shrink-0" /> : <BookmarkPlus size={15} className="shrink-0" />}
            <span className="truncate">{trickSaved ? "Trik Tersimpan" : trickLabel}</span>
          </button>
        )}
      </div>
      {extra}
    </div>
  );
}
