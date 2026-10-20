"use client";

/**
 * GameClock.tsx
 * Digital chess clock (mm:ss, tenths below 10s) with pulse alert below 20s.
 * Follows jev-chess design system (JetBrains Mono, charcoal surface).
 */

import React, { useEffect, useRef, useCallback, useState } from "react";

export interface GameClockProps {
  timeSeconds: number;
  isActive: boolean;
  onTimeExpired?: () => void;
  className?: string;
}

export function GameClock({
  timeSeconds,
  isActive,
  onTimeExpired,
  className = "",
}: GameClockProps) {
  const [display, setDisplay] = useState(formatTime(timeSeconds));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(timeSeconds);

  useEffect(() => {
    remainingRef.current = timeSeconds;
    setDisplay(formatTime(timeSeconds));
  }, [timeSeconds]);

  useEffect(() => {
    if (!isActive || timeSeconds <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      remainingRef.current -= 1;
      setDisplay(formatTime(remainingRef.current));
      if (remainingRef.current <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        onTimeExpired?.();
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, onTimeExpired]);

  const isCritical = remainingRef.current <= 20;
  const isTenths = remainingRef.current < 10;

  return (
    <div
      className={`
        font-mono font-bold px-2 py-0.5 rounded border transition-colors duration-200
        ${className}
      `}
      style={{
        backgroundColor: isCritical ? "rgba(139, 0, 0, 0.35)" : "rgba(0,0,0,0.35)",
        borderColor: isCritical ? "rgba(239, 68, 68, 0.6)" : "rgba(255,255,255,0.12)",
        color: isCritical ? "#f87171" : "#e5e7eb",
        animation: isCritical ? "pulse 2s infinite" : "none",
      }}
    >
      {display}
    </div>
  );
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const tenths = Math.round((seconds % 1) * 10);

  if (total < 10) {
    return `${total}.${tenths}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
