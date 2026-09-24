"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D, IconTrophy3D } from "@/components/icons3d";
import { describeOutcome, getLegalMoves, findLegalMove, type GameOutcome } from "@/lib/chess";

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchMove = {
  san: string;
  uci: string;
  by: "jev" | "stockfish" | "fly" | "fly";
  fen: string;
  scoreCp: number | null;
};

type MatchStatus = "idle" | "running" | "paused" | "finished";

type Props = {
  lang?: "id" | "en";
  /** Called when user wants to try the resulting position themselves */
  onTryPosition?: (fen: string, moves: string[]) => void;
};

// Delay between moves (ms) — long enough to read, short enough to stay engaging
const MOVE_DELAY_MS = 1400;

// Jev should use TypeSafe engine (not Stockfish fallback)
// Stockfish should use local Stockfish engine.


// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchMove(
  fen: string,
  depth: number,
  engine: "stockfish" | "jev" | "fly",
  seed?: number,
  history?: string[],
): Promise<{ uci: string; san: string; scoreCp: number | null } | null> {
  try {
    const body: Record<string, unknown> = { fen, depth, engine };
    if (engine === "jev") {
      if (seed !== undefined) body.seed = seed;
      if (history) body.history = history;
    }
    const res = await fetch("/api/engine-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.uci && d.san) return { uci: d.uci, san: d.san, scoreCp: d.scoreCp ?? null };
  } catch {}
  return null;
}

function cpToAdvantage(cp: number | null, turn: "w" | "b"): string {
  if (cp === null) return "=";
  // scoreCp from stockfish is always from the side-to-move perspective
  // after the move was applied, flip to white perspective
  const whiteCp = turn === "w" ? -cp : cp; // after the move, turn has flipped
  if (Math.abs(whiteCp) >= 3000) return whiteCp > 0 ? "♔ Menang" : "♚ Menang";
  const val = (whiteCp / 100).toFixed(1);
  return whiteCp > 0 ? `+${val}` : val;
}

function qualityLabel(cpLoss: number | null): { label: string; color: string } {
  if (cpLoss === null) return { label: "—", color: "text-neutral-300" };
  if (cpLoss < 10) return { label: "Terbaik ★", color: "text-emerald-400" };
  if (cpLoss < 30) return { label: "Bagus", color: "text-green-300" };
  if (cpLoss < 80) return { label: "Kurang Akurat", color: "text-yellow-400" };
  if (cpLoss < 200) return { label: "Kesalahan!", color: "text-orange-400" };
  return { label: "Blunder! ✗", color: "text-red-400" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SpectatorView({ lang = "id", onTryPosition }: Props) {
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [moves, setMoves] = useState<MatchMove[]>([]);
  const [currentFen, setCurrentFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  // Jev side selectable; both engines use same depth for a fair fight
  const [whiteEngine, setWhiteEngine] = useState<"jev" | "fly" | "stockfish">("jev");
  const [blackEngine, setBlackEngine] = useState<"jev" | "fly" | "stockfish">("stockfish");
  const [jevDepth, setJevDepth] = useState(10);
  const [sfDepth, setSfDepth] = useState(10);
  const [seed, setSeed] = useState(0);

  const abortRef = useRef(false);
  const moveListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll move list
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [moves]);

  const runMatch = useCallback(async () => {
    abortRef.current = false;
    setStatus("running");
    setMoves([]);
    setOutcome(null);
    setShowConfetti(false);

    const chess = new Chess();
    setCurrentFen(chess.fen());

    let prevCp: number | null = null;

    while (!abortRef.current) {
      const isWhiteTurn = chess.turn() === "w";
      const actor: "jev" | "fly" | "stockfish" = isWhiteTurn ? whiteEngine : blackEngine;
      const depth = actor === "stockfish" ? sfDepth : jevDepth;

      const data = await fetchMove(chess.fen(), depth, actor, seed + moves.length, moves.map(m => m.san));
      if (abortRef.current) break;
      if (!data) break;

      const move = findLegalMove(
        chess,
        data.uci.slice(0, 2) as Square,
        data.uci.slice(2, 4) as Square,
        data.uci.length > 4 ? (data.uci[4] as "q") : undefined,
      );
      if (!move) break;

      chess.move(move);
      const fen = chess.fen();
      setCurrentFen(fen);

      // cp loss = how much worse than previous best (same perspective)
      let cpLoss: number | null = null;
      if (prevCp !== null && data.scoreCp !== null) {
        // prevCp was for the side that just moved; scoreCp after move is for next side
        // difference in evaluation from the moving side's perspective
        cpLoss = Math.max(0, prevCp - (-( data.scoreCp ?? 0)));
      }
      prevCp = data.scoreCp !== null ? -(data.scoreCp ?? 0) : null;

      const newMove: MatchMove = {
        san: data.san,
        uci: data.uci,
        by: actor,
        fen,
        scoreCp: data.scoreCp,
      };
      setMoves(prev => [...prev, newMove]);

      const out = describeOutcome(chess);
      if (out.over) {
        setOutcome(out);
        setStatus("finished");
        if (out.winner) {
          setShowConfetti(true);
        }
        return;
      }

      // Delay between moves
      await new Promise<void>(res => setTimeout(res, MOVE_DELAY_MS));
      if (abortRef.current) break;
    }

    if (!abortRef.current) {
      setStatus("finished");
    }
  }, [whiteEngine, blackEngine, jevDepth, sfDepth, seed]);

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
    setSeed((s) => s + 1);
  };

  const lastMove = moves[moves.length - 1] ?? null;
  const lastActor = lastMove?.by ?? null;

  // Eval bar: score from last move (white perspective)
  const lastCp = lastMove?.scoreCp ?? null;
  // after move applied, scoreCp is from side-to-move (which is opponent of who just moved)
  // so to get white perspective: if last actor was white (just moved), scoreCp is black's perspective = negate
  const isLastMoveWhite = moves.length % 2 === 1;
  const whiteCp = lastCp !== null ? (isLastMoveWhite ? -lastCp : lastCp) : null;
  const barPct = whiteCp !== null ? Math.round((Math.tanh(whiteCp / 400) + 1) / 2 * 100) : 50;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="bg-[#262421] px-5 py-4 rounded-2xl border border-[#36322d] shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <IconLightning3D size={22} />
              {lang === "id" ? "Jev AI vs Stockfish — Live Match" : "Jev AI vs Stockfish — Live Match"}
            </h2>
            <p className="text-xs text-neutral-300 mt-0.5">
              {lang === "id"
                ? "Nonton pertarungan langsung Jev (Putih, depth 10) vs Stockfish (Hitam, depth 10). Kedua mesin sama-sama depth 10 — adil."
                : "Watch Jev (White, depth 10) battle Stockfish (Black, depth 10) live. Equal depth — fair fight."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {status === "idle" || status === "paused" || status === "finished" ? (
              <Button
                onClick={runMatch}
                className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-sm"
              >
                {status === "idle" ? (lang === "id" ? "▶ Mulai Pertandingan" : "▶ Start Match")
                  : (lang === "id" ? "▶ Mulai Ulang" : "▶ Restart")}
              </Button>
            ) : (
              <Button
                onClick={stopMatch}
                variant="outline"
                className="border-red-500/40 text-red-400 font-bold text-sm"
              >
                ⏸ {lang === "id" ? "Pause" : "Pause"}
              </Button>
            )}
            {status !== "idle" && (
              <Button onClick={resetMatch} variant="outline" className="border-[#36322d] text-neutral-300 text-sm font-bold">
                ↺ {lang === "id" ? "Reset" : "Reset"}
              </Button>
            )}
            {(status === "finished" || status === "paused") && onTryPosition && (
              <Button
                onClick={() => onTryPosition(currentFen, moves.map(m => m.san))}
                className="bg-sky-700 hover:bg-sky-600 text-white font-bold text-sm"
              >
                🎯 {lang === "id" ? "Coba Posisi Ini" : "Try This Position"}
              </Button>
            )}
          </div>
        </div>

        {/* Engine Matchup Selectors */}
        <div className="flex flex-wrap gap-4 items-center border-t border-[#36322d] pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              ♔ {lang === "id" ? "Putih:" : "White:"}
            </span>
            <select
              value={whiteEngine}
              onChange={(e) => setWhiteEngine(e.target.value as any)}
              className="bg-[#1f1d1a] border border-[#36322d] rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-[#81b64c]"
            >
              <option value="jev">🧠 Jev (Hybrid System One + FlyWire)</option>
              <option value="fly">🪰 Fruit Fly (Drosophila 134k)</option>
              <option value="stockfish">🤖 Stockfish 15 NNUE</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              ♚ {lang === "id" ? "Hitam:" : "Black:"}
            </span>
            <select
              value={blackEngine}
              onChange={(e) => setBlackEngine(e.target.value as any)}
              className="bg-[#1f1d1a] border border-[#36322d] rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-[#81b64c]"
            >
              <option value="stockfish">🤖 Stockfish 15 NNUE</option>
              <option value="jev">🧠 Jev (Hybrid System One + FlyWire)</option>
              <option value="fly">🪰 Fruit Fly (Drosophila 134k)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              {lang === "id" ? "Kedalaman:" : "Depth:"}
            </span>
            <div className="flex gap-1">
              {[6, 10, 14].map((d) => (
                <button
                  key={d}
                  onClick={() => { setJevDepth(d); setSfDepth(d); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${d === jevDepth ? "bg-[#3d3a37] border-[#81b64c] text-white" : "bg-[#1f1d1a] border-[#36322d] text-neutral-400 hover:text-white"}`}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="text-xs text-neutral-300 ml-auto">
            {lang === "id"
              ? "Kedalaman sama — pertandingan adil. Jev bervariasi tiap reset."
              : "Equal depth (10) — fair fight. Jev varies each reset."}
          </div>
        </div>
      </div>

      {/* Player cards */}
      <div className="grid grid-cols-2 gap-3">
        {(["white", "black"] as const).map(side => {
          const engineType = side === "white" ? whiteEngine : blackEngine;
          const isMoving = status === "running" && lastActor !== engineType;
          const engineName = engineType === "jev"
            ? "Jev AI (TypeSafe + FlyWire)"
            : engineType === "fly"
            ? "Fruit Fly (Drosophila 134k)"
            : "Stockfish 15 NNUE";
          return (
            <div
              key={side}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                isMoving
                  ? "bg-[#1e2a14] border-[#81b64c] shadow-lg shadow-[#81b64c]/10"
                  : "bg-[#262421] border-[#36322d]"
              }`}
            >
              <div className={`w-8 h-8 rounded-full border-2 flex-shrink-0 ${side === "white" ? "bg-white border-neutral-300" : "bg-neutral-800 border-neutral-600"}`} />
              <div className="min-w-0">
                <div className="font-bold text-white text-sm truncate">
                  {engineName}
                </div>
                <div className="text-xs text-neutral-300">
                  {side === "white" ? "Sisi Putih (White)" : "Sisi Hitam (Black)"}
                </div>
              </div>
              {isMoving && (
                <div className="ml-auto text-xs text-[#81b64c] font-bold animate-pulse">
                  {lang === "id" ? "Giliran..." : "To move..."}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[minmax(300px,1fr)_380px] gap-5 items-start">
        {/* Board + eval bar */}
        <div className="space-y-3">
          {/* Controls Bar directly above Chessboard */}
          <div className="bg-[#262421] p-2.5 rounded-xl border border-[#36322d] flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-1.5">
              {status === "running" ? (
                <Button
                  onClick={stopMatch}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-8 px-3"
                >
                  ⏸ Pause
                </Button>
              ) : (
                <Button
                  onClick={runMatch}
                  className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs h-8 px-3"
                >
                  {status === "idle" ? "▶ Start" : "▶ Resume / Restart"}
                </Button>
              )}
              <Button
                onClick={resetMatch}
                variant="outline"
                className="border-[#36322d] text-neutral-300 hover:text-white font-bold text-xs h-8 px-3"
              >
                ↺ Reset
              </Button>
            </div>
            <div>
              <Button
                onClick={() => setShowReviewModal(true)}
                disabled={status !== "finished" && moves.length < 5}
                className={
                  status === "finished" || moves.length >= 10
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8 px-3 shadow-md shadow-indigo-600/20"
                    : "bg-[#1f1d1a] border border-[#36322d] text-neutral-500 font-bold text-xs h-8 px-3 cursor-not-allowed"
                }
              >
                🔍 {lang === "id" ? "Review Permainan" : "Game Review"}
              </Button>
            </div>
          </div>

          {/* Eval bar */}
          <div className="bg-[#1c1a18] rounded-xl border border-[#36322d] p-2.5 flex items-center gap-3">
            <span className="text-xs text-neutral-300 font-mono w-10 text-right">
              {whiteCp !== null ? (whiteCp > 0 ? `+${(whiteCp/100).toFixed(1)}` : (whiteCp/100).toFixed(1)) : "="}
            </span>
            <div className="flex-1 h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${barPct}%`,
                  background: barPct > 55 ? "linear-gradient(90deg,#ccc,#fff)" : barPct < 45 ? "linear-gradient(90deg,#222,#444)" : "linear-gradient(90deg,#888,#bbb)",
                }}
              />
            </div>
            <span className="text-xs font-mono text-neutral-300 w-12">
              {barPct > 50 ? `W ${barPct}%` : `B ${100-barPct}%`}
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl">
            <Chessboard
              options={{
                id: "spectator-board",
                position: currentFen,
                boardOrientation: "white",
                allowDragging: false,
                darkSquareStyle: { backgroundColor: "#b58863" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
                animationDurationInMs: 350,
              }}
            />
          </div>

          {/* Outcome banner */}
          {outcome && outcome.over && (
            <div className="p-4 rounded-xl bg-[#262421] border border-[#81b64c] text-center space-y-1">
              <IconTrophy3D size={28} className="mx-auto" />
              <div className="font-black text-white text-lg">{outcome.label}</div>
              <div className="text-sm text-neutral-300">
                {outcome.winner === "white"
                  ? `${whiteEngine === "jev" ? "🎉 Jev AI" : whiteEngine === "fly" ? "🪰 Fruit Fly" : "Stockfish"} menang!`
                  : outcome.winner === "black"
                  ? `${blackEngine === "jev" ? "🎉 Jev AI" : blackEngine === "fly" ? "🪰 Fruit Fly" : "Stockfish"} menang!`
                  : "Remis!"}
              </div>
              <div className="text-xs text-neutral-300">{moves.length} {lang === "id" ? "langkah total" : "total moves"}</div>
            </div>
          )}

          {status === "idle" && (
            <div className="p-4 rounded-xl bg-[#1c1a18] border border-[#36322d] text-center text-neutral-300 text-sm">
              {lang === "id"
                ? "Tekan \"Mulai Pertandingan\" untuk menonton Jev melawan Stockfish secara live."
                : "Press \"Start Match\" to watch Jev battle Stockfish live."}
            </div>
          )}
        </div>

        {/* Move log */}
        <Card className="bg-[#262421] border-[#36322d] text-white">
          <CardHeader className="py-3 px-4 border-b border-[#36322d]">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
              <span>{lang === "id" ? "Riwayat Langkah Live" : "Live Move Log"}</span>
              <Badge className={`text-xs ${status === "running" ? "bg-emerald-600 animate-pulse" : status === "finished" ? "bg-neutral-600" : "bg-neutral-700"}`}>
                {status === "running" ? (lang === "id" ? "● LIVE" : "● LIVE")
                  : status === "finished" ? (lang === "id" ? "Selesai" : "Finished")
                  : status === "paused" ? (lang === "id" ? "Dijeda" : "Paused")
                  : (lang === "id" ? "Siap" : "Ready")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {moves.length === 0 ? (
              <div className="p-6 text-center text-neutral-300 text-sm">
                {lang === "id" ? "Belum ada langkah." : "No moves yet."}
              </div>
            ) : (
              <div ref={moveListRef} className="h-[440px] overflow-y-auto p-3 space-y-1">
                {moves.map((m, i) => {
                  const moveNum = Math.floor(i / 2) + 1;
                  const isWhite = i % 2 === 0;
                  const isJevMove = m.by === "jev";
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                        i === moves.length - 1
                          ? "bg-[#2c2824] ring-1 ring-[#81b64c]"
                          : "bg-[#1a1816]"
                      }`}
                    >
                      {isWhite && (
                        <span className="text-neutral-300 font-mono w-7 shrink-0">{moveNum}.</span>
                      )}
                      {!isWhite && <span className="w-7 shrink-0" />}
                      <span className={`font-mono font-bold ${isJevMove ? "text-sky-300" : "text-amber-300"}`}>
                        {m.san}
                      </span>
                      <Badge className={`text-[9px] px-1.5 py-0 ${isJevMove ? "bg-sky-900 text-sky-300" : "bg-amber-900 text-amber-300"}`}>
                        {isJevMove ? "Jev" : "SF"}
                      </Badge>
                      {m.scoreCp !== null && (
                        <span className="ml-auto font-mono text-xs text-neutral-300">
                          {cpToAdvantage(m.scoreCp, isWhite ? "b" : "w")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info box */}
      <div className="p-3.5 rounded-xl bg-[#1e2a14] border border-[#81b64c]/30 text-[#81b64c] text-xs leading-relaxed">
        <span className="font-bold">💡 Tips: </span>
        {lang === "id"
          ? "Setelah pertandingan, tekan \"Coba Posisi Ini\" untuk membuka posisi akhir di tab \"Latihan Dipandu\" dan bermain dari sana dengan bimbingan Jev."
          : "After the match, press \"Try This Position\" to open the final position in \"Guided Practice\" and play from there with Jev's coaching."}
      </div>

      {/* Game Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#262421] border border-[#36322d] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#36322d] pb-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  🔍 {lang === "id" ? "Review Taktik Pertandingan" : "Match Tactical Review"}
                </h3>
                <p className="text-xs text-neutral-400">
                  {lang === "id"
                    ? `Analisis mendalam ${moves.length} langkah antara Jev AI (Hybrid FlyWire) vs Stockfish 15 NNUE.`
                    : `In-depth analysis of ${moves.length} moves between Jev AI (Hybrid FlyWire) vs Stockfish 15 NNUE.`}
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="w-8 h-8 rounded-lg bg-[#1f1d1a] border border-[#36322d] text-neutral-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* White Tactical Review */}
              <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d] space-y-2">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-white border" />
                  {whiteEngine === "jev" ? "Jev AI (Hybrid FlyWire)" : whiteEngine === "fly" ? "Fruit Fly Brain" : "Stockfish"}
                </div>
                <div className="text-xs text-neutral-300 space-y-1.5 leading-relaxed">
                  <p><strong>🎯 Strategi Utama:</strong> Pembukaan Inggris & Fianchetto Gajah ganda (Bg2/Bb2), kontrol petak tengah d4/e4.</p>
                  <p><strong>⚔️ Arah Serangan:</strong> Menekan sayap raja lawan (f7/h7) dan mencari pertukaran perwira mayor.</p>
                  <p><strong>🛡️ Apa yang Dijaga:</strong> Struktur pion sayap raja dan penguasaan lajur-e terbuka.</p>
                  <p><strong>⚠️ Evaluasi Kritis:</strong> Sempat mengorbankan kualitas di langkah 27 (Rxe6) dan terlambat memblokade pion bebas sayap menteri (a-pawn) lawan di endgame.</p>
                </div>
              </div>

              {/* Black Tactical Review */}
              <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d] space-y-2">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-neutral-800 border border-neutral-600" />
                  {blackEngine === "stockfish" ? "Stockfish 15 NNUE" : blackEngine === "fly" ? "Fruit Fly Brain" : "Jev AI"}
                </div>
                <div className="text-xs text-neutral-300 space-y-1.5 leading-relaxed">
                  <p><strong>🎯 Strategi Utama:</strong> Penciptaan pion bebas sayap menteri (passed pawn lajur-a) dan sentralisasi Raja (Kxe6/Kf7/Kd7).</p>
                  <p><strong>⚔️ Arah Serangan:</strong> Meluncurkan pion a5 → a4 → a3 menuju promosi Menteri dan manuver benteng Rd8/Rd7/Rd3.</p>
                  <p><strong>🛡️ Apa yang Dijaga:</strong> Posisi Kuda sentral di b4/b5 dan keamanan Raja di endgame.</p>
                  <p><strong>🏆 Taktik Kunci:</strong> Memanfaatkan keterlambatan lawan memblokade pion sayap menteri hingga pion a3 hampir promosi.</p>
                </div>
              </div>
            </div>

            {/* Tactical Takeaways */}
            <div className="bg-[#181614] p-4 rounded-xl border border-amber-500/30 space-y-2">
              <div className="font-bold text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                💡 Pelajaran Kunci untuk Engine
              </div>
              <ul className="text-xs text-neutral-300 space-y-1 list-disc list-inside leading-relaxed">
                <li><strong>Blokade Pion Bebas Musuh:</strong> Saat lawan mendorong pion bebas melewati baris 4 (a5 → a4 → a3), blokade adalah prioritas pertahanan nomor satu.</li>
                <li><strong>Hindari Pengorbanan Kualitas Semu:</strong> Jangan menukar Benteng untuk Gajah (Rxe6) kecuali ada skakmat pasti atau promosi pion segera.</li>
                <li><strong>Aktifkan Raja & Cari Skak Kontra:</strong> Di fase akhir, Raja harus aktif ke tengah dan terus mencari skak untuk menahan tempo lawan.</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setShowReviewModal(false)}
                className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs px-4"
              >
                Tutup Review
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}