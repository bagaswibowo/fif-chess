"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D } from "@/components/icons3d";
import {
  describeOutcome,
  findLegalMove,
  getLegalMoves,
  type GameOutcome,
  type LegalMove,
} from "@/lib/chess";

// ── Types ─────────────────────────────────────────────────────────────────────

type MoveQuality = "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder";

type CoachFeedback = {
  quality: MoveQuality;
  headline: string;
  reason: string;
  tactic: string;
  bestSan?: string;
  bestUci?: string;
  cpLoss: number | null;
  evalBar: number | null; // -1..+1 from white's perspective
};

type Props = { lang?: "id" | "en" };

// ── Constants ─────────────────────────────────────────────────────────────────

// Centipawn loss thresholds (from white's POV after move)
const QUALITY_LABELS: Record<MoveQuality, { id: string; en: string; color: string }> = {
  brilliant: { id: "Brilian! ⭐", en: "Brilliant! ⭐", color: "text-cyan-300" },
  best:      { id: "Terbaik!", en: "Best Move!", color: "text-emerald-400" },
  good:      { id: "Bagus.", en: "Good.", color: "text-green-300" },
  inaccuracy:{ id: "Kurang Akurat", en: "Inaccuracy", color: "text-yellow-400" },
  mistake:   { id: "Kesalahan", en: "Mistake", color: "text-orange-400" },
  blunder:   { id: "Blunder! ✗", en: "Blunder! ✗", color: "text-red-400" },
};

// Opening principles — keyed to ply count (0-based)
const OPENING_PRINCIPLES = [
  { id: "Kuasai pusat: e4, d4, e5, d5 adalah petak kunci di awal permainan.", en: "Control the center: e4, d4, e5, d5 are key squares in the opening." },
  { id: "Kembangkan perwira ringan (Kuda & Gajah) sebelum melakukan rokade.", en: "Develop minor pieces (Knights & Bishops) before castling." },
  { id: "Jangan memindahkan bidak yang sama dua kali di pembukaan tanpa alasan taktis.", en: "Avoid moving the same pawn twice in the opening without tactical reason." },
  { id: "Rokade lebih awal untuk mengamankan Raja ke sudut.", en: "Castle early to tuck your King safely." },
  { id: "Hubungkan benteng — singkirkan semua perwira di antara kedua benteng.", en: "Connect your Rooks by clearing pieces between them." },
  { id: "Jangan keluarkan Menteri terlalu awal — mudah diusir dan membuang tempo.", en: "Don't bring the Queen out too early — she's easily chased and loses tempo." },
];

// Chess tactic patterns detected from move flags
function detectTactic(move: LegalMove, chess: Chess): string {
  if (move.isCheckmate) return "♚ Skakmat — partai berakhir!";
  if (move.isCheck) {
    // Is it a discovered check? (piece not on original square moved away)
    return "♟ Skak langsung — Raja lawan dalam ancaman.";
  }
  if (move.isCapture) {
    const captured = chess.get(move.to as Square);
    const names: Record<string, string> = { p: "Pion", n: "Kuda", b: "Gajah", r: "Benteng", q: "Menteri" };
    const pieceId = captured?.type ?? "bidak";
    return `✂ Pertukaran material: ambil ${names[pieceId] ?? pieceId} lawan.`;
  }
  if (move.isPromotion) return "👑 Promosi Pion — mendapat Menteri baru!";
  if (move.isCastle) return "🏰 Rokade — Raja aman, Benteng aktif.";

  // Heuristic: moving to a central square?
  const centralSquares = ["d4", "d5", "e4", "e5", "c4", "c5", "f4", "f5"];
  if (centralSquares.includes(move.to)) return "⚡ Kontrol pusat — mendominasi area strategis papan.";

  return "📐 Langkah posisional — membangun struktur dan aktivitas bidak.";
}

// Classify move quality from centipawn loss
function classifyQuality(cpLoss: number | null, isBest: boolean): MoveQuality {
  if (isBest) return "best";
  if (cpLoss === null) return "good";
  if (cpLoss < 10) return "best";
  if (cpLoss < 25) return "good";
  if (cpLoss < 50) return "inaccuracy";
  if (cpLoss < 150) return "mistake";
  return "blunder";
}

// Normalize centipawn to -1..+1 for eval bar
function cpToBar(cp: number | null): number | null {
  if (cp === null) return null;
  // tanh compression: ±300cp → ±0.75, ±1000cp → ±0.99
  return Math.tanh(cp / 400);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CoachModeView({ lang = "id" }: Props) {
  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>(() => new Chess().fen());
  const [history, setHistory] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [thinking, setThinking] = useState(false);
  const [playerSide, setPlayerSide] = useState<"white" | "black">("white");
  const [outcome, setOutcome] = useState<GameOutcome>(() => describeOutcome(new Chess()));
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [bestArrow, setBestArrow] = useState<[string, string] | null>(null);
  const [showBestMove, setShowBestMove] = useState(false);
  const [evalCp, setEvalCp] = useState<number | null>(null); // current position eval
  const thinkingRef = useRef(false);

  // ── Principle of the moment (based on ply) ──────────────────────────────
  const currentPrinciple = useMemo(() => {
    const ply = history.length;
    if (ply >= 20) return null; // past opening
    const p = OPENING_PRINCIPLES[Math.min(Math.floor(ply / 2), OPENING_PRINCIPLES.length - 1)];
    return lang === "id" ? p.id : p.en;
  }, [history.length, lang]);

  // ── Eval bar visual ──────────────────────────────────────────────────────
  const evalBarValue = cpToBar(evalCp); // -1..+1 (white favored = positive)

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetGame = useCallback((side: "white" | "black" = "white") => {
    const c = new Chess();
    setChess(c);
    setFen(c.fen());
    setHistory([]);
    setFeedback(null);
    setPlayerSide(side);
    setOutcome(describeOutcome(c));
    setShowConfetti(false);
    setSelectedSquare(null);
    setBestArrow(null);
    setShowBestMove(false);
    setEvalCp(null);
    thinkingRef.current = false;
    setThinking(false);

    if (side === "black") {
      triggerStockfishMove(c.fen(), true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch best move from Stockfish ───────────────────────────────────────
  const fetchBestMove = async (
    fen: string,
  ): Promise<{ uci: string; san: string; scoreCp: number | null } | null> => {
    try {
      const res = await fetch("/api/jev-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen }),
      });
      const data = await res.json();
      if (data.uci && data.san) return { uci: data.uci, san: data.san, scoreCp: data.scoreCp ?? null };
    } catch {}
    return null;
  };

  // ── Stockfish plays a move (opponent) ────────────────────────────────────
  const triggerStockfishMove = async (currentFen: string, isInitial = false) => {
    setThinking(true);
    thinkingRef.current = true;
    try {
      const data = await fetchBestMove(currentFen);
      if (!data) throw new Error("no data");

      const c = new Chess(currentFen);
      const move = findLegalMove(
        c,
        data.uci.slice(0, 2) as Square,
        data.uci.slice(2, 4) as Square,
        data.uci.length > 4 ? (data.uci[4] as "q" | "r" | "b" | "n") : undefined,
      );
      if (!move) return;
      c.move(move);

      setChess(c);
      setFen(c.fen());
      setHistory((prev) => [...prev, data.san]);
      setBestArrow(null);
      setShowBestMove(false);
      // Eval flips for opponent's move
      setEvalCp(data.scoreCp !== null ? -data.scoreCp : null);

      const out = describeOutcome(c);
      setOutcome(out);
      if (out.over && out.winner === (playerSide === "white" ? "black" : "white")) setShowConfetti(true);

      setFeedback({
        quality: "good",
        headline: isInitial
          ? (lang === "id" ? `Stockfish membuka dengan ${data.san}. Giliran Anda!` : `Stockfish opens with ${data.san}. Your turn!`)
          : (lang === "id" ? `Stockfish menjawab dengan ${data.san}.` : `Stockfish replies: ${data.san}.`),
        reason: lang === "id" ? "Analisis posisi dan tentukan respons terbaik Anda." : "Analyze the position and find your best response.",
        tactic: "",
        evalBar: evalBarValue,
        cpLoss: null,
      });
    } catch {
      setFeedback({
        quality: "inaccuracy",
        headline: lang === "id" ? "Gagal memuat langkah AI." : "Failed to load AI move.",
        reason: "",
        tactic: "",
        evalBar: null,
        cpLoss: null,
      });
    } finally {
      setThinking(false);
      thinkingRef.current = false;
    }
  };

  // ── Player makes a move ───────────────────────────────────────────────────
  const tryMove = async (from: string, to: string) => {
    if (outcome.over || thinkingRef.current) return;
    if (chess.turn() !== (playerSide === "white" ? "w" : "b")) {
      setFeedback({
        quality: "inaccuracy",
        headline: lang === "id" ? "Bukan giliran Anda." : "Not your turn.",
        reason: "", tactic: "", evalBar: evalBarValue, cpLoss: null,
      });
      return;
    }

    const c = new Chess(chess.fen());
    const hasPromotion = getLegalMoves(c).some((m) => m.from === from && m.to === to && m.isPromotion);
    const move = findLegalMove(c, from as Square, to as Square, hasPromotion ? "q" : undefined);
    if (!move) {
      setFeedback({
        quality: "inaccuracy",
        headline: lang === "id" ? "Langkah tidak valid. Coba lagi." : "Illegal move. Try again.",
        reason: "", tactic: "", evalBar: evalBarValue, cpLoss: null,
      });
      return;
    }

    setThinking(true);
    thinkingRef.current = true;
    setBestArrow(null);
    setShowBestMove(false);

    // Ask engine what was best BEFORE the player moved
    const preMoveEval = await fetchBestMove(chess.fen());
    const bestUci = preMoveEval?.uci ?? "";
    const bestSan = preMoveEval?.san ?? "";
    const evalBefore = preMoveEval?.scoreCp ?? null;

    // Apply player move
    c.move(move);
    const userUci = move.from + move.to + (move.promotion ?? "");

    // Get engine eval AFTER player's move (to compute cp loss)
    let evalAfterRaw: number | null = null;
    try {
      const postMoveData = await fetchBestMove(c.fen());
      // Score is from the side to move (now opponent), so flip for original side
      evalAfterRaw = postMoveData?.scoreCp !== null && postMoveData?.scoreCp !== undefined
        ? -postMoveData.scoreCp
        : null;
    } catch {}

    // cp loss = how much worse than best move (both from player's perspective)
    let cpLoss: number | null = null;
    if (evalBefore !== null && evalAfterRaw !== null) {
      // evalBefore is from side-to-move (player), evalAfterRaw also from player
      cpLoss = Math.max(0, evalBefore - evalAfterRaw);
    }

    const isBest = !bestUci || userUci === bestUci || move.san === bestSan;
    const quality = classifyQuality(cpLoss, isBest);
    const tactic = detectTactic(move, chess); // chess = state before move

    setChess(c);
    setFen(c.fen());
    setHistory((prev) => [...prev, move.san]);
    setEvalCp(evalAfterRaw);
    const currentOut = describeOutcome(c);
    setOutcome(currentOut);

    if (currentOut.over) {
      setThinking(false);
      thinkingRef.current = false;
      setShowConfetti(currentOut.winner === playerSide);
      setFeedback({
        quality: currentOut.winner === playerSide ? "brilliant" : "good",
        headline: lang === "id" ? "Pertandingan selesai!" : "Game over!",
        reason: "", tactic, evalBar: evalAfterRaw !== null ? cpToBar(evalAfterRaw) : null,
        cpLoss: null,
      });
      return;
    }

    const qLabel = QUALITY_LABELS[quality];
    setFeedback({
      quality,
      headline: lang === "id" ? qLabel.id : qLabel.en,
      reason: lang === "id"
        ? (isBest
            ? `${move.san} adalah langkah terbaik di posisi ini.`
            : `Disarankan ${bestSan || "langkah lain"} (kehilangan ${cpLoss ?? "?"} centipawn).`)
        : (isBest
            ? `${move.san} is the top engine move.`
            : `Engine suggests ${bestSan || "another move"} (lost ${cpLoss ?? "?"} centipawns).`),
      tactic,
      bestSan: isBest ? undefined : bestSan,
      bestUci: isBest ? undefined : bestUci,
      evalBar: evalAfterRaw !== null ? cpToBar(evalAfterRaw) : null,
      cpLoss,
    });

    // Store best move arrow so player can request it
    if (!isBest && bestUci && bestUci.length >= 4) {
      setBestArrow([bestUci.slice(0, 2), bestUci.slice(2, 4)]);
    }

    setTimeout(() => { triggerStockfishMove(c.fen()); }, 700);
  };

  // ── Undo (2 plies: player + AI) ─────────────────────────────────────────
  const handleUndo = () => {
    if (history.length < 2 || thinkingRef.current) return;
    const newHistory = history.slice(0, -2);
    const rebuild = new Chess();
    for (const m of newHistory) { if (!rebuild.move(m)) break; }
    setChess(rebuild);
    setFen(rebuild.fen());
    setHistory(newHistory);
    setOutcome(describeOutcome(rebuild));
    setFeedback({
      quality: "good",
      headline: lang === "id" ? "Undo 1 langkah. Ulangi!" : "Undone. Try again!",
      reason: "", tactic: "", evalBar: null, cpLoss: null,
    });
    setBestArrow(null);
    setShowBestMove(false);
    setShowConfetti(false);
  };

  // ── Square highlight styles ───────────────────────────────────────────────
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selectedSquare) {
      styles[selectedSquare] = { boxShadow: "inset 0 0 0 4px #facc15", backgroundColor: "rgba(250,204,21,0.35)" };
    }
    if (showBestMove && bestArrow) {
      styles[bestArrow[0]] = { boxShadow: "inset 0 0 0 4px #38bdf8", backgroundColor: "rgba(56,189,248,0.35)" };
      styles[bestArrow[1]] = { boxShadow: "inset 0 0 0 4px #81b64c", backgroundColor: "rgba(129,182,76,0.45)" };
    }
    return styles;
  }, [selectedSquare, showBestMove, bestArrow]);

  // ── Arrows for best move ──────────────────────────────────────────────────
  const arrows = useMemo(() => {
    if (!showBestMove || !bestArrow) return [];
    return [{ startSquare: bestArrow[0], endSquare: bestArrow[1], color: '#38bdf8' }];
  }, [showBestMove, bestArrow]);

  // ── Eval bar % from white perspective ────────────────────────────────────
  const evalBarWhitePct = evalBarValue !== null
    ? Math.round((evalBarValue + 1) / 2 * 100)
    : 50;

  const qColor = feedback ? QUALITY_LABELS[feedback.quality].color : "";

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">
      {showConfetti && <Confetti />}

      {/* ── Header bar ── */}
      <div className="bg-[#262421] px-5 py-4 rounded-2xl border border-[#36322d] shadow-xl flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <IconBot3D size={28} />
          <div>
            <h2 className="text-lg font-black text-white leading-tight">
              {lang === "id" ? "Mode Belajar AI Coach" : "AI Coach Mode"}
            </h2>
            <p className="text-xs text-neutral-400">
              {lang === "id"
                ? "Setiap langkah dinilai Stockfish • Undo tersedia"
                : "Every move rated by Stockfish • Undo available"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => resetGame("white")}
            variant="outline"
            className="border-[#36322d] text-white text-xs font-bold bg-[#1c1a18] hover:bg-[#28241f]"
            disabled={thinking}
          >
            ♟ {lang === "id" ? "Main Putih" : "Play White"}
          </Button>
          <Button
            onClick={() => resetGame("black")}
            variant="outline"
            className="border-[#36322d] text-white text-xs font-bold bg-[#1c1a18] hover:bg-[#28241f]"
            disabled={thinking}
          >
            ♟ {lang === "id" ? "Main Hitam" : "Play Black"}
          </Button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="grid lg:grid-cols-[420px_1fr] gap-5 items-start">

        {/* ── Left: Board + eval bar ── */}
        <div className="space-y-3">
          {/* Eval bar */}
          <div className="bg-[#1c1a18] rounded-xl border border-[#36322d] p-2.5 flex items-center gap-3">
            <span className="text-[10px] text-neutral-500 font-mono w-6 text-right">
              {evalCp !== null ? (evalCp > 0 ? `+${(evalCp / 100).toFixed(1)}` : (evalCp / 100).toFixed(1)) : "="}
            </span>
            <div className="flex-1 h-3 bg-[#1a0000] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${evalBarWhitePct}%`,
                  background: evalBarWhitePct > 55
                    ? "linear-gradient(90deg, #e8e8e8, #ffffff)"
                    : evalBarWhitePct < 45
                    ? "linear-gradient(90deg, #1a1a1a, #333)"
                    : "linear-gradient(90deg, #888, #bbb)",
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-neutral-400 w-12">
              {evalBarWhitePct > 50
                ? `W ${evalBarWhitePct}%`
                : `B ${100 - evalBarWhitePct}%`}
            </span>
          </div>

          {/* Board */}
          <div className="rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl bg-[#1c1a18]">
            <Chessboard
              options={{
                id: "coach-board",
                position: fen,
                boardOrientation: playerSide,
                allowDragging: false,
                onSquareClick: ({ square }) => {
                  if (selectedSquare) {
                    tryMove(selectedSquare, square);
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

          {/* Action buttons under board */}
          <div className="flex gap-2">
            <Button
              onClick={handleUndo}
              variant="outline"
              className="flex-1 border-[#36322d] text-neutral-300 text-xs font-bold bg-[#1c1a18] hover:bg-[#28241f]"
              disabled={history.length < 2 || thinkingRef.current}
            >
              ← {lang === "id" ? "Undo Langkah Saya" : "Undo My Move"}
            </Button>
            {bestArrow && (
              <Button
                onClick={() => setShowBestMove((v) => !v)}
                variant="outline"
                className={`flex-1 text-xs font-bold border-[#38bdf8]/40 ${showBestMove ? "bg-[#0f2231] text-sky-300" : "bg-[#1c1a18] text-neutral-400"}`}
              >
                {showBestMove
                  ? (lang === "id" ? "Sembunyikan" : "Hide Best")
                  : (lang === "id" ? "Tampilkan Terbaik" : "Show Best Move")}
              </Button>
            )}
          </div>
        </div>

        {/* ── Right: Feedback + principles ── */}
        <div className="space-y-4">

          {/* Opening principle banner */}
          {currentPrinciple && (
            <div className="p-3.5 rounded-xl bg-[#1e2a14] border border-[#81b64c]/40 text-[#81b64c] text-xs leading-relaxed flex gap-2.5 items-start">
              <IconLightning3D size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-[#81b64c]/70 block mb-0.5">
                  {lang === "id" ? "Prinsip Pembukaan" : "Opening Principle"}
                </span>
                {currentPrinciple}
              </div>
            </div>
          )}

          {/* Feedback card */}
          <Card className="bg-[#262421] border-[#36322d] text-white">
            <CardHeader className="pb-2 border-b border-[#36322d]">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>{lang === "id" ? "Analisis Langkah" : "Move Analysis"}</span>
                {thinking && (
                  <span className="text-xs text-neutral-400 animate-pulse font-normal">
                    {lang === "id" ? "Stockfish berpikir…" : "Stockfish thinking…"}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {feedback ? (
                <>
                  {/* Quality badge */}
                  <div className={`text-2xl font-black ${qColor}`}>
                    {feedback.headline}
                  </div>

                  {/* CP loss badge */}
                  {feedback.cpLoss !== null && feedback.cpLoss > 0 && (
                    <div className="text-xs text-neutral-400 font-mono">
                      -{feedback.cpLoss} cp {lang === "id" ? "kehilangan evaluasi" : "evaluation loss"}
                    </div>
                  )}

                  {/* Reason + best move suggestion */}
                  {feedback.reason && (
                    <div className="p-3 rounded-xl bg-[#312e2b] text-sm text-neutral-200 leading-relaxed">
                      {feedback.reason}
                    </div>
                  )}

                  {/* Tactic label */}
                  {feedback.tactic && (
                    <div className="p-3 rounded-xl bg-[#1a1a14] border border-[#3d3a20] text-xs text-amber-300 font-semibold leading-relaxed">
                      {feedback.tactic}
                    </div>
                  )}

                  {/* Best move if player not playing best */}
                  {feedback.bestSan && (
                    <div className="p-3 rounded-xl bg-[#0f2231] border border-[#38bdf8]/30 text-sky-200 text-xs space-y-1">
                      <div className="font-bold text-sky-300">
                        {lang === "id" ? "Langkah Terbaik Engine:" : "Engine's Top Move:"}
                      </div>
                      <div className="font-mono text-base font-black">{feedback.bestSan}</div>
                      <div className="text-sky-400/70 text-[10px]">
                        {lang === "id"
                          ? "Tekan \"Tampilkan Terbaik\" untuk melihat panahnya di papan."
                          : "Press \"Show Best Move\" to see the arrow on the board."}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-neutral-400 py-4 text-center">
                  {lang === "id"
                    ? "Buat langkah pertama Anda untuk memulai analisis."
                    : "Make your first move to start the analysis."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Move history */}
          {history.length > 0 && (
            <Card className="bg-[#262421] border-[#36322d] text-white">
              <CardHeader className="py-3 px-4 border-b border-[#36322d]">
                <CardTitle className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  {lang === "id" ? "Riwayat Langkah" : "Move History"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                  {history.map((san, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded ${
                        idx % 2 === 0
                          ? "bg-[#312e2b] text-neutral-200"
                          : "bg-[#1c1a18] text-neutral-400"
                      } ${idx === history.length - 1 ? "ring-1 ring-[#81b64c]" : ""}`}
                    >
                      {idx % 2 === 0 && <span className="text-neutral-500 mr-1">{Math.floor(idx / 2) + 1}.</span>}
                      {san}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trick library — static reference */}
          <Card className="bg-[#262421] border-[#36322d] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#36322d]">
              <CardTitle className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                {lang === "id" ? "Trik & Pola Taktis (Referensi)" : "Tricks & Tactical Patterns"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2.5 text-xs">
                {[
                  {
                    icon: "🍴", id: "Garpu (Fork)",
                    descId: "Satu bidak menyerang 2 target sekaligus. Kuda sering jadi pelaku fork terbaik.",
                    descEn: "One piece attacks two targets simultaneously. Knights are the best fork pieces.",
                  },
                  {
                    icon: "📌", id: "Pin",
                    descId: "Bidak terikat karena jika pindah, bidak di belakangnya yang lebih berharga akan terambil.",
                    descEn: "A piece is pinned — moving it exposes a more valuable piece behind it.",
                  },
                  {
                    icon: "🪤", id: "Skewer",
                    descId: "Bidak berharga dipaksa menyingkir dan bidak di belakangnya diambil.",
                    descEn: "A valuable piece is forced to move, exposing a lesser piece behind it to capture.",
                  },
                  {
                    icon: "💥", id: "Discovered Attack",
                    descId: "Memindahkan satu bidak A membuka jalur serangan bidak B yang tersembunyi di belakangnya.",
                    descEn: "Moving piece A uncovers an attack from piece B hiding behind it.",
                  },
                  {
                    icon: "🏰", id: "Back-Rank Mate",
                    descId: "Raja musuh terjebak di baris paling belakang oleh pionnya sendiri. Masukkan Menteri/Benteng!",
                    descEn: "Enemy King is trapped on its back rank by its own pawns. Slide Rook/Queen in!",
                  },
                  {
                    icon: "🎯", id: "Zwischenzug",
                    descId: "Langkah 'di antara' — respons mengejutkan sebelum merespons ancaman lawan.",
                    descEn: "In-between move — a surprising intermediate response before addressing the opponent's threat.",
                  },
                  {
                    icon: "⚡", id: "Tempo Gain",
                    descId: "Menyerang sambil mengembangkan bidak — tidak membuang giliran.",
                    descEn: "Develop a piece while threatening something — gaining a free tempo.",
                  },
                  {
                    icon: "♟", id: "Passed Pawn",
                    descId: "Pion yang tidak bisa dihentikan pion musuh — harus didorong ke promosi!",
                    descEn: "A pawn no enemy pawn can stop — push it toward promotion!",
                  },
                ].map((trick) => (
                  <div key={trick.id} className="flex gap-2.5 p-2.5 rounded-lg bg-[#1a1816] border border-[#2e2c29]">
                    <span className="text-base shrink-0">{trick.icon}</span>
                    <div>
                      <div className="font-bold text-white text-xs mb-0.5">{trick.id}</div>
                      <div className="text-neutral-400 leading-relaxed">
                        {lang === "id" ? trick.descId : trick.descEn}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
