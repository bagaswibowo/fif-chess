"use client";

import { CapturedPiecesBar } from "@/components/captured-pieces";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D, IconTrophy3D } from "@/components/icons3d";
import { describeOutcome, findLegalMove, type GameOutcome } from "@/lib/chess";
import {
  identifyOpeningOrGambit,
  identifyBainTactics,
  computeTektokkanExchange,
  type TacticalConcept,
  type TektokkanPrediction,
} from "@/lib/tactics";

type EngineType = "jev" | "fly" | "stockfish";
type MatchStatus = "idle" | "running" | "paused" | "finished";

type MatchMove = {
  san: string;
  uci: string;
  by: EngineType;
  fen: string;
  scoreCp: number | null;
};

type Commentary = {
  moveSan: string;
  actorName: string;
  summary: string;
  target: string;
  prediction: string;
  tacticalBadge?: TacticalConcept | null;
  tektokkan?: TektokkanPrediction | null;
};

const MOVE_DELAY_MS = 900;

function getAttackedSquares(chess: Chess, sq: string): string[] {
  const piece = chess.get(sq as any);
  if (!piece) return [];
  const col = sq.charCodeAt(0) - 97;
  const row = parseInt(sq[1], 10) - 1;
  const attacks: string[] = [];

  if (piece.type === "p") {
    const dir = piece.color === "w" ? 1 : -1;
    const r = row + dir;
    if (r >= 0 && r < 8) {
      if (col > 0) attacks.push(String.fromCharCode(96 + col) + (r + 1));
      if (col < 7) attacks.push(String.fromCharCode(98 + col) + (r + 1));
    }
    return attacks;
  }

  if (piece.type === "n") {
    const deltas = [[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]];
    for (const [dc, dr] of deltas) {
      const c = col + dc;
      const r = row + dr;
      if (c >= 0 && c < 8 && r >= 0 && r < 8) attacks.push(String.fromCharCode(97 + c) + (r + 1));
    }
    return attacks;
  }

  if (piece.type === "k") {
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const c = col + dc;
        const r = row + dr;
        if (c >= 0 && c < 8 && r >= 0 && r < 8) attacks.push(String.fromCharCode(97 + c) + (r + 1));
      }
    }
    return attacks;
  }

  const dirs: [number, number][] = [];
  if (piece.type === "b" || piece.type === "q") {
    dirs.push([1,1], [1,-1], [-1,1], [-1,-1]);
  }
  if (piece.type === "r" || piece.type === "q") {
    dirs.push([1,0], [-1,0], [0,1], [0,-1]);
  }

  for (const [dc, dr] of dirs) {
    let c = col + dc;
    let r = row + dr;
    while (c >= 0 && c < 8 && r >= 0 && r < 8) {
      const target = String.fromCharCode(97 + c) + (r + 1);
      attacks.push(target);
      if (chess.get(target as any)) break;
      c += dc;
      r += dr;
    }
  }

  return attacks;
}

export function SpectatorView({
  lang = "id",
  onTryPosition,
}: {
  lang?: "id" | "en";
  onTryPosition?: (fen: string, moves: string[]) => void;
}) {
  const [whiteEngine, setWhiteEngine] = useState<EngineType>("jev");
  const [blackEngine, setBlackEngine] = useState<EngineType>("stockfish");
  const [jevDepth, setJevDepth] = useState(10);
  const [sfDepth, setSfDepth] = useState(10);
  const [showSettings, setShowSettings] = useState(false);

  const [currentFen, setCurrentFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moves, setMoves] = useState<MatchMove[]>([]);
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [seed, setSeed] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [lastMoveUci, setLastMoveUci] = useState<string | null>(null);
  const [threatInfo, setThreatInfo] = useState<{ from: string; to: string; sq: string } | null>(null);
  const [predictedMove, setPredictedMove] = useState<{ from: string; to: string } | null>(null);
  const [commentary, setCommentary] = useState<Commentary | null>(null);

  const abortRef = useRef(false);

  const runMatch = useCallback(async () => {
    abortRef.current = false;
    setStatus("running");
    setShowConfetti(false);

    const chess = new Chess(currentFen);
    let prevCp: number | null = null;

    while (!abortRef.current) {
      const isWhiteTurn = chess.turn() === "w";
      const actor = isWhiteTurn ? whiteEngine : blackEngine;
      const historyList = chess.history();

      let endpoint: string;
      let body: Record<string, unknown>;

      if (actor === "fly") {
        endpoint = "/api/engine-move";
        body = { fen: chess.fen(), engine: "fly" };
      } else if (actor === "stockfish") {
        endpoint = "/api/engine-move";
        body = { fen: chess.fen(), engine: "stockfish", depth: sfDepth };
      } else {
        endpoint = "/api/engine-move";
        body = {
          fen: chess.fen(),
          engine: "jev",
          depth: jevDepth,
          seed: seed + chess.history().length,
          history: historyList.slice(-10),
        };
      }

      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        break;
      }

      if (!res.ok || abortRef.current) break;
      const data = await res.json() as { uci: string; san: string; scoreCp: number | null };
      if (!data.uci) break;

      const move = findLegalMove(
        chess,
        data.uci.slice(0, 2) as Square,
        data.uci.slice(2, 4) as Square,
        data.uci.length > 4 ? (data.uci[4] as "q") : undefined,
      );
      if (!move) break;

      chess.move(move);
      const fen = chess.fen();
      setCurrentFen(fen);

      const newMove: MatchMove = {
        san: data.san,
        uci: data.uci,
        by: actor,
        fen,
        scoreCp: data.scoreCp,
      };
      setMoves(prev => [...prev, newMove]);

      const fromSq = data.uci.slice(0, 2);
      const toSq = data.uci.slice(2, 4);
      setLastMoveUci(data.uci);

      const nextTurnColor = chess.turn();
      let foundThreat: { from: string; to: string; sq: string } | null = null;
      let threatDesc = "";

      const legalAttacks = getAttackedSquares(chess, toSq);
      const valMap: Record<string, number> = { k: 1000, q: 9, r: 5, b: 3, n: 3, p: 1 };
      let maxVal = 0;

      for (const targetSq of legalAttacks) {
        const targetPiece = chess.get(targetSq as any);
        if (targetPiece && targetPiece.color === nextTurnColor) {
          const v = valMap[targetPiece.type] || 0;
          if (v > maxVal) {
            maxVal = v;
            foundThreat = { from: toSq, to: targetSq, sq: targetSq };
            const pNames: Record<string, string> = { k: "Raja", q: "Menteri", r: "Benteng", b: "Gajah", n: "Kuda", p: "Pion" };
            threatDesc = `Mengancam ${pNames[targetPiece.type] || "bidak"} lawan di ${targetSq}!`;
          }
        }
      }
      setThreatInfo(foundThreat);

      // Tektokkan Exchange Prediction
      const tektokkan = computeTektokkanExchange(chess, data.uci);

      // Next Move Prediction
      const legals = chess.moves({ verbose: true });
      let chosenPred: { from: string; to: string; san: string } | null = null;
      let predDesc = "";

      if (tektokkan.hasExchange && tektokkan.defenderFrom && tektokkan.targetSq) {
        chosenPred = { from: tektokkan.defenderFrom, to: tektokkan.targetSq, san: `x${tektokkan.targetSq}` };
        predDesc = tektokkan.explanation || "";
      } else if (legals.length > 0) {
        const recapture = legals.find(m => m.to === toSq && m.captured);
        if (recapture) {
          chosenPred = { from: recapture.from, to: recapture.to, san: recapture.san };
          predDesc = `Lawan diprediksi membalas memakan ${data.san} di ${toSq} via ${recapture.san}!`;
        } else if (chess.isCheck()) {
          const escape = legals.find(m => m.piece === "k") || legals[0];
          chosenPred = { from: escape.from, to: escape.to, san: escape.san };
          predDesc = `Raja lawan terpaksa menghindar atau menutup skak via ${escape.san}.`;
        } else {
          const captures = legals.filter(m => m.captured).sort((a,b) => (valMap[b.captured || "p"] || 0) - (valMap[a.captured || "p"] || 0));
          const bestMove = captures[0] || legals.find(m => m.san.includes("+")) || legals[0];
          chosenPred = { from: bestMove.from, to: bestMove.to, san: bestMove.san };
          predDesc = `Ditebak lawan merespons dengan ${bestMove.san} untuk mengimbangi posisi.`;
        }
      }

      setPredictedMove(chosenPred ? { from: chosenPred.from, to: chosenPred.to } : null);

      // Recognize Tactics (John A. Bain) or Openings/Gambits
      const opening = identifyOpeningOrGambit(chess.history());
      const tactic = identifyBainTactics(chess, data.uci);
      const activeConcept = tactic || opening;

      const actorLabel = actor === "jev" ? "Jev AI" : actor === "fly" ? "Fruit Fly" : "Stockfish 15";
      let summaryText = "";
      if (data.san.includes("#")) {
        summaryText = `SKAKMAT! ${actorLabel} mengunci kemenangan mutlak!`;
      } else if (data.san.includes("+")) {
        summaryText = `Skak tajam! ${actorLabel} menekan raja musuh (${data.san}).`;
      } else if (data.san.includes("x")) {
        summaryText = `${actorLabel} melancarkan pemukulan perwira di ${toSq}!`;
      } else {
        summaryText = `${actorLabel} bermanuver (${data.san}) memperkuat kendali posisi.`;
      }

      const oppKingSq = isWhiteTurn ? "sayap raja hitam" : "sayap raja putih";
      const targetText = threatDesc || (data.san.includes("+") ? `Mengancam Raja lawan (${oppKingSq})!` : `Mengontrol petak strategis ${toSq}.`);

      setCommentary({
        moveSan: data.san,
        actorName: actorLabel,
        summary: summaryText,
        target: targetText,
        prediction: predDesc || "Menunggu respon lawan.",
        tacticalBadge: activeConcept,
        tektokkan,
      });

      const out = describeOutcome(chess);
      if (out.over) {
        setOutcome(out);
        setStatus("finished");
        if (out.winner) setShowConfetti(true);
        return;
      }

      await new Promise<void>(res => setTimeout(res, MOVE_DELAY_MS));
      if (abortRef.current) break;
    }

    if (!abortRef.current) setStatus("finished");
  }, [whiteEngine, blackEngine, jevDepth, sfDepth, seed, currentFen]);

    const swapSides = () => {
    if (status === "running") stopMatch();
    const prevWhite = whiteEngine;
    const prevBlack = blackEngine;
    setWhiteEngine(prevBlack);
    setBlackEngine(prevWhite);
    resetMatch();
  };

  const stopMatch = () => {
    abortRef.current = true;
    setStatus("paused");
  };

  const resetMatch = () => {
    abortRef.current = true;
    setStatus("idle");
    setMoves([]);
    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setOutcome(null);
    setShowConfetti(false);
    setLastMoveUci(null);
    setThreatInfo(null);
    setPredictedMove(null);
    setCommentary(null);
    setSeed(s => s + 1);
  };

  const lastMove = moves[moves.length - 1] ?? null;
  const lastCp = lastMove?.scoreCp ?? null;
  const isLastMoveWhite = moves.length % 2 === 1;
  const whiteCp = lastCp !== null ? (isLastMoveWhite ? -lastCp : lastCp) : null;
  const barPct = whiteCp !== null ? Math.round((Math.tanh(whiteCp / 400) + 1) / 2 * 100) : 50;

  const arrows = useMemo(() => {
    const list: { startSquare: string; endSquare: string; color: string }[] = [];
    if (lastMoveUci && lastMoveUci.length >= 4) {
      list.push({ startSquare: lastMoveUci.slice(0, 2), endSquare: lastMoveUci.slice(2, 4), color: "#eab308" });
    }
    if (threatInfo && threatInfo.from !== threatInfo.to) {
      list.push({ startSquare: threatInfo.from, endSquare: threatInfo.to, color: "#ef4444" });
    }
    if (commentary?.tektokkan?.hasExchange && commentary.tektokkan.defenderFrom && commentary.tektokkan.targetSq) {
      list.push({ startSquare: commentary.tektokkan.defenderFrom, endSquare: commentary.tektokkan.targetSq, color: "#38bdf8" });
    } else if (predictedMove) {
      list.push({ startSquare: predictedMove.from, endSquare: predictedMove.to, color: "#38bdf8" });
    }
    return list;
  }, [lastMoveUci, threatInfo, predictedMove, commentary]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (threatInfo?.sq) {
      styles[threatInfo.sq] = {
        boxShadow: "inset 0 0 0 3px #ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.4)",
      };
    }
    if (predictedMove?.to) {
      styles[predictedMove.to] = {
        boxShadow: "inset 0 0 0 3px #38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.3)",
      };
    }
    return styles;
  }, [threatInfo, predictedMove]);

  return (
    <div className="max-w-6xl mx-auto space-y-3 pb-8 px-1 md:px-0">
      {showConfetti && <Confetti />}

      {/* TOP HEADER BAR - Compact & Streamlined */}
      <div className="bg-[#262421] px-3.5 py-2.5 rounded-xl border border-[#36322d] shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <IconLightning3D size={22} className="shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs md:text-sm font-black text-white truncate flex items-center gap-1.5">
              <span>Jev AI vs Stockfish</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#81b64c]/20 text-[#81b64c] border border-[#81b64c]/40">
                Live Broadcast
              </span>
            </h2>
            <div className="text-[10px] text-neutral-400 truncate">
              {status === "running" ? "⚡ Pertandingan Sedang Berlangsung..." : status === "finished" ? `🏁 Selesai (${moves.length} langkah)` : "Siap Dimulai"}
            </div>
          </div>
        </div>

        {/* Action Controls & Settings Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "idle" || status === "paused" || status === "finished" ? (
            <Button
              onClick={runMatch}
              size="sm"
              className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs h-7 px-2.5 shadow-sm active:translate-y-[1px]"
            >
              {status === "idle" ? "▶ Mulai" : "▶ Resume"}
            </Button>
          ) : (
            <Button
              onClick={stopMatch}
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-400 font-bold text-xs h-7 px-2.5 active:translate-y-[1px]"
            >
              ⏸ Pause
            </Button>
          )}

          {status !== "idle" && (
            <Button
              onClick={resetMatch}
              size="sm"
              variant="outline"
              className="border-[#36322d] text-neutral-300 font-bold text-xs h-7 px-2 active:translate-y-[1px]"
            >
              ↺ Reset
            </Button>
          )}

          <Button
            onClick={swapSides}
            size="sm"
            variant="outline"
            className="border-[#81b64c]/60 text-[#81b64c] hover:bg-[#81b64c]/10 font-bold text-xs h-7 px-2.5 flex items-center gap-1 active:translate-y-[1px]"
            title="Tukar posisi Putih dan Hitam"
          >
            <span className="text-sm">⇄</span>
            <span>Tukar Sisi</span>
          </Button>

          <Button
            onClick={() => setShowSettings(!showSettings)}
            size="sm"
            variant="outline"
            className="border-[#36322d] text-neutral-400 font-bold text-xs h-7 px-2 active:translate-y-[1px]"
          >
            ⚙️ Mesin
          </Button>

          {(status === "finished" || moves.length >= 10) && (
            <Button
              onClick={() => setShowReviewModal(true)}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-7 px-2.5 shadow-sm active:translate-y-[1px]"
            >
              🔍 Review
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Settings Row */}
      {showSettings && (
        <div className="bg-[#1f1d1a] px-3 py-2 rounded-xl border border-[#36322d] flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-neutral-400">Putih:</span>
            <select
              value={whiteEngine}
              onChange={(e) => setWhiteEngine(e.target.value as any)}
              className="bg-[#171614] border border-[#36322d] rounded px-2 py-0.5 text-xs text-white"
            >
              <option value="jev">Jev (Hybrid Connectome)</option>
              <option value="fly">Fruit Fly Brain</option>
              <option value="stockfish">Stockfish 15</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-neutral-400">Hitam:</span>
            <select
              value={blackEngine}
              onChange={(e) => setBlackEngine(e.target.value as any)}
              className="bg-[#171614] border border-[#36322d] rounded px-2 py-0.5 text-xs text-white"
            >
              <option value="stockfish">Stockfish 15</option>
              <option value="jev">Jev (Hybrid Connectome)</option>
              <option value="fly">Fruit Fly Brain</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-neutral-400">Depth:</span>
            <div className="flex gap-1">
              {[6, 10, 14].map(d => (
                <button
                  key={d}
                  onClick={() => { setJevDepth(d); setSfDepth(d); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${jevDepth === d ? "bg-[#81b64c] text-white" : "bg-[#262421] text-neutral-400"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN ARENA LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        
        {/* LEFT COLUMN (7 Cols): Chess Arena (Eval Bar + Top Player + Board + Bottom Player + Legend) */}
        <div className="lg:col-span-7 space-y-2">
          
          {/* Top Player (Black) with 1-Click Engine Selector & Captured Pieces */}
          <div className="bg-[#1c1a18] px-3 py-2 rounded-xl border border-[#36322d] flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-4 h-4 rounded-full bg-neutral-900 border-2 border-neutral-600 shrink-0" />
              <select
                value={blackEngine}
                onChange={(e) => { setBlackEngine(e.target.value as any); if (status !== "idle") resetMatch(); }}
                className="bg-[#262421] text-xs md:text-sm font-black text-white border border-[#36322d] rounded-lg px-2 py-1 focus:outline-none focus:border-[#81b64c] cursor-pointer"
              >
                <option value="stockfish">Stockfish 15 NNUE (Hitam)</option>
                <option value="jev">Jev AI Connectome (Hitam)</option>
                <option value="fly">Fruit Fly Brain (Hitam)</option>
              </select>
              <span className="text-xs text-neutral-400 font-mono font-bold">
                {whiteCp !== null ? (whiteCp < 0 ? `+${(-whiteCp/100).toFixed(1)}` : `-${(whiteCp/100).toFixed(1)}`) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={currentFen} side="black" />
          </div>

          {/* Board Container with Sleek Vertical Eval Bar */}
          <div className="flex gap-2 items-stretch">
            {/* Slim Vertical Eval Bar */}
            <div className="w-2.5 md:w-3 bg-[#171614] rounded-full overflow-hidden border border-[#36322d] flex flex-col justify-end shrink-0 shadow-inner">
              <div
                className="w-full bg-neutral-200 transition-all duration-500 rounded-b-full"
                style={{ height: `${barPct}%` }}
              />
            </div>

            {/* Chessboard */}
            <div className="flex-1 rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl bg-[#262421] aspect-square max-w-[540px] mx-auto w-full">
              <Chessboard
                options={{
                  id: "spectator-board",
                  position: currentFen,
                  boardOrientation: "white",
                  allowDragging: false,
                  arrows,
                  squareStyles,
                  darkSquareStyle: { backgroundColor: "#b58863" },
                  lightSquareStyle: { backgroundColor: "#f0d9b5" },
                  animationDurationInMs: 350,
                }}
              />
            </div>
          </div>

          {/* Bottom Player (White) with 1-Click Engine Selector & Captured Pieces */}
          <div className="bg-[#1c1a18] px-3 py-2 rounded-xl border border-[#36322d] flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-4 h-4 rounded-full bg-white border-2 border-neutral-300 shrink-0" />
              <select
                value={whiteEngine}
                onChange={(e) => { setWhiteEngine(e.target.value as any); if (status !== "idle") resetMatch(); }}
                className="bg-[#262421] text-xs md:text-sm font-black text-white border border-[#36322d] rounded-lg px-2 py-1 focus:outline-none focus:border-[#81b64c] cursor-pointer"
              >
                <option value="jev">Jev AI Connectome (Putih)</option>
                <option value="stockfish">Stockfish 15 NNUE (Putih)</option>
                <option value="fly">Fruit Fly Brain (Putih)</option>
              </select>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                {whiteCp !== null ? (whiteCp > 0 ? `+${(whiteCp/100).toFixed(1)}` : (whiteCp/100).toFixed(1)) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={currentFen} side="white" />
          </div>

          {/* Visual Arrows Legend - Besar & Jelas Terbaca */}
          <div className="bg-[#191816] px-3.5 py-2.5 rounded-xl border border-[#36322d] flex items-center justify-around text-xs md:text-sm font-bold text-neutral-300 shadow-sm">
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-yellow-500 border border-yellow-300" />
              <span>Langkah Terkini</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-red-500 border border-red-300" />
              <span className="text-red-400">Target Diancam</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-sky-400 border border-sky-300" />
              <span className="text-sky-400">Prediksi Tektokkan</span>
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): Live AI Commentary & Move History */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* LIVE AI COMMENTATOR & TACTICS CARD - Tipografi Besar & Kontras Jelas */}
          <Card className="bg-[#262421] border-[#36322d] text-white shadow-xl overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-[#36322d] bg-[#1e1c19] flex flex-row items-center justify-between">
              <CardTitle className="text-sm md:text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>🎙️ Komentator & Taktik AI</span>
              </CardTitle>
              {commentary?.tacticalBadge && (
                <span className={`text-xs md:text-sm font-black px-2.5 py-1 rounded-full border shadow-sm ${commentary.tacticalBadge.badgeColor}`}>
                  {commentary.tacticalBadge.name}
                </span>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-3.5 text-sm md:text-base">
              {commentary ? (
                <>
                  {/* Tactical Concept Explanation if detected */}
                  {commentary.tacticalBadge && (
                    <div className="p-3 rounded-xl bg-[#171614] border-2 border-amber-500/30 text-xs md:text-sm text-neutral-200 leading-relaxed">
                      <span className="font-black text-amber-400 text-sm">📖 Konsep Taktis: </span>
                      {commentary.tacticalBadge.description}
                    </div>
                  )}

                  {/* Summary of current move */}
                  <div className="flex items-start gap-2.5">
                    <span className="text-neutral-400 font-black shrink-0 text-sm">Langkah:</span>
                    <span className="text-white font-bold leading-snug">{commentary.summary}</span>
                  </div>

                  {/* Target & Threat */}
                  <div className="flex items-start gap-2.5">
                    <span className="text-red-400 font-black shrink-0 text-sm">Ancaman:</span>
                    <span className="text-neutral-200 font-semibold leading-snug">{commentary.target}</span>
                  </div>

                  {/* Tektokkan Recapture or Next Move Prediction */}
                  <div className="p-3 rounded-xl bg-[#14232c] border-2 border-sky-500/40 text-xs md:text-sm shadow-inner">
                    <div className="font-black text-sky-400 text-sm flex items-center gap-1.5 mb-1">
                      <span>⚡ Prediksi Respons (Tektokkan):</span>
                    </div>
                    <div className="text-sky-100 font-bold leading-relaxed">
                      {commentary.prediction}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-neutral-400 font-medium italic text-sm">
                  Tekan "▶ Mulai" untuk mendengarkan ulasan strategi dan tektokkan taktis secara langsung.
                </div>
              )}
            </CardContent>
          </Card>

          {/* MOVE HISTORY TABLE - Compact & Scrollable */}
          <Card className="bg-[#262421] border-[#36322d] text-white shadow-lg overflow-hidden">
            <CardHeader className="py-2 px-3.5 border-b border-[#36322d] bg-[#1e1c19] flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-neutral-300">
                Notasi Langkah ({moves.length})
              </CardTitle>
              {outcome && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                  {outcome.label}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="p-0">
              <div className="h-56 overflow-y-auto divide-y divide-[#36322d]/60 font-mono text-xs">
                {moves.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 italic text-xs">
                    Belum ada langkah yang dimainkan.
                  </div>
                ) : (
                  Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
                    const whiteM = moves[i * 2];
                    const blackM = moves[i * 2 + 1];
                    return (
                      <div key={i} className="flex items-center px-3 py-1 text-[11px] hover:bg-neutral-800/40">
                        <span className="w-8 text-neutral-500 font-bold shrink-0">{i + 1}.</span>
                        <div className="flex-1 flex items-center justify-between pr-2">
                          <span className="text-white font-bold">{whiteM.san}</span>
                          <span className="text-[10px] text-neutral-400">
                            {whiteM.scoreCp !== null ? (whiteM.scoreCp > 0 ? `+${(whiteM.scoreCp/100).toFixed(1)}` : (whiteM.scoreCp/100).toFixed(1)) : ""}
                          </span>
                        </div>
                        <div className="flex-1 flex items-center justify-between pl-2 border-l border-[#36322d]">
                          {blackM ? (
                            <>
                              <span className="text-neutral-300 font-bold">{blackM.san}</span>
                              <span className="text-[10px] text-neutral-400">
                                {blackM.scoreCp !== null ? (blackM.scoreCp > 0 ? `+${(blackM.scoreCp/100).toFixed(1)}` : (blackM.scoreCp/100).toFixed(1)) : ""}
                              </span>
                            </>
                          ) : (
                            <span className="text-neutral-600">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Outcome Result Card if Over */}
          {outcome && outcome.over && (
            <div className="p-3 rounded-xl bg-[#1f2a17] border border-[#81b64c] text-center space-y-1 shadow-md">
              <div className="font-black text-white text-sm flex items-center justify-center gap-1.5">
                <IconTrophy3D size={18} />
                <span>{outcome.label}</span>
              </div>
              <div className="text-xs text-neutral-300">
                {outcome.winner === "white"
                  ? `${whiteEngine === "jev" ? "Jev AI" : whiteEngine === "fly" ? "Fruit Fly" : "Stockfish"} Menang!`
                  : outcome.winner === "black"
                  ? `${blackEngine === "jev" ? "Jev AI" : blackEngine === "fly" ? "Fruit Fly" : "Stockfish"} Menang!`
                  : "Remis (Draw)!"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}