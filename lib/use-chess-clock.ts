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

  const resetClocks = useCallback((mode: string) => {
    const initial = getInitialMs(mode);
    setWhiteMs(initial);
    setBlackMs(initial);
    lastTickRef.current = Date.now();
    setIsRunning(mode !== "unlimited");
  }, [getInitialMs]);

  // Millisecond precision timer loop (100ms ticks, exact delta)
  useEffect(() => {
    if (!isRunning || isOver) return;

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (turn === "white") {
        setWhiteMs((ms) => {
          const next = ms - delta;
          if (next <= 0) {
            setIsRunning(false);
            onTimeout("white");
            return 0;
          }
          return next;
        });
      } else {
        setBlackMs((ms) => {
          const next = ms - delta;
          if (next <= 0) {
            setIsRunning(false);
            onTimeout("black");
            return 0;
          }
          return next;
        });
      }
    }, 100);

    return () => {
      // Deduct exact delta on unmount / turn change without bias
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      if (turn === "white") {
        setWhiteMs((ms) => Math.max(0, ms - delta));
      } else {
        setBlackMs((ms) => Math.max(0, ms - delta));
      }
      clearInterval(interval);
    };
  }, [isRunning, turn, isOver, onTimeout]);

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
