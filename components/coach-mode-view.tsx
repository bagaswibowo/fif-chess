"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D } from "@/components/icons3d";
import { describeOutcome, findLegalMove, getLegalMoves, type GameOutcome } from "@/lib/chess";

type Props = { lang?: "id" | "en" };

function classifyLoss(cpLoss: number | null, isBest: boolean): "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder" {
  if (isBest || cpLoss === null || cpLoss < 15) return "best";
  if (cpLoss < 35) return "good";
  if (cpLoss < 75) return "inaccuracy";
  if (cpLoss < 180) return "mistake";
  return "blunder";
}

const QUALITY: Record<"brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder", { id: string; en: string; color: string }> = {
  brilliant:  { id: "Brilian! ⭐", en: "Brilliant! ⭐",  color: "text-cyan-300" },
  best:       { id: "Terbaik! ✓",  en: "Best Move! ✓",   color: "text-emerald-400" },
  good:       { id: "Bagus.",      en: "Good.",            color: "text-green-300" },
  inaccuracy: { id: "Kurang Akurat", en: "Inaccuracy",   color: "text-yellow-400" },
  mistake:    { id: "Kesalahan",  en: "Mistake",          color: "text-orange-400" },
  blunder:    { id: "Blunder! ✗", en: "Blunder! ✗",     color: "text-red-400" },
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
  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState<string[]>([]);
  const [playerSide, setPlayerSide] = useState<"white" | "black">("white");
  const [outcome, setOutcome] = useState<GameOutcome>(() => describeOutcome(new Chess()));
  const [showConfetti, setShowConfetti] = useState(false);
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

  const engineBest = async (currentFen: string, engine: "stockfish" | "jev" = "stockfish", depth = 12) => {
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
        engineBest(currentFen, "stockfish", 12),
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

  const resetGame = useCallback(async (side: "white" | "black" = "white") => {
    const c = new Chess();
    setChess(c);
    setFen(c.fen());
    setHistory([]);
    setPlayerSide(side);
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
      const botMove = await engineBest(c.fen(), "stockfish", 12);
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
  }, [computeCoachAdvice]);

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

    const bestMoveData = hint ?? (await engineBest(c.fen(), "stockfish", 10));
    const bestUci = bestMoveData?.uci ?? "";
    const bestSan = bestMoveData?.san ?? "";
    const evalBefore = evalCp ?? 0;

    c.move(move);
    const userUci = move.from + move.to + (move.promotion ?? "");
    const isBest = !bestUci || userUci === bestUci || move.san === bestSan;

    setChess(c);
    setFen(c.fen());
    setHistory(h => [...h, move.san]);
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
    if (move.san.includes("#")) tactic = "♚ SKAKMAT! Kemenangan mutlak!";
    else if (move.san.includes("+")) tactic = "♟ Skak langsung ke Raja lawan.";
    else if (move.isCapture) tactic = `✂ Pertukaran: memakan perwira di ${move.to}.`;
    else if (move.isCastle) tactic = "🏰 Rokade: Raja terlindungi, Benteng terhubung.";

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

    const botData = await engineBest(c.fen(), "stockfish", 12);
    if (botData) {
      const oppMove = findLegalMove(c, botData.uci.slice(0, 2) as Square, botData.uci.slice(2, 4) as Square,
        botData.uci.length > 4 ? (botData.uci[4] as "q") : undefined);
      if (oppMove && c.move(oppMove)) {
        setChess(c);
        setFen(c.fen());
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

  const whitePct = (() => {
    if (evalCp === null) return 50;
    return Math.round((Math.tanh(evalCp / 400) + 1) / 2 * 100);
  })();

  const qColor = feedback ? QUALITY[feedback.quality].color : "";

  return (
    <div className="max-w-5xl mx-auto space-y-3 pb-8">
      {showConfetti && <Confetti />}

      {/* Header Info Matchup */}
      <div className="bg-[#262421] px-4 py-3 rounded-2xl border border-[#36322d] shadow-xl flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <IconBot3D size={28} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">
                {lang === "id" ? "AI Coach — Mode Latih Mandiri" : "AI Coach — Self-Training"}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#81b64c]/20 text-[#81b64c] font-bold border border-[#81b64c]/40">
                Lawan: Stockfish 15 NNUE | Coach: Jev System One
              </span>
            </div>
            <p className="text-xs text-neutral-300">
              {lang === "id"
                ? `Kamu bermain sebagai ${playerSide === "white" ? "Putih (di bawah)" : "Hitam (di bawah)"}, dibimbing rekomendasi Jev melawan Stockfish.`
                : `You play as ${playerSide === "white" ? "White (bottom)" : "Black (bottom)"}, coached by Jev against Stockfish.`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => void resetGame("white")}
            variant="outline"
            size="sm"
            className={`border-[#36322d] text-sm font-bold ${playerSide === "white" ? "bg-[#81b64c] text-white hover:bg-[#81b64c]/90" : "bg-[#1c1a18] text-neutral-300 hover:text-white"}`}
            disabled={thinking}
          >
            ♔ {lang === "id" ? "Main Putih (Bawah)" : "Play White (Bottom)"}
          </Button>
          <Button
            onClick={() => void resetGame("black")}
            variant="outline"
            size="sm"
            className={`border-[#36322d] text-sm font-bold ${playerSide === "black" ? "bg-[#81b64c] text-white hover:bg-[#81b64c]/90" : "bg-[#1c1a18] text-neutral-300 hover:text-white"}`}
            disabled={thinking}
          >
            ♚ {lang === "id" ? "Main Hitam (Bawah)" : "Play Black (Bottom)"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Board Stays Solid on Left, Dynamic Cards on Right */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
        {/* LEFT COLUMN: Chessboard strictly anchored (NEVER JUMPS) */}
        <div className="space-y-3">
          {/* Eval bar */}
          <div className="bg-[#1c1a18] rounded-xl border border-[#36322d] px-3 py-2 flex items-center gap-3">
            <span className="text-sm text-neutral-300 font-mono w-14 text-right shrink-0">
              {evalCp !== null ? (evalCp > 0 ? `+${(evalCp / 100).toFixed(1)}` : (evalCp / 100).toFixed(1)) : "="}
            </span>
            <div className="flex-1 h-3.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${whitePct}%`,
                  background: whitePct > 55
                    ? "linear-gradient(90deg,#ccc,#fff)"
                    : whitePct < 45
                    ? "linear-gradient(90deg,#222,#555)"
                    : "linear-gradient(90deg,#888,#bbb)",
                }}
              />
            </div>
            <span className="text-sm font-mono text-neutral-300 w-16 shrink-0">
              {whitePct > 50 ? `Putih ${whitePct}%` : `Hitam ${100 - whitePct}%`}
            </span>
          </div>

          {/* Chessboard: Fixed Aspect Square with key=playerSide to force board orientation rotation */}
          <div className="rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl w-full bg-[#262421]">
            <Chessboard
              key={`coach-board-${playerSide}`}
              options={{
                id: `coach-board-${playerSide}`,
                position: fen,
                boardOrientation: playerSide,
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
                darkSquareStyle: { backgroundColor: "#b58863" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
              }}
            />
          </div>

          {/* Controls Bar Below Board */}
          <div className="flex gap-2">
            <Button
              onClick={handleUndo}
              variant="outline"
              size="sm"
              className="flex-1 border-[#36322d] text-neutral-300 text-sm font-bold bg-[#1c1a18] hover:bg-[#262421]"
              disabled={history.length < 2 || thinkingRef.current}
            >
              ← {lang === "id" ? "Batalkan Langkah (Undo)" : "Undo Move"}
            </Button>
            {hint && isPlayerTurn && (
              <Button
                onClick={() => void tryMove(hint.uci.slice(0, 2), hint.uci.slice(2, 4))}
                size="sm"
                className="flex-1 bg-[#81b64c] hover:bg-[#81b64c]/80 text-white font-bold text-sm"
                disabled={thinkingRef.current}
              >
                ✓ {lang === "id" ? `Mainkan Rekomendasi (${hint.san})` : `Play Recommendation (${hint.san})`}
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Coach Guidance, Threats & Move Review */}
        <div className="space-y-3">
          {/* REKOMENDASI LANGKAH AKTIF */}
          <Card className="bg-[#1f291e] border-2 border-[#81b64c]/60 text-white shadow-lg overflow-hidden">
            <CardHeader className="py-2.5 px-4 bg-[#81b64c]/10 border-b border-[#81b64c]/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <IconLightning3D size={20} />
                <span className="text-xs font-black uppercase tracking-wider text-[#81b64c]">
                  {lang === "id" ? "Rekomendasi Coach Jev" : "Coach Jev Recommendation"}
                </span>
              </div>
              {hint && isPlayerTurn && (
                <Button
                  onClick={() => setShowHintArrow(v => !v)}
                  size="sm"
                  variant="outline"
                  className={`h-7 px-2.5 text-xs font-bold border-[#81b64c]/40 ${
                    showHintArrow ? "bg-[#38bdf8] text-black border-[#38bdf8]" : "bg-transparent text-[#81b64c] hover:bg-[#81b64c]/20"
                  }`}
                >
                  {showHintArrow ? "✕ Panah Sembunyi" : "🎯 Tunjukkan Panah"}
                </Button>
              )}
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
                      <div className="text-xs text-[#81b64c]/90 bg-[#81b64c]/10 p-2 rounded-lg border border-[#81b64c]/20">
                        💡 {principle}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-neutral-400 py-3 text-center animate-pulse flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#81b64c] animate-ping" />
                    {lang === "id" ? "Jev sedang menganalisis papan..." : "Calculating optimal tactic..."}
                  </div>
                )
              ) : thinking ? (
                <div className="text-xs text-neutral-400 py-3 text-center animate-pulse flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#81b64c] animate-ping" />
                  {lang === "id" ? "Stockfish sedang merespon..." : "Stockfish is responding..."}
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
              <span className="text-base shrink-0">⚠️</span>
              <span>{threat.msg}</span>
            </div>
          )}

          {/* Evaluasi Langkah Terakhir */}
          <Card className="bg-[#262421] border-[#36322d] text-white shadow-lg">
            <CardHeader className="py-2.5 px-4 border-b border-[#36322d]">
              <CardTitle className="text-xs font-bold text-neutral-300 flex items-center justify-between">
                <span>{lang === "id" ? "Review Langkah Terakhir" : "Move Evaluation"}</span>
                {feedback && <span className="text-[10px] font-mono text-[#81b64c]">Active</span>}
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
                      <div className="text-[11px] font-bold text-sky-300">
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
                  <div>♟️ {lang === "id" ? "Silakan jalankan langkah pertama." : "Make your first move."}</div>
                  <div className="text-[11px] text-neutral-500">
                    {lang === "id" ? "AI Coach akan menilai kualitas dan akurasimu." : "AI Coach will rate move precision."}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Riwayat Langkah */}
          {history.length > 0 && (
            <Card className="bg-[#262421] border-[#36322d] text-white">
              <CardHeader className="py-2 px-4 border-b border-[#36322d]">
                <CardTitle className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  {lang === "id" ? "Riwayat Langkah" : "Move History"} ({history.length} ply)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2.5">
                <div className="flex flex-wrap gap-1 font-mono text-xs max-h-[110px] overflow-y-auto">
                  {history.map((san, idx) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-0.5 rounded ${
                        idx % 2 === 0 ? "bg-[#312e2b] text-neutral-200" : "bg-[#1c1a18] text-neutral-300"
                      } ${idx === history.length - 1 ? "ring-1 ring-[#81b64c] text-white font-bold" : ""}`}
                    >
                      {idx % 2 === 0 && <span className="text-neutral-500 mr-1">{Math.floor(idx / 2) + 1}.</span>}
                      {san}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
