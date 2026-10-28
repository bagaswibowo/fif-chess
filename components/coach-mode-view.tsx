"use client";

import { chessSound } from "@/lib/chess-sound";
import { classifyMove, createSquareBadgeRenderer, ChessBadgeLegend, type MoveBadge } from "@/lib/chess-move-badges";
import { CapturedPiecesBar } from "@/components/captured-pieces";
import { BoardControls } from "@/components/board-controls";
import { NotationTable } from "@/components/notation-table";
import { EvalBar } from "@/components/eval-bar";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti } from "@/components/confetti";
import { useChessTheme } from "@/lib/chess-themes";
import {
  IconBot3D,
  IconLightning3D,
  IconKingWhite3D,
  IconKingBlack3D,
  IconDice3D,
  IconLightbulb3D,
  IconAlert3D,
  IconTarget3D,
  IconCheck3D,
  IconClose3D,
} from "@/components/icons3d";
import { describeOutcome, findLegalMove, getLegalMoves, type GameOutcome } from "@/lib/chess";
// Import type-only dari modul daun: barrel "@/lib/engines" menarik node:child_process
// (spawn Stockfish) dan akan menggagalkan build client component.
import type { EngineId } from "@/lib/engines/types";

type Props = { lang?: "id" | "en" };

// Engine sparring yang boleh dipilih pemain. Pelatihnya tetap Stockfish 19 —
// ini hanya lawan tandingnya.
const SPARRING_ENGINES: { id: EngineId; label: string }[] = [
  { id: "jev-fly", label: "Jev + Fly Brain" },
  { id: "jev", label: "Jev System One" },
  { id: "fly", label: "Fruit Fly Brain" },
  { id: "stockfish", label: "Stockfish 19 NNUE" },
];
const SPARRING_LABEL = Object.fromEntries(SPARRING_ENGINES.map((e) => [e.id, e.label])) as Record<
  EngineId,
  string
>;

// Depth pengajar. 14 = plafon di StockfishEngine.play (lib/engines/stockfish.ts).
// Setiap "go depth N" di lib/stockfish.ts selalu dibarengi movetime 1200, jadi
// naik 12 -> 14 menambah kualitas tanpa menambah waktu tunggu.
const COACH_DEPTH = 14;

function classifyLoss(cpLoss: number | null, isBest: boolean): "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder" {
  if (isBest || cpLoss === null || cpLoss < 15) return "best";
  if (cpLoss < 35) return "good";
  if (cpLoss < 75) return "inaccuracy";
  if (cpLoss < 180) return "mistake";
  return "blunder";
}

const QUALITY: Record<"brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder", { id: string; en: string; color: string }> = {
  brilliant:  { id: "Brilian!",      en: "Brilliant!",     color: "text-cyan-300" },
  best:       { id: "Terbaik!",      en: "Best Move!",     color: "text-emerald-400" },
  good:       { id: "Bagus.",        en: "Good.",          color: "text-green-300" },
  inaccuracy: { id: "Kurang Akurat", en: "Inaccuracy",     color: "text-yellow-400" },
  mistake:    { id: "Kesalahan",     en: "Mistake",        color: "text-orange-400" },
  blunder:    { id: "Blunder!",      en: "Blunder!",       color: "text-red-400" },
};

const PRINCIPLES = [
  { id: "Kuasai pusat: e4/d4/e5/d5 adalah petak paling strategis di awal laga.", en: "Control the center: e4/d4/e5/d5 are the key strategic squares." },
  { id: "Kembangkan perwira ringan (Kuda & Gajah) sebelum melangkah berulang.", en: "Develop minor pieces (Knights & Bishops) actively." },
  { id: "Jangan gerakkan pion yang sama berkali-kali tanpa ancaman taktis.", en: "Avoid moving the same pawn repeatedly without purpose." },
  { id: "Segera rokade: amankan Raja di sudut dan aktifkan Benteng.", en: "Castle early: secure your King and activate Rooks." },
  { id: "Hubungkan kedua Benteng dengan mengosongkan perwira di baris perwira.", en: "Connect your Rooks by developing other pieces." },
  { id: "Jangan keluarkan Menteri terlalu awal agar tidak jadi target serangan.", en: "Do not expose your Queen early to cheap tactical attacks." },
];

export function CoachModeView({ lang = "id" }: Props) {
  const { customPieces, notationStyles, boardTheme, boardThemeId, pieceThemeId } = useChessTheme();
  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState<string[]>([]);
  const [playerSide, setPlayerSide] = useState<"white" | "black">("white");
  const [moveBadges, setMoveBadges] = useState<Record<string, MoveBadge>>({});
  const [sideChoice, setSideChoice] = useState<"white" | "black" | "random">("white");
  const [sparring, setSparring] = useState<EngineId>("jev-fly");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [outcome, setOutcome] = useState<GameOutcome>(() => describeOutcome(new Chess()));
  const [showConfetti, setShowConfetti] = useState(false);
  const [fullscreenCoach, setFullscreenCoach] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [evalCp, setEvalCp] = useState<number | null>(null);
  const [hint, setHint] = useState<{ san: string; uci: string; reason?: string } | null>(null);
  const [threat, setThreat] = useState<{ hasThreat: boolean; msg: string; square: string | null } | null>(null);
  const [showHintArrow, setShowHintArrow] = useState(false);
  const [feedback, setFeedback] = useState<{
    quality: "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder";
    headline: string;
    reason: string;
    tactic: string;
    bestSan?: string;
    cpLoss: number | null;
  } | null>(null);

  const thinkingRef = useRef(false);

  const principle = useMemo(() => {
    const ply = history.length;
    if (ply >= 20) return null;
    const p = PRINCIPLES[Math.min(Math.floor(ply / 2), PRINCIPLES.length - 1)];
    return lang === "id" ? p.id : p.en;
  }, [history.length, lang]);

  const isPlayerTurn = chess.turn() === (playerSide === "white" ? "w" : "b");

  const engineBest = async (currentFen: string, engine: "stockfish" | "jev" | "fly" | "jev-fly" = "stockfish", depth = 12) => {
    try {
      const r = await fetch("/api/engine-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: currentFen, depth, engine }),
      });
      const d = await r.json();
      if (d.uci && d.san) {
        return {
          uci: d.uci as string,
          san: d.san as string,
          scoreCp: (d.scoreCp as number | null) ?? null,
        };
      }
    } catch (e) {
      console.error("Coach engineBest error:", e);
    }
    return null;
  };

  const probeThreat = async (currentFen: string): Promise<{ hasThreat: boolean; msg: string; square: string | null }> => {
    try {
      const c = new Chess(currentFen);
      if (c.isGameOver()) return { hasThreat: false, msg: "", square: null };
      const data = await engineBest(currentFen, "stockfish", 6);
      if (!data) return { hasThreat: false, msg: "", square: null };
      const isThreat = data.san.includes("+") || data.san.includes("x") || data.san.includes("#");
      if (!isThreat) return { hasThreat: false, msg: "", square: null };
      const sq = data.uci.slice(2, 4);
      const msg = data.san.includes("#")
        ? `AWAS: Lawan mengancam skakmat di petak ${sq} lewat ${data.san}!`
        : data.san.includes("+")
        ? `PERINGATAN: Lawan bisa skak lewat ${data.san}!`
        : `PERHATIAN: Lawan mengincar perwira di ${sq} lewat ${data.san}!`;
      return { hasThreat: true, msg, square: sq };
    } catch {
      return { hasThreat: false, msg: "", square: null };
    }
  };

  const computeCoachAdvice = useCallback(async (currentFen: string) => {
    try {
      const [bestData, threatData] = await Promise.all([
        engineBest(currentFen, "stockfish", COACH_DEPTH),
        probeThreat(currentFen),
      ]);
      if (bestData) {
        setHint({
          san: bestData.san,
          uci: bestData.uci,
          reason: bestData.san.includes("#")
            ? "Skakmat mematikan — kunci kemenangan!"
            : bestData.san.includes("x")
            ? "Memenangkan pertukaran perwira."
            : "Langkah posisional terkuat menjaga inisiatif.",
        });
        if (bestData.scoreCp !== null) {
          setEvalCp(bestData.scoreCp);
        }
      }
      setThreat(threatData);
    } catch (e) {
      console.error("computeCoachAdvice error:", e);
    }
  }, []);

  useEffect(() => {
    if (isPlayerTurn && !hint) {
      void computeCoachAdvice(fen);
    }
  }, [computeCoachAdvice, fen, isPlayerTurn, hint]);

  const clearPreMoveState = () => {
    setHint(null);
    setThreat(null);
    setShowHintArrow(false);
  };

  const resetGame = useCallback(async (side: "white" | "black" = "white", opponent: EngineId = sparring) => {
    const c = new Chess();
    setChess(c);
    setFen(c.fen());
    setHistory([]);
    setPlayerSide(side);
    setSparring(opponent);
    setBoardOrientation(side);
    setOutcome(describeOutcome(c));
    setShowConfetti(false);
    setSelected(null);
    clearPreMoveState();
    setFeedback(null);
    setEvalCp(null);
    thinkingRef.current = false;
    setThinking(false);

    if (side === "white") {
      void computeCoachAdvice(c.fen());
    } else {
      setThinking(true);
      thinkingRef.current = true;
      const botMove = await engineBest(c.fen(), opponent, 12);
      if (botMove) {
        const move = findLegalMove(c, botMove.uci.slice(0, 2) as Square, botMove.uci.slice(2, 4) as Square);
        if (move && c.move(move)) {
          setChess(c);
          setFen(c.fen());
          setHistory([botMove.san]);
          setOutcome(describeOutcome(c));
          void computeCoachAdvice(c.fen());
        }
      }
      thinkingRef.current = false;
      setThinking(false);
    }
  }, [computeCoachAdvice, sparring]);

  const handleSideSelect = useCallback(async (choice: "white" | "black" | "random") => {
    if (thinkingRef.current) return;
    setSideChoice(choice);
    const resolvedSide: "white" | "black" = choice === "random" ? (Math.random() < 0.5 ? "white" : "black") : choice;
    await resetGame(resolvedSide, sparring);
  }, [resetGame, sparring]);

  const tryMove = async (from: string, to: string) => {
    if (outcome.over || thinkingRef.current || !isPlayerTurn) return false;

    const c = new Chess(chess.fen());
    const hasPromo = getLegalMoves(c).some(m => m.from === from && m.to === to && m.isPromotion);
    const move = findLegalMove(c, from as Square, to as Square, hasPromo ? "q" : undefined);
    if (!move) {
      setSelected(null);
      return false;
    }

    setThinking(true);
    thinkingRef.current = true;
    clearPreMoveState();

    const bestMoveData = hint ?? (await engineBest(c.fen(), "stockfish", COACH_DEPTH));
    const bestUci = bestMoveData?.uci ?? "";
    const bestSan = bestMoveData?.san ?? "";
    const evalBefore = evalCp ?? 0;

    c.move(move);
    const userUci = move.from + move.to + (move.promotion ?? "");
    const isBest = !bestUci || userUci === bestUci || move.san === bestSan;

    setChess(c);
    setFen(c.fen());
    if (c.isCheck()) {
      chessSound.playCheck();
    } else if (move.san.includes("x")) {
      chessSound.playCapture();
    } else if (move.san.includes("O-O")) {
      chessSound.playCastle();
    } else {
      chessSound.playMove();
    }
    setHistory(h => [...h, move.san]);
    const coachBadge = classifyMove(chess.fen(), userUci, move.san, { isEngineBest: isBest });
    setMoveBadges({ [move.to]: coachBadge });
    const out = describeOutcome(c);
    setOutcome(out);

    if (out.over) {
      setThinking(false);
      thinkingRef.current = false;
      setShowConfetti(out.winner === playerSide);
      setFeedback({
        quality: out.winner === playerSide ? "brilliant" : "good",
        headline: lang === "id" ? "Partai Selesai!" : "Game Over!",
        reason: out.label,
        tactic: "",
        cpLoss: null,
      });
      return true;
    }

    const evalAfterData = await engineBest(c.fen(), "stockfish", 8);
    const evalAfter = evalAfterData?.scoreCp != null ? -evalAfterData.scoreCp : null;
    const cpLoss = evalAfter !== null && evalBefore !== null && !isBest
      ? Math.max(0, evalBefore - evalAfter)
      : (isBest ? 0 : 50);

    const quality = classifyLoss(cpLoss, isBest);
    let tactic = "";
    if (move.san.includes("#")) tactic = "SKAKMAT! Kemenangan mutlak!";
    else if (move.san.includes("+")) tactic = "Skak langsung ke Raja lawan.";
    else if (move.isCapture) tactic = `Pertukaran: memakan perwira di ${move.to}.`;
    else if (move.isCastle) tactic = "Rokade: Raja terlindungi, Benteng terhubung.";

    setFeedback({
      quality,
      headline: lang === "id" ? QUALITY[quality].id : QUALITY[quality].en,
      reason: lang === "id"
        ? (isBest
            ? `${move.san} adalah langkah terbaik pilihan AI Coach!`
            : `Kurang optimal: AI Coach merekomendasikan ${bestSan} (kehilangan ~${cpLoss ?? "?"} cp).`)
        : (isBest
            ? `${move.san} is the optimal coach move!`
            : `Suboptimal: Coach suggests ${bestSan} (~${cpLoss ?? "?"} cp loss).`),
      tactic,
      bestSan: isBest ? undefined : bestSan,
      cpLoss,
    });

    const botData = await engineBest(c.fen(), sparring, 12);
    if (botData) {
      const oppMove = findLegalMove(c, botData.uci.slice(0, 2) as Square, botData.uci.slice(2, 4) as Square,
        botData.uci.length > 4 ? (botData.uci[4] as "q") : undefined);
      if (oppMove && c.move(oppMove)) {
        setChess(c);
        setFen(c.fen());
        if (c.isCheck()) {
          chessSound.playCheck();
        } else if (botData.san.includes("x")) {
          chessSound.playCapture();
        } else if (botData.san.includes("O-O")) {
          chessSound.playCastle();
        } else {
          chessSound.playMove();
        }
        setHistory(h => [...h, botData.san]);
        setEvalCp(botData.scoreCp !== null ? -botData.scoreCp : null);
        const nextOut = describeOutcome(c);
        setOutcome(nextOut);

        if (nextOut.over) {
          setShowConfetti(nextOut.winner === playerSide);
          setFeedback({
            quality: "good",
            headline: lang === "id" ? "Partai Selesai!" : "Game Over!",
            reason: nextOut.label,
            tactic: "",
            cpLoss: null,
          });
        } else {
          await computeCoachAdvice(c.fen());
        }
      }
    }

    thinkingRef.current = false;
    setThinking(false);
    return true;
  };

  const handlePieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!targetSquare || !isPlayerTurn || thinkingRef.current) return false;
    void tryMove(sourceSquare, targetSquare);
    return true;
  };

  const handleUndo = () => {
    if (history.length < 2 || thinkingRef.current) return;
    const newH = history.slice(0, -2);
    const rebuild = new Chess();
    for (const m of newH) {
      if (!rebuild.move(m)) break;
    }
    setChess(rebuild);
    setFen(rebuild.fen());
    setHistory(newH);
    setOutcome(describeOutcome(rebuild));
    setFeedback(null);
    clearPreMoveState();
    setShowConfetti(false);
    void computeCoachAdvice(rebuild.fen());
  };

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (selected) {
      s[selected] = { boxShadow: "inset 0 0 0 4px #facc15", backgroundColor: "rgba(250,204,21,0.3)" };
    }
    if (showHintArrow && hint) {
      s[hint.uci.slice(0, 2)] = { boxShadow: "inset 0 0 0 4px #38bdf8", backgroundColor: "rgba(56,189,248,0.3)" };
      s[hint.uci.slice(2, 4)] = { boxShadow: "inset 0 0 0 4px #81b64c", backgroundColor: "rgba(129,182,76,0.4)" };
    }
    if (threat?.hasThreat && threat.square && !showHintArrow) {
      s[threat.square] = { boxShadow: "inset 0 0 0 4px #f97316", backgroundColor: "rgba(249,115,22,0.25)" };
    }
    return s;
  }, [selected, showHintArrow, hint, threat]);

  const arrows = useMemo(() => {
    if (!showHintArrow || !hint) return [];
    return [{
      startSquare: hint.uci.slice(0, 2),
      endSquare: hint.uci.slice(2, 4),
      color: "#38bdf8",
    }];
  }, [showHintArrow, hint]);

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
        setFullscreenCoach((v) => !v);
      } else if (e.key === "z" || e.key === "Z") {
        setBoardOrientation((o) => (o === "white" ? "black" : "white"));
      } else if (e.key === "Escape" && fullscreenCoach) {
        setFullscreenCoach(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenCoach]);

  const whitePct = (() => {
    if (evalCp === null) return 50;
    return Math.round((Math.tanh(evalCp / 400) + 1) / 2 * 100);
  })();

  const qColor = feedback ? QUALITY[feedback.quality].color : "";

  return (
    <div
      className={
        fullscreenCoach
          ? "fixed inset-0 z-50 bg-[var(--background)] text-white flex flex-col p-2 sm:p-3 overflow-hidden animate-in fade-in duration-200"
          : "min-h-0 flex flex-col gap-2 w-full max-w-7xl mx-auto"
      }
    >
      {showConfetti && <Confetti />}

      {/* Header Info Matchup with Standardized BoardControls */}
      <div className="bg-[var(--card)] px-3 py-2 rounded-xl border border-[var(--border)] shadow-md flex items-center justify-between gap-2 shrink-0 sm:min-h-14 overflow-visible">
        <div className="flex items-center gap-2 min-w-0">
          <IconBot3D size={22} className="shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs md:text-sm font-black text-white truncate">
              {lang === "id" ? "AI Coach — Mode Latih" : "AI Coach — Training"}
            </h2>
            <div className="text-xs md:text-xs text-neutral-400 truncate">
              {lang === "id"
                ? `Lawan: ${SPARRING_LABEL[sparring]} · Pelatih: Stockfish 19 depth ${COACH_DEPTH}`
                : `Opponent: ${SPARRING_LABEL[sparring]} · Coach: Stockfish 19 depth ${COACH_DEPTH}`}
            </div>
          </div>
        </div>

        <BoardControls
          variant="toolbar"
          orientation={boardOrientation}
          onFlipOrientation={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
          isFullscreen={fullscreenCoach}
          onToggleFullscreen={() => setFullscreenCoach((v) => !v)}
          showShortcuts={true}
          className="border-0 bg-transparent p-0 shadow-none w-auto min-w-0"
        />
      </div>

      {/* Main Grid: Board Stays Solid on Left, Dynamic Cards on Right */}
      <div className="flex-1 grid lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-3 items-stretch min-h-0 overflow-y-auto lg:overflow-hidden pt-1">
        {/* LEFT COLUMN: Chessboard strictly anchored */}
        <div className="flex flex-col justify-between items-center h-full min-h-0 w-full max-w-[min(100%,var(--board-cap))] mx-auto py-0.5 space-y-1">
          {/* Integrated Opponent Bar with Inline Engine Selector, Eval Badge & Captured Pieces */}
          <div className="w-full flex items-center justify-between px-3 py-1 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-3.5 h-3.5 rounded-full border shrink-0 ${playerSide === "white" ? "bg-neutral-800 border-neutral-600" : "bg-white border-neutral-300"}`} />
              <select
                id="coach-sparring"
                aria-label={lang === "id" ? "Lawan Sparring" : "Sparring Opponent"}
                value={sparring}
                onChange={(e) => void resetGame(playerSide, e.target.value as EngineId)}
                disabled={thinking}
                className="bg-[var(--surface)] text-xs md:text-sm font-bold text-white border border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:border-[var(--primary)] cursor-pointer disabled:opacity-60"
              >
                {SPARRING_ENGINES.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.label}
                  </option>
                ))}
              </select>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 shrink-0">
                {evalCp !== null ? (evalCp > 0 ? `+${(evalCp / 100).toFixed(1)}` : (evalCp / 100).toFixed(1)) : "="}
              </span>
            </div>
            <CapturedPiecesBar fen={fen} side={playerSide === "white" ? "black" : "white"} />
          </div>

          {/* Badge Legend: Di Atas Papan */}
          <div className="flex justify-center w-full shrink-0 mb-1">
            <ChessBadgeLegend className="w-full max-w-[min(100%,var(--board-cap))]" />
          </div>

          {/* Chessboard Row with Vertical Eval Bar */}
          <div className="flex justify-center w-full flex-1 min-h-0">
            <div className="flex gap-2.5 items-center w-full justify-center">
              <EvalBar fen={fen} scoreCp={evalCp} orientation={boardOrientation} />
              <div className="aspect-square w-[var(--board-cap)] max-w-[calc(100%-2.5rem)] min-w-0 rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-2xl bg-[var(--board-dark)] relative">
                <Chessboard
                  key={`coach-board-${boardOrientation}-${boardThemeId}-${pieceThemeId}`}
                  options={{
                    id: `coach-board-${boardOrientation}-${boardThemeId}-${pieceThemeId}`,
                    squareRenderer: createSquareBadgeRenderer(moveBadges, fen, squareStyles),
                    position: fen,
                    boardOrientation: boardOrientation,
                    allowDragging: isPlayerTurn && !thinking,
                    onPieceDrop: handlePieceDrop,
                    onSquareClick: ({ square }) => {
                      if (selected) {
                        void tryMove(selected, square);
                        setSelected(null);
                      } else {
                        setSelected(square);
                      }
                    },
                    squareStyles,
                    arrows,
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
                    animationDurationInMs: 200,
                    ...notationStyles,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Player Status Bar with Hint Action */}
          <div className="w-full flex items-center justify-between px-3 py-1 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full border shrink-0 ${playerSide === "white" ? "bg-white border-neutral-300" : "bg-neutral-800 border-neutral-600"}`} />
              <span className="text-xs md:text-sm font-bold text-white">Anda (Player)</span>
              {isPlayerTurn && <span className="text-xs text-[var(--primary)] font-black animate-pulse">Giliran</span>}
            </div>
            <div className="flex items-center gap-2">
              <CapturedPiecesBar fen={fen} side={playerSide} />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Real-Time Coach Guidance, Threats & Move Review */}
        <div className="h-full overflow-y-auto pr-1 space-y-2.5 custom-scrollbar min-h-0">
          {/* Sisi Bidak (3-Card Visual Selector: Putih / Acak / Hitam) */}
          <div className="bg-[var(--card)] p-2.5 rounded-xl border border-[var(--border)] shadow-sm space-y-1.5 shrink-0">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
              <span>{lang === "id" ? "Pilih Sisi Bidak" : "Choose Side"}</span>
              <span className="text-xs text-[var(--primary)] font-bold">
                {sideChoice === "random"
                  ? (lang === "id" ? `Acak (${playerSide === "white" ? "Putih" : "Hitam"})` : `Random (${playerSide})`)
                  : sideChoice === "white"
                  ? (lang === "id" ? "Putih (Main Pertama)" : "White (1st Move)")
                  : (lang === "id" ? "Hitam (Main Kedua)" : "Black (2nd Move)")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => void handleSideSelect("white")}
                disabled={thinking}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-60 ${
                  sideChoice === "white"
                    ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]"
                    : "bg-[var(--background)] border-[var(--border)] hover:border-neutral-500 text-neutral-400"
                }`}
              >
                <IconKingWhite3D size={22} />
                <span className="text-xs font-bold text-white">{lang === "id" ? "Putih" : "White"}</span>
                <span className="text-[10px] text-neutral-400 font-medium">{lang === "id" ? "Main Pertama" : "1st Move"}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSideSelect("random")}
                disabled={thinking}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-60 ${
                  sideChoice === "random"
                    ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]"
                    : "bg-[var(--background)] border-[var(--border)] hover:border-neutral-500 text-neutral-400"
                }`}
              >
                <IconDice3D size={22} />
                <span className="text-xs font-bold text-white">{lang === "id" ? "Acak" : "Random"}</span>
                <span className="text-[10px] text-neutral-400 font-medium">{lang === "id" ? "Otomatis" : "Automatic"}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSideSelect("black")}
                disabled={thinking}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-60 ${
                  sideChoice === "black"
                    ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]"
                    : "bg-[var(--background)] border-[var(--border)] hover:border-neutral-500 text-neutral-400"
                }`}
              >
                <IconKingBlack3D size={22} />
                <span className="text-xs font-bold text-white">{lang === "id" ? "Hitam" : "Black"}</span>
                <span className="text-[10px] text-neutral-400 font-medium">{lang === "id" ? "Main Kedua" : "2nd Move"}</span>
              </button>
            </div>
          </div>

          {/* REKOMENDASI LANGKAH AKTIF */}
          <Card className="bg-[#1f291e] border-2 border-[#81b64c]/60 text-white shadow-lg overflow-hidden">
            <CardHeader className="py-2.5 px-4 bg-[#81b64c]/10 border-b border-[#81b64c]/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <IconLightning3D size={20} />
                <span className="text-xs font-black uppercase tracking-wider text-[#81b64c]">
                  {lang === "id" ? `Rekomendasi Coach (Stockfish 19 · depth ${COACH_DEPTH})` : `Coach Recommendation (Stockfish 19 · depth ${COACH_DEPTH})`}
                </span>
              </div>

            </CardHeader>
            <CardContent className="p-3.5 space-y-2">
              {!outcome.over && isPlayerTurn ? (
                hint ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-black text-[#81b64c]">{hint.san}</span>
                      <span className="text-xs text-neutral-300 font-medium">{hint.reason}</span>
                    </div>
                    {principle && (
                      <div className="text-xs text-[#81b64c]/90 bg-[#81b64c]/10 p-2 rounded-lg border border-[#81b64c]/20 flex items-center gap-1.5">
                        <IconLightbulb3D size={14} className="shrink-0" />
                        <span>{principle}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button onClick={handleUndo} variant="outline" size="sm"
                        className="flex-1 min-w-0 px-2 h-8 border-[#81b64c]/40 bg-transparent text-xs font-bold text-neutral-300 hover:bg-[#81b64c]/20"
                        disabled={history.length < 2 || thinkingRef.current}>
                        <Undo2 size={14} className="shrink-0" /><span>{lang === "id" ? "Batalkan" : "Undo"}</span>
                      </Button>
                      <Button onClick={() => void tryMove(hint.uci.slice(0, 2), hint.uci.slice(2, 4))} size="sm"
                        className="flex-1 min-w-0 px-2 h-8 bg-[var(--primary)] text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
                        disabled={thinkingRef.current}>
                        <IconCheck3D size={16} />
                        {lang === "id" ? `Mainkan` : `Play`}
                      </Button>
                      <Button onClick={() => setShowHintArrow(v => !v)} variant="outline" size="sm"
                        className={`flex-1 min-w-0 px-2 h-8 text-xs font-bold border-[#81b64c]/40 flex gap-1.5 items-center justify-center ${
                          showHintArrow ? "bg-sky-500 text-white font-extrabold border-sky-400 hover:bg-sky-600 shadow-sm" : "bg-transparent text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20"
                        }`}>
                        {showHintArrow ? <IconClose3D size={13} /> : <IconTarget3D size={13} />}
                        <span className="truncate">{showHintArrow ? (lang === "id" ? "Sembunyi" : "Hide") : (lang === "id" ? "Tunjukkan" : "Show")}</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-neutral-400 py-3 text-center animate-pulse flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#81b64c] animate-ping" />
                    {lang === "id" ? `Stockfish 19 depth ${COACH_DEPTH} sedang menganalisis...` : `Stockfish 19 depth ${COACH_DEPTH} is analysing...`}
                  </div>
                )
              ) : thinking ? (
                <div className="text-xs text-neutral-400 py-3 text-center animate-pulse flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#81b64c] animate-ping" />
                  {lang === "id" ? `${SPARRING_LABEL[sparring]} sedang merespon...` : `${SPARRING_LABEL[sparring]} is responding...`}
                </div>
              ) : (
                <div className="text-xs text-neutral-400 py-2 text-center">
                  {outcome.over
                    ? (lang === "id" ? "Pertandingan telah berakhir." : "Match concluded.")
                    : (lang === "id" ? "Menunggu giliran pemain..." : "Waiting for player turn...")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* PERINGATAN ANCAMAN LAWAN */}
          {threat?.hasThreat && (
            <div className="bg-[#2e1717] border border-orange-500/50 p-3 rounded-xl flex items-center gap-2.5 text-orange-200 text-xs shadow-md">
              <IconAlert3D size={18} className="shrink-0" />
              <span>{threat.msg}</span>
            </div>
          )}

          {/* Evaluasi Langkah Terakhir */}
          <Card className="bg-[#262421] border-[#36322d] text-white shadow-lg">
            <CardHeader className="py-2.5 px-4 border-b border-[#36322d]">
              <CardTitle className="text-xs font-bold text-neutral-300 flex items-center justify-between">
                <span>{lang === "id" ? "Review Langkah Terakhir" : "Move Evaluation"}</span>
                {feedback && <span className="text-xs font-mono text-[#81b64c]">Active</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2.5">
              {feedback ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className={`text-xl font-black ${qColor}`}>{feedback.headline}</div>
                    {feedback.cpLoss !== null && feedback.cpLoss > 0 && (
                      <div className="text-xs text-neutral-400 font-mono">
                        -{feedback.cpLoss} cp
                      </div>
                    )}
                  </div>
                  {feedback.reason && (
                    <div className="p-2.5 rounded-lg bg-[#312e2b] text-xs text-neutral-200 leading-relaxed border border-[#3d3a36]">
                      {feedback.reason}
                    </div>
                  )}
                  {feedback.tactic && (
                    <div className="p-2 rounded-lg bg-[#1a1a14] border border-[#3d3a20] text-xs text-amber-300 font-medium">
                      {feedback.tactic}
                    </div>
                  )}
                  {feedback.bestSan && (
                    <div className="p-2.5 rounded-lg bg-[#0f2231] border border-[#38bdf8]/30 space-y-0.5">
                      <div className="text-xs font-bold text-sky-300">
                        {lang === "id" ? "Langkah Terbaik Seharusnya:" : "Optimal Choice Was:"}
                      </div>
                      <div className="font-mono text-base font-black text-sky-200">
                        {feedback.bestSan}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-neutral-400 py-4 text-center space-y-1">
                  <div>{lang === "id" ? "Silakan jalankan langkah pertama." : "Make your first move."}</div>
                  <div className="text-xs text-neutral-500">
                    {lang === "id" ? "AI Coach akan menilai kualitas dan akurasimu." : "AI Coach will rate move precision."}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Riwayat Langkah */}
          {history.length > 0 && (
            <NotationTable
              title={lang === "id" ? "Riwayat Langkah" : "Move History"}
              whiteLabel={playerSide === "white" ? (lang === "id" ? "Anda (Player)" : "You (Player)") : SPARRING_LABEL[sparring]}
              blackLabel={playerSide === "black" ? (lang === "id" ? "Anda (Player)" : "You (Player)") : SPARRING_LABEL[sparring]}
              plyCount={history.length}
              rows={Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => ({
                no: i + 1,
                white: history[i * 2],
                black: history[i * 2 + 1],
                latest: i === Math.floor((history.length - 1) / 2),
              }))}
            />
          )}
        </div>
      </div>

          </div>
  );
}