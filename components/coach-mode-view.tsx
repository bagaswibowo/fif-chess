"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D } from "@/components/icons3d";
import {
  describeOutcome, findLegalMove, getLegalMoves, type GameOutcome,
} from "@/lib/chess";

type MoveQuality = "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder";
type Props = { lang?: "id" | "en" };

const QUALITY: Record<MoveQuality, { id: string; en: string; color: string }> = {
  brilliant:  { id: "Brilian! ⭐", en: "Brilliant! ⭐",  color: "text-cyan-300"   },
  best:       { id: "Terbaik!",   en: "Best Move!",      color: "text-emerald-400" },
  good:       { id: "Bagus.",     en: "Good.",            color: "text-green-300"  },
  inaccuracy: { id: "Kurang Akurat", en: "Inaccuracy",   color: "text-yellow-400" },
  mistake:    { id: "Kesalahan",  en: "Mistake",          color: "text-orange-400" },
  blunder:    { id: "Blunder! ✗", en: "Blunder! ✗",     color: "text-red-400"    },
};

const PRINCIPLES = [
  { id: "Kuasai pusat — e4/d4/e5/d5 adalah petak paling strategis di pembukaan.", en: "Control the center — e4/d4/e5/d5 are the most strategic squares." },
  { id: "Kembangkan perwira ringan (Kuda & Gajah) sebelum rokade.", en: "Develop minor pieces (Knights & Bishops) before castling." },
  { id: "Jangan gerakkan pion yang sama dua kali tanpa alasan taktis.", en: "Avoid moving the same pawn twice without a tactical reason." },
  { id: "Rokade lebih awal — Raja aman, Benteng aktif.", en: "Castle early — King is safe, Rooks become active." },
  { id: "Hubungkan kedua Benteng dengan mengosongkan baris di antaranya.", en: "Connect Rooks by clearing pieces between them." },
  { id: "Jangan keluarkan Menteri terlalu awal — mudah diusir, buang tempo.", en: "Avoid early Queen development — it gets chased and wastes tempo." },
];

function classifyLoss(cpLoss: number | null, isBest: boolean): MoveQuality {
  if (isBest || cpLoss === null || cpLoss < 10) return "best";
  if (cpLoss < 25) return "good";
  if (cpLoss < 50) return "inaccuracy";
  if (cpLoss < 150) return "mistake";
  return "blunder";
}

function barPct(whiteCp: number | null): number {
  if (whiteCp === null) return 50;
  return Math.round((Math.tanh(whiteCp / 400) + 1) / 2 * 100);
}

async function engineBest(fen: string, engine: "stockfish" | "jev" = "stockfish", depth = 14) {
  try {
    const r = await fetch("/api/engine-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, depth, engine }),
    });
    const d = await r.json();
    if (d.uci && d.san) return { uci: d.uci as string, san: d.san as string, scoreCp: (d.scoreCp as number | null) ?? null };
  } catch {}
  return null;
}

async function probeThreat(fen: string): Promise<{ hasThreat: boolean; msg: string; square: string | null }> {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return { hasThreat: false, msg: "", square: null };
    const data = await engineBest(fen, "stockfish", 3);
    if (!data) return { hasThreat: false, msg: "", square: null };
    const isThreat = data.san.includes("+") || data.san.includes("x") || data.san.includes("#");
    if (!isThreat) return { hasThreat: false, msg: "", square: null };
    const sq = data.uci.slice(2, 4);
    const msg = data.san.includes("#")
      ? `Ancaman skakmat lewat ${data.san} — petak ${sq} dalam bahaya!`
      : data.san.includes("+")
      ? `Lawan bisa skak lewat ${data.san} — lindungi Raja!`
      : `Lawan bisa ambil bidak di ${sq} lewat ${data.san} — waspadai!`;
    return { hasThreat: true, msg, square: sq };
  } catch {
    return { hasThreat: false, msg: "", square: null };
  }
}

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
  const [hint, setHint] = useState<{ san: string; uci: string } | null>(null);
  const [threat, setThreat] = useState<{ hasThreat: boolean; msg: string; square: string | null } | null>(null);
  const [showHintArrow, setShowHintArrow] = useState(false);
  const [feedback, setFeedback] = useState<{ quality: MoveQuality; headline: string; reason: string; tactic: string; bestSan?: string; cpLoss: number | null } | null>(null);
  const thinkingRef = useRef(false);

  const principle = useMemo(() => {
    const ply = history.length;
    if (ply >= 20) return null;
    const p = PRINCIPLES[Math.min(Math.floor(ply / 2), PRINCIPLES.length - 1)];
    return lang === "id" ? p.id : p.en;
  }, [history.length, lang]);

  const isPlayerTurn = chess.turn() === (playerSide === "white" ? "w" : "b");

  useEffect(() => {
    if (!isPlayerTurn || outcome.over || thinkingRef.current) return;
    let cancelled = false;
    (async () => {
      const [bestData, threatData] = await Promise.all([
        engineBest(fen, "stockfish", 12),
        probeThreat(fen),
      ]);
      if (cancelled) return;
      setHint(bestData ? { san: bestData.san, uci: bestData.uci } : null);
      setThreat(threatData);
    })();
    return () => { cancelled = true; };
  }, [fen, isPlayerTurn, outcome.over]);

  const clearPreMoveState = () => { setHint(null); setThreat(null); setShowHintArrow(false); };

  const resetGame = useCallback((side: "white" | "black" = "white") => {
    const c = new Chess();
    setChess(c); setFen(c.fen()); setHistory([]);
    setPlayerSide(side); setOutcome(describeOutcome(c));
    setShowConfetti(false); setSelected(null); clearPreMoveState();
    setFeedback(null); setEvalCp(null);
    thinkingRef.current = false; setThinking(false);
    if (side === "black") void triggerOpponent(c.fen());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triggerOpponent(currentFen: string) {
    setThinking(true); thinkingRef.current = true; clearPreMoveState();
    try {
      const data = await engineBest(currentFen, "stockfish", 14);
      if (!data) return;
      const c = new Chess(currentFen);
      const move = findLegalMove(c, data.uci.slice(0, 2) as Square, data.uci.slice(2, 4) as Square,
        data.uci.length > 4 ? (data.uci[4] as "q") : undefined);
      if (!move) return;
      c.move(move);
      setChess(c); setFen(c.fen()); setHistory(h => [...h, data.san]);
      setEvalCp(data.scoreCp !== null ? -data.scoreCp : null);
      const out = describeOutcome(c); setOutcome(out);
      if (out.over && out.winner !== playerSide) setShowConfetti(false);
      setFeedback({
        quality: "good",
        headline: lang === "id" ? `Stockfish menjawab: ${data.san}` : `Stockfish plays: ${data.san}`,
        reason: lang === "id" ? "Giliran Anda. Perhatikan posisi — Jev sudah menyiapkan rekomendasi di atas." : "Your turn. Check the recommendation above and find your best response.",
        tactic: "", cpLoss: null,
      });
    } finally { setThinking(false); thinkingRef.current = false; }
  }

  const tryMove = async (from: string, to: string) => {
    if (outcome.over || thinkingRef.current || !isPlayerTurn) return;
    const c = new Chess(chess.fen());
    const hasPromo = getLegalMoves(c).some(m => m.from === from && m.to === to && m.isPromotion);
    const move = findLegalMove(c, from as Square, to as Square, hasPromo ? "q" : undefined);
    if (!move) { setSelected(null); return; }

    setThinking(true); thinkingRef.current = true; clearPreMoveState();

    const preBest = await engineBest(chess.fen(), "stockfish", 14);
    const bestUci = preBest?.uci ?? "";
    const bestSan = preBest?.san ?? "";
    const evalBefore = preBest?.scoreCp ?? null;

    c.move(move);
    const userUci = move.from + move.to + (move.promotion ?? "");
    const postData = await engineBest(c.fen(), "stockfish", 14);
    const evalAfter = postData?.scoreCp != null ? -postData.scoreCp : null;
    const cpLoss = evalBefore !== null && evalAfter !== null ? Math.max(0, evalBefore - evalAfter) : null;
    const isBest = !bestUci || userUci === bestUci || move.san === bestSan;
    const quality = classifyLoss(cpLoss, isBest);

    let tactic = "";
    if (move.san.includes("#")) tactic = "♚ Skakmat!";
    else if (move.san.includes("+")) tactic = "♟ Skak langsung — Raja lawan terancam.";
    else if (move.isCapture) tactic = `✂ Pertukaran: ambil bidak di ${move.to}.`;
    else if (move.isCastle) tactic = "🏰 Rokade — Raja aman, Benteng aktif.";

    setChess(c); setFen(c.fen()); setHistory(h => [...h, move.san]);
    setEvalCp(evalAfter);
    const out = describeOutcome(c); setOutcome(out);

    if (out.over) {
      setThinking(false); thinkingRef.current = false;
      setShowConfetti(out.winner === playerSide);
      setFeedback({ quality: out.winner === playerSide ? "brilliant" : "good", headline: lang === "id" ? "Partai selesai!" : "Game over!", reason: "", tactic, cpLoss: null });
      return;
    }

    const ql = QUALITY[quality];
    setFeedback({
      quality, headline: lang === "id" ? ql.id : ql.en,
      reason: lang === "id"
        ? isBest ? `${move.san} adalah langkah terbaik di posisi ini!` : `Kurang optimal — Stockfish menyarankan ${bestSan} (kehilangan ~${cpLoss ?? "?"} cp).`
        : isBest ? `${move.san} is the top engine move!` : `Suboptimal — engine suggests ${bestSan} (~${cpLoss ?? "?"} cp loss).`,
      tactic,
      bestSan: isBest ? undefined : bestSan,
      cpLoss,
    });
    setTimeout(() => { void triggerOpponent(c.fen()); }, 600);
  };

  const handleUndo = () => {
    if (history.length < 2 || thinkingRef.current) return;
    const newH = history.slice(0, -2);
    const rebuild = new Chess();
    for (const m of newH) { if (!rebuild.move(m)) break; }
    setChess(rebuild); setFen(rebuild.fen()); setHistory(newH);
    setOutcome(describeOutcome(rebuild)); setFeedback(null);
    clearPreMoveState(); setShowConfetti(false);
  };

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (selected) s[selected] = { boxShadow: "inset 0 0 0 4px #facc15", backgroundColor: "rgba(250,204,21,0.3)" };
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
    return [{ startSquare: hint.uci.slice(0, 2), endSquare: hint.uci.slice(2, 4), color: "#38bdf8" }];
  }, [showHintArrow, hint]);

  const whitePct = barPct(evalCp);
  const qColor = feedback ? QUALITY[feedback.quality].color : "";

  return (
    <div className="max-w-5xl mx-auto space-y-3 pb-8">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="bg-[#262421] px-4 py-3 rounded-2xl border border-[#36322d] shadow-xl flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <IconBot3D size={26} />
          <div>
            <h2 className="text-base font-black text-white">{lang === "id" ? "AI Coach — Main Dipandu" : "AI Coach — Guided Play"}</h2>
            <p className="text-sm text-neutral-400">{lang === "id" ? "Jev membimbing tiap langkah + peringatan ancaman sebelum kamu bergerak" : "Jev guides every move + warns you of threats before you play"}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => resetGame("white")} variant="outline" size="sm" className="border-[#36322d] text-white text-sm font-bold bg-[#1c1a18]" disabled={thinking}>♟ {lang === "id" ? "Main Putih" : "Play White"}</Button>
          <Button onClick={() => resetGame("black")} variant="outline" size="sm" className="border-[#36322d] text-white text-sm font-bold bg-[#1c1a18]" disabled={thinking}>♟ {lang === "id" ? "Main Hitam" : "Play Black"}</Button>
        </div>
      </div>

      {/* Threat warning */}
      {threat?.hasThreat && !thinking && !outcome.over && isPlayerTurn && (
        <div className="px-4 py-3 rounded-xl bg-orange-950/70 border border-orange-500/60 text-orange-200 flex items-start gap-2.5">
          <span className="text-xl shrink-0">⚠</span>
          <div>
            <div className="text-sm font-bold text-orange-300 mb-0.5">{lang === "id" ? "Peringatan Taktis Jev" : "Jev Tactical Warning"}</div>
            <div className="text-sm font-semibold">{threat.msg}</div>
          </div>
        </div>
      )}

      {/* Best move hint */}
      {hint && !thinking && !outcome.over && isPlayerTurn && (
        <div className="px-4 py-3 rounded-xl bg-[#1e2a14] border border-[#81b64c]/40 text-[#81b64c] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconLightning3D size={18} className="shrink-0" />
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-[#81b64c]/80 mb-0.5">{lang === "id" ? "Rekomendasi Jev" : "Jev Suggestion"}</div>
              <span className="text-base font-black text-[#81b64c]">{lang === "id" ? `Langkah terbaik: ${hint.san}` : `Best move: ${hint.san}`}</span>
              {principle && <span className="text-xs text-[#81b64c]/60 ml-3 hidden md:inline">{principle}</span>}
            </div>
          </div>
          <Button onClick={() => setShowHintArrow(v => !v)} size="sm" variant="outline"
            className={`text-sm font-bold border-[#81b64c]/40 shrink-0 ${showHintArrow ? "bg-[#1e2a14] text-[#81b64c]" : "bg-transparent text-neutral-400"}`}>
            {showHintArrow ? (lang === "id" ? "Sembunyikan" : "Hide") : (lang === "id" ? "Tampilkan di Papan" : "Show on Board")}
          </Button>
        </div>
      )}

      {/* Thinking */}
      {thinking && (
        <div className="px-4 py-3 rounded-xl bg-[#1a1816] border border-[#36322d] text-neutral-400 text-sm animate-pulse">
          {lang === "id" ? "Stockfish sedang berpikir…" : "Stockfish is thinking…"}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-3">
          {/* Eval bar */}
          <div className="bg-[#1c1a18] rounded-xl border border-[#36322d] px-3 py-2 flex items-center gap-3">
            <span className="text-sm text-neutral-500 font-mono w-14 text-right shrink-0">
              {evalCp !== null ? (evalCp > 0 ? `+${(evalCp/100).toFixed(1)}` : (evalCp/100).toFixed(1)) : "="}
            </span>
            <div className="flex-1 h-4 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${whitePct}%`, background: whitePct > 55 ? "linear-gradient(90deg,#ccc,#fff)" : whitePct < 45 ? "linear-gradient(90deg,#222,#444)" : "linear-gradient(90deg,#888,#bbb)" }} />
            </div>
            <span className="text-sm font-mono text-neutral-400 w-16 shrink-0">{whitePct > 50 ? `Putih ${whitePct}%` : `Hitam ${100-whitePct}%`}</span>
          </div>

          {/* Board */}
          <div className="rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl w-full">
            <Chessboard
              options={{
                id: "coach-board",
                position: fen,
                boardOrientation: playerSide,
                allowDragging: false,
                onSquareClick: ({ square }) => {
                  if (selected) { void tryMove(selected, square); setSelected(null); }
                  else setSelected(square);
                },
                squareStyles, arrows,
                darkSquareStyle: { backgroundColor: "#b58863" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleUndo} variant="outline" size="sm" className="flex-1 border-[#36322d] text-neutral-300 text-sm font-bold bg-[#1c1a18]" disabled={history.length < 2 || thinkingRef.current}>
              ← {lang === "id" ? "Undo Langkah Saya" : "Undo My Move"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Card className="bg-[#262421] border-[#36322d] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#36322d]">
              <CardTitle className="text-sm font-bold">{lang === "id" ? "Analisis Langkah" : "Move Analysis"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              {feedback ? (
                <>
                  <div className={`text-2xl font-black ${qColor}`}>{feedback.headline}</div>
                  {feedback.cpLoss !== null && feedback.cpLoss > 0 && (
                    <div className="text-sm text-neutral-500 font-mono">-{feedback.cpLoss} centipawn</div>
                  )}
                  {feedback.reason && (
                    <div className="p-3 rounded-xl bg-[#312e2b] text-sm text-neutral-200 leading-relaxed">{feedback.reason}</div>
                  )}
                  {feedback.tactic && (
                    <div className="p-3 rounded-xl bg-[#1a1a14] border border-[#3d3a20] text-sm text-amber-300 font-semibold">{feedback.tactic}</div>
                  )}
                  {feedback.bestSan && (
                    <div className="p-3 rounded-xl bg-[#0f2231] border border-[#38bdf8]/30 space-y-1">
                      <div className="text-sm font-bold text-sky-300">{lang === "id" ? "Langkah Terbaik Engine:" : "Engine Best Move:"}</div>
                      <div className="font-mono text-lg font-black text-sky-200">{feedback.bestSan}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-neutral-500 py-4 text-center">
                  {lang === "id" ? "Rekomendasi & analisis muncul setelah Anda bergerak." : "Analysis appears after each of your moves."}
                </div>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card className="bg-[#262421] border-[#36322d] text-white">
              <CardHeader className="py-3 px-4 border-b border-[#36322d]">
                <CardTitle className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{lang === "id" ? "Riwayat Langkah" : "Move History"}</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-1.5 font-mono text-sm">
                  {history.map((san, idx) => (
                    <span key={idx} className={`px-2 py-0.5 rounded text-sm ${idx % 2 === 0 ? "bg-[#312e2b] text-neutral-200" : "bg-[#1c1a18] text-neutral-400"} ${idx === history.length - 1 ? "ring-1 ring-[#81b64c]" : ""}`}>
                      {idx % 2 === 0 && <span className="text-neutral-500 mr-1">{Math.floor(idx/2)+1}.</span>}{san}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-[#262421] border-[#36322d] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#36322d]">
              <CardTitle className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{lang === "id" ? "8 Trik Taktis" : "8 Tactical Tricks"}</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { icon: "🍴", name: "Fork",            desc: lang === "id" ? "Serang 2 bidak sekaligus"      : "Attack 2 pieces at once"    },
                  { icon: "📌", name: "Pin",             desc: lang === "id" ? "Tahan bidak agar tak bisa pindah" : "Freeze a piece in place" },
                  { icon: "🪤", name: "Skewer",          desc: lang === "id" ? "Paksa bidak besar menyingkir"   : "Force valuable piece to move" },
                  { icon: "💥", name: "Discovered Atk",  desc: lang === "id" ? "Pindah bidak, buka serangan lain" : "Move one, expose another" },
                  { icon: "🏰", name: "Back Rank Mate",  desc: lang === "id" ? "Skakmat di baris belakang"      : "Checkmate on back rank"     },
                  { icon: "🎯", name: "Zwischenzug",     desc: lang === "id" ? "Langkah kejutan sebelum merespons" : "Intermezzo before responding" },
                  { icon: "⚡", name: "Tempo Gain",      desc: lang === "id" ? "Serang sambil berkembang"        : "Develop while threatening"  },
                  { icon: "♟", name: "Passed Pawn",     desc: lang === "id" ? "Dorong pion ke promosi"          : "Push pawn to promotion"     },
                ].map(t => (
                  <div key={t.name} className="flex gap-1.5 p-2 rounded-lg bg-[#1a1816] border border-[#2e2c29]">
                    <span className="text-base shrink-0">{t.icon}</span>
                    <div>
                      <div className="font-bold text-white text-sm">{t.name}</div>
                      <div className="text-neutral-500 text-xs leading-tight">{t.desc}</div>
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
