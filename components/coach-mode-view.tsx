import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D } from "@/components/icons3d";
import { describeOutcome, findLegalMove, getLegalMoves, type GameOutcome } from "@/lib/chess";

type Props = { lang?: "id" | "en" };

function classifyLoss(cpLoss: number | null, isBest: boolean): "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder" {
  if (isBest || cpLoss === null || cpLoss < 10) return "best";
  if (cpLoss < 25) return "good";
  if (cpLoss < 50) return "inaccuracy";
  if (cpLoss < 150) return "mistake";
  return "blunder";
}

const QUALITY: Record<"brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder", { id: string; en: string; color: string }> = {
  brilliant:  { id: "Brilian! ⭐", en: "Brilliant! ⭐",  color: "text-cyan-300" },
  best:       { id: "Terbaik!",   en: "Best Move!",      color: "text-emerald-400" },
  good:       { id: "Bagus.",     en: "Good.",            color: "text-green-300" },
  inaccuracy: { id: "Kurang Akurat", en: "Inaccuracy",   color: "text-yellow-400" },
  mistake:    { id: "Kesalahan",  en: "Mistake",          color: "text-orange-400" },
  blunder:    { id: "Blunder! ✗", en: "Blunder! ✗",     color: "text-red-400" },
};

const PRINCIPLES = [
  { id: "Kuasai pusat — e4/d4/e5/d5 adalah petak paling strategis di pembukaan.", en: "Control the center — e4/d4/e5/d5 are the most strategic squares." },
  { id: "Kembangkan perwira ringan (Kuda & Gajah) sebelum rokade.", en: "Develop minor pieces (Knights & Bishops) before castling." },
  { id: "Jangan gerakkan pion yang sama dua kali tanpa alasan taktis.", en: "Avoid moving the same pawn twice without a tactical reason." },
  { id: "Rokade lebih awal — Raja aman, Benteng aktif.", en: "Castle early — King is safe, Rooks become active." },
  { id: "Hubungkan kedua Benteng dengan mengosongkan baris di antaranya.", en: "Connect Rooks by clearing pieces between them." },
  { id: "Jangan keluarkan Menteri terlalu awal — mudah diusir, buang tempo.", en: "Avoid early Queen development — it gets chased and wastes tempo." },
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
  const [hint, setHint] = useState<{ san: string; uci: string } | null>(null);
  const [threat, setThreat] = useState<{ hasThreat: boolean; msg: string; square: string | null } | null>(null);
  const [showHintArrow, setShowHintArrow] = useState(false);
  const [feedback, setFeedback] = useState<{ quality: "brilliant" | "best" | "good" | "inaccuracy" | "mistake" | "blunder"; headline: string; reason: string; tactic: string; bestSan?: string; cpLoss: number | null } | null>(null);
  const thinkingRef = useRef(false);

  const principle = useMemo(() => {
    const ply = history.length;
    if (ply >= 20) return null;
    const p = PRINCIPLES[Math.min(Math.floor(ply / 2), PRINCIPLES.length - 1)];
    return lang === "id" ? p.id : p.en;
  }, [history.length, lang]);

  const isPlayerTurn = chess.turn() === (playerSide === "white" ? "w" : "b");

  const engineBest = async (fen: string, engine: "stockfish" | "jev" = "stockfish", depth = 14) => {
    try {
      const r = await fetch("/api/engine-move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fen, depth, engine }) });
      const d = await r.json();
      if (d.uci && d.san) return { uci: d.uci as string, san: d.san as string, scoreCp: (d.scoreCp as number | null) ?? null };
    } catch {}
    return null;
  };

  const probeThreat = async (fen: string): Promise<{ hasThreat: boolean; msg: string; square: string | null }> => {
    try {
      const c = new Chess(fen);
      if (c.isGameOver()) return { hasThreat: false, msg: "", square: null };
      const data = await engineBest(fen, "stockfish", 3);
      if (!data) return { hasThreat: false, msg: "", square: null };
      const isThreat = data.san.includes("+") || data.san.includes("x") || data.san.includes("#");
      if (!isThreat) return { hasThreat: false, msg: "", square: null };
      const sq = data.uci.slice(2, 4);
      const msg = data.san.includes("#") ? `Ancaman skakmat lewat ${data.san} — petak ${sq} dalam bahaya!` : data.san.includes("+") ? `Lawan bisa skak lewat ${data.san} — lindungi Raja!` : `Lawan bisa ambil bidak di ${sq} lewat ${data.san} — waspadai!`;
      return { hasThreat: true, msg, square: sq };
    } catch {
      return { hasThreat: false, msg: "", square: null };
    }
  };

  useEffect(() => {
    if (outcome.over || thinkingRef.current || !isPlayerTurn) return;
    let cancelled = false;
    (async () => {
      // Stockfish plays opposite side → computer moves first
      const data = await engineBest(fen, "stockfish", 14);
      if (cancelled || !data) return;
      const c = new Chess(fen);
      const move = findLegalMove(c, data.uci.slice(0, 2) as Square, data.uci.slice(2, 4) as Square, data.uci.length > 4 ? (data.uci[4] as "q") : undefined);
      if (!move || !c.move(move)) return;

      setChess(c); setFen(c.fen()); setHistory(h => [...h, data.san]);
      setEvalCp(data.scoreCp !== null ? -data.scoreCp : null);
      const out = describeOutcome(c); setOutcome(out);

      if (out.over) {
        if (out.winner !== playerSide) setShowConfetti(false);
        setFeedback({ quality: "good", headline: lang === "id" ? "Partai selesai!" : "Game over!", reason: "", tactic: "", cpLoss: null });
        return;
      }

      // Pre-move: compute hint + threat for upcoming player turn
      const [hintData, threatData] = await Promise.all([
        engineBest(c.fen(), "stockfish", 12),
        probeThreat(c.fen()),
      ]);
      if (cancelled) return;
      setHint(hintData ? { san: hintData.san, uci: hintData.uci } : null);
      setThreat(threatData);
    })();
    return () => { cancelled = true; };
  }, [fen, isPlayerTurn, outcome.over, playerSide, lang]);

  const clearPreMoveState = () => { setHint(null); setThreat(null); setShowHintArrow(false); };

  const resetGame = useCallback((side: "white" | "black" = "white") => {
    const c = new Chess();
    setChess(c); setFen(c.fen()); setHistory([]);
    setPlayerSide(side); setOutcome(describeOutcome(c));
    setShowConfetti(false); setSelected(null); clearPreMoveState();
    setFeedback(null); setEvalCp(null);
    thinkingRef.current = false; setThinking(false);
  }, []);

  const tryMove = async (from: string, to: string) => {
    if (outcome.over || thinkingRef.current || !isPlayerTurn) return;
    const c = new Chess(chess.fen());
    const hasPromo = getLegalMoves(c).some(m => m.from === from && m.to === to && m.isPromotion);
    const move = findLegalMove(c, from as Square, to as Square, hasPromo ? "q" : undefined);
    if (!move) { setSelected(null); return; }

    setThinking(true); thinkingRef.current = true; clearPreMoveState();

    const preBest = await engineBest(chess.fen(), "stockfish", 14);
    const bestUci = preBest?.uci ?? ""; const bestSan = preBest?.san ?? "";
    const evalBefore = preBest?.scoreCp ?? null;

    c.move(move);
    const userUci = move.from + move.to + (move.promotion ?? "");
    const postData = await engineBest(c.fen(), "stockfish", 14);
    const evalAfter = postData?.scoreCp != null ? -postData.scoreCp : null;
    const cpLoss = evalBefore !== null && evalAfter !== null ? Math.max(0, evalBefore - evalAfter) : null;
    const isBest = !bestUci || userUci === bestUci || move.san === bestSan;

    setChess(c); setFen(c.fen()); setHistory(h => [...h, move.san]);
    setEvalCp(evalAfter);
    const out = describeOutcome(c); setOutcome(out);

    if (out.over) {
      setThinking(false); thinkingRef.current = false;
      setShowConfetti(out.winner === playerSide);
      setFeedback({ quality: out.winner === playerSide ? "brilliant" : "good", headline: lang === "id" ? "Partai selesai!" : "Game over!", reason: "", tactic: "", cpLoss: null });
      return;
    }

    const quality = classifyLoss(cpLoss, isBest);
    let tactic = "";
    if (move.san.includes("#")) tactic = "♚ Skakmat!";
    else if (move.san.includes("+")) tactic = "♟ Skak langsung — Raja lawan terancam.";
    else if (move.isCapture) tactic = `✂ Pertukaran: ambil bidak di ${move.to}.`;
    else if (move.isCastle) tactic = "🏰 Rokade — Raja aman, Benteng aktif.";

    setFeedback({
      quality, headline: lang === "id" ? QUALITY[quality].id : QUALITY[quality].en,
      reason: lang === "id"
        ? (isBest ? `${move.san} adalah langkah terbaik di posisi ini!` : `Kurang optimal — Stockfish menyarankan ${bestSan} (kehilangan ~${cpLoss ?? "?"} cp).`)
        : (isBest ? `${move.san} is the top engine move!` : `Suboptimal — engine suggests ${bestSan} (~${cpLoss ?? "?"} cp loss).`),
      tactic, bestSan: isBest ? undefined : bestSan, cpLoss,
    });

    setTimeout(() => {
      thinkingRef.current = false; setThinking(false);
      (async () => {
        const nextData = await engineBest(c.fen(), "stockfish", 14);
        if (!nextData) return;
        const nextC = new Chess(c.fen());
        const nextMove = findLegalMove(nextC, nextData.uci.slice(0, 2) as Square, nextData.uci.slice(2, 4) as Square, nextData.uci.length > 4 ? (nextData.uci[4] as "q") : undefined);
        if (!nextMove || !nextC.move(nextMove)) return;
        setChess(nextC); setFen(nextC.fen()); setHistory(h => [...h, nextData.san]);
        setEvalCp(nextData.scoreCp !== null ? -nextData.scoreCp : null);
        const nextOut = describeOutcome(nextC); setOutcome(nextOut);
        if (nextOut.over) {
          if (nextOut.winner !== playerSide) setShowConfetti(false);
          setFeedback({ quality: "good", headline: lang === "id" ? "Partai selesai!" : "Game over!", reason: "", tactic: "", cpLoss: null });
        } else {
          const [hintData, threatData] = await Promise.all([
            engineBest(nextC.fen(), "stockfish", 12),
            probeThreat(nextC.fen()),
          ]);
          setHint(hintData ? { san: hintData.san, uci: hintData.uci } : null);
          setThreat(threatData);
        }
      })();
    }, 600);
  };

  const handleUndo = () => {
    if (history.length < 2 || thinkingRef.current) return;
    const newH = history.slice(0, -2);
    const rebuild = new Chess();
    for (const m of newH) { if (!rebuild.move(m)) break; }
    setChess(rebuild); setFen(rebuild.fen()); setHistory(newH);
    setOutcome(describeOutcome(rebuild)); setFeedback(null); clearPreMoveState(); setShowConfetti(false);
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

  const whitePct = (() => { if (evalCp === null) return 50; return Math.round((Math.tanh(evalCp / 400) + 1) / 2 * 100); })();
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
            <p className="text-sm text-neutral-300">{lang === "id" ? "Jev membimbing tiap langkah + peringatan ancaman sebelum kamu bergerak" : "Jev guides every move + warns you of threats before you play"}</p>
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

      {/* Best move hint — appears BEFORE you move */}
      {hint && !thinking && !outcome.over && isPlayerTurn && (
        <div className="px-4 py-3 rounded-xl bg-[#1e2a14] border border-[#81b64c]/60 text-[#81b64c] flex items-center justify-between gap-3 shadow-lg shadow-[#81b64c]/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#81b64c]/20 flex items-center justify-center shrink-0"><IconLightning3D size={18} /></div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-[#81b64c]/70 mb-1">{lang === "id" ? "Jev menyuruhmu:" : "Jev tells you:"}</div>
              <span className="text-lg font-black text-[#81b64c] leading-tight">{lang === "id" ? `Gerakkan: ${hint.san}` : `Play: ${hint.san}`}</span>
              {principle && <div className="text-xs text-[#81b64c]/60 mt-1">{principle}</div>}
            </div>
          </div>
          <Button onClick={() => setShowHintArrow(v => !v)} size="sm" variant="outline" className={`text-sm font-bold border-[#81b64c]/40 shrink-0 ${showHintArrow ? "bg-[#81b64c] text-white" : "bg-transparent text-[#81b64c]"}`}>{showHintArrow ? "✕" : "→ Papan"}</Button>
        </div>
      )}

      {/* Thinking */}
      {thinking && (<div className="px-4 py-3 rounded-xl bg-[#1a1816] border border-[#36322d] text-neutral-300 text-sm animate-pulse">{lang === "id" ? "Stockfish sedang berpikir…" : "Stockfish is thinking…"}</div>)}

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-3">
          {/* Eval bar */}
          <div className="bg-[#1c1a18] rounded-xl border border-[#36322d] px-3 py-2 flex items-center gap-3">
            <span className="text-sm text-neutral-300 font-mono w-14 text-right shrink-0">{evalCp !== null ? (evalCp > 0 ? `+${(evalCp / 100).toFixed(1)}` : (evalCp / 100).toFixed(1)) : "="}</span>
            <div className="flex-1 h-4 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${whitePct}%`, background: whitePct > 55 ? "linear-gradient(90deg,#ccc,#fff)" : whitePct < 45 ? "linear-gradient(90deg,#222,#444)" : "linear-gradient(90deg,#888,#bbb)" }} />
            </div>
            <span className="text-sm font-mono text-neutral-300 w-16 shrink-0">{whitePct > 50 ? `Putih ${whitePct}%` : `Hitam ${100 - whitePct}%`}</span>
          </div>

          {/* Board */}
          <div className="rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl w-full">
            <Chessboard options={{ id: "coach-board", position: fen, boardOrientation: playerSide, allowDragging: false, onSquareClick: ({ square }) => { if (selected) { void tryMove(selected, square); setSelected(null); } else setSelected(square); }, squareStyles, arrows, darkSquareStyle: { backgroundColor: "#b58863" }, lightSquareStyle: { backgroundColor: "#f0d9b5" } }} />
          </div>
          <Button onClick={handleUndo} variant="outline" size="sm" className="flex-1 border-[#36322d] text-neutral-300 text-sm font-bold bg-[#1c1a18]" disabled={history.length < 2 || thinkingRef.current}>← {lang === "id" ? "Undo Langkah Saya" : "Undo My Move"}</Button>
        </div>

        <div className="space-y-3">
          <Card className="bg-[#262421] border-[#36322d] text-white">
            <CardHeader className="py-3 px-4 border-b border-[#36322d]"><CardTitle className="text-sm font-bold">{lang === "id" ? "Analisis Langkah" : "Move Analysis"}</CardTitle></CardHeader>
            <CardContent className="pt-3 space-y-3">
              {feedback ? (
                <>
                  <div className={`text-2xl font-black ${qColor}`}>{feedback.headline}</div>
                  {feedback.cpLoss !== null && feedback.cpLoss > 0 && <div className="text-sm text-neutral-300 font-mono">-{feedback.cpLoss} centipawn</div>}
                  {feedback.reason && <div className="p-3 rounded-xl bg-[#312e2b] text-sm text-neutral-200 leading-relaxed">{feedback.reason}</div>}
                  {feedback.tactic && <div className="p-3 rounded-xl bg-[#1a1a14] border border-[#3d3a20] text-sm text-amber-300 font-semibold">{feedback.tactic}</div>}
                  {feedback.bestSan && (
                    <div className="p-3 rounded-xl bg-[#0f2231] border border-[#38bdf8]/30 space-y-1">
                      <div className="text-sm font-bold text-sky-300">{lang === "id" ? "Seharusnya Kamu Main:" : "You Should Have Played:"}</div>
                      <div className="font-mono text-lg font-black text-sky-200">{feedback.bestSan}</div>
                    </div>
                  )}
                  {!outcome.over && isPlayerTurn && hint && <div className="mt-2 p-3 rounded-xl bg-[#1e2a14] border border-[#81b64c]/30 text-sm text-[#81b64c] font-bold">{lang === "id" ? `Sekarang gerakkan: ${hint.san}` : `Now play: ${hint.san}`}</div>}
                </>
              ) : (
                <div className="text-sm text-neutral-300 py-4 text-center">{lang === "id" ? "Jev akan merekomendasikan langkahmu sebelum kamu bergerak." : "Jev will recommend your move before you play."}</div>
              )}
            </CardContent>
          </Card>
          {history.length > 0 && (
            <Card className="bg-[#262421] border-[#36322d] text-white">
              <CardHeader className="py-3 px-4 border-b border-[#36322d]"><CardTitle className="text-sm font-bold text-neutral-300 uppercase tracking-wider">{lang === "id" ? "Riwayat Langkah" : "Move History"}</CardTitle></CardHeader>
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-1.5 font-mono text-sm h-[120px] overflow-y-auto">
                  {history.map((san, idx) => (
                    <span key={idx} className={`px-2 py-0.5 rounded text-sm ${idx % 2 === 0 ? "bg-[#312e2b] text-neutral-200" : "bg-[#1c1a18] text-neutral-300"} ${idx === history.length - 1 ? "ring-1 ring-[#81b64c]" : ""}`}>
                      {idx % 2 === 0 && <span className="text-neutral-300 mr-1">{Math.floor(idx / 2) + 1}.</span>}{san}
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
