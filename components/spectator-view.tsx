"use client";

// AI vs Engine Catur Arena (v2.0)
// Fitur:
// 1. Label resmi "AI vs Engine Catur" dengan pemilih engine cepat.
// 2. Deteksi taktik eksplisit dengan nama motif (Skakmat Tangga, Skewer, Pin, Fork, dll.).
// 3. Tipografi 12px terstruktur rapi dengan penekanan bold & italic.
// 4. Notasi langkah dalam tabel 2-kolom terpisah (Langkah Putih vs Langkah Hitam) berlabel nama engine.
// 5. Layout compact & minimalis tanpa membuang ruang layar.

import { CapturedPiecesBar } from "@/components/captured-pieces";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D, IconTrophy3D, IconSwap3D, IconVision3D } from "@/components/icons3d";
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

const MOVE_DELAY_MS = 850;

const ENGINE_LABELS: Record<EngineType, string> = {
  stockfish: "Stockfish 15 NNUE",
  jev: "Jev AI Connectome",
  fly: "Fruit Fly Brain",
};

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
  const [whiteEngine, setWhiteEngine] = useState<EngineType>("stockfish");
  const [blackEngine, setBlackEngine] = useState<EngineType>("jev");
  const [jevDepth, setJevDepth] = useState(10);
  const [sfDepth, setSfDepth] = useState(10);

  const [currentFen, setCurrentFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moves, setMoves] = useState<MatchMove[]>([]);
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [seed, setSeed] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);

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
      const data = (await res.json()) as { uci: string; san: string; scoreCp: number | null };
      if (!data.uci) break;

      const move = findLegalMove(
        chess,
        data.uci.slice(0, 2) as Square,
        data.uci.slice(2, 4) as Square,
        data.uci.length > 4 ? (data.uci[4] as "q") : undefined
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
      setMoves((prev) => [...prev, newMove]);

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
        const recapture = legals.find((m) => m.to === toSq && m.captured);
        if (recapture) {
          chosenPred = { from: recapture.from, to: recapture.to, san: recapture.san };
          predDesc = `Lawan diprediksi membalas memakan ${data.san} di ${toSq} via ${recapture.san}!`;
        } else if (chess.isCheck()) {
          const escape = legals.find((m) => m.piece === "k") || legals[0];
          chosenPred = { from: escape.from, to: escape.to, san: escape.san };
          predDesc = `Raja lawan terpaksa menghindar atau menutup skak via ${escape.san}.`;
        } else {
          const captures = legals
            .filter((m) => m.captured)
            .sort((a, b) => (valMap[b.captured || "p"] || 0) - (valMap[a.captured || "p"] || 0));
          const bestMove = captures[0] || legals.find((m) => m.san.includes("+")) || legals[0];
          chosenPred = { from: bestMove.from, to: bestMove.to, san: bestMove.san };
          predDesc = `Ditebak lawan merespons dengan ${bestMove.san} untuk mengimbangi posisi.`;
        }
      }

      setPredictedMove(chosenPred ? { from: chosenPred.from, to: chosenPred.to } : null);

      // Recognize Tactics with Explicit Named Motifs
      const plyCount = chess.history().length;
      const isEarlyOpening = plyCount <= 10;
      let tactic = identifyBainTactics(chess, data.uci);
      const opening = isEarlyOpening ? identifyOpeningOrGambit(chess.history()) : null;

      // Ensure explicit tactic name when checkmate or sharp tactic happens
      if (!tactic && data.san.includes("#")) {
        const isDoubleQueenOrRook = chess.board().flat().filter((p) => p && p.color === (isWhiteTurn ? "w" : "b") && (p.type === "q" || p.type === "r")).length >= 2;
        tactic = {
          name: isDoubleQueenOrRook ? "Taktik: Skakmat Tangga (Ladder Mate)" : "Taktik: Skakmat Mutlak (Checkmate)",
          category: "tactic",
          description: isDoubleQueenOrRook
            ? "Pemanfaatan koordinasi dua perwira berat (Menteri/Benteng) untuk membatasi ruang gerak raja di tepi papan hingga skakmat."
            : "Kombinasi taktis yang mengunci seluruh petak pelarian raja lawan.",
          badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        };
      } else if (!tactic && data.san.includes("+")) {
        tactic = {
          name: "Taktik: Skak Tekanan Raja (King Check)",
          category: "tactic",
          description: "Serangan langsung terhadap Raja lawan yang memaksa respon defensif seketika.",
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        };
      } else if (!tactic && data.san.includes("=")) {
        tactic = {
          name: "Taktik: Promosi Bidak Bebas (Pawn Promotion)",
          category: "tactic",
          description: "Keberhasilan meloloskan pion ke baris akhir untuk bertransformasi menjadi Menteri baru.",
          badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        };
      }

      const activeConcept = tactic || (isEarlyOpening ? opening : null);
      const actorLabel = ENGINE_LABELS[actor];

      let summaryText = "";
      if (data.san.includes("#")) {
        summaryText = `SKAKMAT! ${actorLabel} mengunci kemenangan mutlak.`;
      } else if (data.san.includes("+")) {
        summaryText = `Skak tajam! ${actorLabel} menekan raja lawan (${data.san}).`;
      } else if (data.san.includes("x")) {
        summaryText = `${actorLabel} melancarkan pemukulan perwira di ${toSq}.`;
      } else {
        summaryText = `${actorLabel} bermanuver (${data.san}) memperkuat kendali posisi.`;
      }

      const oppKingSq = isWhiteTurn ? "sayap raja hitam" : "sayap raja putih";
      const targetText =
        threatDesc || (data.san.includes("+") ? `Mengancam Raja lawan (${oppKingSq})!` : `Mengontrol petak strategis ${toSq}.`);

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

      await new Promise<void>((res) => setTimeout(res, MOVE_DELAY_MS));
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
    setSeed((s) => s + 1);
  };

  const lastMove = moves[moves.length - 1] ?? null;
  const lastCp = lastMove?.scoreCp ?? null;
  const isLastMoveWhite = moves.length % 2 === 1;
  const whiteCp = lastCp !== null ? (isLastMoveWhite ? -lastCp : lastCp) : null;
  const barPct = whiteCp !== null ? Math.round(((Math.tanh(whiteCp / 400) + 1) / 2) * 100) : 50;

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

  // 2-column move table rows
  const moveRows = useMemo(() => {
    const rows: { n: number; white?: MatchMove; black?: MatchMove }[] = [];
    moves.forEach((m, idx) => {
      const rowIdx = Math.floor(idx / 2);
      if (!rows[rowIdx]) rows[rowIdx] = { n: rowIdx + 1 };
      if (idx % 2 === 0) rows[rowIdx].white = m;
      else rows[rowIdx].black = m;
    });
    return rows;
  }, [moves]);

  return (
    <div className="max-w-6xl mx-auto space-y-3 pb-8 px-1 md:px-0">
      {showConfetti && <Confetti />}

      {/* TOP HEADER BAR - AI vs Engine Catur */}
      <div className="panel px-3.5 py-2.5 rounded-xl border border-[var(--border)] flex items-center justify-between gap-3" style={{ background: "var(--card)" }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <IconLightning3D size={22} className="shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs md:text-sm font-black text-white truncate flex items-center gap-1.5" style={{ margin: 0 }}>
              <span>AI vs Engine Catur</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/40">
                Live Arena
              </span>
            </h2>
            <div className="text-[10px] text-[var(--muted-foreground)] truncate">
              {status === "running" ? "Pertandingan Berlangsung..." : status === "finished" ? `Selesai (${moves.length} langkah)` : "Siap Dimulai"}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "idle" || status === "paused" || status === "finished" ? (
            <Button
              onClick={runMatch}
              size="sm"
              className="bg-[var(--primary)] hover:opacity-90 text-white font-bold text-xs h-7 px-2.5 shadow-sm active:translate-y-[1px]"
            >
              {status === "idle" ? "Mulai" : "Lanjutkan"}
            </Button>
          ) : (
            <Button
              onClick={stopMatch}
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-400 font-bold text-xs h-7 px-2.5 active:translate-y-[1px]"
            >
              Jeda
            </Button>
          )}

          {status !== "idle" && (
            <Button
              onClick={resetMatch}
              size="sm"
              variant="outline"
              className="border-[var(--border)] text-neutral-300 font-bold text-xs h-7 px-2 active:translate-y-[1px]"
            >
              Reset
            </Button>
          )}

          <Button
            onClick={swapSides}
            size="sm"
            variant="outline"
            className="border-[var(--primary)]/60 text-[var(--primary)] hover:bg-[var(--primary)]/10 font-bold text-xs h-7 px-2.5 flex items-center gap-1.5 active:translate-y-[1px]"
            title="Tukar posisi Putih dan Hitam"
          >
            <IconSwap3D size={14} />
            <span>Tukar Sisi</span>
          </Button>

          {/* Depth Selector */}
          <div className="flex items-center gap-1 bg-[var(--background)] p-0.5 rounded-lg border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted-foreground)] font-bold px-1">Depth:</span>
            {[6, 10, 14].map((d) => (
              <button
                key={d}
                onClick={() => { setJevDepth(d); setSfDepth(d); }}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                  jevDepth === d ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN ARENA LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        
        {/* LEFT COLUMN (7 Cols): Chess Arena (Eval Bar + Top Player + Board + Bottom Player + Legend) */}
        <div className="lg:col-span-7 space-y-2">
          
          {/* Top Player (Black) with 1-Click Engine Selector & Captured Pieces */}
          <div className="panel px-3 py-2 rounded-xl border border-[var(--border)] flex items-center justify-between gap-2 shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 border-2 border-neutral-600 shrink-0" />
              <select
                value={blackEngine}
                onChange={(e) => { setBlackEngine(e.target.value as any); if (status !== "idle") resetMatch(); }}
                className="bg-[var(--surface)] text-[12px] font-bold text-white border border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="jev">Jev AI Connectome (Hitam)</option>
                <option value="stockfish">Stockfish 15 NNUE (Hitam)</option>
                <option value="fly">Fruit Fly Brain (Hitam)</option>
              </select>
              <span className="text-[11px] text-neutral-400 font-mono font-bold">
                {whiteCp !== null ? (whiteCp < 0 ? `+${(-whiteCp/100).toFixed(1)}` : `-${(whiteCp/100).toFixed(1)}`) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={currentFen} side="black" />
          </div>

          {/* Board Container with Sleek Vertical Eval Bar */}
          <div className="flex gap-2 items-stretch">
            {/* Slim Vertical Eval Bar */}
            <div className="w-2.5 md:w-3 bg-[var(--background)] rounded-full overflow-hidden border border-[var(--border)] flex flex-col justify-end shrink-0 shadow-inner">
              <div
                className="w-full bg-neutral-200 transition-all duration-500 rounded-b-full"
                style={{ height: `${barPct}%` }}
              />
            </div>

            {/* Chessboard */}
            <div className="flex-1 rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-2xl bg-[var(--board-dark)] aspect-square max-w-[540px] mx-auto w-full">
              <Chessboard
                options={{
                  id: "spectator-board",
                  position: currentFen,
                  boardOrientation: "white",
                  allowDragging: false,
                  arrows,
                  squareStyles,
                  boardStyle: { backgroundColor: "var(--board-dark)" },
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                  animationDurationInMs: 300,
                }}
              />
            </div>
          </div>

          {/* Bottom Player (White) with 1-Click Engine Selector & Captured Pieces */}
          <div className="panel px-3 py-2 rounded-xl border border-[var(--border)] flex items-center justify-between gap-2 shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-neutral-300 shrink-0" />
              <select
                value={whiteEngine}
                onChange={(e) => { setWhiteEngine(e.target.value as any); if (status !== "idle") resetMatch(); }}
                className="bg-[var(--surface)] text-[12px] font-bold text-white border border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="stockfish">Stockfish 15 NNUE (Putih)</option>
                <option value="jev">Jev AI Connectome (Putih)</option>
                <option value="fly">Fruit Fly Brain (Putih)</option>
              </select>
              <span className="text-[11px] text-emerald-400 font-mono font-bold">
                {whiteCp !== null ? (whiteCp > 0 ? `+${(whiteCp/100).toFixed(1)}` : (whiteCp/100).toFixed(1)) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={currentFen} side="white" />
          </div>

          {/* Visual Arrows Legend */}
          <div className="panel px-3 py-2 rounded-xl border border-[var(--border)] flex items-center justify-around text-[12px] font-bold text-neutral-300 shadow-sm" style={{ background: "var(--surface)" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-yellow-500 border border-yellow-300" />
              <span className="font-semibold text-neutral-300">Langkah Terkini</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-red-500 border border-red-300" />
              <span className="font-bold text-red-400">Target Diancam</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-sky-400 border border-sky-300" />
              <span className="font-bold text-sky-400">Prediksi Balasan</span>
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): Live AI Commentary & 2-Column Move History */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* LIVE AI COMMENTATOR & TACTICS CARD - Typography 12px with bold & italic */}
          <Card className="panel border-[var(--border)] text-white shadow-xl overflow-hidden" style={{ background: "var(--card)" }}>
            <CardHeader className="py-2.5 px-3.5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ background: "var(--surface)" }}>
              <CardTitle className="text-xs md:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <IconBot3D size={18} className="shrink-0" />
                <span>Komentator &amp; Taktik AI</span>
              </CardTitle>
              {commentary?.tacticalBadge && (
                <div className="self-start sm:self-auto shrink-0">
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-sm inline-block ${commentary.tacticalBadge.badgeColor}`}>
                    {commentary.tacticalBadge.name}
                  </span>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-3.5 space-y-2.5 text-[12px] leading-relaxed">
              {commentary ? (
                <>
                  {/* Tactical Concept Explanation with Explicit Name */}
                  {commentary.tacticalBadge && (
                    <div className="p-2.5 rounded-xl border border-amber-500/40 text-[12px] text-neutral-200 leading-relaxed" style={{ background: "var(--surface)" }}>
                      <span className="font-black text-amber-400">{commentary.tacticalBadge.name}: </span>
                      <span className="italic text-neutral-300">{commentary.tacticalBadge.description}</span>
                    </div>
                  )}

                  {/* Summary of current move */}
                  <div className="flex items-start gap-2 text-[12px]">
                    <span className="text-[var(--muted-foreground)] font-bold shrink-0">Langkah:</span>
                    <span className="text-white font-bold leading-snug">{commentary.summary}</span>
                  </div>

                  {/* Target & Threat */}
                  <div className="flex items-start gap-2 text-[12px]">
                    <span className="text-red-400 font-bold shrink-0">Ancaman:</span>
                    <span className="text-neutral-200 font-medium leading-snug">{commentary.target}</span>
                  </div>

                  {/* Prediction */}
                  <div className="p-2.5 rounded-xl border border-sky-500/40 text-[12px] shadow-inner" style={{ background: "rgba(14, 34, 48, 0.7)" }}>
                    <div className="font-bold text-sky-400 text-[11px] flex items-center gap-1 mb-0.5">
                      <span>Prediksi Respons Lawan:</span>
                    </div>
                    <div className="text-sky-100 italic font-medium leading-relaxed">
                      {commentary.prediction}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-neutral-400 font-medium italic text-[12px]">
                  Tekan "Mulai" untuk mengaktifkan analisis taktik dan prediksi langkah AI.
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2-COLUMN MOVE HISTORY TABLE - White Engine vs Black Engine */}
          <Card className="panel border-[var(--border)] text-white shadow-lg overflow-hidden" style={{ background: "var(--card)" }}>
            <CardHeader className="py-2 px-3.5 border-b border-[var(--border)] flex flex-row items-center justify-between" style={{ background: "var(--surface)" }}>
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
              <div className="h-56 overflow-y-auto font-mono text-[12px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-[10px] text-neutral-400 font-sans uppercase tracking-wider">
                      <th className="py-1 px-2 text-center w-8">#</th>
                      <th className="py-1 px-2.5 text-left border-r border-[var(--border)]">
                        Putih: <strong className="text-white">{ENGINE_LABELS[whiteEngine]}</strong>
                      </th>
                      <th className="py-1 px-2.5 text-left">
                        Hitam: <strong className="text-white">{ENGINE_LABELS[blackEngine]}</strong>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/60 text-[11px]">
                    {moveRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-neutral-500 italic text-[11px]">
                          Belum ada langkah yang dimainkan.
                        </td>
                      </tr>
                    ) : (
                      moveRows.map((r, i) => (
                        <tr key={i} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-1 px-2 text-center text-neutral-500 font-bold">{r.n}.</td>
                          <td className="py-1 px-2.5 border-r border-[var(--border)]">
                            {r.white ? (
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">{r.white.san}</span>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {r.white.scoreCp !== null ? `${r.white.scoreCp > 0 ? "+" : ""}${(r.white.scoreCp / 100).toFixed(1)}` : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-neutral-600">—</span>
                            )}
                          </td>
                          <td className="py-1 px-2.5">
                            {r.black ? (
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-neutral-300">{r.black.san}</span>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {r.black.scoreCp !== null ? `${r.black.scoreCp > 0 ? "+" : ""}${(r.black.scoreCp / 100).toFixed(1)}` : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-neutral-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Outcome Result Card if Over */}
          {outcome && outcome.over && (
            <div className="p-3 rounded-xl border border-[var(--primary)] text-center space-y-1 shadow-md" style={{ background: "color-mix(in srgb, var(--primary) 15%, var(--card))" }}>
              <div className="font-black text-white text-xs flex items-center justify-center gap-1.5">
                <IconTrophy3D size={16} />
                <span>{outcome.label}</span>
              </div>
              <div className="text-[11px] text-neutral-300">
                {outcome.winner === "white"
                  ? `${ENGINE_LABELS[whiteEngine]} (Putih) Menang Mutlak!`
                  : outcome.winner === "black"
                  ? `${ENGINE_LABELS[blackEngine]} (Hitam) Menang Mutlak!`
                  : "Remis (Draw)!"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
