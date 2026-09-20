"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function getRandomSquare(): string {
  const file = FILES[Math.floor(Math.random() * FILES.length)];
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  return `${file}${rank}`;
}

export function VisionDrill({ lang = "id" }: { lang?: "id" | "en" }) {
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [targetSquare, setTargetSquare] = useState<string>(getRandomSquare);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isActive, setIsActive] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("fif_chess_vision_highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const startDrill = useCallback(() => {
    setScore(0);
    setAttempts(0);
    setTimeLeft(30);
    setIsActive(true);
    setLastResult(null);
    setTargetSquare(getRandomSquare());
  }, []);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem("fif_chess_vision_highscore", score.toString());
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, timeLeft, score, highScore]);

  const handleSquareClick = (square: string) => {
    if (!isActive) return;
    setAttempts((a) => a + 1);
    if (square === targetSquare) {
      setScore((s) => s + 1);
      setLastResult("correct");
      setTargetSquare(getRandomSquare());
    } else {
      setLastResult("wrong");
    }
  };

  const displayFiles = orientation === "white" ? FILES : [...FILES].reverse();
  const displayRanks = orientation === "white" ? RANKS : [...RANKS].reverse();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {lang === "id" ? "Latihan Koordinat & Visi (FIF Vision Drills)" : "Vision & Coordinates Drill"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {lang === "id"
              ? "Latih kecepatan membaca petak koordinat catur tanpa melihat label angka/huruf."
              : "Train square recognition speed under blitz conditions."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
          >
            {lang === "id" ? "Sudut Pandang: " : "Perspective: "}
            {orientation === "white" ? (lang === "id" ? "Putih" : "White") : (lang === "id" ? "Hitam" : "Black")}
          </Button>
          {!isActive ? (
            <Button size="sm" onClick={startDrill} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {lang === "id" ? "Mulai Drill (30 Detik)" : "Start Drill (30s)"}
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setIsActive(false)}>
              {lang === "id" ? "Stop" : "Stop"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 flex flex-col items-center">
          <div className="w-full max-w-[480px] aspect-square border-2 border-border rounded-lg overflow-hidden grid grid-cols-8 shadow-md">
            {displayRanks.map((rank, rIdx) =>
              displayFiles.map((file, fIdx) => {
                const square = `${file}${rank}`;
                const isLight = (rIdx + fIdx) % 2 === 0;
                const isTarget = isActive && lastResult === "wrong" && square === targetSquare;

                return (
                  <button
                    key={square}
                    type="button"
                    onClick={() => handleSquareClick(square)}
                    disabled={!isActive}
                    className={`relative flex items-center justify-center font-mono text-xs transition-colors duration-150 select-none ${
                      isLight ? "bg-[#eeeed2] text-[#779952]" : "bg-[#779952] text-[#eeeed2]"
                    } ${
                      isTarget
                        ? "ring-4 ring-rose-500 z-10 animate-pulse"
                        : "hover:opacity-80 active:scale-95"
                    }`}
                  >
                    {/* Only show edge labels when inactive as a study guide */}
                    {!isActive && (
                      <span className="opacity-40 text-[10px] font-semibold">{square}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{lang === "id" ? "Target Petak" : "Target Square"}</CardTitle>
              <CardDescription>
                {isActive
                  ? (lang === "id" ? "Klik petak ini secepat mungkin!" : "Click this square quickly!")
                  : (lang === "id" ? "Tekan Mulai untuk menguji kecepatanmu" : "Click Start to begin")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center p-6 bg-muted rounded-xl border">
                <span className="text-5xl font-black font-mono tracking-widest text-primary">
                  {isActive ? targetSquare.toUpperCase() : "--"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-card p-3 rounded-lg border">
                  <div className="text-muted-foreground text-xs">{lang === "id" ? "Sisa Waktu" : "Time Left"}</div>
                  <div className="text-2xl font-bold font-mono text-amber-500">{timeLeft}s</div>
                </div>
                <div className="bg-card p-3 rounded-lg border">
                  <div className="text-muted-foreground text-xs">{lang === "id" ? "Skor" : "Score"}</div>
                  <div className="text-2xl font-bold font-mono text-emerald-500">{score}</div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                <span>{lang === "id" ? "Rekor Terbaik:" : "High Score:"}</span>
                <Badge variant="secondary" className="font-mono text-xs">{highScore} pts</Badge>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{lang === "id" ? "Akurasi:" : "Accuracy:"}</span>
                <span className="font-mono">
                  {attempts > 0 ? `${Math.round((score / attempts) * 100)}%` : "100%"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
