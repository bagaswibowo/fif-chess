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
      case "3m": return 180 * 1000;
      case "5m": return 300 * 1000;
      case "10m": return 600 * 1000;
      default: return 9999 * 1000;
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

  // Pure timer loop: strictly updates state without side effects
  useEffect(() => {
    if (!isRunning || isOver) return;

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
  }, [isRunning, turn, isOver]);

  // Dedicated pure effect for timeout detection
  useEffect(() => {
    if (isRunning && !isOver) {
      if (whiteMs <= 0) {
        setIsRunning(false);
        onTimeoutRef.current("white");
      } else if (blackMs <= 0) {
        setIsRunning(false);
        onTimeoutRef.current("black");
      }
    }
  }, [whiteMs, blackMs, isRunning, isOver]);

  const formatMs = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
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
