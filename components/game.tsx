"use client";

import { CapturedPiecesBar } from "@/components/captured-pieces";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, PieceHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JevDistribution } from "@/components/jev-distribution";
import { MoveList } from "@/components/move-list";
import { PromotionDialog } from "@/components/promotion-dialog";
import { LearningHub } from "@/components/learning-hub";
import { PuzzleView, type Puzzle } from "@/components/puzzle-view";
import { ScanView } from "@/components/scan-view";
import { CommunityView } from "@/components/community-view";
import { GameReview, type GameRecord } from "@/components/game-review";
import { CoachModeView } from "@/components/coach-mode-view";
import { SpectatorView } from "@/components/spectator-view";
import { GuidedPlayView } from "@/components/guided-play-view";
import { GameOverModal } from "@/components/game-over-modal";
import { useChessClock } from "@/lib/use-chess-clock";
import { getStoredUser, saveStoredUser, registerUser, type UserProfile } from "@/lib/user-auth";
import {
  IconPawn3D, IconPlay3D,
  IconPuzzle3D,
  IconVision3D,
  IconScan3D,
  IconCommunity3D,
  IconBot3D,
  IconLightning3D,
  IconClock3D,
  IconSwap3D,
  IconGlobe3D,
  IconMedal3D,
  IconCoach3D,
} from "@/components/icons3d";
import {
  applyUci,
  describeOutcome,
  findLegalMove,
  getLegalMoves,
  isPromotionAttempt,
  sideToMove,
  type PromotionPiece,
  type Side,
  type GameOutcome,
} from "@/lib/chess";
import type { JevAnalysis, JevError, PlayedMove } from "@/lib/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type PendingPromotion = { from: string; to: string };
type NavTab = "play" | "puzzle" | "vision" | "scan" | "community" | "review" | "coach";
type RightTab = "game-setup" | "analysis" | "moves";
type PlayMode = "ai" | "pvp";
type CoachSubTab = "coach" | "spectator" | "guided";

export function Game() {
  const [fen, setFen] = useState(START_FEN);
  const [humanSide, setHumanSide] = useState<Side>("white");
  const [moves, setMoves] = useState<PlayedMove[]>([]);
  const [analysis, setAnalysis] = useState<JevAnalysis | null>(null);
  const [error, setError] = useState<JevError | null>(null);
  const [thinking, setThinking] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [navTab, setNavTab] = useState<NavTab>("play");
  const [coachSubTab, setCoachSubTab] = useState<CoachSubTab>("coach");
  const [guidedStartFen, setGuidedStartFen] = useState<string | undefined>(undefined);
  const [guidedStartMoves, setGuidedStartMoves] = useState<string[] | undefined>(undefined);
  const [aiDepth, setAiDepth] = useState(14);
  const [gameActive, setGameActive] = useState(false);
  const [selectedAiOpponent, setSelectedAiOpponent] = useState<"stockfish" | "jev-fly" | "jev" | "fly">("stockfish");
  const [rightTab, setRightTab] = useState<RightTab>("game-setup");
  const [lang, setLang] = useState<"id" | "en">("id");
  const [timeMode, setTimeMode] = useState<string>("5m");

  // User Profile State
  const [currentUser, setCurrentUser] = useState<UserProfile>(getStoredUser);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInputName, setAuthInputName] = useState("");
  const [authInputUsername, setAuthInputUsername] = useState("");
  const [authInputRole, setAuthInputRole] = useState("Mahasiswa TI Tel-U");

  // PvP Real-time State
  const [playMode, setPlayMode] = useState<PlayMode>("ai");
  const [pvpRoomCode, setPvpRoomCode] = useState<string>("");
  const [pvpToken, setPvpToken] = useState<string>("");
  const [pvpJoinInput, setPvpJoinInput] = useState<string>("");
  const [pvpStatus, setPvpStatus] = useState<"idle" | "waiting" | "active" | "finished">("idle");
  const [pvpOpponentName, setPvpOpponentName] = useState<string>("Lawan Online");
  const [opponentTacticSaved, setOpponentTacticSaved] = useState<boolean>(false);

  // Game History State
  const [gameHistory, setGameHistory] = useState<GameRecord[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("fif_chess_game_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [customOutcome, setCustomOutcome] = useState<GameOutcome | null>(null);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const requestGen = useRef(0);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const outcome = describeOutcome(chess);
  const effectiveOutcome = customOutcome ?? outcome;
  const turn = sideToMove(chess);
  const humanToMove = !effectiveOutcome.over && turn === humanSide && !thinking;

  // Show Game Over Modal automatically after game ends
  useEffect(() => {
    if (effectiveOutcome.over) {
      const timer = setTimeout(() => setShowGameOverModal(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowGameOverModal(false);
    }
  }, [effectiveOutcome.over]);

  // Record completed games to history
  useEffect(() => {
    if (effectiveOutcome.over && moves.length > 0) {
      const record: GameRecord = {
        id: "game-" + Date.now(),
        date: new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        opponent: playMode === "ai" ? "Stockfish 15 NNUE" : pvpOpponentName,
        humanSide,
        outcomeKind: effectiveOutcome.kind,
        winner: effectiveOutcome.winner,
        moves: moves.map((m) => m.san),
      };

      setGameHistory((prev) => {
        const exists = prev.some((g) => g.id === record.id);
        if (exists) return prev;
        const updated = [record, ...prev].slice(0, 50);
        try {
          localStorage.setItem("fif_chess_game_history", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  }, [effectiveOutcome.over, moves, playMode, humanSide, effectiveOutcome.kind, effectiveOutcome.winner, pvpOpponentName]);

  const onTimeout = useCallback((loser: Side) => {
    setCustomOutcome({
      over: true,
      winner: loser === "white" ? "black" : "white",
      kind: "timeout",
      label: loser === "white"
        ? (lang === "id" ? "Waktu Putih Habis" : "White ran out of time")
        : (lang === "id" ? "Waktu Hitam Habis" : "Black ran out of time"),
    });
  }, [lang]);

  const { resetClocks, formattedWhiteTime, formattedBlackTime } = useChessClock(timeMode, turn, effectiveOutcome.over, onTimeout);

  const askEngine = useCallback(
    async (position: string) => {
      const gen = ++requestGen.current;
      setThinking(true);
      setError(null);
      try {
        const engineParam = selectedAiOpponent === "fly" ? "fly" : selectedAiOpponent === "stockfish" ? "stockfish" : "jev";
        const response = await fetch("/api/engine-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fen: position,
            depth: aiDepth,
            engine: engineParam,
            history: chess.history().slice(-10),
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
          retryable?: boolean;
          uci?: string;
          san?: string;
          fen?: string;
          probabilities?: Record<string, number>;
          confidence?: number | null;
          droppedMoveCount?: number;
        };
        if (gen !== requestGen.current) return;
        if (!response.ok || !payload.uci || !payload.san || !payload.fen) {
          setError({
            message: payload.error ?? "AI did not return a move.",
            retryable: payload.retryable !== false,
          });
          return;
        }
        try {
          chess.load(payload.fen);
        } catch {
          // Fallback if load fails
        }
        setFen(payload.fen);
        setMoves((current) => [
          ...current,
          {
            san: payload.san!,
            uci: payload.uci!,
            by: "jev",
            ply: current.length + 1,
          },
        ]);
        setAnalysis({
          chosenUci: payload.uci,
          chosenSan: payload.san,
          probabilities: payload.probabilities ?? {},
          confidence: payload.confidence ?? null,
          droppedMoveCount: payload.droppedMoveCount ?? 0,
        });
      } catch {
        if (gen !== requestGen.current) return;
        setError({
          message: "Tidak dapat menghubungi server engine.",
          retryable: true,
        });
      } finally {
        if (gen === requestGen.current) {
          setThinking(false);
        }
      }
    },
    [aiDepth, selectedAiOpponent, chess],
  );

  const startGame = useCallback(
    (side: Side) => {
      requestGen.current += 1;
      try { chess.load(START_FEN); } catch (_) {}
      setHumanSide(side);
      setFen(START_FEN);
      setMoves([]);
      setAnalysis(null);
      setError(null);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setThinking(false);
      setCustomOutcome(null);
      setShowGameOverModal(false);
      setOpponentTacticSaved(false);
      resetClocks(timeMode);
      setGameActive(true);
      if (playMode === "ai" && side === "black") {
        void askEngine(START_FEN);
      }
    },
    [askEngine, timeMode, resetClocks, playMode, chess],
  );

  const resetGame = useCallback(() => {
    requestGen.current += 1;
    try { chess.load(START_FEN); } catch (_) {}
    setFen(START_FEN);
    setMoves([]);
    setAnalysis(null);
    setError(null);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setThinking(false);
    setCustomOutcome(null);
    setShowGameOverModal(false);
    setOpponentTacticSaved(false);
    resetClocks(timeMode);
    setGameActive(false);
  }, [timeMode, resetClocks, chess]);

  // Save last move by opponent as a dynamic puzzle
  const saveOpponentTrick = () => {
    if (moves.length === 0) return;
    const lastM = moves[moves.length - 1];
    const prevFen = moves.length > 1 ? chess.fen() : START_FEN;

    const newPuzzle: Puzzle = {
      id: "opp-" + Date.now(),
      category: "opponent",
      difficulty: "Sedang",
      fen: prevFen,
      turn: humanSide === "white" ? "b" : "w",
      solutionUci: lastM.uci,
      solutionSan: lastM.san,
      theme: "Trik Taktis Lawan (Live Match)",
      description: `Langkah taktis ${lastM.san} yang dilancarkan oleh ${playMode === "ai" ? "Stockfish 15 NNUE" : pvpOpponentName} saat pertandingan langsung.`,
      hintPiece: `Perhatikan posisi bidak ${lastM.uci.slice(0, 2)}.`,
      hintExplanation: `Langkahkan ke petak ${lastM.uci.slice(2, 4)} untuk mereplikasi taktik kemenangan lawan.`,
      trickExplanation: `Taktik dari Lawan: Langkah ${lastM.san} berhasil mengubah dinamika papan. Menganalisis dan memecahkan kembali langkah ini melatih refleks taktis menghadapi serangan serupa di turnamen nyata.`,
    };

    try {
      const saved = localStorage.getItem("fif_chess_custom_puzzles");
      const list = saved ? JSON.parse(saved) : [];
      list.unshift(newPuzzle);
      localStorage.setItem("fif_chess_custom_puzzles", JSON.stringify(list));
      setOpponentTacticSaved(true);
      setTimeout(() => setOpponentTacticSaved(false), 3000);
    } catch {}
  };

  // PvP Room: Polling Loop for Multiplayer Sync
  useEffect(() => {
    if (playMode !== "pvp" || !pvpRoomCode || pvpStatus === "finished") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pvp?room=${pvpRoomCode}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.room) {
          const r = data.room;
          if (r.fen !== fen) {
            setFen(r.fen);
          }
          if (r.status === "active" && pvpStatus === "waiting") {
            setPvpStatus("active");
            setPvpOpponentName(humanSide === "white" ? r.blackUser || "Pemain 2" : r.whiteUser);
          }
          if (r.status === "finished") {
            setPvpStatus("finished");
            setCustomOutcome({
              over: true,
              winner: r.winner || null,
              kind: r.outcomeKind || "checkmate",
              label: r.winner === humanSide ? "Kemenangan PvP!" : "Kekalahan PvP",
            });
            setShowGameOverModal(true);
          }
        }
      } catch {}
    };

    const interval = setInterval(poll, 1200);
    return () => clearInterval(interval);
  }, [playMode, pvpRoomCode, pvpStatus, fen, humanSide]);

  // Create PvP Room
  const createPvpRoom = async () => {
    try {
      const res = await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", username: currentUser.fullName }),
      });
      const data = await res.json();
      if (data.success) {
        setPvpRoomCode(data.room.code);
        setPvpToken(data.playerToken);
        setHumanSide("white");
        setPvpStatus("waiting");
        setPlayMode("pvp");
        startGame("white");
      }
    } catch {}
  };

  // Join PvP Room
  const joinPvpRoom = async () => {
    if (!pvpJoinInput.trim()) return;
    try {
      const res = await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", code: pvpJoinInput.trim(), username: currentUser.fullName }),
      });
      const data = await res.json();
      if (data.success) {
        setPvpRoomCode(data.room.code);
        setPvpToken(data.playerToken);
        setHumanSide("black");
        setPvpStatus("active");
        setPvpOpponentName(data.room.whiteUser || "Pemain Putih");
        setPlayMode("pvp");
        setFen(data.room.fen);
      }
    } catch {}
  };

  const tryHumanMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece): boolean => {
      if (!humanToMove) return false;
      const legal = findLegalMove(chess, from, to, promotion);
      if (!legal) return false;

      const applied = applyUci(chess, legal.uci);
      const nextFen = chess.fen();
      setFen(nextFen);
      setSelectedSquare(null);
      setMoves((current) => [
        ...current,
        {
          san: applied.san,
          uci: legal.uci,
          by: "human",
          ply: current.length + 1,
        },
      ]);

      // If in PvP mode, push move to server
      if (playMode === "pvp" && pvpRoomCode) {
        void fetch("/api/pvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move",
            code: pvpRoomCode,
            from,
            to,
            promotion,
            side: humanSide,
            playerToken: pvpToken,
          }),
        });
        return true;
      }

      // AI Mode
      const nextOutcome = describeOutcome(chess);
      if (!nextOutcome.over) {
        void askEngine(nextFen);
      }
      return true;
    },
    [askEngine, chess, humanToMove, playMode, pvpRoomCode, humanSide, pvpToken],
  );

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!targetSquare || !humanToMove) return false;
    if (isPromotionAttempt(chess, sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return true;
    }
    return tryHumanMove(sourceSquare, targetSquare);
  };

  const canDragPiece = ({ piece }: PieceHandlerArgs): boolean => {
    if (!humanToMove) return false;
    return (
      (humanSide === "white" && piece.pieceType.startsWith("w")) ||
      (humanSide === "black" && piece.pieceType.startsWith("b"))
    );
  };

  const destinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const set = new Set<string>();
    for (const move of getLegalMoves(chess)) {
      if (move.from === selectedSquare) {
        set.add(move.to);
      }
    }
    return set;
  }, [chess, selectedSquare]);

  const lastMove = moves[moves.length - 1];

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selectedSquare) {
      styles[selectedSquare] = {
        boxShadow: "inset 0 0 0 4px #fde047",
      };
    }
    for (const square of destinations) {
      styles[square] = {
        background: "radial-gradient(circle, rgba(253, 224, 71, 0.5) 25%, transparent 27%)",
      };
    }
    if (lastMove) {
      const from = lastMove.uci.slice(0, 2);
      const to = lastMove.uci.slice(2, 4);
      styles[from] = {
        ...styles[from],
        backgroundColor: "rgba(255, 235, 59, 0.3)",
      };
      styles[to] = {
        ...styles[to],
        backgroundColor: "rgba(255, 235, 59, 0.45)",
      };
    }

    // Effect: Raja Tumbang / Mated King fallen
    if (effectiveOutcome.over && effectiveOutcome.kind === "checkmate") {
      const matedSide = chess.turn();
      for (let r = 1; r <= 8; r++) {
        for (const f of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
          const sq = `${f}${r}` as Square;
          const piece = chess.get(sq);
          if (piece && piece.type === "k" && piece.color === matedSide) {
            styles[sq] = {
              backgroundColor: "rgba(239, 68, 68, 0.5)",
              boxShadow: "inset 0 0 0 4px #ef4444",
              transform: "rotate(-85deg) translate(-8px, 12px)",
              transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
            };
          }
        }
      }
    }

    return styles;
  }, [chess, destinations, lastMove, effectiveOutcome.kind, effectiveOutcome.over, selectedSquare]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#312e2b] text-white">
      {/* MOBILE TOP BAR (Hidden on Desktop) */}
      <header className="flex md:hidden items-center justify-between px-3.5 py-2.5 bg-[#262421] border-b border-[#36322d] sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setNavTab("play")}>
          <div className="w-8 h-8 rounded-lg bg-[#1f1d1a] border border-[#3d3a37] flex items-center justify-center shadow">
            <IconPlay3D size={20} />
          </div>
          <div>
            <div className="font-black text-sm uppercase leading-tight text-white flex items-center gap-1">
              FIF <span className="text-[#81b64c]">CHESS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang((l) => (l === "id" ? "en" : "id"))}
            className="flex items-center gap-1 text-xs font-bold text-neutral-300 bg-[#1f1d1a] border border-[#36322d] px-2 py-1 rounded-md"
          >
            <IconGlobe3D size={13} />
            <span>{lang.toUpperCase()}</span>
          </button>
          <div
            onClick={() => setShowAuthModal(true)}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow cursor-pointer"
          >
            {currentUser.username.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* DESKTOP LEFT SIDEBAR (Hidden on Mobile) */}
      <aside className="hidden md:flex md:w-64 bg-[#262421] border-r border-[#36322d] flex-col justify-between p-3 shrink-0">
        <div>
          {/* Logo with 3D Pawn */}
          <div className="flex items-center gap-3 px-3 py-4 mb-3 cursor-pointer" onClick={() => setNavTab("play")}>
            <div className="w-10 h-10 rounded-xl bg-[#1f1d1a] border border-[#3d3a37] flex items-center justify-center shadow-lg">
              <IconPawn3D size={28} />
            </div>
            <div>
              <div className="font-black tracking-wider text-base uppercase leading-tight text-white flex items-center gap-1.5">
                FIF <span className="text-[#81b64c]">CHESS</span>
              </div>
              <div className="text-xs text-neutral-400 font-semibold tracking-wide">ARENA CATUR TEL-U</div>
            </div>
          </div>

          {/* Navigation Menu with 3D Icons */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setNavTab("play")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "play"
                  ? "bg-[#334621] text-white border-2 border-[#81b64c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[#24221f] text-neutral-300 hover:text-white border border-[#35322d] hover:bg-[#2c2925] active:bg-[#1c1a18] active:border-[#81b64c] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconPlay3D size={22} />
              <span>{lang === "id" ? "Bermain" : "Play"}</span>
            </button>

            <button
              onClick={() => setNavTab("puzzle")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "puzzle"
                  ? "bg-[#334621] text-white border-2 border-[#81b64c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[#24221f] text-neutral-300 hover:text-white border border-[#35322d] hover:bg-[#2c2925] active:bg-[#1c1a18] active:border-[#81b64c] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconPuzzle3D size={22} />
              <span>{lang === "id" ? "Teka-Teki" : "Puzzles"}</span>
            </button>

            <button
              onClick={() => setNavTab("review")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "review"
                  ? "bg-[#334621] text-white border-2 border-[#81b64c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[#24221f] text-neutral-300 hover:text-white border border-[#35322d] hover:bg-[#2c2925] active:bg-[#1c1a18] active:border-[#81b64c] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconMedal3D size={22} />
              <span>{lang === "id" ? "Review Blunder" : "Game Review"}</span>
            </button>

            <button
              onClick={() => setNavTab("coach")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "coach"
                  ? "bg-[#334621] text-white border-2 border-[#81b64c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[#24221f] text-neutral-300 hover:text-white border border-[#35322d] hover:bg-[#2c2925] active:bg-[#1c1a18] active:border-[#81b64c] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconBot3D size={22} />
              <span>{lang === "id" ? "AI Coach & Latih" : "AI Coach & Train"}</span>
            </button>

            <button
              onClick={() => setNavTab("vision")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "vision"
                  ? "bg-[#334621] text-white border-2 border-[#81b64c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[#24221f] text-neutral-300 hover:text-white border border-[#35322d] hover:bg-[#2c2925] active:bg-[#1c1a18] active:border-[#81b64c] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconVision3D size={22} />
              <span>{lang === "id" ? "Belajar & Quest" : "Learn & Quest"}</span>
            </button>

            <button
              onClick={() => setNavTab("scan")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "scan"
                  ? "bg-[#334621] text-white border-2 border-[#81b64c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[#24221f] text-neutral-300 hover:text-white border border-[#35322d] hover:bg-[#2c2925] active:bg-[#1c1a18] active:border-[#81b64c] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconScan3D size={22} />
              <span>{lang === "id" ? "Import Posisi" : "Import Position"}</span>
            </button>

            <button
              onClick={() => setNavTab("community")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "community"
                  ? "bg-[#334621] text-white border-2 border-[#81b64c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[#24221f] text-neutral-300 hover:text-white border border-[#35322d] hover:bg-[#2c2925] active:bg-[#1c1a18] active:border-[#81b64c] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconCommunity3D size={22} />
              <span>{lang === "id" ? "Komunitas FIF" : "FIF Community"}</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar: 3D Globe & User profile */}
        <div className="pt-4 border-t border-[#36322d] space-y-3">
          <div className="flex items-center justify-between px-2">
            <button
              onClick={() => setLang((l) => (l === "id" ? "en" : "id"))}
              className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-[#1f1d1a] border border-[#36322d] px-2.5 py-1.5 rounded-lg"
            >
              <IconGlobe3D size={16} />
              <span>{lang.toUpperCase()}</span>
            </button>
            <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
              Stockfish 15 NNUE
            </Badge>
          </div>

          <div
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1f1d1a] border border-[#36322d] cursor-pointer hover:border-[#81b64c] transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow">
              {currentUser.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate text-white">{currentUser.fullName}</div>
              <div className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm"></span>
                <span>{currentUser.role} ({currentUser.elo})</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col p-2.5 md:p-6 pb-24 md:pb-6 overflow-y-auto max-w-7xl mx-auto w-full">
        {navTab === "coach" && (
          <div className="space-y-4">
            {/* Coach sub-tab switcher */}
            <div className="flex bg-[#262421] p-1.5 rounded-2xl border border-[#36322d] w-full max-w-lg mx-auto shadow-lg">
              {([
                { id: "coach", labelId: "AI Coach", labelEn: "AI Coach" },
                { id: "spectator", labelId: "Jev vs Stockfish", labelEn: "Jev vs Stockfish" },
                { id: "guided", labelId: "Latihan Dipandu", labelEn: "Guided Practice" },
              ] as { id: CoachSubTab; labelId: string; labelEn: string }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCoachSubTab(tab.id)}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all ${coachSubTab === tab.id ? "bg-[#81b64c] text-white shadow-md" : "text-neutral-400 hover:text-white"}`}
                >
                  {lang === "id" ? tab.labelId : tab.labelEn}
                </button>
              ))}
            </div>
            {coachSubTab === "coach" && <CoachModeView lang={lang} />}
            {coachSubTab === "spectator" && (
              <SpectatorView
                lang={lang}
                onTryPosition={(fen, moves) => {
                  setGuidedStartFen(fen);
                  setGuidedStartMoves(moves);
                  setCoachSubTab("guided");
                }}
              />
            )}
            {coachSubTab === "guided" && (
              <GuidedPlayView lang={lang} startFen={guidedStartFen} startMoves={guidedStartMoves} />
            )}
          </div>
        )}
        {navTab === "vision" && <LearningHub lang={lang} />}
        {navTab === "puzzle" && <PuzzleView lang={lang} />}
        {navTab === "review" && (
          <GameReview
            history={gameHistory}
            onBackToPlay={() => setNavTab("play")}
            lang={lang}
          />
        )}
        {navTab === "scan" && <ScanView onLoadFen={(f) => { setFen(f); setNavTab("play"); }} lang={lang} />}
        {navTab === "community" && <CommunityView lang={lang} />}

        {navTab === "play" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 md:gap-6 items-start w-full">
            {/* CENTER CHESSBOARD */}
            <div className="flex flex-col items-center max-w-[640px] w-full mx-auto space-y-2">
              {/* Opponent Card (Top) with 3D Bot Icon / Player Icon */}
              <div className="w-full flex items-center justify-between px-3 py-2 bg-[#262421] rounded-xl border border-[#36322d] shadow-sm">
                <div className="flex items-center gap-2.5">
                  {playMode === "ai" ? <IconBot3D size={28} /> : <IconCommunity3D size={28} />}
                  <div>
                    <div className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{playMode === "ai"
                        ? (selectedAiOpponent === "jev-fly" ? "Jev + Fly Brain (Hybrid)" : selectedAiOpponent === "fly" ? "Fruit Fly Brain (134k)" : selectedAiOpponent === "jev" ? "Jev System One" : "Stockfish 15 NNUE")
                        : pvpOpponentName}</span>
                      <span className="text-xs font-normal text-neutral-400">
                        ({playMode === "ai" ? "3550" : "PvP Online"})
                      </span>
                    </div>
                    <div className="text-xs md:text-xs text-neutral-400 font-medium">
                      {thinking
                        ? (lang === "id" ? "Sedang menghitung..." : "Thinking...")
                        : (lang === "id" ? "Siap melangkah" : "Ready")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CapturedPiecesBar fen={fen} side={humanSide === "white" ? "black" : "white"} />
                  <div className="bg-[#1a1816] px-2.5 py-1 rounded-lg font-mono font-bold text-base md:text-xl text-white border border-[#36322d] shadow-inner">
                    {humanSide === "white" ? formattedBlackTime : formattedWhiteTime}
                  </div>
                </div>
              </div>

              {/* Chessboard (Responsive to Viewport Width) */}
              <div className="w-full aspect-square relative shadow-2xl rounded-xl md:rounded-2xl overflow-hidden border-2 border-[#45423e]">
                <Chessboard
                  options={{
                    id: "fif-chess-main",
                    position: fen,
                    boardOrientation: humanSide,
                    allowDragging: humanToMove,
                    canDragPiece,
                    onPieceDrop,
                    onSquareClick: ({ square }) => {
                      if (!humanToMove) return;
                      if (selectedSquare) {
                        if (selectedSquare === square) {
                          setSelectedSquare(null);
                          return;
                        }
                        if (tryHumanMove(selectedSquare, square)) return;
                      }
                      const piece = chess.get(square as Square);
                      const isHumanPiece =
                        piece &&
                        ((humanSide === "white" && piece.color === "w") ||
                          (humanSide === "black" && piece.color === "b"));
                      setSelectedSquare(isHumanPiece ? square : null);
                    },
                    squareStyles,
                    lightSquareStyle: { backgroundColor: "#f0d9b5" },
                    darkSquareStyle: { backgroundColor: "#b58863" },
                    animationDurationInMs: 200,
                    showNotation: true,
                  }}
                />
              </div>

              {/* Player Card (Bottom) */}
              <div className="w-full flex items-center justify-between px-3 py-2 bg-[#262421] rounded-xl border border-[#36322d] shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow">
                    {currentUser.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{currentUser.fullName}</span>
                      <span className="text-xs font-normal text-neutral-400">({currentUser.elo})</span>
                    </div>
                    <div className="text-xs md:text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                      <span>{humanSide === "white" ? (lang === "id" ? "Bidak Putih" : "White") : (lang === "id" ? "Bidak Hitam" : "Black")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CapturedPiecesBar fen={fen} side={humanSide} />
                  <div className="bg-[#1a1816] px-2.5 py-1 rounded-lg font-mono font-bold text-base md:text-xl text-white border border-[#36322d] shadow-inner">
                    {humanSide === "white" ? formattedWhiteTime : formattedBlackTime}
                  </div>
                </div>
              </div>

              {/* ACTION: CAPTURE OPPONENT TRICK INTO PUZZLES */}
              {moves.length > 0 && (
                <div className="w-full pt-1">
                  <button
                    onClick={saveOpponentTrick}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                      opponentTacticSaved
                        ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                        : "bg-[#262421] border-[#36322d] text-neutral-300 hover:text-white hover:border-[#81b64c]"
                    }`}
                  >
                    <span>{opponentTacticSaved ? "✓ Trik Lawan Berhasil Disimpan ke Teka-Teki!" : "Simpan Trik Lawan Ini Jadi Teka-Teki"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR (Control Panel) */}
            <div className="flex flex-col gap-3 md:gap-4 w-full">
              <Card className="bg-[#262421] border-[#36322d] shadow-xl rounded-xl md:rounded-2xl overflow-hidden">
                <CardHeader className="p-2.5 md:p-3 border-b border-[#36322d] bg-[#22201d]">
                  <div className="flex bg-[#191816] p-1 rounded-xl border border-[#36322d]">
                    <button
                      onClick={() => setRightTab("game-setup")}
                      className={`flex-1 py-1.5 md:py-2 text-xs font-bold rounded-lg transition-all ${
                        rightTab === "game-setup" ? "bg-[#81b64c] text-white shadow-md" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang === "id" ? "Permainan Baru" : "New Game"}
                    </button>
                    <button
                      onClick={() => setRightTab("analysis")}
                      className={`flex-1 py-1.5 md:py-2 text-xs font-bold rounded-lg transition-all ${
                        rightTab === "analysis" ? "bg-[#81b64c] text-white shadow-md" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang === "id" ? "Analisis Engine" : "Analysis"}
                    </button>
                    <button
                      onClick={() => setRightTab("moves")}
                      className={`flex-1 py-1.5 md:py-2 text-xs font-bold rounded-lg transition-all ${
                        rightTab === "moves" ? "bg-[#81b64c] text-white shadow-md" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang === "id" ? "Langkah" : "Moves"}
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 md:p-5 space-y-3 md:space-y-4">
                  {/* TAB 1: GAME SETUP OR ACTIVE MATCH HUB */}
                  {rightTab === "game-setup" && (
                    <div className="space-y-4">
                      {/* WHEN MATCH IS ACTIVE: HIDE SETUP BUTTONS AND SHOW LIVE CLOCKS & IN-GAME CONTROLS */}
                      {gameActive && !effectiveOutcome.over ? (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex justify-between items-center">
                            <span>Jam Catur Pertandingan</span>
                            <Badge className="bg-[#81b64c]/20 text-[#81b64c] border border-[#81b64c]/40 text-[10px]">
                              {timeMode === "unlimited" ? "Tanpa Batas" : timeMode}
                            </Badge>
                          </div>

                          {/* Opponent Live Clock */}
                          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            !humanToMove ? "bg-[#1f2a14] border-[#81b64c] shadow-md shadow-[#81b64c]/20" : "bg-[#171614] border-[#36322d]"
                          }`}>
                            <div>
                              <span className="text-xs font-bold text-neutral-300 block">
                                {playMode === "ai"
                                  ? (selectedAiOpponent === "jev-fly" ? "Jev + Fly Brain" : selectedAiOpponent === "fly" ? "Fruit Fly Brain" : selectedAiOpponent === "jev" ? "Jev System One" : "Stockfish 15")
                                  : pvpOpponentName}
                              </span>
                              {!humanToMove && <span className="text-[10px] text-[#81b64c] font-black animate-pulse">Sedang Berpikir...</span>}
                            </div>
                            <div className="font-mono font-black text-2xl text-white">
                              {humanSide === "white" ? formattedBlackTime : formattedWhiteTime}
                            </div>
                          </div>

                          {/* Player Live Clock */}
                          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            humanToMove ? "bg-[#1f2a14] border-[#81b64c] shadow-md shadow-[#81b64c]/20" : "bg-[#171614] border-[#36322d]"
                          }`}>
                            <div>
                              <span className="text-xs font-bold text-neutral-300 block">Anda (Player)</span>
                              {humanToMove && <span className="text-[10px] text-[#81b64c] font-black animate-pulse">Giliran Anda Melangkah</span>}
                            </div>
                            <div className="font-mono font-black text-2xl text-white">
                              {humanSide === "white" ? formattedWhiteTime : formattedBlackTime}
                            </div>
                          </div>

                          {/* In-Game Actions */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#36322d]">
                            <button
                              onClick={() => {
                                setCustomOutcome({
                                  over: true,
                                  winner: null,
                                  kind: "draw",
                                  label: "Remis — Kesepakatan Bersama",
                                });
                                setShowGameOverModal(true);
                              }}
                              className="btn-chess-dark py-2 px-3 rounded-xl text-xs font-bold text-neutral-300 hover:text-white"
                            >
                              Tawarkan Remis
                            </button>
                            <button
                              onClick={() => {
                                setCustomOutcome({
                                  over: true,
                                  winner: humanSide === "white" ? "black" : "white",
                                  kind: "resigned",
                                  label: "Kekalahan — Anda Menyerah",
                                });
                                setShowGameOverModal(true);
                              }}
                              className="btn-chess-dark py-2 px-3 rounded-xl text-xs font-bold text-red-400 hover:text-red-300"
                            >
                              Menyerah
                            </button>
                          </div>

                          <button
                            onClick={resetGame}
                            className="w-full py-2.5 rounded-xl text-xs font-bold border border-[#81b64c]/40 text-emerald-400 hover:text-white hover:bg-[#81b64c]/20 transition-all bg-[#171614] flex items-center justify-center gap-2"
                          >
                            <IconSwap3D size={15} />
                            <span>Reset Permainan</span>
                          </button>
                        </div>
                      ) : (
                        /* WHEN NO GAME IS RUNNING: SHOW SETUP CONTROLS */
                        <div className="space-y-3.5">
                          {/* 1. SELECT OPPONENT ENGINE */}
                          <div>
                            <label className="text-xs font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">
                              Pilih Lawan Bertanding:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "stockfish", label: "Stockfish 15 NNUE", sub: "Engine 3550+" },
                                { id: "jev-fly", label: "Jev + Fly Brain", sub: "Hybrid Neuro-Connectome" },
                                { id: "jev", label: "Jev System One", sub: "Semantic Reasoning" },
                                { id: "fly", label: "Fruit Fly Brain", sub: "Drosophila 134k" },
                              ].map(eng => (
                                <button
                                  key={eng.id}
                                  onClick={() => { setPlayMode("ai"); setSelectedAiOpponent(eng.id as any); }}
                                  className={`p-2 rounded-xl text-left border transition-all ${
                                    playMode === "ai" && selectedAiOpponent === eng.id
                                      ? "bg-[#3d3a37] border-[#81b64c] text-white shadow-sm"
                                      : "bg-[#1f1d1a] border-[#36322d] text-neutral-400 hover:text-white"
                                  }`}
                                >
                                  <div className="text-xs font-bold truncate">{eng.label}</div>
                                  <div className="text-[10px] text-neutral-500 truncate">{eng.sub}</div>
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setPlayMode("pvp")}
                              className={`w-full mt-2 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                playMode === "pvp"
                                  ? "bg-[#3d3a37] border-[#81b64c] text-white shadow"
                                  : "bg-[#1f1d1a] border-[#36322d] text-neutral-400 hover:text-white"
                              }`}
                            >
                              <IconCommunity3D size={16} />
                              <span>Lawan Pemain Nyata (PvP Online)</span>
                            </button>
                          </div>

                          {/* 2. DIFFICULTY */}
                          {playMode === "ai" && (
                            <div>
                              <label className="text-xs font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">
                                Tingkat Kesulitan AI:
                              </label>
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                {[
                                  { depth: 3, label: "Mudah", elo: "~800" },
                                  { depth: 8, label: "Sedang", elo: "~1600" },
                                  { depth: 14, label: "Expert", elo: "3550+" },
                                ].map(lvl => (
                                  <button
                                    key={lvl.depth}
                                    onClick={() => setAiDepth(lvl.depth)}
                                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                                      aiDepth === lvl.depth
                                        ? "bg-[#3d3a37] border-[#81b64c] text-white shadow-sm"
                                        : "bg-[#1f1d1a] border-[#36322d] text-neutral-400 hover:text-white"
                                    }`}
                                  >
                                    <div>{lvl.label}</div>
                                    <div className="text-[10px] text-neutral-500">{lvl.elo}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 3. TIME CONTROL */}
                          {playMode === "ai" && (
                            <div>
                              <label className="text-xs font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">
                                Kontrol Waktu Permainan:
                              </label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[
                                  { id: "5m", label: "5 Menit" },
                                  { id: "10m", label: "10 Menit" },
                                  { id: "30m", label: "30 Menit" },
                                  { id: "60m", label: "1 Jam" },
                                  { id: "120m", label: "2 Jam" },
                                  { id: "unlimited", label: "Tanpa Batas" },
                                ].map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() => setTimeMode(t.id)}
                                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                                      timeMode === t.id
                                        ? "bg-[#3d3a37] border-[#81b64c] text-white shadow-sm"
                                        : "bg-[#1f1d1a] border-[#36322d] text-neutral-400 hover:text-white"
                                    }`}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4. BIG START MATCH BUTTON */}
                          {playMode === "ai" && (
                            <div className="space-y-2 pt-1">
                              <button
                                onClick={() => startGame("white")}
                                className="btn-chess-green w-full py-3 rounded-xl font-black text-sm md:text-base tracking-wider shadow-lg uppercase cursor-pointer flex items-center justify-center gap-2"
                              >
                                <IconPlay3D size={20} />
                                <span>Mulai Sebagai Putih</span>
                              </button>
                              <button
                                onClick={() => startGame("black")}
                                className="btn-chess-dark w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                              >
                                <IconSwap3D size={14} />
                                <span>Main Sebagai Hitam</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ENGINE ANALYSIS */}
                  {rightTab === "analysis" && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400">{lang === "id" ? "Kedalaman Kalkulasi:" : "Engine Depth:"}</span>
                        <span className="font-mono text-emerald-400 font-bold">Depth 14+ (Elo 3550)</span>
                      </div>
                      <JevDistribution analysis={analysis} thinking={thinking} />
                    </div>
                  )}

                  {/* TAB 3: MOVES */}
                  {rightTab === "moves" && (
                    <div className="space-y-2">
                      <div className="text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1">
                        {lang === "id" ? "Notasi Langkah Catur (FEN/SAN):" : "Chess Notation (FEN/SAN):"}
                      </div>
                      <MoveList moves={moves} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#262421]/95 backdrop-blur-md border-t border-[#36322d] shadow-2xl overflow-x-auto">
        <div className="flex justify-around items-center py-2 px-1 gap-1 min-w-full">
          {[
            { id: "play", icon: IconPlay3D, labelId: "Bermain", labelEn: "Play" },
            { id: "coach", icon: IconCoach3D, labelId: "Latih", labelEn: "Train" },
            { id: "puzzle", icon: IconPuzzle3D, labelId: "Puzzle", labelEn: "Puzzle" },
            { id: "vision", icon: IconVision3D, labelId: "Belajar", labelEn: "Learn" },
            { id: "review", icon: IconMedal3D, labelId: "Review", labelEn: "Review" },
            { id: "community", icon: IconCommunity3D, labelId: "Klub", labelEn: "Club" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setNavTab(tab.id as NavTab)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all min-w-[56px] ${
                navTab === tab.id ? "text-white font-bold" : "text-neutral-400 font-medium hover:text-white"
              }`}
            >
              <div className={`p-1 rounded-lg ${navTab === tab.id ? "bg-[#3d3a37] text-white" : ""}`}>
                <tab.icon size={20} />
              </div>
              <span className="text-[10px] leading-none">{lang === "id" ? tab.labelId : tab.labelEn}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* MODAL USER PROFILE / LOGIN / DAFTAR */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#262421] border border-[#36322d] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#36322d] pb-3">
              <h3 className="font-bold text-base text-white">Akun Pemain & Profil Tel-U</h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-[#191816] rounded-xl border border-[#36322d] space-y-1">
              <div className="text-xs text-neutral-400">Akun Aktif:</div>
              <div className="font-bold text-white text-sm">{currentUser.fullName}</div>
              <div className="text-xs text-emerald-400">{currentUser.role} — Rating {currentUser.elo} ELO</div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-neutral-300">Daftar Akun Baru / Ganti Pengguna:</div>
              <input
                type="text"
                placeholder="Nama Lengkap (misal: Budi Santoso)"
                value={authInputName}
                onChange={(e) => setAuthInputName(e.target.value)}
                className="w-full bg-[#191816] border border-[#36322d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#81b64c]"
              />
              <input
                type="text"
                placeholder="Username (misal: budisantoso)"
                value={authInputUsername}
                onChange={(e) => setAuthInputUsername(e.target.value)}
                className="w-full bg-[#191816] border border-[#36322d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#81b64c]"
              />
              <input
                type="text"
                placeholder="Fakultas / Kelas (misal: S1 IF-45-02)"
                value={authInputRole}
                onChange={(e) => setAuthInputRole(e.target.value)}
                className="w-full bg-[#191816] border border-[#36322d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#81b64c]"
              />

              <Button
                onClick={() => {
                  if (!authInputUsername.trim() || !authInputName.trim()) return;
                  const u = registerUser(authInputUsername, authInputName, authInputRole);
                  setCurrentUser(u);
                  setShowAuthModal(false);
                  setAuthInputName("");
                  setAuthInputUsername("");
                }}
                className="w-full bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs py-2.5"
              >
                Simpan & Masuk Akun
              </Button>
            </div>
          </div>
        </div>
      )}

      <GameOverModal
        outcome={effectiveOutcome}
        humanSide={humanSide}
        lang={lang}
        open={showGameOverModal}
        onClose={() => setShowGameOverModal(false)}
        onNewGame={() => startGame(humanSide)}
      />

      <PromotionDialog
        open={pendingPromotion !== null}
        side={humanSide}
        onCancel={() => setPendingPromotion(null)}
        onPick={(piece) => {
          if (!pendingPromotion) return;
          tryHumanMove(pendingPromotion.from, pendingPromotion.to, piece);
        }}
      />
    </div>
  );
}
