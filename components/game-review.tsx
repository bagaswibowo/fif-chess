"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconMedal3D,
  IconBot3D,
  IconPawn3D,
  IconTrophy3D,
  IconPlay3D,
} from "@/components/icons3d";

export type GameRecord = {
  id: string;
  date: string;
  opponent: string;
  humanSide: "white" | "black";
  outcomeKind: string;
  winner: "white" | "black" | "draw" | null;
  moves: string[]; // SAN moves
};

type Props = {
  history: GameRecord[];
  onBackToPlay: () => void;
  lang?: "id" | "en";
};

type AiEval = {
  bestUci: string;
  bestSan: string;
  scoreCp: number | null;
  depth?: number;
};

export function GameReview({ history, onBackToPlay, lang = "id" }: Props) {
  const [selectedGameId, setSelectedGameId] = useState<string>(
    history.length > 0 ? history[0].id : ""
  );
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
  const [reviewEngine, setReviewEngine] = useState<"jev" | "fly" | "stockfish">("jev");
  const [aiEvaluation, setAiEvaluation] = useState<AiEval | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1500);

  // In-memory evaluation cache keyed by FEN + Engine
  const evalCache = useRef<Map<string, AiEval>>(new Map());

  const activeGame = useMemo(() => {
    return history.find((g) => g.id === selectedGameId) || history[0] || null;
  }, [history, selectedGameId]);

  // Reconstruct all FEN board snapshots and moves
  const { fenList, playedMoveObjects } = useMemo(() => {
    if (!activeGame || !activeGame.moves || activeGame.moves.length === 0) {
      return {
        fenList: ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
        playedMoveObjects: [],
      };
    }
    const fList: string[] = ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"];
    const mList: { from: string; to: string; san: string }[] = [];
    const c = new Chess();
    for (const moveSan of activeGame.moves) {
      try {
        const res = c.move(moveSan);
        if (res) {
          fList.push(c.fen());
          mList.push({ from: res.from, to: res.to, san: res.san });
        }
      } catch {
        break;
      }
    }
    return { fenList: fList, playedMoveObjects: mList };
  }, [activeGame]);

  const currentFen = fenList[currentMoveIndex] || fenList[0];

  // Auto-play effect loop
  useEffect(() => {
    if (!isPlaying) return;

    if (currentMoveIndex >= fenList.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = setInterval(() => {
      setCurrentMoveIndex((prev) => {
        if (prev >= fenList.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, currentMoveIndex, fenList.length, playSpeed]);

  // Fetch real Jev + FlyBrain / Selected Engine recommendation
  useEffect(() => {
    if (!currentFen) return;

    const cacheKey = `${reviewEngine}:${currentFen}`;
    if (evalCache.current.has(cacheKey)) {
      setAiEvaluation(evalCache.current.get(cacheKey)!);
      return;
    }

    const controller = new AbortController();
    setLoadingAi(true);

    fetch("/api/engine-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fen: currentFen,
        engine: reviewEngine,
        depth: 12,
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.uci && data.san) {
          const evalResult: AiEval = {
            bestUci: data.uci,
            bestSan: data.san,
            scoreCp: data.scoreCp ?? null,
            depth: data.depth ?? 12,
          };
          evalCache.current.set(cacheKey, evalResult);
          setAiEvaluation(evalResult);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          // ignore aborted
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingAi(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentFen, reviewEngine]);

  // Current move played
  const currentPlayedObj = currentMoveIndex > 0 ? playedMoveObjects[currentMoveIndex - 1] : null;
  const playedSan = currentPlayedObj ? currentPlayedObj.san : null;

  // Is player move equal to AI recommendation?
  const isBestMove = useMemo(() => {
    if (!playedSan || !aiEvaluation) return false;
    return playedSan === aiEvaluation.bestSan;
  }, [playedSan, aiEvaluation]);

  // Visual Arrows on the Single Chessboard
  const arrows = useMemo(() => {
    const list: { startSquare: string; endSquare: string; color: string }[] = [];

    // 1. Yellow Arrow for the move actually played in game
    if (currentPlayedObj) {
      list.push({
        startSquare: currentPlayedObj.from,
        endSquare: currentPlayedObj.to,
        color: "#eab308", // Yellow
      });
    }

    // 2. Green Arrow for AI Coach (Jev + Fly Brain) recommendation
    if (aiEvaluation && aiEvaluation.bestUci.length >= 4) {
      const from = aiEvaluation.bestUci.slice(0, 2);
      const to = aiEvaluation.bestUci.slice(2, 4);
      // Only show if different from played move or no move played
      if (!currentPlayedObj || from !== currentPlayedObj.from || to !== currentPlayedObj.to) {
        list.push({
          startSquare: from,
          endSquare: to,
          color: "#81b64c", // Green
        });
      }
    }

    return list;
  }, [currentPlayedObj, aiEvaluation]);

  // Square highlights matching arrows
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (currentPlayedObj) {
      styles[currentPlayedObj.from] = {
        boxShadow: "inset 0 0 0 3px #facc15",
        backgroundColor: "rgba(250, 204, 21, 0.3)",
      };
      styles[currentPlayedObj.to] = {
        boxShadow: "inset 0 0 0 4px #facc15",
        backgroundColor: "rgba(250, 204, 21, 0.45)",
      };
    }
    if (aiEvaluation && aiEvaluation.bestUci.length >= 4) {
      const from = aiEvaluation.bestUci.slice(0, 2);
      const to = aiEvaluation.bestUci.slice(2, 4);
      styles[from] = {
        ...(styles[from] || {}),
        boxShadow: "inset 0 0 0 3px #81b64c",
      };
      styles[to] = {
        ...(styles[to] || {}),
        boxShadow: "inset 0 0 0 4px #81b64c",
      };
    }
    return styles;
  }, [currentPlayedObj, aiEvaluation]);

  if (!activeGame) {
    return (
      <div className="max-w-4xl mx-auto w-full p-8 text-center bg-[#262421] border border-[#36322d] rounded-2xl space-y-4">
        <IconMedal3D size={48} className="mx-auto" />
        <h3 className="text-xl font-bold text-white">
          {lang === "id" ? "Belum Ada Riwayat Permainan" : "No Game History Yet"}
        </h3>
        <p className="text-sm text-neutral-400">
          {lang === "id"
            ? "Mainkan setidaknya 1 babak di menu 'Bermain' untuk melihat review blunder dan petunjuk garis taktis dari Jev + Fly Brain."
            : "Play at least 1 match in 'Play' tab to review blunders with tactical arrows from Jev + Fly Brain."}
        </p>
        <Button onClick={onBackToPlay} className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-sm px-5 py-2.5">
          {lang === "id" ? "Kembali ke Papan Permainan" : "Back to Chessboard"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto w-full pb-14 px-2 md:px-0">
      {/* 1. TOP HEADER & SETTINGS */}
      <div className="bg-[#262421] p-4 rounded-2xl border border-[#36322d] shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-black text-white flex items-center gap-2">
            <IconMedal3D size={26} />
            <span>{lang === "id" ? "Review Blunder & Petunjuk Garis AI" : "Blunder Review & Tactical Arrows"}</span>
          </h2>
          <p className="text-xs md:text-sm text-neutral-400 mt-1">
            {lang === "id"
              ? "Garis kuning menunjukkan langkah riwayat Anda, garis hijau menunjukkan rekomendasi AI."
              : "Yellow arrow shows your actual move, green arrow shows AI recommendation."}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Review Engine Selector */}
          <select
            value={reviewEngine}
            onChange={(e) => setReviewEngine(e.target.value as any)}
            className="bg-[#191816] text-white text-xs md:text-sm font-bold px-3 py-2 rounded-xl border border-[#36322d] focus:outline-none focus:border-[#81b64c]"
          >
            <option value="jev">Review: Jev AI (Hybrid FlyBrain)</option>
            <option value="fly">Review: Fruit Fly Brain (134k)</option>
            <option value="stockfish">Review: Stockfish 15 NNUE</option>
          </select>

          {/* Game Selector */}
          <select
            value={selectedGameId}
            onChange={(e) => {
              setSelectedGameId(e.target.value);
              setCurrentMoveIndex(0);
              setIsPlaying(false);
            }}
            className="bg-[#191816] text-white text-xs md:text-sm font-bold px-3 py-2 rounded-xl border border-[#36322d] focus:outline-none focus:border-[#81b64c]"
          >
            {history.map((g, idx) => (
              <option key={g.id} value={g.id}>
                Babak #{history.length - idx} ({g.date}) — {g.outcomeKind}
              </option>
            ))}
          </select>

          <Button
            onClick={onBackToPlay}
            variant="outline"
            className="border-[#36322d] text-xs md:text-sm font-bold"
          >
            {lang === "id" ? "Bermain" : "Play"}
          </Button>
        </div>
      </div>

      {/* 2. PLAYBACK CONTROLS & MOVE NAVIGATION AT TOP */}
      <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-3 md:p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <Button
              onClick={() => {
                setIsPlaying(!isPlaying);
                if (!isPlaying && currentMoveIndex >= fenList.length - 1) {
                  setCurrentMoveIndex(0);
                }
              }}
              className={`font-bold text-xs md:text-sm h-9 px-4 shadow-md ${
                isPlaying
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-[#81b64c] hover:bg-[#72a342] text-white"
              }`}
            >
              {isPlaying ? "⏸ Jeda Otomatis" : "▶ Putar Otomatis"}
            </Button>

            <Button
              onClick={() => {
                setIsPlaying(false);
                setCurrentMoveIndex(0);
              }}
              disabled={currentMoveIndex === 0}
              variant="outline"
              size="sm"
              className="border-[#36322d] text-xs md:text-sm font-bold h-9 px-3"
            >
              |◀ Awal
            </Button>
            <Button
              onClick={() => {
                setIsPlaying(false);
                setCurrentMoveIndex((p) => Math.max(0, p - 1));
              }}
              disabled={currentMoveIndex === 0}
              variant="outline"
              size="sm"
              className="border-[#36322d] text-xs md:text-sm font-bold h-9 px-3"
            >
              ◀ Mundur
            </Button>
            <Button
              onClick={() => {
                setIsPlaying(false);
                setCurrentMoveIndex((p) => Math.min(fenList.length - 1, p + 1));
              }}
              disabled={currentMoveIndex >= fenList.length - 1}
              variant="outline"
              size="sm"
              className="border-[#36322d] text-xs md:text-sm font-bold h-9 px-3"
            >
              Maju ▶
            </Button>
            <Button
              onClick={() => {
                setIsPlaying(false);
                setCurrentMoveIndex(fenList.length - 1);
              }}
              disabled={currentMoveIndex >= fenList.length - 1}
              variant="outline"
              size="sm"
              className="border-[#36322d] text-xs md:text-sm font-bold h-9 px-3"
            >
              Akhir ▶|
            </Button>

            {/* Speed Selector */}
            <select
              value={playSpeed}
              onChange={(e) => setPlaySpeed(Number(e.target.value))}
              className="bg-[#191816] text-neutral-200 text-xs md:text-sm font-bold px-2.5 py-1.5 h-9 rounded-xl border border-[#36322d]"
            >
              <option value={2000}>0.5x (2.0s)</option>
              <option value={1500}>1.0x (1.5s)</option>
              <option value={800}>2.0x (0.8s)</option>
            </select>
          </div>

          <div className="text-xs md:text-sm font-bold text-neutral-300">
            <span className="bg-[#191816] px-3 py-1.5 rounded-xl border border-[#36322d]">
              Langkah: <strong className="text-white text-base">{currentMoveIndex}</strong> / {activeGame.moves.length}
            </span>
          </div>
        </div>

        {/* CLICKABLE MOVES LIST SCROLLER */}
        <div className="pt-2 border-t border-[#36322d] flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar">
          {activeGame.moves.map((m, idx) => {
            const isWhite = idx % 2 === 0;
            const moveNum = Math.floor(idx / 2) + 1;
            return (
              <button
                key={idx}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentMoveIndex(idx + 1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs md:text-sm font-mono transition-all flex items-center gap-1 ${
                  currentMoveIndex === idx + 1
                    ? "bg-[#81b64c] text-white font-bold shadow-md"
                    : "bg-[#191816] text-neutral-300 hover:text-white border border-[#36322d]"
                }`}
              >
                {isWhite ? `${moveNum}. ` : ""}{m}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 3. MAIN SECTION: 1 SINGLE CHESSBOARD WITH ARROWS + TACTICAL EXPLANATION SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,580px)_1fr] gap-4 md:gap-6 items-start">
        {/* THE SINGLE CLEAR BOARD WITH TACTICAL ARROWS */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl overflow-hidden shadow-2xl p-3 md:p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-[#36322d] pb-2">
            <div className="flex items-center gap-2 font-bold text-sm md:text-base text-white">
              <IconPawn3D size={20} />
              <span>Papan Permainan & Petunjuk Garis</span>
            </div>
            {playedSan && (
              <Badge
                className={`text-xs md:text-sm font-bold px-2.5 py-0.5 ${
                  isBestMove ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                }`}
              >
                {isBestMove ? "Langkah Akurat" : "Pilihan Pemain"}
              </Badge>
            )}
          </div>

          <div className="w-full aspect-square rounded-xl overflow-hidden border border-[#3d3a37] shadow-xl">
            <Chessboard
              options={{
                id: "review-single-board",
                position: currentFen,
                boardOrientation: activeGame.humanSide,
                allowDragging: false,
                squareStyles,
                arrows,
                darkSquareStyle: { backgroundColor: "#b58863" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
                boardStyle: { borderRadius: "12px" },
              }}
            />
          </div>

          {/* ARROW LEGEND */}
          <div className="bg-[#191816] p-3 rounded-xl border border-[#36322d] flex items-center justify-between text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-yellow-500 border border-yellow-300" />
              <span className="text-neutral-300">Garis Kuning: Langkah Anda</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-[#81b64c] border border-emerald-300" />
              <span className="text-neutral-300">Garis Hijau: Saran AI</span>
            </div>
          </div>
        </Card>

        {/* TACTICAL ANALYSIS & RECOMMENDATION SIDEBAR */}
        <div className="space-y-4">
          {/* Card: Move Comparison */}
          <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#36322d] pb-3">
              <div className="font-bold text-white text-base md:text-lg flex items-center gap-2">
                <IconBot3D size={22} />
                <span>Analisis Langkah #{currentMoveIndex || 1}</span>
              </div>
              <Badge variant="outline" className="text-xs md:text-sm text-emerald-400 border-emerald-500/40">
                {reviewEngine === "jev"
                  ? "Jev AI (FlyWire 134k)"
                  : reviewEngine === "fly"
                  ? "Drosophila Connectome"
                  : "Stockfish 15"}
              </Badge>
            </div>

            {/* Move details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#191816] p-3.5 rounded-xl border border-[#36322d] space-y-1">
                <span className="text-xs text-neutral-400 block font-semibold">Langkah Dimainkan:</span>
                <span className="text-base md:text-lg font-black text-yellow-400 font-mono">
                  {currentMoveIndex === 0 ? "Posisi Awal" : playedSan || "-"}
                </span>
              </div>

              <div className="bg-[#191816] p-3.5 rounded-xl border border-[#36322d] space-y-1">
                <span className="text-xs text-neutral-400 block font-semibold">Rekomendasi AI:</span>
                <span className="text-base md:text-lg font-black text-[#81b64c] font-mono">
                  {loadingAi ? "Menghitung..." : aiEvaluation ? `${aiEvaluation.bestSan}` : "-"}
                </span>
              </div>
            </div>

            {/* Tactical Pedagogy Explanation */}
            <div className="bg-[#191816] p-4 rounded-xl border border-[#36322d] space-y-2">
              <div className="font-bold text-sm md:text-base text-white flex items-center gap-2">
                <IconTrophy3D size={18} />
                <span>Pertimbangan Strategis AI:</span>
              </div>
              <p className="text-sm md:text-base text-neutral-300 leading-relaxed">
                {currentMoveIndex === 0
                  ? "Papan berada pada posisi awal pembukaan. Tekan 'Maju ▶' atau 'Putar Otomatis' untuk menganalisis setiap langkah."
                  : isBestMove
                  ? `Sempurna! Langkah ${playedSan} adalah langkah terbaik yang juga dipilih oleh AI. Anda menguasai ruang dan menjaga koordinasi perwira secara optimal.`
                  : `Pada langkah ini, Anda memainkan ${playedSan}. AI (Jev + Fly Brain) merekomendasikan langkah alternatif ${
                      aiEvaluation ? aiEvaluation.bestSan : "lain"
                    } untuk memberikan tekanan lebih besar ke sayap lawan atau mencegah serangan balik berbahaya.`}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
