"use client";

import { classifyMove, createSquareBadgeRenderer, ChessBadgeLegend, type MoveBadge } from "@/lib/chess-move-badges";
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
import { useChessTheme } from "@/lib/chess-themes";
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
  strategicGoal?: string;
  chain3Moves?: string;
  tacticalBadge?: TacticalConcept | null;
  tektokkan?: TektokkanPrediction | null;
  futureLine?: any[];
  pieceTrajectory?: any[];
  pvText?: string;
};

const MOVE_DELAY_MS = 850;

const ENGINE_LABELS: Record<EngineType, string> = {
  stockfish: "Stockfish 19 NNUE",
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
  broadcastId,
}: {
  lang?: "id" | "en";
  onTryPosition?: (fen: string, moves: string[]) => void;
  broadcastId?: string;
}) {
  const { customPieces, notationStyles, boardTheme, boardThemeId, pieceThemeId } = useChessTheme();
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
  const [moveBadges, setMoveBadges] = useState<Record<string, MoveBadge>>({});

  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [fullscreenSpectator, setFullscreenSpectator] = useState(false);
  const [broadcastData, setBroadcastData] = useState<any>(null);

  useEffect(() => {
    const activeBroadcastId = broadcastId || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("spectate") : null);
    if (!activeBroadcastId) return;

    let timer: NodeJS.Timeout;
    const fetchLive = async () => {
      try {
        const res = await fetch("/api/broadcast?id=" + activeBroadcastId);
        if (res.ok) {
          const data = await res.json();
          if (data?.match) {
            setBroadcastData(data.match);
            setCurrentFen(data.match.fen);
            if (data.match.moves) {
              setMoves(data.match.moves.map((san: string, idx: number) => ({
                san,
                uci: san,
                by: idx % 2 === 0 ? "white" : "black",
                fen: data.match.fen,
                scoreCp: data.match.scoreCp ?? null,
              })));
            }
            if (data.match.commentary) {
              setCommentary(data.match.commentary);
            }
            if (data.match.lastUci) {
              setLastMoveUci(data.match.lastUci);
            }
            // scoreCp auto-derived from moves
          }
        }
      } catch (_) {}
      timer = setTimeout(fetchLive, 1500);
    };

    fetchLive();
    return () => clearTimeout(timer);
  }, [broadcastId]);


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

      const specTo = data.uci.slice(2, 4);
      const specBadge = classifyMove(currentFen, data.uci, data.san, { isEngineBest: true });
      setMoveBadges({ [specTo]: specBadge });

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
        predDesc = data.prediction.summary || data.prediction.description || `Stockfish 19 NNUE memprediksi balasan terbaik: ${data.prediction.san}`;
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

      // 3. Langkah Strategis (Taktik langkah diambil, proyeksi 15 langkah ke depan)
      let stratMoveObj: { from: string; to: string } | null = null;
      let stratPlanText = "";
      const futureLine = (data.prediction as any)?.futureLine || [];
      const pieceTrajectory = (data.prediction as any)?.pieceTrajectory || [];
      const pvText = (data.prediction as any)?.pvText || "";

      const strategicGoal = (data.prediction as any)?.strategicGoal || "";
      const chain3Moves = (data.prediction as any)?.chain3Moves || "";

      if (data.prediction?.strategicMove?.intention) {
        stratMoveObj = {
          from: data.prediction.strategicMove.from,
          to: data.prediction.strategicMove.to,
        };
        stratPlanText = data.prediction.strategicMove.intention;
      } else if (pieceTrajectory.length > 0) {
        stratMoveObj = { from: pieceTrajectory[0].from, to: pieceTrajectory[0].to };
        stratPlanText = `${pieceTrajectory[0].san}: ${pieceTrajectory[0].intention || "Manuver lanjutan perwira ini."}`;
      } else if (futureLine.length > 1) {
        stratMoveObj = { from: futureLine[1].from, to: futureLine[1].to };
        stratPlanText = `${futureLine[1].san}: ${futureLine[1].intention || "Melanjutkan rantai manuver taktis posisi."}`;
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
        strategicGoal,
        chain3Moves,
        tacticalBadge: activeConcept,
        tektokkan,
        futureLine,
        pieceTrajectory,
        pvText,
      });

      const out = describeOutcome(chess);
      if (out.over) {
        setOutcome(out);
        setStatus("finished");
        if (out.winner) setShowConfetti(true);
        // Sinkronisasi otomatis: Laporkan hasil laga ke database pembelajaran & dopamin
        try {
          fetch("/api/match-result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              history: chess.history(),
              winner: out.winner || "draw",
            }),
          }).catch(() => {});
        } catch (_) {}
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
    // Proyeksi Panah Strategis Khusus untuk Bidak/Pion yang Melangkah Saja
    const activeSq = lastMoveUci && lastMoveUci.length >= 4 ? lastMoveUci.slice(2, 4) : "";
    const trajectory = commentary?.pieceTrajectory && commentary.pieceTrajectory.length > 0
      ? commentary.pieceTrajectory
      : (commentary?.futureLine ? commentary.futureLine.filter((step: any) => step.from === activeSq) : []);

    if (trajectory && trajectory.length > 0) {
      trajectory.forEach((step: any, idx: number) => {
        if (step.from && step.to && step.from !== step.to) {
          const color = idx === 0 ? "#10b981" : "#059669cc";
          list.push({ startSquare: step.from, endSquare: step.to, color });
        }
      });
    } else if (strategicMove && strategicMove.from !== strategicMove.to && (!activeSq || strategicMove.from === activeSq)) {
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
          : "view-root w-full max-w-7xl mx-auto min-h-0"
      }
    >
      {showConfetti && <Confetti />}

      {/* S8 Pola A (spec §3): .view-head pinned (44px min) — label + kontrol laga. */}
      <div className="view-head panel px-3.5 py-2 rounded-xl border border-[var(--border)] flex items-center justify-between gap-3 shrink-0" style={{ background: "var(--card)", borderLeft: "3px solid var(--nav-accent-learn)" }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <IconLightning3D size={22} className="shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs md:text-sm font-black text-white truncate flex items-center gap-1.5" style={{ margin: 0 }}>
              <span>AI vs Engine Catur</span>
              <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/40">
                Live Arena
              </span>
            </h2>
            <div className="text-xs text-[var(--muted-foreground)] truncate">
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
              <span className="text-xs text-[var(--muted-foreground)] font-bold px-1 hidden sm:inline">SF Depth:</span>
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

      {/* S8 Pola A: .view-grid-board (papan kiri + panel .view-body kanan);
          flex-1 min-h-0 override height:100% di dalam kolom flex (§2 spec). */}
      <div className="view-grid-board flex-1 min-h-0 mt-2">
        
        {/* LEFT: Chess Arena (Board + Eval) — F8: papan cap 540px. */}
        <div className="flex flex-col gap-1.5 min-h-0 w-full max-w-[min(100%,var(--board-cap))] overflow-hidden">
          
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
              {broadcastData ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white px-2 py-1 rounded bg-neutral-800 border border-neutral-700">
                    {broadcastData.blackName} (Hitam)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold animate-pulse">● LIVE</span>
                </div>
              ) : (
                <select
                  value={blackEngine}
                  onChange={(e) => { setBlackEngine(e.target.value as any); if (status !== "idle") resetMatch(); }}
                  className="bg-[var(--surface)] text-[12px] font-bold text-white border border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="jev">Jev AI Connectome (Hitam)</option>
                  <option value="stockfish">Stockfish 19 NNUE (Hitam)</option>
                  <option value="fly">Fruit Fly Brain (Hitam)</option>
                  <option value="jev-fly">Jev + Fly Brain (Hitam)</option>
                </select>
              )}
              <span className="text-xs text-neutral-400 font-mono font-bold">
                {whiteCp !== null ? (whiteCp < 0 ? `+${(-whiteCp/100).toFixed(1)}` : `-${(whiteCp/100).toFixed(1)}`) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={currentFen} side="black" />
          </div>

          {/* Badge Legend: Di Atas Papan */}
          <div className="flex justify-center w-full shrink-0 mb-1">
            <ChessBadgeLegend className="w-full max-w-[min(100%,var(--board-cap))]" />
          </div>

          {/* 4. Board Container with Sleek Vertical Dual-Bar Eval — F8: papan
              width-driven (aspect-square + flex-1, cap 540px) agar muat utuh
              di area 1360×768 tanpa scroll internal. (height-driven h-full
              collapse di rantai BoardShell auto-height — lihat Pola A spec.) */}
          <div className="flex justify-center w-full">
            <div
              className={`flex gap-2 md:gap-3 items-stretch w-full ${
                fullscreenSpectator
                  ? "lg:w-auto lg:h-full max-h-full"
                  : "max-w-[min(100%,var(--board-cap))]"
              }`}
            >
              {/* Slim Vertical Dual Eval Bar: Black at top, White at bottom (responsive to orientation) */}
              <EvalBar fen={currentFen} scoreCp={whiteCp} orientation={boardOrientation} />

              {/* Chessboard */}
              <div className="aspect-square flex-1 min-w-0 rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-2xl bg-[var(--board-dark)] relative">
                <Chessboard
                  key={`spectator-board-${boardOrientation}-${boardThemeId}-${pieceThemeId}`}
                  options={{
                    id: `spectator-board-${boardThemeId}-${pieceThemeId}`,
                    squareRenderer: createSquareBadgeRenderer(moveBadges, currentFen, squareStyles),
                    position: currentFen,
                    boardOrientation: boardOrientation,
                    allowDragging: false,
                    arrows,
                    squareStyles,
                    boardStyle: {
                      backgroundColor: boardTheme.dark,
                      gridTemplateRows: "repeat(8, 1fr)",
                      gap: 0,
                      width: "100%",
                      height: "100%",
                    },
                    darkSquareStyle: { backgroundColor: boardTheme.dark },
                    lightSquareStyle: { backgroundColor: boardTheme.light },
                    pieces: customPieces,
                    animationDurationInMs: 300,
                    ...notationStyles,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 5. Bottom Player (White) with 1-Click Engine Selector & Captured Pieces */}
          <div className="panel px-3 py-2 rounded-xl border border-[var(--border)] flex items-center justify-between gap-2 shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-neutral-300 shrink-0" />
              {broadcastData ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white px-2 py-1 rounded bg-neutral-800 border border-neutral-700">
                    {broadcastData.whiteName} (Putih)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold animate-pulse">● LIVE</span>
                </div>
              ) : (
                <select
                  value={whiteEngine}
                  onChange={(e) => { setWhiteEngine(e.target.value as any); if (status !== "idle") resetMatch(); }}
                  className="bg-[var(--surface)] text-[12px] font-bold text-white border border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value="stockfish">Stockfish 19 NNUE (Putih)</option>
                  <option value="jev">Jev AI Connectome (Putih)</option>
                  <option value="fly">Fruit Fly Brain (Putih)</option>
                  <option value="jev-fly">Jev + Fly Brain (Putih)</option>
                </select>
              )}
              <span className="text-xs text-emerald-400 font-mono font-bold">
                {whiteCp !== null ? (whiteCp > 0 ? `+${(whiteCp/100).toFixed(1)}` : (whiteCp/100).toFixed(1)) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={currentFen} side="white" />
          </div>
        </div>

        {/* RIGHT: Live AI Commentary & 2-Column Move History — S8 Pola A:
            panel .view-body 320px (satu-satunya region scroll internal). */}
        <div className="view-body flex flex-col gap-2 min-h-0 pr-1">
          
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
              <div className="grid grid-cols-4 gap-1 p-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-bold">
                <div className="flex items-center justify-center gap-1 text-neutral-300">
                  <span className="w-2 h-2 rounded bg-yellow-500 border border-yellow-300 shrink-0" />
                  <span className="truncate">Langkah</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-red-400">
                  <span className="w-2 h-2 rounded bg-red-500 border border-red-300 shrink-0" />
                  <span className="truncate">Ancaman</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-sky-400">
                  <span className="w-2 h-2 rounded bg-sky-400 border border-sky-300 shrink-0" />
                  <span className="truncate">Prediksi</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded bg-emerald-500 border border-emerald-300 shrink-0" />
                  <span className="truncate">Strategi</span>
                </div>
              </div>

              {commentary ? (
                <>
                  {/* Badge Taktis diletakkan di bawah judul di dalam card */}
                  {commentary.tacticalBadge && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border shadow-sm inline-block ${commentary.tacticalBadge.badgeColor}`}>
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

                  {/* Prediksi Respons Lawan (Sebelum Lawan Melangkah) */}
                  <div className="p-2.5 rounded-xl border border-sky-500/40 text-[12px] shadow-inner" style={{ background: "rgba(14, 34, 48, 0.7)" }}>
                    <div className="font-bold text-sky-400 text-xs flex items-center justify-between mb-0.5">
                      <span>Prediksi Respons Lawan:</span>
                      <span className="text-[10px] text-sky-300/80 font-mono">Sebelum Lawan Melangkah</span>
                    </div>
                    <div className="text-sky-100 italic font-medium leading-relaxed">
                      {commentary.prediction}
                    </div>
                  </div>

                  {/* Strategi Bidak (Tujuan Langkah yang Baru Dilakukan) */}
                  {commentary.strategicPlan && (
                    <div className="p-2.5 rounded-xl border border-emerald-500/40 text-[12px] shadow-inner" style={{ background: "rgba(6, 40, 28, 0.7)" }}>
                      <div className="font-bold text-emerald-400 text-xs flex items-center justify-between mb-1">
                        <span>Tujuan Strategi ({commentary.moveSan}):</span>
                        {commentary.strategicGoal && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-500/25 text-emerald-300 rounded font-semibold border border-emerald-500/40">
                            {commentary.strategicGoal}
                          </span>
                        )}
                      </div>
                      <div className="text-emerald-100 font-medium leading-relaxed mb-1.5">
                        {commentary.strategicPlan}
                      </div>
                      {commentary.chain3Moves && (
                        <div className="font-mono text-[10.5px] p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 leading-relaxed">
                          <span className="text-emerald-400 font-sans text-xs font-bold block mb-0.5">Proyeksi Rantai Langkah (s/d 3 Langkah):</span>
                          {commentary.chain3Moves}
                        </div>
                      )}
                      {!commentary.chain3Moves && commentary.pvText && (
                        <div className="font-mono text-[10.5px] p-2 rounded-lg bg-emerald-950/70 border border-emerald-500/25 text-emerald-200/90 leading-relaxed break-words">
                          <span className="text-emerald-400 font-sans text-xs font-bold block mb-0.5">Kontekstual PV Global:</span>
                          {commentary.pvText}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stockfish Prediction Verification Indicator */}
                  {predictionComparison && (
                    <div className="p-2 rounded-xl border border-neutral-700/60 text-xs font-bold bg-neutral-900/60 text-neutral-200 flex items-center gap-1.5 shadow-sm">
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
                <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/40">
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
              <div className="text-xs text-neutral-300">
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