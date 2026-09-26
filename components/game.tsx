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
import { PuzzleView } from "@/components/puzzle-view";
import type { Puzzle } from "@/lib/puzzle-data";
import { loadSaved, persistSaved } from "@/lib/puzzle-store";
import { ScanView } from "@/components/scan-view";
import { CommunityView } from "@/components/community-view";
import { GameReview } from "@/components/game-review";
import { AuthPanel } from "@/components/auth-panel";
import { AdminPanel } from "@/components/admin-panel";
import { PvpPanel, type PvpRoom } from "@/components/pvp-panel";
import { ClockMovesFullscreen } from "@/components/clock-moves-fullscreen";
import { useSession } from "@/lib/use-session";
import { useGameHistory, type GameRecord } from "@/lib/game-history";
import { CoachModeView } from "@/components/coach-mode-view";
import { SpectatorView } from "@/components/spectator-view";
import { GuidedPlayView } from "@/components/guided-play-view";
import { GameOverModal } from "@/components/game-over-modal";
import { useChessClock } from "@/lib/use-chess-clock";
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
  replaySanList,
  isPromotionAttempt,
  sideToMove,
  type PromotionPiece,
  type Side,
  type GameOutcome,
} from "@/lib/chess";
import type { JevAnalysis, JevError, PlayedMove } from "@/lib/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const AI_LABEL: Record<string, string> = {
  stockfish: "Stockfish 15 NNUE",
  "jev-fly": "Jev + Fly Brain",
  jev: "Jev System One",
  fly: "Fruit Fly Brain",
};

type PendingPromotion = { from: string; to: string };
type NavTab = "play" | "puzzle" | "vision" | "scan" | "community" | "review" | "coach" | "admin";
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

  // Identitas: satu session server-side (cookie httpOnly). Tidak ada lagi
  // identitas client-side yang bisa dipalsukan.
  const { user: currentUser, login, register, logout } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [fullscreenClocks, setFullscreenClocks] = useState(false);

  // Sisi yang dipilih pemain. "random" di-resolve sekali di sini lalu dipakai
  // ke AI maupun PvP supaya tidak ada ketidaksamaan antar menu.
  const [sideChoice, setSideChoice] = useState<"white" | "black" | "random">("white");
  // "random" diundi SEKALI saat permainan dimulai, lalu meng jadi nilai tetap
  // supaya board, jam, dan nama kartu tidak berganti di tengah jalan.
  const [sideResolved, setSideResolved] = useState<"white" | "black">("white");

  // Nama tampilan untuk kartu pemain. guest = belum masuk; tidak pernah
  // menyentuh currentUser tanpa dijaga null.
  const me = currentUser
    ? { name: currentUser.fullName, tag: `@${currentUser.username}`, elo: currentUser.elo, initials: currentUser.username.slice(0, 2).toUpperCase() }
    : { name: "Tamu", tag: "belum masuk", elo: null as number | null, initials: "?" };

  // PvP Real-time State
  const [playMode, setPlayMode] = useState<PlayMode>("ai");
  const [pvpRoom, setPvpRoom] = useState<PvpRoom | null>(null);
  const [pvpToken, setPvpToken] = useState<string>("");
  const [pvpJoinInput, setPvpJoinInput] = useState<string>("");
  const [pvpStatus, setPvpStatus] = useState<"idle" | "waiting" | "active" | "finished">("idle");
  const [pvpOpponentName, setPvpOpponentName] = useState<string>("Lawan Online");
  const [opponentTacticSaved, setOpponentTacticSaved] = useState<boolean>(false);
  const pvpRoomCode = pvpRoom?.code ?? "";

  // Riwayat satu sumber: lib/game-history.ts (dibaca juga oleh tab Riwayat).
  const { history: gameHistory, record: recordGameResult } = useGameHistory();

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

  // Catat permainan selesai ke riwayat. playedAt = epoch ms supaya tab
  // Riwayat bisa mengurutkan dan menampilkan tanggal+jam dengan benar.
  useEffect(() => {
    if (!effectiveOutcome.over || moves.length === 0) return;
    recordGameResult({
      opponent: playMode === "ai" ? AI_LABEL[selectedAiOpponent] : pvpOpponentName,
      humanSide,
      outcomeKind: effectiveOutcome.kind,
      winner: effectiveOutcome.winner,
      moves: moves.map((m) => m.san),
      mode: playMode,
      timeMode,
    });
  }, [effectiveOutcome.over, moves, playMode, humanSide, effectiveOutcome.kind, effectiveOutcome.winner, pvpOpponentName, selectedAiOpponent, timeMode, recordGameResult]);

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
      // "Acak" diundi di sini, sekali, lalu meng jadi nilai tetap.
      const resolved: Side = sideChoice === "random" ? (Math.random() < 0.5 ? "white" : "black") : side;
      setSideResolved(resolved);
      requestGen.current += 1;
      try { chess.load(START_FEN); } catch (_) {}
      setHumanSide(resolved);
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
      if (playMode === "ai" && resolved === "black") {
        void askEngine(START_FEN);
      }
    },
    [askEngine, timeMode, resetClocks, playMode, chess, sideChoice],
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
      track: "puzzle",
      motif: "capture",
      fen: prevFen,
      turn: humanSide === "white" ? "b" : "w",
      solutionUci: lastM.uci,
      solutionSan: lastM.san,
      theme: "Trik Taktis Lawan (Live Match)",
      description: `Langkah taktis ${lastM.san} yang dilancarkan oleh ${playMode === "ai" ? "Stockfish 15 NNUE" : pvpOpponentName} saat pertandingan langsung.`,
      hintPiece: `Perhatikan posisi bidak ${lastM.uci.slice(0, 2)}.`,
      hintExplanation: `Langkahkan ke petak ${lastM.uci.slice(2, 4)} untuk mereplikasi taktik kemenangan lawan.`,
      xp: 15,
      trickExplanation: `Taktik dari Lawan: Langkah ${lastM.san} berhasil mengubah dinamika papan. Menganalisis dan memecahkan kembali langkah ini melatih refleks taktis menghadapi serangan serupa di turnamen nyata.`,
    };

    try {
      // Lewat store yang sama dengan Bank Teka-Teki, supaya triiknya benar-benar
      // muncul di bank; key sendiri tidak akan dibaca siapa pun.
      const list = loadSaved().filter((p) => p.id !== newPuzzle.id);
      persistSaved([{ ...newPuzzle, savedAt: Date.now(), source: "live" }, ...list]);
      setOpponentTacticSaved(true);
      setTimeout(() => setOpponentTacticSaved(false), 3000);
    } catch {}
  };

  // PvP Room: Polling Loop for Multiplayer Sync
  useEffect(() => {
    if (playMode !== "pvp" || !pvpRoomCode || pvpStatus === "finished") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pvp?room=${pvpRoomCode}`, {
          cache: "no-store",
          headers: pvpToken ? { "x-player-token": pvpToken } : undefined,
        });
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

  // Room PvP dibuat/diambil lewat PvpPanel; di sini hanya diterjemahkan ke
  // state papan supaya sisi yang dipilih pemain jadi sisi sebenarnya.
  const onPvpRoom = useCallback(
    (room: PvpRoom, side: Side, token: string) => {
      setPvpRoom(room);
      setPvpToken(token);
      setPlayMode("pvp");
      setHumanSide(side);
      setPvpStatus(room.status === "waiting" ? "waiting" : room.status === "finished" ? "finished" : "active");
      setPvpOpponentName(
        (side === "white" ? room.blackUser : room.whiteUser) || (room.invitedUser ?? "Lawan Online")
      );
      setFen(room.fen);
      setMoves(
        replaySanList(START_FEN, room.moves).map((m, i) => ({
          san: m.san,
          uci: m.uci,
          by: i % 2 === 0 ? "human" : "jev",
          ply: i + 1,
        })),
      );
      setGameActive(true);
    },
    [],
  );

  const leavePvpRoom = useCallback(() => {
    if (pvpRoomCode) {
      void fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", code: pvpRoomCode, token: pvpToken }),
      });
    }
    setPvpRoom(null);
    setPvpToken("");
    setPvpStatus("idle");
    setPlayMode("ai");
    setGameActive(false);
    resetGame();
  }, [pvpRoomCode, pvpToken, resetGame]);

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
        boxShadow: "inset 0 0 0 4px var(--primary)",
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
              boxShadow: "inset 0 0 0 4px var(--destructive)",
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
    <div className="flex flex-col md:flex-row min-h-screen bg-[var(--muted)] text-white">
      {/* MOBILE TOP BAR (Hidden on Desktop) */}
      <header className="flex md:hidden items-center justify-between px-3.5 py-2.5 bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setNavTab("play")}>
          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--muted)] flex items-center justify-center shadow">
            <IconPlay3D size={20} />
          </div>
          <div>
            <div className="font-black text-sm uppercase leading-tight text-white flex items-center gap-1">
              FIF <span className="text-[var(--primary)]">CHESS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang((l) => (l === "id" ? "en" : "id"))}
            className="flex items-center gap-1 text-xs font-bold text-neutral-300 bg-[var(--surface)] border border-[var(--border)] px-2 py-1 rounded-md"
          >
            <IconGlobe3D size={13} />
            <span>{lang.toUpperCase()}</span>
          </button>
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow cursor-pointer"
            title={currentUser ? `@${currentUser.username}` : "Masuk / daftar"}
            aria-label={currentUser ? `Akun @${currentUser.username}` : "Masuk atau daftar"}
          >
            {currentUser ? currentUser.username.slice(0, 2).toUpperCase() : "?"}
          </button>
        </div>
      </header>

      {/* DESKTOP LEFT SIDEBAR (Hidden on Mobile) */}
      <aside className="hidden md:flex md:w-64 bg-[var(--card)] border-r border-[var(--border)] flex-col justify-between p-3 shrink-0">
        <div>
          {/* Logo with 3D Pawn */}
          <div className="flex items-center gap-3 px-3 py-4 mb-3 cursor-pointer" onClick={() => setNavTab("play")}>
            <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--muted)] flex items-center justify-center shadow-lg">
              <IconPawn3D size={28} />
            </div>
            <div>
              <div className="font-black tracking-wider text-base uppercase leading-tight text-white flex items-center gap-1.5">
                FIF <span className="text-[var(--primary)]">CHESS</span>
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
                  ? "bg-[var(--primary-strong)] text-white border-2 border-[var(--primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[var(--surface)] text-neutral-300 hover:text-white border border-[var(--border)] hover:bg-[var(--surface)] active:bg-[var(--background)] active:border-[var(--primary)] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconPlay3D size={22} />
              <span>{lang === "id" ? "Bermain" : "Play"}</span>
            </button>

            <button
              onClick={() => setNavTab("puzzle")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "puzzle"
                  ? "bg-[var(--primary-strong)] text-white border-2 border-[var(--primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[var(--surface)] text-neutral-300 hover:text-white border border-[var(--border)] hover:bg-[var(--surface)] active:bg-[var(--background)] active:border-[var(--primary)] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconPuzzle3D size={22} />
              <span>{lang === "id" ? "Teka-Teki" : "Puzzles"}</span>
            </button>

            <button
              onClick={() => setNavTab("review")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "review"
                  ? "bg-[var(--primary-strong)] text-white border-2 border-[var(--primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[var(--surface)] text-neutral-300 hover:text-white border border-[var(--border)] hover:bg-[var(--surface)] active:bg-[var(--background)] active:border-[var(--primary)] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconMedal3D size={22} />
              <span>{lang === "id" ? "Review Blunder" : "Game Review"}</span>
            </button>

            <button
              onClick={() => setNavTab("coach")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "coach"
                  ? "bg-[var(--primary-strong)] text-white border-2 border-[var(--primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[var(--surface)] text-neutral-300 hover:text-white border border-[var(--border)] hover:bg-[var(--surface)] active:bg-[var(--background)] active:border-[var(--primary)] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconBot3D size={22} />
              <span>{lang === "id" ? "AI Coach & Latih" : "AI Coach & Train"}</span>
            </button>

            {currentUser?.isAdmin && (
              <button
                onClick={() => setNavTab("admin")}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                  navTab === "admin"
                    ? "bg-[var(--primary-strong)] text-white border-2 border-[var(--primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                    : "bg-[var(--surface)] text-neutral-300 hover:text-white border border-[var(--border)] hover:bg-[var(--surface)]"
                }`}
                aria-current={navTab === "admin"}
              >
                <IconMedal3D size={22} />
                <span>Admin</span>
              </button>
            )}

            <button
              onClick={() => setNavTab("vision")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "vision"
                  ? "bg-[var(--primary-strong)] text-white border-2 border-[var(--primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[var(--surface)] text-neutral-300 hover:text-white border border-[var(--border)] hover:bg-[var(--surface)] active:bg-[var(--background)] active:border-[var(--primary)] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconVision3D size={22} />
              <span>{lang === "id" ? "Belajar & Quest" : "Learn & Quest"}</span>
            </button>

            <button
              onClick={() => setNavTab("scan")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "scan"
                  ? "bg-[var(--primary-strong)] text-white border-2 border-[var(--primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[var(--surface)] text-neutral-300 hover:text-white border border-[var(--border)] hover:bg-[var(--surface)] active:bg-[var(--background)] active:border-[var(--primary)] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconScan3D size={22} />
              <span>{lang === "id" ? "Import Posisi" : "Import Position"}</span>
            </button>

            <button
              onClick={() => setNavTab("community")}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm md:text-base font-bold transition-all text-left ${
                navTab === "community"
                  ? "bg-[var(--primary-strong)] text-white border-2 border-[var(--primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_3px_8px_rgba(129,182,76,0.3)] translate-y-[1px]"
                  : "bg-[var(--surface)] text-neutral-300 hover:text-white border border-[var(--border)] hover:bg-[var(--surface)] active:bg-[var(--background)] active:border-[var(--primary)] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] active:translate-y-[1px]"
              }`}
            >
              <IconCommunity3D size={22} />
              <span>{lang === "id" ? "Komunitas FIF" : "FIF Community"}</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar: 3D Globe & User profile */}
        <div className="pt-4 border-t border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between px-2">
            <button
              onClick={() => setLang((l) => (l === "id" ? "en" : "id"))}
              className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1.5 rounded-lg"
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] cursor-pointer hover:border-[var(--primary)] transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow">
              {me.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate text-white">{me.name}</div>
              <div className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm"></span>
                <span>{currentUser ? `${currentUser.role} (${currentUser.elo})` : "Masuk untuk rating"}</span>
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
            <div className="flex bg-[var(--card)] p-1.5 rounded-2xl border border-[var(--border)] w-full max-w-lg mx-auto shadow-lg">
              {([
                { id: "coach", labelId: "AI Coach", labelEn: "AI Coach" },
                { id: "spectator", labelId: "Jev vs Stockfish", labelEn: "Jev vs Stockfish" },
                { id: "guided", labelId: "Latihan Dipandu", labelEn: "Guided Practice" },
              ] as { id: CoachSubTab; labelId: string; labelEn: string }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCoachSubTab(tab.id)}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all ${coachSubTab === tab.id ? "bg-[var(--primary)] text-white shadow-md" : "text-neutral-400 hover:text-white"}`}
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
        {navTab === "community" && <CommunityView user={currentUser} lang={lang} />}
        {navTab === "admin" && <AdminPanel user={currentUser} />}

        {navTab === "play" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 md:gap-6 items-start w-full">
            {/* CENTER CHESSBOARD */}
            <div className="flex flex-col items-center max-w-[640px] w-full mx-auto space-y-2">
              {/* Opponent Card (Top) with 3D Bot Icon / Player Icon */}
              <div className="w-full flex items-center justify-between px-3 py-2 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
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
                  <div className="bg-[var(--background)] px-2.5 py-1 rounded-lg font-mono font-bold text-base md:text-xl text-white border border-[var(--border)] shadow-inner">
                    {humanSide === "white" ? formattedBlackTime : formattedWhiteTime}
                  </div>
                </div>
              </div>

              {/* Chessboard (Responsive to Viewport Width) */}
              <div className="w-full aspect-square relative shadow-2xl rounded-xl md:rounded-2xl overflow-hidden border-2 border-[var(--border-strong)]">
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
                    lightSquareStyle: { backgroundColor: "var(--board-light)" },
                    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                    animationDurationInMs: 200,
                    showNotation: true,
                  }}
                />
              </div>

              {/* Player Card (Bottom) */}
              <div className="w-full flex items-center justify-between px-3 py-2 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow">
                    {me.initials}
                  </div>
                  <div>
                    <div className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{me.name}</span>
                      {me.elo !== null && <span className="text-xs font-normal text-neutral-400">({me.elo})</span>}
                    </div>
                    <div className="text-xs md:text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                      <span>{humanSide === "white" ? (lang === "id" ? "Bidak Putih" : "White") : (lang === "id" ? "Bidak Hitam" : "Black")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CapturedPiecesBar fen={fen} side={humanSide} />
                  <div className="bg-[var(--background)] px-2.5 py-1 rounded-lg font-mono font-bold text-base md:text-xl text-white border border-[var(--border)] shadow-inner">
                    {humanSide === "white" ? formattedWhiteTime : formattedBlackTime}
                  </div>
                </div>
              </div>

              {/* ACTION: fullscreen jam + log, dan simpan trik lawan */}
              <div className="w-full flex items-center gap-2">
                <button
                  onClick={() => setFullscreenClocks(true)}
                  className="ctl ctl-sm"
                  aria-label="Layar penuh: jam dan riwayat langkah"
                >
                  <IconClock3D size={14} />
                  <span>Jam &amp; Log</span>
                </button>
                {moves.length > 0 && (
                <button
                    onClick={saveOpponentTrick}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                      opponentTacticSaved
                        ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                        : "bg-[var(--card)] border-[var(--border)] text-neutral-300 hover:text-white hover:border-[var(--primary)]"
                    }`}
                  >
                    <span>{opponentTacticSaved ? "✓ Trik Lawan Berhasil Disimpan ke Teka-Teki!" : "Simpan Trik Lawan Ini Jadi Teka-Teki"}</span>
                </button>
                )}
              </div>
              {fullscreenClocks && (
                <ClockMovesFullscreen
                  fen={fen}
                  moves={moves}
                  whiteName={
                    humanSide === "white"
                      ? `${currentUser?.fullName ?? "Kamu"} (kamu)`
                      : playMode === "ai"
                        ? AI_LABEL[selectedAiOpponent]
                        : pvpOpponentName
                  }
                  blackName={
                    humanSide === "black"
                      ? `${currentUser?.fullName ?? "Kamu"} (kamu)`
                      : playMode === "ai"
                        ? AI_LABEL[selectedAiOpponent]
                        : pvpOpponentName
                  }
                  whiteTime={formattedWhiteTime}
                  blackTime={formattedBlackTime}
                  activeSide={effectiveOutcome.over ? null : turn}
                  onClose={() => setFullscreenClocks(false)}
                />
              )}
            </div>

            {/* RIGHT SIDEBAR (Control Panel) */}
            <div className="flex flex-col gap-3 md:gap-4 w-full">
              <Card className="bg-[var(--card)] border-[var(--border)] shadow-xl rounded-xl md:rounded-2xl overflow-hidden">
                <CardHeader className="p-2.5 md:p-3 border-b border-[var(--border)] bg-[var(--muted)]">
                  <div className="flex bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
                    <button
                      onClick={() => setRightTab("game-setup")}
                      className={`flex-1 py-1.5 md:py-2 text-xs font-bold rounded-lg transition-all ${
                        rightTab === "game-setup" ? "bg-[var(--primary)] text-white shadow-md" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang === "id" ? "Permainan Baru" : "New Game"}
                    </button>
                    <button
                      onClick={() => setRightTab("analysis")}
                      className={`flex-1 py-1.5 md:py-2 text-xs font-bold rounded-lg transition-all ${
                        rightTab === "analysis" ? "bg-[var(--primary)] text-white shadow-md" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang === "id" ? "Analisis Engine" : "Analysis"}
                    </button>
                    <button
                      onClick={() => setRightTab("moves")}
                      className={`flex-1 py-1.5 md:py-2 text-xs font-bold rounded-lg transition-all ${
                        rightTab === "moves" ? "bg-[var(--primary)] text-white shadow-md" : "text-neutral-400 hover:text-white"
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
                            <Badge className="bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/40 text-[10px]">
                              {timeMode === "unlimited" ? "Tanpa Batas" : timeMode}
                            </Badge>
                          </div>

                          {/* Opponent Live Clock */}
                          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            !humanToMove ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-md shadow-[var(--primary)]/20" : "bg-[var(--background)] border-[var(--border)]"
                          }`}>
                            <div>
                              <span className="text-xs font-bold text-neutral-300 block">
                                {playMode === "ai"
                                  ? (selectedAiOpponent === "jev-fly" ? "Jev + Fly Brain" : selectedAiOpponent === "fly" ? "Fruit Fly Brain" : selectedAiOpponent === "jev" ? "Jev System One" : "Stockfish 15")
                                  : pvpOpponentName}
                              </span>
                              {!humanToMove && <span className="text-[10px] text-[var(--primary)] font-black animate-pulse">Sedang Berpikir...</span>}
                            </div>
                            <div className="font-mono font-black text-2xl text-white">
                              {humanSide === "white" ? formattedBlackTime : formattedWhiteTime}
                            </div>
                          </div>

                          {/* Player Live Clock */}
                          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            humanToMove ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-md shadow-[var(--primary)]/20" : "bg-[var(--background)] border-[var(--border)]"
                          }`}>
                            <div>
                              <span className="text-xs font-bold text-neutral-300 block">Anda (Player)</span>
                              {humanToMove && <span className="text-[10px] text-[var(--primary)] font-black animate-pulse">Giliran Anda Melangkah</span>}
                            </div>
                            <div className="font-mono font-black text-2xl text-white">
                              {humanSide === "white" ? formattedWhiteTime : formattedBlackTime}
                            </div>
                          </div>

                          {/* In-Game Actions */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]">
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
                              className="ctl ctl-sm ctl-quiet"
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
                              className="ctl ctl-sm ctl-danger"
                            >
                              Menyerah
                            </button>
                          </div>

                          <button
                            onClick={resetGame}
                            className="w-full py-2.5 rounded-xl text-xs font-bold border border-[var(--primary)]/40 text-emerald-400 hover:text-white hover:bg-[var(--primary)]/20 transition-all bg-[var(--background)] flex items-center justify-center gap-2"
                          >
                            <IconSwap3D size={15} />
                            <span>Reset Permainan</span>
                          </button>
                        </div>
                      ) : (
                        /* SETUP — satu design system, satu sumber kebenaran sisi. */
                        <div className="stack">
                          <div className="stack-tight">
                            <span className="label">Lawan</span>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "stockfish", label: "Stockfish 15 NNUE", sub: "Engine 3550+" },
                                { id: "jev-fly", label: "Jev + Fly Brain", sub: "Hybrid" },
                                { id: "jev", label: "Jev System One", sub: "Semantik" },
                                { id: "fly", label: "Fruit Fly Brain", sub: "134k neuron" },
                              ].map((eng) => (
                                <button
                                  key={eng.id}
                                  onClick={() => { setPlayMode("ai"); setSelectedAiOpponent(eng.id as any); }}
                                  className={`ctl ctl-tile ${playMode === "ai" && selectedAiOpponent === eng.id ? "ctl-active" : ""}`}
                                  aria-pressed={playMode === "ai" && selectedAiOpponent === eng.id}
                                >
                                  <span className="ctl-tile-title">{eng.label}</span>
                                  <span className="ctl-tile-sub">{eng.sub}</span>
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setPlayMode("pvp")}
                              className={`ctl ctl-tile ctl-tile-wide ${playMode === "pvp" ? "ctl-active" : ""}`}
                              aria-pressed={playMode === "pvp"}
                            >
                              <IconCommunity3D size={16} />
                              <span className="ctl-tile-title">Lawan Pemain Nyata (PvP Online)</span>
                            </button>
                          </div>

                          {/* Sisi: dipilih sekali, dipakai AI dan PvP alike. */}
                          <div className="stack-tight">
                            <span className="label">Sisi kamu</span>
                            <div className="row" style={{ gap: "0.5rem" }}>
                              {([
                                { id: "white", label: "Putih" },
                                { id: "random", label: "Acak" },
                                { id: "black", label: "Hitam" },
                              ] as const).map((sc) => (
                                <button
                                  key={sc.id}
                                  onClick={() => setSideChoice(sc.id)}
                                  className={`ctl ctl-sm ctl-choice ${sideChoice === sc.id ? "ctl-active" : ""}`}
                                  aria-pressed={sideChoice === sc.id}
                                >
                                  {sc.label}
                                </button>
                              ))}
                            </div>
                            <p className="prose-note" style={{ fontSize: "var(--text-xs)" }}>
                              Sisi yang kamu pilih di sini yang diletakkan di bawah bidak. Berlaku sama di duel
                              engine maupun PvP.
                            </p>
                          </div>

                          {playMode === "pvp" ? (
                            <PvpPanel
                              user={currentUser}
                              room={pvpRoom}
                              yourSide={pvpRoom ? humanSide : null}
                              token={pvpToken}
                              onRoom={onPvpRoom}
                              onLeave={leavePvpRoom}
                            />
                          ) : (
                            <>
                              <div className="stack-tight">
                                <span className="label">Tingkat kesulitan</span>
                                <div className="row" style={{ gap: "0.5rem" }}>
                                  {[
                                    { depth: 3, label: "Mudah", elo: "~800" },
                                    { depth: 8, label: "Sedang", elo: "~1600" },
                                    { depth: 14, label: "Expert", elo: "3550+" },
                                  ].map((lvl) => (
                                    <button
                                      key={lvl.depth}
                                      onClick={() => setAiDepth(lvl.depth)}
                                      className={`ctl ctl-sm ctl-choice ${aiDepth === lvl.depth ? "ctl-active" : ""}`}
                                      aria-pressed={aiDepth === lvl.depth}
                                    >
                                      {lvl.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="stack-tight">
                                <span className="label">Kontrol waktu</span>
                                <div className="row" style={{ gap: "0.5rem" }}>
                                  {[
                                    { id: "5m", label: "5 mnt" },
                                    { id: "10m", label: "10 mnt" },
                                    { id: "30m", label: "30 mnt" },
                                    { id: "60m", label: "1 jam" },
                                    { id: "120m", label: "2 jam" },
                                    { id: "unlimited", label: "Tanpa batas" },
                                  ].map((t) => (
                                    <button
                                      key={t.id}
                                      onClick={() => setTimeMode(t.id)}
                                      className={`ctl ctl-xs ctl-choice ${timeMode === t.id ? "ctl-active" : ""}`}
                                      aria-pressed={timeMode === t.id}
                                    >
                                      {t.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <button
                                onClick={() => startGame(sideChoice === "random" ? "white" : sideChoice)}
                                className="ctl ctl-lg ctl-primary"
                              >
                                <IconPlay3D size={18} />
                                <span>Mulai sebagai {sideChoice === "random" ? "sisi acak" : sideChoice === "white" ? "Putih" : "Hitam"}</span>
                              </button>
                            </>
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
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)]/95 backdrop-blur-md border-t border-[var(--border)] shadow-2xl overflow-x-auto">
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
              <div className={`p-1 rounded-lg ${navTab === tab.id ? "bg-[var(--muted)] text-white" : ""}`}>
                <tab.icon size={20} />
              </div>
              <span className="text-[10px] leading-none">{lang === "id" ? tab.labelId : tab.labelEn}</span>
            </button>
          ))}
        </div>
      </nav>

      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <AuthPanel
            user={currentUser}
            onClose={() => setShowAuthModal(false)}
            onLogin={login}
            onRegister={register}
            onLogout={logout}
          />
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
