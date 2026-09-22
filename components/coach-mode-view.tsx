"use client";

import { useState, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D, IconPuzzle3D } from "@/components/icons3d";
import {
  describeOutcome,
  findLegalMove,
  getLegalMoves,
  type GameOutcome,
  type LegalMove,
} from "@/lib/chess";
import { playStockfishMove } from "@/lib/stockfish";

export type CoachFeedback = {
  status: "perfect" | "good" | "inaccurate" | "blunder";
  messageId: string;
  messageEn: string;
  bestUci?: string;
  bestSan?: string;
  reason?: string;
};

type Props = {
  lang?: "id" | "en";
};

export function CoachModeView({ lang = "id" }: Props) {
  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>(chess.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [thinking, setThinking] = useState(false);
  const [playerSide, setPlayerSide] = useState<"white" | "black">("white");
  const [outcome, setOutcome] = useState<GameOutcome>(() => describeOutcome(chess));
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const thinkingRef = useRef(false);

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
    thinkingRef.current = false;
    setThinking(false);

    if (side === "black") {
      triggerStockfishMove(c.fen(), true);
    }
  }, []);

  const triggerStockfishMove = async (currentFen: string, isInitial = false) => {
    setThinking(true);
    thinkingRef.current = true;
    try {
      const data = await playStockfishMove(currentFen);
      if (data.uci && data.san) {
        const c = new Chess(currentFen);
        const move = findLegalMove(c, data.uci.slice(0, 2) as Square, data.uci.slice(2, 4) as Square, data.uci.length > 4 ? data.uci[4] : undefined);
        if (!move) {
          setFeedback({ status: "inaccurate", messageId: "Langkah AI tidak valid di posisi ini.", messageEn: "AI suggested an illegal move." });
          return;
        }
        c.move(move);

        setChess(c);
        setFen(c.fen());
        setHistory((prev) => [...prev, data.san]);
        const out = describeOutcome(c);
        setOutcome(out);
        if (out.over && out.winner === (playerSide === "white" ? "black" : "white")) {
          setShowConfetti(true);
        }

        setFeedback({
          status: "good",
          messageId: isInitial
            ? `Stockfish membuka permainan dengan ${data.san}. Giliran Anda!`
            : `Stockfish merespons dengan ${data.san}. Analisis dan balas!`,
          messageEn: isInitial
            ? `Stockfish opened with ${data.san}. Your turn!`
            : `Stockfish replied with ${data.san}. Analyze and respond!`,
          bestUci: data.uci,
          bestSan: data.san,
        });
      }
    } catch {
      setFeedback({
        status: "inaccurate",
        messageId: "Gagal memuat langkah AI.",
        messageEn: "Failed to load AI move.",
      });
    } finally {
      setThinking(false);
      thinkingRef.current = false;
    }
  };

  const getTacticReason = (move: LegalMove, chess: Chess): string => {
    const legal = getLegalMoves(chess);
    if (move.isCheckmate) return "Skakmat! Langkah ini mengakhiri permainan.";
    if (move.isCheck) return "Skak! Raja lawan terancam langsung.";
    if (move.isCapture) {
      const captured = chess.get(move.to);
      return `Bentrok: ambil ${captured?.type ?? "bidak"} lawan secara cuma-cuma.`;
    }
    if (move.isPromotion) return `Promosi pion menjadi ${move.promotion}. Menguatkan posisi akhir.`;
    if (move.isCastle) return "Rokade: mengamankan raja dan membuka jalur benteng.";
    return "Langkah stabil sesuai prinsip dasar catur.";
  };

  const tryMove = async (from: string, to: string) => {
    if (outcome.over || thinkingRef.current) return;
    if (chess.turn() !== (playerSide === "white" ? "w" : "b")) {
      setFeedback({ status: "inaccurate", messageId: "Bukan giliran Anda. Tunggu AI.", messageEn: "Not your turn. Wait for AI." });
      return;
    }

    const c = new Chess(chess.fen());
    const promotionIfAny = getLegalMoves(c).some((m) => m.from === from && m.to === to && m.isPromotion) ? "q" : undefined;
    const move = findLegalMove(c, from as Square, to as Square, promotionIfAny as any);
    if (!move) {
      setFeedback({ status: "inaccurate", messageId: "Langkah tidak valid. Coba lagi.", messageEn: "Illegal move. Try again." });
      return;
    }

    setThinking(true);
    thinkingRef.current = true;
    let bestUci = "";
    let bestSan = "";
    try {
      const evalRes = await playStockfishMove(chess.fen());
      if (evalRes.uci && evalRes.san) {
        bestUci = evalRes.uci;
        bestSan = evalRes.san;
      }
    } catch {}

    c.move(move);
    const userUci = move.from + move.to + (move.promotion ? move.promotion : "");
    const isBest = !bestUci || userUci === bestUci || move.san === bestSan;

    setChess(c);
    setFen(c.fen());
    setHistory((prev) => [...prev, move.san]);
    const currentOut = describeOutcome(c);
    setOutcome(currentOut);

    if (currentOut.over) {
      setThinking(false);
      thinkingRef.current = false;
      setShowConfetti(currentOut.winner === playerSide);
      setFeedback({
        status: "perfect",
        messageId: "Pertandingan selesai.",
        messageEn: "Game over.",
      });
      return;
    }

    const reason = getTacticReason(move, c);
    setFeedback({
      status: isBest ? "perfect" : "inaccurate",
      messageId: isBest ? `Brilian! ${move.san} adalah langkah terbaik.` : `Kurang optimal. Disarankan ${bestSan || "langkah lain"}.`,
      messageEn: isBest ? `Brilliant! ${move.san} is the top move.` : `Inaccurate. Suggestion: ${bestSan || "alternative"}.`,
      bestUci,
      bestSan,
      reason,
    });

    // Auto-continue AI opponent only after player move; keep loop minimal.
    setTimeout(() => { triggerStockfishMove(c.fen()); }, 600);
  };

  const handleUndo = () => {
    if (history.length === 0 || thinkingRef.current) return;
    const c = new Chess(chess.fen());
    // Undo exactly one half-move: player OR engine, but not both at once.
    const lastMove = history[history.length - 1];
    const newHistory = [...history];
    newHistory.pop();

    const rebuild = new Chess();
    for (const m of newHistory) {
      const moved = rebuild.move(m);
      if (!moved) break;
    }

    setChess(rebuild);
    setFen(rebuild.fen());
    setHistory(newHistory);
    setOutcome(describeOutcome(rebuild));
    setFeedback({ status: "good", messageId: "Undo satu langkah.", messageEn: "Undo one move." });
    setShowConfetti(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showConfetti && <Confetti />}
      <div className="bg-[#262421] p-6 rounded-2xl border border-[#36322d] shadow-xl flex justify-between items-center gap-4">
        <h2 className="text-xl font-black text-white">AI Coach</h2>
        <div className="flex gap-2">
          <Button onClick={() => resetGame("white")} variant="outline">Putih</Button>
          <Button onClick={() => resetGame("black")} variant="outline">Hitam</Button>
        </div>
      </div>
      <div className="grid md:grid-cols-[400px_1fr] gap-6">
        <div className="bg-[#262421] p-4 rounded-2xl border border-[#36322d]">
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
              darkSquareStyle: { backgroundColor: "#b58863" },
              lightSquareStyle: { backgroundColor: "#f0d9b5" },
            }}
          />
          <Button onClick={handleUndo} className="w-full mt-4" disabled={history.length === 0 || thinkingRef.current}>
            Undo (1 langkah)
          </Button>
        </div>
        <Card className="bg-[#262421] border-[#36322d] text-white">
          <CardHeader><CardTitle>Analisis</CardTitle></CardHeader>
          <CardContent>
            {feedback && (
              <div className="p-4 rounded-xl bg-[#312e2b] text-sm space-y-2">
                <div>{lang === "id" ? feedback.messageId : feedback.messageEn}</div>
                {feedback.reason && (
                  <div className="text-xs text-neutral-300 border-t border-[#36322d] pt-2">
                    Alasan taktis: {feedback.reason}
                  </div>
                )}
                {feedback.bestSan && feedback.status !== "perfect" && (
                  <div className="text-xs text-[#81b64c]">
                    Saran AI: {feedback.bestSan}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
