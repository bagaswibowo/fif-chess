import { useState, useEffect, useCallback, useRef } from "react";
import type { Side } from "@/lib/chess";

export function useChessClock(
  timeMode: string,
  turn: Side,
  isOver: boolean,
  onTimeout: (loser: Side) => void
) {
  const getInitialMs = useCallback((mode: string) => {
    switch (mode) {
      case "5m": return 5 * 60 * 1000;
      case "10m": return 10 * 60 * 1000;
      case "30m": return 30 * 60 * 1000;
      case "60m": return 60 * 60 * 1000;
      case "120m": return 120 * 60 * 1000;
      case "unlimited": return Infinity;
      default: return 10 * 60 * 1000;
    }
  }, []);

  const [whiteMs, setWhiteMs] = useState(() => getInitialMs(timeMode));
  const [blackMs, setBlackMs] = useState(() => getInitialMs(timeMode));
  const [isRunning, setIsRunning] = useState(false);
  const lastTickRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const resetClocks = useCallback((mode: string) => {
    const initial = getInitialMs(mode);
    setWhiteMs(initial);
    setBlackMs(initial);
    lastTickRef.current = Date.now();
    setIsRunning(mode !== "unlimited");
  }, [getInitialMs]);

  // Timer loop
  useEffect(() => {
    if (!isRunning || isOver || timeMode === "unlimited") return;

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (turn === "white") {
        setWhiteMs((prev) => Math.max(0, prev - delta));
      } else {
        setBlackMs((prev) => Math.max(0, prev - delta));
      }
    }, 100);

    return () => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      if (turn === "white") {
        setWhiteMs((prev) => Math.max(0, prev - delta));
      } else {
        setBlackMs((prev) => Math.max(0, prev - delta));
      }
      clearInterval(interval);
    };
  }, [isRunning, turn, isOver, timeMode]);

  // Timeout detector
  useEffect(() => {
    if (isRunning && !isOver && timeMode !== "unlimited") {
      if (turn === "white" && whiteMs <= 0) {
        setIsRunning(false);
        onTimeoutRef.current("white");
      } else if (turn === "black" && blackMs <= 0) {
        setIsRunning(false);
        onTimeoutRef.current("black");
      }
    }
  }, [whiteMs, blackMs, isRunning, isOver, turn, timeMode]);

  const formatMs = (ms: number) => {
    if (!isFinite(ms) || timeMode === "unlimited") return "∞";
    const totalSeconds = Math.ceil(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
    }
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return {
    whiteTime: Math.ceil(whiteMs / 1000),
    blackTime: Math.ceil(blackMs / 1000),
    formattedWhiteTime: formatMs(whiteMs),
    formattedBlackTime: formatMs(blackMs),
    isRunning,
    setIsRunning,
    resetClocks,
  };
}
