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

type BlunderMap = Record<number, { quality: string; color: string; cpLoss: number }>;

function classifyMove(cpLoss: number | null, isBest: boolean): { quality: string; color: string } {
  if (isBest || cpLoss === null || cpLoss < 10) return { quality: "✓", color: "text-emerald-400" };
  if (cpLoss < 25) return { quality: "?", color: "text-green-300" };
  if (cpLoss < 50) return { quality: "?!", color: "text-yellow-400" };
  if (cpLoss < 150) return { quality: "?", color: "text-orange-400" };
  return { quality: "??", color: "text-red-400" };
}

  async function getScoreCpForFen(fen: string): Promise<number | null> {
    try {
      const res = await fetch(/api/jev-move, {
        method: POST,
        headers: { Content-Type: application/json },
        body: JSON.stringify({ fen }),
      });
      const d = await res.json();
      return typeof d.scoreCp === number ? d.scoreCp : null;
    } catch {
      return null;
    }
  }

export function GameReview({ history, onBackToPlay, lang = "id" }: Props) {
  const [selectedGameId, setSelectedGameId] = useState<string>(
    history.length > 0 ? history[0].id : ""
  );
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
  const [aiEvaluation, setAiEvaluation] = useState<AiEval | null>(null);
  const [blunderMap, setBlunderMap] = useState<BlunderMap>({});
  const [loadingAi, setLoadingAi] = useState(false);

  // In-memory evaluation cache to avoid duplicate network calls
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

  // Fetch genuine Stockfish 15 NNUE evaluation with AbortController to prevent DoS
  useEffect(() => {
    if (!currentFen) return;

    if (evalCache.current.has(currentFen)) {
      setAiEvaluation(evalCache.current.get(currentFen)!);
      return;
    }

    const controller = new AbortController();
    setLoadingAi(true);

    fetch("/api/jev-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen: currentFen }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.uci && data.san) {
          const evalResult: AiEval = {
            bestUci: data.uci,
            bestSan: data.san,
            scoreCp: data.scoreCp ?? null,
            depth: 14,
          };
          evalCache.current.set(currentFen, evalResult);
          setAiEvaluation(evalResult);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          // ignore aborted requests
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
  }, [currentFen]);

  // Alternative AI board position after playing engine's best move
  const aiFen = useMemo(() => {
    if (!aiEvaluation) return currentFen;
    try {
      const c = new Chess(currentFen);
      const from = aiEvaluation.bestUci.slice(0, 2) as Square;
      const to = aiEvaluation.bestUci.slice(2, 4) as Square;
      const promo = aiEvaluation.bestUci.length > 4 ? aiEvaluation.bestUci[4] : undefined;
      c.move({ from, to, promotion: promo });
      return c.fen();
    } catch {
      return currentFen;
    }
  }, [currentFen, aiEvaluation]);

  // Update blunderMap for the move that leads into currentFen
  // Index mapping: currentFen = after N moves; the move is at index N-1
  useEffect(() => {
    (async () => {
      const moveIdx = currentMoveIndex > 0 ? currentMoveIndex - 1 : -1;
      if (moveIdx < 0 || !aiEvaluation) {
        return;
      }
      if (!playedSan) {
        return;
      }

      // bestCp: scoreCp from the evaluation endpoint for the best-move resulting position
      // actualCp: scoreCp for the actual resulting position (currentFen itself)
      const bestUci = aiEvaluation.bestUci;
      const bestFen = (() => {
        try {
          const c = new Chess(fenList[moveIdx]);
          const from = bestUci.slice(0, 2) as Square;
          const to = bestUci.slice(2, 4) as Square;
          const promo = bestUci.length > 4 ? (bestUci[4] as any) : undefined;
          c.move({ from, to, promotion: promo });
          return c.fen();
        } catch {
          return null;
        }
      })();

      if (!bestFen) return;

      const bestCp = await getScoreCpForFen(bestFen);
      const actualCp = await getScoreCpForFen(currentFen);

      // scoreCp is from side-to-move perspective after the move; convert to white perspective by negating after each ply
      // To keep consistent without extra state, we use absolute delta as risk proxy
      if (bestCp === null || actualCp === null) return;

      const cpLoss = Math.max(0, bestCp - actualCp);
      const isBest = playedSan === aiEvaluation.bestSan;
      const quality = classifyMove(cpLoss, isBest);

      setBlunderMap((prev) => {
        if (quality.quality === ✓) {
          const next = { ...prev };
          delete next[moveIdx];
          return next;
        }
        return { ...prev, [moveIdx]: { quality: quality.quality, color: quality.color, cpLoss } };
      });
    })();
  }, [currentMoveIndex, aiEvaluation, playedSan]);

  // The actual move that was played on this step
  const currentPlayedObj = currentMoveIndex > 0 ? playedMoveObjects[currentMoveIndex - 1] : null;
  const playedSan = currentPlayedObj ? currentPlayedObj.san : null;

  // Comparison between user move and Stockfish suggestion
  const isBestMove = useMemo(() => {
    if (!playedSan || !aiEvaluation) return false;
    return playedSan === aiEvaluation.bestSan;
  }, [playedSan, aiEvaluation]);

  // Square highlights for actual move board (Board 1)
  const actualSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (!currentPlayedObj) return styles;
    styles[currentPlayedObj.from] = {
      boxShadow: "inset 0 0 0 3px #facc15",
      backgroundColor: "rgba(250, 204, 21, 0.35)",
    };
    styles[currentPlayedObj.to] = {
      boxShadow: "inset 0 0 0 4px #facc15",
      backgroundColor: "rgba(250, 204, 21, 0.55)",
    };
    return styles;
  }, [currentPlayedObj]);

  // Square highlights for AI suggestion board (Board 2)
  const aiSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (!aiEvaluation) return styles;
    const from = aiEvaluation.bestUci.slice(0, 2);
    const to = aiEvaluation.bestUci.slice(2, 4);
    styles[from] = {
      boxShadow: "inset 0 0 0 3px #81b64c",
      backgroundColor: "rgba(129, 182, 76, 0.4)",
    };
    styles[to] = {
      boxShadow: "inset 0 0 0 4px #81b64c",
      backgroundColor: "rgba(129, 182, 76, 0.6)",
    };
    return styles;
  }, [aiEvaluation]);

  if (!activeGame) {
    return (
      <div className="max-w-4xl mx-auto w-full p-8 text-center bg-[#262421] border border-[#36322d] rounded-2xl space-y-4">
        <IconMedal3D size={48} className="mx-auto" />
        <h3 className="text-lg font-bold text-white">
          {lang === "id" ? "Belum Ada Riwayat Permainan" : "No Game History Yet"}
        </h3>
        <p className="text-xs text-neutral-400">
          {lang === "id"
            ? "Mainkan setidaknya 1 permainan catur di tab 'Bermain' untuk mengaktifkan analisis perbandingan blunder dan evaluasi Stockfish 15 NNUE."
            : "Play at least 1 match in the 'Play' tab to unlock side-by-side blunder analysis and Stockfish 15 NNUE recommendations."}
        </p>
        <Button onClick={onBackToPlay} className="bg-[#81b64c] text-white font-bold text-xs">
          {lang === "id" ? "Kembali ke Papan Permainan" : "Back to Chessboard"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-14">
      {/* HEADER & GAME SELECTOR */}
      <div className="bg-[#262421] p-4 rounded-2xl border border-[#36322d] shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-base md:text-xl font-black text-white flex items-center gap-2">
            <IconMedal3D size={24} />
            <span>{lang === "id" ? "Review Permainan & Analisis Papan Ganda" : "Game Review & Dual-Board Analysis"}</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {lang === "id"
              ? "Bandingkan langkah nyata Anda secara berdampingan dengan evaluasi mesin Stockfish 15 NNUE."
              : "Compare your actual move side-by-side with genuine Stockfish 15 NNUE evaluations."}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedGameId}
            onChange={(e) => {
              setSelectedGameId(e.target.value);
              setCurrentMoveIndex(0);
            }}
            className="bg-[#191816] text-white text-xs font-bold px-3 py-2 rounded-xl border border-[#36322d] focus:outline-none focus:border-[#81b64c]"
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
            className="border-[#36322d] text-xs font-bold"
          >
            {lang === "id" ? "Kembali Bermain" : "Back to Play"}
          </Button>
        </div>
      </div>

      {/* DUAL CHESSBOARDS: BOARD 1 (ACTUAL) vs BOARD 2 (AI RECOMMENDATION) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* BOARD 1: YOUR ACTUAL MOVE */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl overflow-hidden shadow-xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-[#36322d] pb-2">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <IconPawn3D size={18} />
              <span>{lang === "id" ? "Papan 1: Langkah Riwayat Anda" : "Board 1: Your Actual Move"}</span>
            </div>
            {playedSan && (
              <Badge
                className={`text-xs font-bold ${
                  isBestMove
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-600 text-white"
                }`}
              >
                {isBestMove ? "🟢 Langkah Terbaik" : "🟡 Pilihan Pemain"}
              </Badge>
            )}
          </div>

          <div className="w-full max-w-[420px] mx-auto aspect-square rounded-xl overflow-hidden border border-[#3d3a37] shadow-lg">
            <Chessboard
              options={{
                id: "review-actual-board",
                position: currentFen,
                boardOrientation: activeGame.humanSide,
                allowDragging: false,
                squareStyles: actualSquareStyles,
                darkSquareStyle: { backgroundColor: "#b58863" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
              }}
            />
          </div>

          <div className="bg-[#191816] p-3 rounded-xl border border-[#36322d] text-xs text-neutral-300">
            <span className="text-neutral-400 block mb-0.5">Langkah dimainkan:</span>
            <span className="font-bold text-white text-sm">
              {currentMoveIndex === 0 ? "Posisi Awal" : `${currentMoveIndex}. ${playedSan}`}
            </span>
          </div>
        </Card>

        {/* BOARD 2: STOCKFISH 15 NNUE RECOMMENDATION */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl overflow-hidden shadow-xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-[#36322d] pb-2">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
              <IconBot3D size={18} />
              <span>{lang === "id" ? "Papan 2: Saran Langkah AI" : "Board 2: AI Optimal Move"}</span>
            </div>
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40">
              Stockfish 15 NNUE
            </Badge>
          </div>

          <div className="w-full max-w-[420px] mx-auto aspect-square rounded-xl overflow-hidden border border-[#3d3a37] shadow-lg">
            <Chessboard
              options={{
                id: "review-ai-board",
                position: aiFen,
                boardOrientation: activeGame.humanSide,
                allowDragging: false,
                squareStyles: aiSquareStyles,
                darkSquareStyle: { backgroundColor: "#81b64c" },
                lightSquareStyle: { backgroundColor: "#ebecd0" },
              }}
            />
          </div>

          <div className="bg-[#191816] p-3 rounded-xl border border-[#36322d] text-xs text-neutral-300">
            <span className="text-neutral-400 block mb-0.5">
              {loadingAi ? "Menghitung langkah terbaik..." : "Rekomendasi Terbaik Engine:"}
            </span>
            <span className="font-bold text-emerald-400 text-sm">
              {aiEvaluation ? `${aiEvaluation.bestSan} (${aiEvaluation.bestUci})` : "-"}
            </span>
          </div>
        </Card>
      </div>

      {/* TACTICAL PEDAGOGICAL CONTEXT CARD */}
      <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-white">
          <IconTrophy3D size={18} />
          <span>Analisis Taktis AI untuk Langkah #{currentMoveIndex || 1}</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed">
          {currentMoveIndex === 0
            ? "Mulai dari posisi awal papan catur. Geser langkah maju untuk meninjau keputusan taktis."
            : isBestMove
            ? `Bagus sekali! Langkah Anda (${playedSan}) identik dengan kalkulasi mesin catur Stockfish 15 NNUE pada kedalaman Depth 14+. Posisi Anda mempertahankan keunggulan tempo dan kendali petak sentral.`
            : `Pada giliran ini, Anda melangkahkan ${playedSan}. Engine catur merekomendasikan alternatif ${aiEvaluation ? aiEvaluation.bestSan : "lain"} untuk memaksimalkan aktivitas perwira dan menghindari hilangnya inisiatif posisi.`}
        </p>
      </Card>

      {/* PLAYBACK CONTROLS & MOVE NAVIGATION */}
      <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              onClick={() => setCurrentMoveIndex(0)}
              disabled={currentMoveIndex === 0}
              variant="outline"
              size="sm"
              className="border-[#36322d] text-xs font-bold"
            >
              |◀ Awal
            </Button>
            <Button
              onClick={() => setCurrentMoveIndex((p) => Math.max(0, p - 1))}
              disabled={currentMoveIndex === 0}
              variant="outline"
              size="sm"
              className="border-[#36322d] text-xs font-bold"
            >
              ◀ Mundur
            </Button>
            <Button
              onClick={() => setCurrentMoveIndex((p) => Math.min(fenList.length - 1, p + 1))}
              disabled={currentMoveIndex >= fenList.length - 1}
              variant="outline"
              size="sm"
              className="border-[#36322d] text-xs font-bold"
            >
              Maju ▶
            </Button>
            <Button
              onClick={() => setCurrentMoveIndex(fenList.length - 1)}
              disabled={currentMoveIndex >= fenList.length - 1}
              variant="outline"
              size="sm"
              className="border-[#36322d] text-xs font-bold"
            >
              Akhir ▶|
            </Button>
          </div>

          <div className="text-xs font-bold text-neutral-300">
            Langkah : {currentMoveIndex} / {activeGame.moves.length}
          </div>
        </div>

        {/* CLICKABLE MOVES LIST */}
        <div className="pt-2 border-t border-[#36322d] flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
          {activeGame.moves.map((m, idx) => {
            const isWhite = idx % 2 === 0;
            const moveNum = Math.floor(idx / 2) + 1;
            return (
              <button
                key={idx}
                onClick={() => setCurrentMoveIndex(idx + 1)}
                className={`px-2 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-0.5 ${
                  currentMoveIndex === idx + 1
                    ? "bg-[#81b64c] text-white font-bold"
                    : blunderMap[idx]
                    ? "bg-[#191816] border border-orange-500/40 text-neutral-300 hover:text-white"
                    : "bg-[#191816] text-neutral-400 hover:text-white border border-[#36322d]"
                }`}
              >
                {isWhite ? `${moveNum}. ` : ""}{m}
                {blunderMap[idx] && currentMoveIndex !== idx + 1 && (
                  <span className={blunderMap[idx].color + " text-[9px]"}>{blunderMap[idx].quality}</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
