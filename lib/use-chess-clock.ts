import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  const lastTurnTimeRef = useRef<number>(Date.now());

  const resetClocks = useCallback((mode: string) => {
    const initial = getInitialSeconds(mode);
    setWhiteTime(initial);
    setBlackTime(initial);
    lastTurnTimeRef.current = Date.now();
    setIsRunning(mode !== "unlimited");
  }, [getInitialSeconds]);

  // Delta-timestamp based countdown (prevents clock drift and fast-move exploit)
  useEffect(() => {
    if (!isRunning || isOver) return;

    lastTurnTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTurnTimeRef.current) / 1000;
      if (elapsed >= 1) {
        const fullSeconds = Math.floor(elapsed);
        lastTurnTimeRef.current += fullSeconds * 1000;
        if (turn === "white") {
          setWhiteTime((t) => Math.max(0, t - fullSeconds));
        } else {
          setBlackTime((t) => Math.max(0, t - fullSeconds));
        }
      }
    }, 250);

    return () => {
      // Deduct elapsed partial time when turn switches
      const now = Date.now();
      const elapsed = Math.round((now - lastTurnTimeRef.current) / 1000);
      if (elapsed > 0) {
        if (turn === "white") {
          setWhiteTime((t) => Math.max(0, t - elapsed));
        } else {
          setBlackTime((t) => Math.max(0, t - elapsed));
        }
      }
      clearInterval(interval);
    };
  }, [isRunning, turn, isOver]);

  // Handle timeout
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

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }, []);

  const formattedWhiteTime = useMemo(() => formatTime(whiteTime), [formatTime, whiteTime]);
  const formattedBlackTime = useMemo(() => formatTime(blackTime), [formatTime, blackTime]);

  return {
    whiteTime,
    blackTime,
    formattedWhiteTime,
    formattedBlackTime,
    isRunning,
    setIsRunning,
    resetClocks,
  };
}
