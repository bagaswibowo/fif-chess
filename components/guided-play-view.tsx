"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D } from "@/components/icons3d";
import { describeOutcome, findLegalMove, getLegalMoves, type GameOutcome } from "@/lib/chess";

// ── Types ─────────────────────────────────────────────────────────────────────

type ThreatInfo = {
  hasThreat: boolean;
  probability: number;       // 0–1 from Jev noul-equivalent via choice
  squareHint: string | null; // e.g. "f7"
  message: string;
};

type MoveQuality = "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder";

type Feedback = {
  quality: MoveQuality;
  headline: string;
  reason: string;
  bestSan?: string;
  bestUci?: string;
  cpLoss: number | null;
};

type Props = {
  lang?: "id" | "en";
  /** Optional starting FEN (e.g. from spectator "Try Position") */
  startFen?: string;
  startMoves?: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const QUALITY_COLOR: Record<MoveQuality, string> = {
  brilliant: "text-cyan-300",
  best: "text-emerald-400",
  good: "text-green-300",
  inaccuracy: "text-yellow-400",
  mistake: "text-orange-400",
  blunder: "text-red-400",
};

const QUALITY_LABEL_ID: Record<MoveQuality, string> = {
  brilliant: "Brilian! ⭐",
  best: "Terbaik!",
  good: "Bagus.",
  inaccuracy: "Kurang Akurat",
  mistake: "Kesalahan",
  blunder: "Blunder! ✗",
};

function classifyCpLoss(cpLoss: number | null, isBest: boolean): MoveQuality {
  if (isBest || cpLoss === null || cpLoss < 10) return "best";
  if (cpLoss < 25) return "good";
  if (cpLoss < 50) return "inaccuracy";
  if (cpLoss < 150) return "mistake";
  return "blunder";
}

async function fetchBest(fen: string, depth = 14, engine: "stockfish" | "jev" = "stockfish"): Promise<{ uci: string; san: string; scoreCp: number | null } | null> {
  try {
    const r = await fetch("/api/engine-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, depth, engine }),
    });
    const d = await r.json();
    if (d.uci && d.san) return { uci: d.uci, san: d.san, scoreCp: d.scoreCp ?? null };
  } catch {}
  return null;
}

/**
 * Ask Jev whether a tactical threat exists.
 * Uses TypeSafe choice to pick the most "threatened" square from candidates,
 * combined with a probability threshold to decide if warning is shown.
 * We reuse /api/engine-move (Stockfish) for a shallow threat probe — simpler and no
 * extra API endpoint needed. If bestmove is a capture/check at depth 1, there's a threat.
 */
async function probeThreat(fen: string): Promise<ThreatInfo> {
  // Probe at depth 1 from opponent's perspective by making it their turn
  // We look at what the opponent WOULD do if they could move right now
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return { hasThreat: false, probability: 0, squareHint: null, message: "" };

    // Get current side's best move at depth 3 (opponent's reply)
    const data = await fetchBest(fen, 3);
    if (!data) return { hasThreat: false, probability: 0, squareHint: null, message: "" };

    // Check if that best move is a capture or check (threat indicator)
    const isThreat = data.san.includes("+") || data.san.includes("x") || data.san.includes("#");
    const targetSquare = data.uci.slice(2, 4);

    if (isThreat) {
      const abs = data.scoreCp !== null ? Math.abs(data.scoreCp) : 0;
      const probability = Math.min(0.99, 0.6 + abs / 1000);
      return {
        hasThreat: true,
        probability,
        squareHint: targetSquare,
        message: data.san.includes("#")
          ? `⚠ Petak ${targetSquare} rawan — ancaman skakmat via ${data.san}!`
          : data.san.includes("+")
          ? `⚠ Petak ${targetSquare} dalam bahaya — lawan bisa skak via ${data.san}.`
          : `⚠ Petak ${targetSquare} terancam — lawan bisa ambil via ${data.san}.`,
      };
    }
    return { hasThreat: false, probability: 0.1, squareHint: null, message: "" };
  } catch {
    return { hasThreat: false, probability: 0, squareHint: null, message: "" };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function GuidedPlayView({ lang = "id", startFen, startMoves }: Props) {
  const initFen = startFen ?? START_FEN;
  const [chess, setChess] = useState<Chess>(() => new Chess(initFen));
  const [fen, setFen] = useState(initFen);
  const [history, setHistory] = useState<string[]>(startMoves ?? []);
  const [playerSide, setPlayerSide] = useState<"white" | "black">("white");
  const [outcome, setOutcome] = useState<GameOutcome>(() => describeOutcome(new Chess(initFen)));
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [threat, setThreat] = useState<ThreatInfo | null>(null);
  const [showBestArrow, setShowBestArrow] = useState(false);
  const [bestArrow, setBestArrow] = useState<[string, string] | null>(null);
  const [evalCp, setEvalCp] = useState<number | null>(null);
  const thinkingRef = useRef(false);
  const [strategyMode, setStrategyMode] = useState<"attack" | "defense" | "balanced">("balanced");

  // Re-init when startFen changes (from spectator "Try Position")
  useEffect(() => {
    if (!startFen) return;
    const c = new Chess(startFen);
    setChess(c);
    setFen(startFen);
    setHistory(startMoves ?? []);
    setOutcome(describeOutcome(c));
    setFeedback(null);
    setThreat(null);
    setBestArrow(null);
    setShowBestArrow(false);
    setEvalCp(null);
  }, [startFen, startMoves]);

  // After each player turn, probe threat for next position
  const probeThreatForPosition = useCallback(async (currentFen: string) => {
    const info = await probeThreat(currentFen);
    setThreat(info);
  }, []);

  const resetGame = useCallback((side: "white" | "black" = "white") => {
    const c = new Chess(initFen);
    setChess(c);
    setFen(initFen);
    setHistory(startMoves ?? []);
    setPlayerSide(side);
    setOutcome(describeOutcome(c));
    setShowConfetti(false);
    setSelectedSquare(null);
    setFeedback(null);
    setThreat(null);
    setBestArrow(null);
    setShowBestArrow(false);
    setEvalCp(null);
    thinkingRef.current = false;
    setThinking(false);

    if (side === "black") triggerOpponentMove(c.fen());
  }, [initFen, startMoves]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerOpponentMove = async (currentFen: string) => {
    setThinking(true);
    thinkingRef.current = true;
    try {
      const data = await fetchBest(currentFen, 14, "jev");
      if (!data) throw new Error("no data");

      const c = new Chess(currentFen);
      const move = findLegalMove(c, data.uci.slice(0, 2) as Square, data.uci.slice(2, 4) as Square,
        data.uci.length > 4 ? (data.uci[4] as "q") : undefined);
      if (!move) return;
      c.move(move);

      setChess(c);
      setFen(c.fen());
      setHistory(prev => [...prev, data.san]);
      setEvalCp(data.scoreCp !== null ? -data.scoreCp : null);
      setBestArrow(null);
      setShowBestArrow(false);

      const out = describeOutcome(c);
      setOutcome(out);

      const strategyNote = playerSide === "black"
        ? strategyMode === "attack"
          ? lang === "id"
            ? "Lawan (Putih) baru bergerak. Evaluasi serangan: buka garis, tekan raja, hitung material."
            : "White just moved. Evaluate attack: open lines, pressure king, calculate material."
          : strategyMode === "defense"
          ? lang === "id"
            ? "Lawan (Putih) baru bergerak. Evaluasi pertahanan: kunci struktur, amankan raja, tunggu celah."
            : "White just moved. Evaluate defense: lock structure, king safety, wait for gaps."
          : lang === "id"
            ? "Lawan (Putih) baru bergerak. Analisis: cari keseimbangan material dan posisi."
            : "White just moved. Analyze: look for material and positional balance."
        : lang === "id"
        ? "Analisis posisi dan cari respons terbaikmu."
        : "Analyze the position and find your best response.";
      setFeedback({
        quality: "good",
        headline: playerSide === "black"
          ? (lang === "id" ? `Lawan (Putih) bergerak: ${data.san}` : `Opponent (White) plays: ${data.san}`)
          : (lang === "id" ? `Lawan (Hitam) bergerak: ${data.san}` : `Opponent (Black) plays: ${data.san}`),
        reason: strategyNote,
        cpLoss: null,
      });

      // After opponent moves, probe threat for player's upcoming turn
      await probeThreatForPosition(c.fen());
    } catch {
      setFeedback({ quality: "inaccuracy", headline: "Gagal memuat langkah lawan.", reason: "", cpLoss: null });
    } finally {
      setThinking(false);
      thinkingRef.current = false;
    }
  };

  const tryMove = async (from: string, to: string) => {
    if (outcome.over || thinkingRef.current) return;
    if (chess.turn() !== (playerSide === "white" ? "w" : "b")) return;

    const c = new Chess(chess.fen());
    const hasPromo = getLegalMoves(c).some(m => m.from === from && m.to === to && m.isPromotion);
    const move = findLegalMove(c, from as Square, to as Square, hasPromo ? "q" : undefined);
    if (!move) {
      setFeedback({ quality: "inaccuracy", headline: lang === "id" ? "Langkah tidak valid." : "Illegal move.", reason: "", cpLoss: null });
      return;
    }

    setThinking(true);
    thinkingRef.current = true;
    setThreat(null); // clear warning while thinking

    // Get best move BEFORE player moves
    const preBest = await fetchBest(chess.fen(), 14);
    const bestUci = preBest?.uci ?? "";
    const bestSan = preBest?.san ?? "";
    const evalBefore = preBest?.scoreCp ?? null;

    c.move(move);
    const userUci = move.from + move.to + (move.promotion ?? "");

    // Get eval AFTER player move
    let evalAfterFlipped: number | null = null;
    const postData = await fetchBest(c.fen(), 14);
    if (postData?.scoreCp !== null && postData?.scoreCp !== undefined) {
      evalAfterFlipped = -(postData.scoreCp);
    }

    let cpLoss: number | null = null;
    if (evalBefore !== null && evalAfterFlipped !== null) {
      cpLoss = Math.max(0, evalBefore - evalAfterFlipped);
    }

    const isBest = !bestUci || userUci === bestUci || move.san === bestSan;
    const quality = classifyCpLoss(cpLoss, isBest);

    setChess(c);
    setFen(c.fen());
    setHistory(prev => [...prev, move.san]);
    setEvalCp(evalAfterFlipped);

    if (!isBest && bestUci.length >= 4) {
      setBestArrow([bestUci.slice(0, 2), bestUci.slice(2, 4)]);
    } else {
      setBestArrow(null);
    }
    setShowBestArrow(false);

    const out = describeOutcome(c);
    setOutcome(out);

    if (out.over) {
      setThinking(false);
      thinkingRef.current = false;
      setShowConfetti(out.winner === playerSide);
      setFeedback({ quality: out.winner === playerSide ? "brilliant" : "good", headline: lang === "id" ? "Pertandingan selesai!" : "Game over!", reason: "", cpLoss: null });
      return;
    }

    setFeedback({
      quality,
      headline: lang === "id" ? QUALITY_LABEL_ID[quality] : quality,
      reason: lang === "id"
        ? isBest ? `${move.san} adalah langkah terbaik!` : `Disarankan ${bestSan} (kehilangan ~${cpLoss ?? "?"} cp).`
        : isBest ? `${move.san} is the engine's top choice!` : `Engine suggests ${bestSan} (~${cpLoss ?? "?"} cp loss).`,
      bestSan: isBest ? undefined : bestSan,
      bestUci: isBest ? undefined : bestUci,
      cpLoss,
    });

    setTimeout(() => { void triggerOpponentMove(c.fen()); }, 600);
  };

  const handleUndo = () => {
    if (history.length < 2 || thinkingRef.current) return;
    const newHistory = history.slice(0, -2);
    const rebuild = new Chess(initFen);
    for (const m of newHistory) { if (!rebuild.move(m)) break; }
    setChess(rebuild);
    setFen(rebuild.fen());
    setHistory(newHistory);
    setOutcome(describeOutcome(rebuild));
    setFeedback({ quality: "good", headline: lang === "id" ? "Undo 1 langkah." : "Undone.", reason: "", cpLoss: null });
    setThreat(null);
    setBestArrow(null);
    setShowBestArrow(false);
    setShowConfetti(false);
  };

  // Square styles: selected + best arrow highlight + threat highlight
  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (selectedSquare) {
      s[selectedSquare] = { boxShadow: "inset 0 0 0 4px #facc15", backgroundColor: "rgba(250,204,21,0.3)" };
    }
    if (showBestArrow && bestArrow) {
      s[bestArrow[0]] = { boxShadow: "inset 0 0 0 4px #38bdf8", backgroundColor: "rgba(56,189,248,0.3)" };
      s[bestArrow[1]] = { boxShadow: "inset 0 0 0 4px #81b64c", backgroundColor: "rgba(129,182,76,0.4)" };
    }
    if (threat?.hasThreat && threat.squareHint && threat.probability > 0.6) {
      // Only highlight if not already highlighted by best arrow
      if (!showBestArrow) {
        s[threat.squareHint] = { boxShadow: "inset 0 0 0 4px #f97316", backgroundColor: "rgba(249,115,22,0.3)" };
      }
    }
    return s;
  }, [selectedSquare, showBestArrow, bestArrow, threat]);

  const arrows = useMemo(() => {
    if (!showBestArrow || !bestArrow) return [];
    return [{ startSquare: bestArrow[0], endSquare: bestArrow[1], color: "#38bdf8" }];
  }, [showBestArrow, bestArrow]);

  const evalBarPct = evalCp !== null ? Math.round((Math.tanh(evalCp / 400) + 1) / 2 * 100) : 50;
  const qColor = feedback ? QUALITY_COLOR[feedback.quality] : "";

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="bg-[#262421] px-5 py-4 rounded-2xl border border-[#36322d] shadow-xl flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <IconBot3D size={26} />
          <div>
            <h2 className="text-lg font-black text-white">
              {lang === "id" ? "Latihan Dipandu Jev" : "Jev Guided Practice"}
            </h2>
            <p className="text-xs text-neutral-300">
              {lang === "id"
                ? "Jev memandu tiap langkahmu + memberi peringatan ancaman sebelum kamu bergerak"
                : "Jev coaches every move + warns you of threats before you play"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => resetGame("white")} variant="outline" className="border-[#36322d] text-white text-sm font-bold bg-[#1c1a18]" disabled={thinking}>
            ♟ {lang === "id" ? "Main Putih" : "Play White"}
          </Button>
          <Button onClick={() => resetGame("black")} variant="outline" className="border-[#36322d] text-white text-sm font-bold bg-[#1c1a18]" disabled={thinking}>
            ♟ {lang === "id" ? "Main Hitam" : "Play Black"}
          </Button>
        </div>
      </div>

      {/* Strategy selector — visible when player is black */}
      {playerSide === "black" && !outcome.over && (
        <div className="bg-[#1c1a18] px-4 py-2.5 rounded-xl border border-[#36322d] flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            {lang === "id" ? "Strategi vs Lawan:" : "Strategy vs Opponent:"}
          </span>
          <div className="flex gap-1.5">
            <button onClick={() => setStrategyMode("attack")}
              className={"px-2.5 py-1 rounded-lg text-xs font-bold border transition-all " + (strategyMode === "attack" ? "bg-red-900/60 border-red-500 text-red-300" : "bg-[#1a1816] border-[#36322d] text-neutral-400 hover:text-white")}>
              {(lang === "id" ? "Serang" : "Attack")}
            </button>
            <button onClick={() => setStrategyMode("defense")}
              className={"px-2.5 py-1 rounded-lg text-xs font-bold border transition-all " + (strategyMode === "defense" ? "bg-sky-900/60 border-sky-500 text-sky-300" : "bg-[#1a1816] border-[#36322d] text-neutral-400 hover:text-white")}>
              {(lang === "id" ? "Bertahan" : "Defend")}
            </button>
            <button onClick={() => setStrategyMode("balanced")}
              className={"px-2.5 py-1 rounded-lg text-xs font-bold border transition-all " + (strategyMode === "balanced" ? "bg-[#3d3a37] border-[#81b64c] text-white" : "bg-[#1a1816] border-[#36322d] text-neutral-400 hover:text-white")}>
              {(lang === "id" ? "Seimbang" : "Balanced")}
            </button>
          </div>
          <span className="text-xs text-neutral-400 ml-auto">
            {lang === "id"
              ? strategyMode === "attack" ? "Fokus: buka garis, serang raja, hitung material."
              : strategyMode === "defense" ? "Fokus: kunci struktur, amankan raja, tunggu celah."
              : "Fokus: keseimbangan material dan posisi."
              : strategyMode === "attack" ? "Focus: open lines, attack the king."
              : strategyMode === "defense" ? "Focus: lock structure, king safety."
              : "Focus: balance material and position."}
          </span>
        </div>
      )}

      {/* Threat warning banner — appears above board when threat detected */}
      {threat?.hasThreat && threat.probability > 0.55 && !thinking && !outcome.over && (
        <div className="p-3.5 rounded-xl bg-orange-950/70 border border-orange-500/60 text-orange-200 text-sm font-semibold flex items-start gap-2.5 animate-pulse">
          <span className="text-lg shrink-0">⚠</span>
          <div>
            <div className="font-black text-orange-300 text-xs uppercase tracking-wider mb-0.5">
              {lang === "id" ? `Peringatan Jev (${Math.round(threat.probability * 100)}% kemungkinan ancaman)` : `Jev Warning (${Math.round(threat.probability * 100)}% threat probability)`}
            </div>
            <div>{threat.message}</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(300px,1fr)_380px] gap-5 items-start">
        {/* Board */}
        <div className="space-y-3">
          {/* Eval bar */}
          <div className="bg-[#1c1a18] rounded-xl border border-[#36322d] p-2.5 flex items-center gap-3">
            <span className="text-xs text-neutral-300 font-mono w-10 text-right">
              {evalCp !== null ? (evalCp > 0 ? `+${(evalCp/100).toFixed(1)}` : (evalCp/100).toFixed(1)) : "="}
            </span>
            <div className="flex-1 h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${evalBarPct}%`,
                  background: evalBarPct > 55 ? "linear-gradient(90deg,#ccc,#fff)" : evalBarPct < 45 ? "linear-gradient(90deg,#222,#444)" : "linear-gradient(90deg,#888,#bbb)",
                }}
              />
            </div>
            <span className="text-xs font-mono text-neutral-300 w-12">
              {evalBarPct > 50 ? `W ${evalBarPct}%` : `B ${100-evalBarPct}%`}
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl w-full bg-[var(--board-dark)]">
            <Chessboard
              options={{
                id: "guided-board",
                position: fen,
                boardOrientation: playerSide,
                allowDragging: false,
                boardStyle: { backgroundColor: "var(--board-dark)" },
                onSquareClick: ({ square }) => {
                  if (selectedSquare) {
                    void tryMove(selectedSquare, square);
                    setSelectedSquare(null);
                  } else {
                    setSelectedSquare(square);
                  }
                },
                squareStyles,
                arrows,
                darkSquareStyle: { backgroundColor: "#b58863" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleUndo} variant="outline"
              className="flex-1 border-[#36322d] text-neutral-300 text-sm font-bold bg-[#1c1a18]"
              disabled={history.length < 2 || thinkingRef.current}>
              ← {lang === "id" ? "Undo" : "Undo"}
            </Button>
            {bestArrow && (
              <Button onClick={() => setShowBestArrow(v => !v)} variant="outline"
                className={`flex-1 text-xs font-bold border-[#38bdf8]/40 ${showBestArrow ? "bg-[#0f2231] text-sky-300" : "bg-[#1c1a18] text-neutral-300"}`}>
                {showBestArrow ? (lang === "id" ? "Sembunyikan" : "Hide") : (lang === "id" ? "Tampilkan Terbaik" : "Show Best")}
              </Button>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Thinking indicator */}
          {thinking && (
            <div className="p-3 rounded-xl bg-[#1e2a14] border border-[#81b64c]/40 text-[#81b64c] text-xs font-bold animate-pulse flex items-center gap-2">
              <IconLightning3D size={14} />
              {lang === "id" ? "Stockfish sedang berpikir..." : "Stockfish is thinking..."}
            </div>
          )}

          {/* Feedback card */}
          <Card className="bg-[#262421] border-[#36322d] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#36322d]">
              <CardTitle className="text-sm font-bold">{lang === "id" ? "Analisis Langkah Jev" : "Jev Move Analysis"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {feedback ? (
                <>
                  <div className={`text-2xl font-black ${qColor}`}>{feedback.headline}</div>
                  {feedback.cpLoss !== null && feedback.cpLoss > 0 && (
                    <div className="text-xs text-neutral-300 font-mono">-{feedback.cpLoss} cp</div>
                  )}
                  {feedback.reason && (
                    <div className="p-3 rounded-xl bg-[#312e2b] text-sm text-neutral-200 leading-relaxed">{feedback.reason}</div>
                  )}
                  {feedback.bestSan && (
                    <div className="p-3 rounded-xl bg-[#0f2231] border border-[#38bdf8]/30 text-sky-200 text-xs space-y-1">
                      <div className="font-bold text-sky-300">{lang === "id" ? "Langkah Terbaik:" : "Top Move:"}</div>
                      <div className="font-mono text-base font-black">{feedback.bestSan}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-neutral-300 py-4 text-center">
                  {lang === "id" ? "Buat langkah pertama untuk memulai." : "Make your first move to begin."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Move history */}
          {history.length > 0 && (
            <Card className="bg-[#262421] border-[#36322d] text-white">
              <CardHeader className="py-3 px-4 border-b border-[#36322d]">
                <CardTitle className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  {lang === "id" ? "Riwayat Langkah" : "Move History"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-1.5 font-mono text-xs h-[120px] overflow-y-auto">
                  {history.map((san, idx) => (
                    <span key={idx} className={`px-2 py-0.5 rounded ${
                      idx % 2 === 0 ? "bg-[#312e2b] text-neutral-200" : "bg-[#1c1a18] text-neutral-300"
                    } ${idx === history.length - 1 ? "ring-1 ring-[#81b64c]" : ""}`}>
                      {idx % 2 === 0 && <span className="text-neutral-300 mr-1">{Math.floor(idx/2)+1}.</span>}
                      {san}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* How threat detection works */}
          <div className="p-3.5 rounded-xl bg-[#1c1a18] border border-[#36322d] text-xs text-neutral-300 leading-relaxed space-y-1">
            <div className="font-bold text-neutral-300">{lang === "id" ? "Cara Kerja Peringatan Ancaman" : "How Threat Warnings Work"}</div>
            <div>
              {lang === "id"
                ? "Sebelum kamu bergerak, Jev menanyakan Stockfish di depth 3: \"Jika lawan yang jalan sekarang, langkah terbaik mereka apa?\" — Jika jawabannya serangan (skak/ambil bidak), peringatan muncul dengan sorotan oranye di petak target."
                : "Before you move, Jev probes Stockfish at depth 3: \"If the opponent moved right now, what's their best move?\" — If the answer is an attack (check/capture), a warning appears with an orange highlight on the target square."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
