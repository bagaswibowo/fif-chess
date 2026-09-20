"use client";

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
import { VisionDrill } from "@/components/vision-drill";
import { PuzzleView } from "@/components/puzzle-view";
import { ScanView } from "@/components/scan-view";
import { CommunityView } from "@/components/community-view";
import { GameOverModal } from "@/components/game-over-modal";
import { useChessClock } from "@/lib/use-chess-clock";
import {
  IconPawn3D,
  IconPuzzle3D,
  IconVision3D,
  IconScan3D,
  IconCommunity3D,
  IconBot3D,
  IconLightning3D,
  IconClock3D,
  IconSwap3D,
  IconGlobe3D,
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
type NavTab = "play" | "puzzle" | "vision" | "scan" | "community";
type RightTab = "game-setup" | "analysis" | "moves";

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
  const [rightTab, setRightTab] = useState<RightTab>("game-setup");
  const [lang, setLang] = useState<"id" | "en">("id");
  const [timeMode, setTimeMode] = useState<string>("5m");

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
        const response = await fetch("/api/jev-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fen: position }),
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
    [],
  );

  const startGame = useCallback(
    (side: Side) => {
      requestGen.current += 1;
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
      resetClocks(timeMode);
      if (side === "black") {
        void askEngine(START_FEN);
      }
    },
    [askEngine, timeMode, resetClocks],
  );

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
      const nextOutcome = describeOutcome(chess);
      if (!nextOutcome.over) {
        void askEngine(nextFen);
      }
      return true;
    },
    [askEngine, chess, humanToMove],
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
            <IconPawn3D size={22} />
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
            className="flex items-center gap-1 text-[11px] font-bold text-neutral-300 bg-[#1f1d1a] border border-[#36322d] px-2 py-1 rounded-md"
          >
            <IconGlobe3D size={13} />
            <span>{lang.toUpperCase()}</span>
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-[10px] text-white shadow">
            BW
          </div>
        </div>
      </header>

      {/* DESKTOP LEFT SIDEBAR (Hidden on Mobile) */}
      <aside className="hidden md:flex md:w-64 bg-[#262421] border-r border-[#36322d] flex-col justify-between p-3 shrink-0">
        <div>
          {/* Logo with 3D Pawn */}
          <div className="flex items-center gap-3 px-3 py-4 mb-3 cursor-pointer" onClick={() => setNavTab("play")}>
            <div className="w-10 h-10 rounded-xl bg-[#1f1d1a] border border-[#3d3a37] flex items-center justify-center shadow-lg">
              <IconPawn3D size={30} />
            </div>
            <div>
              <div className="font-black tracking-wider text-base uppercase leading-tight text-white flex items-center gap-1.5">
                FIF <span className="text-[#81b64c]">CHESS</span>
              </div>
              <div className="text-[10px] text-neutral-400 font-semibold tracking-wide">ARENA CATUR TEL-U</div>
            </div>
          </div>

          {/* Navigation Menu with 3D Icons */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setNavTab("play")}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                navTab === "play"
                  ? "bg-[#3d3a37] text-white border-l-4 border-[#81b64c] shadow-sm"
                  : "text-neutral-300 hover:bg-[#2c2925] hover:text-white"
              }`}
            >
              <IconPawn3D size={22} />
              <span>{lang === "id" ? "Bermain" : "Play"}</span>
            </button>

            <button
              onClick={() => setNavTab("puzzle")}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                navTab === "puzzle"
                  ? "bg-[#3d3a37] text-white border-l-4 border-[#81b64c] shadow-sm"
                  : "text-neutral-300 hover:bg-[#2c2925] hover:text-white"
              }`}
            >
              <IconPuzzle3D size={22} />
              <span>{lang === "id" ? "Teka-Teki" : "Puzzles"}</span>
            </button>

            <button
              onClick={() => setNavTab("vision")}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                navTab === "vision"
                  ? "bg-[#3d3a37] text-white border-l-4 border-[#81b64c] shadow-sm"
                  : "text-neutral-300 hover:bg-[#2c2925] hover:text-white"
              }`}
            >
              <IconVision3D size={22} />
              <span>{lang === "id" ? "Belajar / Visi" : "Vision Drills"}</span>
            </button>

            <button
              onClick={() => setNavTab("scan")}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                navTab === "scan"
                  ? "bg-[#3d3a37] text-white border-l-4 border-[#81b64c] shadow-sm"
                  : "text-neutral-300 hover:bg-[#2c2925] hover:text-white"
              }`}
            >
              <IconScan3D size={22} />
              <span>Scan OTB</span>
            </button>

            <button
              onClick={() => setNavTab("community")}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                navTab === "community"
                  ? "bg-[#3d3a37] text-white border-l-4 border-[#81b64c] shadow-sm"
                  : "text-neutral-300 hover:bg-[#2c2925] hover:text-white"
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
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
              Stockfish 15 NNUE
            </Badge>
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1f1d1a] border border-[#36322d]">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow">
              BW
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate text-white">Pak Bagas Wibowo</div>
              <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm"></span>
                <span>FIF Tel-U (1500)</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col p-2.5 md:p-6 pb-24 md:pb-6 overflow-y-auto max-w-7xl mx-auto w-full">
        {navTab === "vision" && <VisionDrill lang={lang} />}
        {navTab === "puzzle" && <PuzzleView lang={lang} />}
        {navTab === "scan" && <ScanView onLoadFen={(f) => { setFen(f); setNavTab("play"); }} lang={lang} />}
        {navTab === "community" && <CommunityView lang={lang} />}

        {navTab === "play" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 md:gap-6 items-start w-full">
            {/* CENTER CHESSBOARD */}
            <div className="flex flex-col items-center max-w-[520px] w-full mx-auto space-y-2">
              {/* Opponent Card (Top) with 3D Bot Icon */}
              <div className="w-full flex items-center justify-between px-3 py-2 bg-[#262421] rounded-xl border border-[#36322d] shadow-sm">
                <div className="flex items-center gap-2.5">
                  <IconBot3D size={28} />
                  <div>
                    <div className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Stockfish 15 NNUE</span>
                      <span className="text-[11px] font-normal text-neutral-400">(3550)</span>
                    </div>
                    <div className="text-[10px] md:text-[11px] text-neutral-400 font-medium">
                      {thinking
                        ? (lang === "id" ? "Sedang menghitung..." : "Thinking...")
                        : (lang === "id" ? "Siap melangkah" : "Ready")}
                    </div>
                  </div>
                </div>
                <div className="bg-[#1a1816] px-2.5 py-1 rounded-lg font-mono font-bold text-base md:text-xl text-white border border-[#36322d] shadow-inner">
                  {humanSide === "white" ? formattedBlackTime : formattedWhiteTime}
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
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-[11px] text-white shadow">
                    BW
                  </div>
                  <div>
                    <div className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Pak Bagas (FIF)</span>
                      <span className="text-[11px] font-normal text-neutral-400">(1500)</span>
                    </div>
                    <div className="text-[10px] md:text-[11px] text-neutral-400 flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                      <span>{humanSide === "white" ? (lang === "id" ? "Bidak Putih" : "White") : (lang === "id" ? "Bidak Hitam" : "Black")}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-[#1a1816] px-2.5 py-1 rounded-lg font-mono font-bold text-base md:text-xl text-white border border-[#36322d] shadow-inner">
                  {humanSide === "white" ? formattedWhiteTime : formattedBlackTime}
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR (Chess.com Control Panel) */}
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
                  {/* TAB 1: GAME SETUP */}
                  {rightTab === "game-setup" && (
                    <div className="space-y-3 md:space-y-4">
                      <div>
                        <label className="text-[11px] md:text-xs font-bold text-neutral-400 block mb-2 uppercase tracking-wider">
                          {lang === "id" ? "Kontrol Waktu Permainan:" : "Time Control:"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "3m", label: lang === "id" ? "Kilat 3 mnt" : "Blitz 3m", icon: <IconLightning3D size={15} /> },
                            { id: "5m", label: lang === "id" ? "Cepat 5 mnt" : "Rapid 5m", icon: <IconClock3D size={15} /> },
                            { id: "10m", label: lang === "id" ? "Standar 10 mnt" : "Rapid 10m", icon: <IconClock3D size={15} /> },
                            { id: "unlimited", label: lang === "id" ? "Tanpa Batas" : "Casual", icon: <IconPawn3D size={15} /> },
                          ].map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setTimeMode(t.id)}
                              className={`flex items-center gap-2 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                                timeMode === t.id
                                  ? "bg-[#3d3a37] border-[#81b64c] text-white shadow-sm"
                                  : "bg-[#1f1d1a] border-[#36322d] text-neutral-400 hover:text-white hover:bg-[#282622]"
                              }`}
                            >
                              {t.icon}
                              <span>{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* BIG CHESS.COM GREEN CTA BUTTON */}
                      <button
                        onClick={() => startGame(humanSide)}
                        className="btn-chess-green w-full py-3.5 md:py-4 rounded-xl font-black text-base md:text-lg tracking-wider shadow-lg uppercase cursor-pointer flex items-center justify-center gap-2"
                      >
                        <IconPawn3D size={22} />
                        <span>{lang === "id" ? "Mulai Permainan" : "Play Game"}</span>
                      </button>

                      {/* Quick options with 3D icons */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#36322d]">
                        <button
                          onClick={() => startGame(humanSide === "white" ? "black" : "white")}
                          className="btn-chess-dark py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <IconSwap3D size={15} />
                          <span>{lang === "id" ? `Main ${humanSide === "white" ? "Hitam" : "Putih"}` : `Play ${humanSide === "white" ? "Black" : "White"}`}</span>
                        </button>
                        <button
                          onClick={() => {
                            setCustomOutcome({
                              over: true,
                              winner: humanSide === "white" ? "black" : "white",
                              kind: "resigned",
                              label: lang === "id" ? "Kekalahan — Anda Menyerah" : "Defeat — You Resigned",
                            });
                            setShowGameOverModal(true);
                          }}
                          className="btn-chess-dark py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <span>{lang === "id" ? "Menyerah / Reset" : "Resign / Reset"}</span>
                        </button>
                      </div>

                      <div className="bg-[#1c1a18] p-3 rounded-xl border border-[#36322d] text-xs text-neutral-400 space-y-1">
                        <div className="flex justify-between items-center">
                          <span>Status:</span>
                          <span className="text-white font-bold">{effectiveOutcome.label}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Engine:</span>
                          <span className="text-emerald-400 font-bold">Stockfish 15 NNUE (Invincible)</span>
                        </div>
                      </div>
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

      {/* MOBILE BOTTOM NAVIGATION BAR (Fixed at bottom for smartphones) */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#262421]/95 backdrop-blur-md border-t border-[#36322d] justify-around items-center py-2 px-1 shadow-2xl">
        <button
          onClick={() => setNavTab("play")}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
            navTab === "play" ? "text-white font-bold" : "text-neutral-400 font-medium hover:text-white"
          }`}
        >
          <div className={`p-1 rounded-lg ${navTab === "play" ? "bg-[#3d3a37] text-white" : ""}`}>
            <IconPawn3D size={20} />
          </div>
          <span className="text-[10px] leading-none">{lang === "id" ? "Bermain" : "Play"}</span>
        </button>

        <button
          onClick={() => setNavTab("puzzle")}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
            navTab === "puzzle" ? "text-white font-bold" : "text-neutral-400 font-medium hover:text-white"
          }`}
        >
          <div className={`p-1 rounded-lg ${navTab === "puzzle" ? "bg-[#3d3a37] text-white" : ""}`}>
            <IconPuzzle3D size={20} />
          </div>
          <span className="text-[10px] leading-none">{lang === "id" ? "Teka-Teki" : "Puzzles"}</span>
        </button>

        <button
          onClick={() => setNavTab("vision")}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
            navTab === "vision" ? "text-white font-bold" : "text-neutral-400 font-medium hover:text-white"
          }`}
        >
          <div className={`p-1 rounded-lg ${navTab === "vision" ? "bg-[#3d3a37] text-white" : ""}`}>
            <IconVision3D size={20} />
          </div>
          <span className="text-[10px] leading-none">{lang === "id" ? "Visi" : "Vision"}</span>
        </button>

        <button
          onClick={() => setNavTab("scan")}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
            navTab === "scan" ? "text-white font-bold" : "text-neutral-400 font-medium hover:text-white"
          }`}
        >
          <div className={`p-1 rounded-lg ${navTab === "scan" ? "bg-[#3d3a37] text-white" : ""}`}>
            <IconScan3D size={20} />
          </div>
          <span className="text-[10px] leading-none">Scan OTB</span>
        </button>

        <button
          onClick={() => setNavTab("community")}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
            navTab === "community" ? "text-white font-bold" : "text-neutral-400 font-medium hover:text-white"
          }`}
        >
          <div className={`p-1 rounded-lg ${navTab === "community" ? "bg-[#3d3a37] text-white" : ""}`}>
            <IconCommunity3D size={20} />
          </div>
          <span className="text-[10px] leading-none">{lang === "id" ? "Komunitas" : "Club"}</span>
        </button>
      </nav>

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
