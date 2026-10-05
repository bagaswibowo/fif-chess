"use client";

// AI vs Engine Catur Arena (v2.0)
// Fitur:
// 1. Label resmi "AI vs Engine Catur" dengan pemilih engine cepat.
// 2. Deteksi taktik eksplisit dengan nama motif (Skakmat Tangga, Skewer, Pin, Fork, dll.).
// 3. Tipografi 12px terstruktur rapi dengan penekanan bold & italic.
// 4. Notasi langkah dalam tabel 2-kolom terpisah (Langkah Putih vs Langkah Hitam) berlabel nama engine.
// 5. Layout compact & minimalis tanpa membuang ruang layar.

import { CapturedPiecesBar } from "@/components/captured-pieces";
import { BoardControls } from "@/components/board-controls";
import { NotationTable } from "@/components/notation-table";
import { EvalBar } from "@/components/eval-bar";
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

type EngineType = "jev" | "fly" | "jev-fly" | "stockfish";
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
  strategicPlan?: string;
  tacticalBadge?: TacticalConcept | null;
  tektokkan?: TektokkanPrediction | null;
};

const MOVE_DELAY_MS = 850;

const ENGINE_LABELS: Record<EngineType, string> = {
  stockfish: "Stockfish 15 NNUE",
  jev: "Jev AI Connectome",
  fly: "Fruit Fly Brain",
  "jev-fly": "Jev + Fly Brain",
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
  const [blackEngine, setBlackEngine] = useState<EngineType>("jev-fly");
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
  const [strategicMove, setStrategicMove] = useState<{ from: string; to: string } | null>(null);
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const pendingPredictionRef = useRef<{ uci: string; san: string } | null>(null);
  const [predictionComparison, setPredictionComparison] = useState<string | null>(null);

  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [fullscreenSpectator, setFullscreenSpectator] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        setFullscreenSpectator((v) => !v);
      } else if (e.key === "z" || e.key === "Z") {
        setBoardOrientation((o) => (o === "white" ? "black" : "white"));
      } else if (e.key === "Escape" && fullscreenSpectator) {
        setFullscreenSpectator(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenSpectator]);

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
          engine: actor,
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
      const data = (await res.json()) as {
        uci: string;
        san: string;
        scoreCp: number | null;
        prediction?: {
          engine: string;
          uci: string;
          san: string;
          from?: string;
          to?: string;
          scoreCp?: number | null;
          summary?: string;
          description?: string;
          threat?: {
            from: string;
            to: string;
            sq: string;
            description: string;
          } | null;
          strategicMove?: {
            uci: string;
            san: string;
            from: string;
            to: string;
            intention: string;
          } | null;
        } | null;
      };
      if (!data.uci) break;

      // Bandingkan langkah aktual yang baru saja dieksekusi dengan prediksi Stockfish sebelumnya
      if (pendingPredictionRef.current) {
        if (data.uci === pendingPredictionRef.current.uci) {
          setPredictionComparison(`✓ Tepat sesuai prediksi Stockfish: ${data.san}`);
        } else {
          setPredictionComparison(`⚡ AI memilih ${data.san} (Prediksi Stockfish sebelumnya: ${pendingPredictionRef.current.san})`);
        }
      } else {
        setPredictionComparison(null);
      }

      // Simpan prediksi respons lawan dari Stockfish untuk perbandingan berikutnya
      if (data.prediction?.uci && data.prediction?.san) {
        pendingPredictionRef.current = { uci: data.prediction.uci, san: data.prediction.san };
      } else {
        pendingPredictionRef.current = null;
      }

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
      
      // 1. Target Diancam — Dibaca langsung menggunakan machine Stockfish
      let foundThreat: { from: string; to: string; sq: string } | null = null;
      let threatDesc = "";

      if (data.prediction?.threat) {
        foundThreat = {
          from: data.prediction.threat.from,
          to: data.prediction.threat.to,
          sq: data.prediction.threat.sq,
        };
        threatDesc = data.prediction.threat.description;
      } else if (chess.isCheck()) {
        const board = chess.board();
        let kingSq = "";
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.color === nextTurnColor && p.type === "k") {
              kingSq = String.fromCharCode(97 + c) + (8 - r);
              break;
            }
          }
          if (kingSq) break;
        }
        if (kingSq) {
          foundThreat = { from: toSq, to: kingSq, sq: kingSq };
          threatDesc = `Skak tajam mengancam Raja lawan di ${kingSq}!`;
        }
      } else {
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
      }
      setThreatInfo(foundThreat);

      // Tektokkan Exchange Prediction
      const tektokkan = computeTektokkanExchange(chess, data.uci);

      // 2. Prediksi Balasan — Dibaca langsung menggunakan machine Stockfish
      let chosenPred: { from: string; to: string; san: string } | null = null;
      let predDesc = "";

      if (data.prediction && data.prediction.from && data.prediction.to) {
        chosenPred = {
          from: data.prediction.from,
          to: data.prediction.to,
          san: data.prediction.san,
        };
        predDesc = data.prediction.summary || data.prediction.description || `Stockfish 15 NNUE memprediksi balasan terbaik: ${data.prediction.san}`;
      } else if (tektokkan.hasExchange && tektokkan.defenderFrom && tektokkan.targetSq) {
        chosenPred = { from: tektokkan.defenderFrom, to: tektokkan.targetSq, san: `x${tektokkan.targetSq}` };
        predDesc = tektokkan.explanation || "";
      } else if (chess.moves().length > 0) {
        const legals = chess.moves({ verbose: true });
        const bestMove = legals.find((m: any) => m.captured) || legals.find((m: any) => m.san.includes("+")) || legals[0];
        chosenPred = { from: bestMove.from, to: bestMove.to, san: bestMove.san };
        predDesc = `Ditebak lawan merespons dengan ${bestMove.san} untuk mengimbangi posisi.`;
      }

      setPredictedMove(chosenPred ? { from: chosenPred.from, to: chosenPred.to } : null);

      // 3. Langkah Strategis (Taktik langkah diambil, niat mau kemana) — Dibaca menggunakan machine Stockfish
      let stratMoveObj: { from: string; to: string } | null = null;
      let stratPlanText = "";

      if (data.prediction?.strategicMove) {
        stratMoveObj = {
          from: data.prediction.strategicMove.from,
          to: data.prediction.strategicMove.to,
        };
        stratPlanText = `${data.prediction.strategicMove.san}: ${data.prediction.strategicMove.intention}`;
      } else {
        stratPlanText = "Mengonsolidasikan struktur perwira dan memperkuat kontrol sentral lanjutan.";
      }

      setStrategicMove(stratMoveObj);

      // Recognize Tactics with Explicit Named Motifs
      const plyCount = chess.history().length;
      const isEarlyOpening = plyCount <= 10;
      let tactic = identifyBainTactics(chess, data.uci);
      const opening = isEarlyOpening ? identifyOpeningOrGambit(chess.history()) : null;

      // Ensure explicit tactic name when checkmate or sharp tactic happens
      if (data.san.includes("#") || chess.isCheckmate()) {
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
        strategicPlan: stratPlanText,
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
    setStrategicMove(null);
    setCommentary(null);
    pendingPredictionRef.current = null;
    setPredictionComparison(null);
    setSeed((s) => s + 1);
  };

  const lastMove = moves[moves.length - 1] ?? null;
  const lastCp = lastMove?.scoreCp ?? null;
  const isLastMoveWhite = moves.length % 2 === 1;
  const whiteCp = lastCp !== null ? (isLastMoveWhite ? lastCp : -lastCp) : null;
  const rawPct = whiteCp !== null ? Math.round(((Math.tanh(whiteCp / 400) + 1) / 2) * 100) : 50;
  const barPct = Math.max(5, Math.min(95, rawPct));

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
    if (strategicMove && strategicMove.from !== strategicMove.to) {
      list.push({ startSquare: strategicMove.from, endSquare: strategicMove.to, color: "#10b981" });
    }
    return list;
  }, [lastMoveUci, threatInfo, predictedMove, strategicMove, commentary]);

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
    <div
      className={
        fullscreenSpectator
          ? "fixed inset-0 z-50 bg-[var(--background)] text-white flex flex-col p-2 sm:p-3 overflow-hidden animate-in fade-in duration-200"
          : "flex flex-col gap-2 w-full max-w-7xl mx-auto"
      }
    >
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
        <div className="flex items-center gap-2 shrink-0">
          {status === "idle" || status === "paused" || status === "finished" ? (
            <Button
              onClick={runMatch}
              className="bg-[var(--primary)] hover:opacity-90 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm active:translate-y-[1px]"
            >
              {status === "idle" ? "Mulai" : "Lanjutkan"}
            </Button>
          ) : (
            <Button
              onClick={stopMatch}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold text-xs h-9 px-4 rounded-xl active:translate-y-[1px]"
            >
              Jeda
            </Button>
          )}

          {status !== "idle" && (
            <Button
              onClick={resetMatch}
              variant="outline"
              className="border-[var(--border)] text-neutral-300 hover:text-white font-bold text-xs h-9 px-3 rounded-xl active:translate-y-[1px]"
            >
              Reset
            </Button>
          )}

          {/* Depth Selector (Hanya muncul jika Stockfish terlibat dalam pertandingan) */}
          {(whiteEngine === "stockfish" || blackEngine === "stockfish") && (
            <div className="flex items-center gap-1 bg-[var(--background)] px-1.5 h-9 rounded-xl border border-[var(--border)]">
              <span className="text-[10px] text-[var(--muted-foreground)] font-bold px-1 hidden sm:inline">SF Depth:</span>
              {[6, 10, 14].map((d) => (
                <button
                  key={d}
                  onClick={() => { setJevDepth(d); setSfDepth(d); }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    sfDepth === d ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MAIN TWO-COLUMN ARENA LAYOUT */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-3 items-start ${fullscreenSpectator ? "flex-1 min-h-0" : ""}`}>
        
        {/* LEFT COLUMN (7 Cols): Chess Arena (Controls & Legend on TOP -> Top Player -> Board + Eval -> Bottom Player) */}
        <div className="lg:col-span-7 flex flex-col gap-1.5">
          
          {/* 1. Unified Board Action Controls (ON TOP) */}
          <BoardControls
            variant="toolbar"
            orientation={boardOrientation}
            onFlipOrientation={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
            isFullscreen={fullscreenSpectator}
            onToggleFullscreen={() => setFullscreenSpectator((v) => !v)}
            showShortcuts={true}
          />

          {/* 2. Top Player (Black) with 1-Click Engine Selector & Captured Pieces */}
          <div className="panel px-3 py-1.5 rounded-xl border border-[var(--border)] flex items-center justify-between gap-2 shadow-sm shrink-0" style={{ background: "var(--card)" }}>
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
                <option value="jev-fly">Jev + Fly Brain (Hitam)</option>
              </select>
              <span className="text-[11px] text-neutral-400 font-mono font-bold">
                {whiteCp !== null ? (whiteCp < 0 ? `+${(-whiteCp/100).toFixed(1)}` : `-${(whiteCp/100).toFixed(1)}`) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={currentFen} side="black" />
          </div>

          {/* 4. Board Container with Sleek Vertical Dual-Bar Eval */}
          <div className="flex justify-center w-full">
            <div
              className={`flex gap-2 md:gap-3 items-stretch w-full ${
                fullscreenSpectator
                  ? "lg:w-auto lg:h-full max-h-full"
                  : "max-w-[min(100%,calc(100dvh-215px))]"
              }`}
            >
              {/* Slim Vertical Dual Eval Bar: Black at top, White at bottom (responsive to orientation) */}
              <EvalBar fen={currentFen} scoreCp={whiteCp} orientation={boardOrientation} />

              {/* Chessboard */}
              <div className="aspect-square flex-1 min-w-0 rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-2xl bg-[var(--board-dark)] relative">
                <Chessboard
                  options={{
                    id: "spectator-board",
                    position: currentFen,
                    boardOrientation: boardOrientation,
                    allowDragging: false,
                    arrows,
                    squareStyles,
                    boardStyle: {
                      backgroundColor: "var(--board-dark)",
                      gridTemplateRows: "repeat(8, 1fr)",
                      gap: 0,
                      width: "100%",
                      height: "100%",
                    },
                    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                    lightSquareStyle: { backgroundColor: "var(--board-light)" },
                    animationDurationInMs: 300,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 5. Bottom Player (White) with 1-Click Engine Selector & Captured Pieces */}
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
                <option value="jev-fly">Jev + Fly Brain (Putih)</option>
              </select>
              <span className="text-[11px] text-emerald-400 font-mono font-bold">
                {whiteCp !== null ? (whiteCp > 0 ? `+${(whiteCp/100).toFixed(1)}` : (whiteCp/100).toFixed(1)) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={currentFen} side="white" />
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): Live AI Commentary & 2-Column Move History */}
        <div className="lg:col-span-5 flex flex-col gap-2 min-h-0 lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto lg:pr-1 custom-scrollbar">
          
          {/* LIVE AI COMMENTATOR & TACTICS CARD - Typography 12px with bold & italic */}
          <Card className="panel border-[var(--border)] text-white shadow-xl overflow-hidden shrink-0 max-h-[42%] flex flex-col" style={{ background: "var(--card)" }}>
            <CardHeader className="py-2 px-3.5 border-b border-[var(--border)] flex items-center justify-between shrink-0" style={{ background: "var(--surface)" }}>
              <CardTitle className="text-xs md:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <IconBot3D size={18} className="shrink-0" />
                <span>Komentator &amp; Taktik AI</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-3 space-y-2 text-[12px] leading-relaxed overflow-y-auto flex-1 min-h-0 custom-scrollbar">
              {/* 4 Label Pertanda Visual di dalam card Komentator AI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[10px] font-bold">
                <div className="flex items-center gap-1.5 text-neutral-300">
                  <span className="w-2.5 h-2.5 rounded bg-yellow-500 border border-yellow-300 shrink-0" />
                  <span className="truncate">Langkah Sekarang</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2.5 h-2.5 rounded bg-red-500 border border-red-300 shrink-0" />
                  <span className="truncate">Ancaman</span>
                </div>
                <div className="flex items-center gap-1.5 text-sky-400">
                  <span className="w-2.5 h-2.5 rounded bg-sky-400 border border-sky-300 shrink-0" />
                  <span className="truncate">Prediksi</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-300 shrink-0" />
                  <span className="truncate">Strategi</span>
                </div>
              </div>

              {commentary ? (
                <>
                  {/* Badge Taktis diletakkan di bawah judul di dalam card */}
                  {commentary.tacticalBadge && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-sm inline-block ${commentary.tacticalBadge.badgeColor}`}>
                        {commentary.tacticalBadge.name}
                      </span>
                    </div>
                  )}

                  {/* Tactical Concept Explanation with Explicit Name */}
                  {commentary.tacticalBadge && (
                    <div className="p-2 rounded-xl border border-amber-500/40 text-[12px] text-neutral-200 leading-relaxed" style={{ background: "var(--surface)" }}>
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

                  {/* Stockfish Prediction Verification Indicator */}
                  {predictionComparison && (
                    <div className="p-2 rounded-xl border border-neutral-700/60 text-[11px] font-bold bg-neutral-900/60 text-neutral-200 flex items-center gap-1.5 shadow-sm">
                      <span>{predictionComparison}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-neutral-400 font-medium italic text-[12px]">
                  Tekan "Mulai" untuk mengaktifkan analisis taktik dan prediksi langkah AI.
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2-COLUMN MOVE HISTORY TABLE - White Engine vs Black Engine */}
          <NotationTable
            title="Notasi Langkah"
            plyCount={moves.length}
            whiteLabel={ENGINE_LABELS[whiteEngine]}
            blackLabel={ENGINE_LABELS[blackEngine]}
            className="flex-1 min-h-[180px]"
            bodyMaxHeightClass="max-h-[220px] md:max-h-[280px] lg:max-h-[340px]"
            headerExtra={
              outcome ? (
                <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                  {outcome.label}
                </Badge>
              ) : undefined
            }
            rows={moveRows.map((r, i) => ({
              no: r.n,
              white: r.white?.san,
              black: r.black?.san,
              whiteScoreCp: r.white?.scoreCp ?? null,
              blackScoreCp: r.black?.scoreCp ?? null,
              latest: i === moveRows.length - 1 && (r.white !== undefined || r.black !== undefined),
            }))}
          />

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
