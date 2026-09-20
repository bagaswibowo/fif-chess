import { useState, useEffect, useCallback } from "react";
import type { Side } from "@/lib/chess";

export function useChessClock(
  timeMode: string,
  turn: Side,
  isOver: boolean,
  onTimeout: (loser: Side) => void
) {
  const getInitialSeconds = useCallback((mode: string) => {
    switch (mode) {
      case "3m": return 180;
      case "5m": return 300;
      case "10m": return 600;
      default: return 9999;
    }
  }, []);

  const [whiteTime, setWhiteTime] = useState(() => getInitialSeconds(timeMode));
  const [blackTime, setBlackTime] = useState(() => getInitialSeconds(timeMode));
  const [isRunning, setIsRunning] = useState(false);

  const resetClocks = useCallback((mode: string) => {
    const initial = getInitialSeconds(mode);
    setWhiteTime(initial);
    setBlackTime(initial);
    setIsRunning(mode !== "unlimited");
  }, [getInitialSeconds]);

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && !isOver) {
      interval = setInterval(() => {
        if (turn === "white") {
          setWhiteTime((t) => Math.max(0, t - 1));
        } else {
          setBlackTime((t) => Math.max(0, t - 1));
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, turn, isOver]);

  // Timeout triggers
  useEffect(() => {
    if (isRunning && !isOver) {
      if (whiteTime === 0) {
        setIsRunning(false);
        onTimeout("white");
      } else if (blackTime === 0) {
        setIsRunning(false);
        onTimeout("black");
      }
    }
  }, [whiteTime, blackTime, isRunning, isOver, onTimeout]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return {
    whiteTime,
    blackTime,
    formattedWhiteTime: formatTime(whiteTime),
    formattedBlackTime: formatTime(blackTime),
    isRunning,
    setIsRunning,
    resetClocks,
  };
}
