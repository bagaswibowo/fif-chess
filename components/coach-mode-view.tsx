"use client";

import { useState, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti } from "@/components/confetti";
import { IconBot3D, IconLightning3D, IconPuzzle3D } from "@/components/icons3d";
import { describeOutcome, type GameOutcome } from "@/lib/chess";

type CoachFeedback = {
  status: "perfect" | "good" | "inaccurate" | "blunder";
  messageId: string;
  messageEn: string;
  bestUci?: string;
  bestSan?: string;
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

    if (side === "black") {
      triggerStockfishMove(c.fen(), true);
    }
  }, []);

  const triggerStockfishMove = async (currentFen: string, isInitial = false) => {
    setThinking(true);
    try {
      const res = await fetch("/api/jev-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: currentFen }),
      });
      const data = await res.json();
      if (data.uci && data.san) {
        const c = new Chess(currentFen);
        const from = data.uci.slice(0, 2) as Square;
        const to = data.uci.slice(2, 4) as Square;
        const promo = data.uci.length > 4 ? data.uci[4] : undefined;
        c.move({ from, to, promotion: promo });

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
    }
  };

  const tryMove = async (from: string, to: string) => {
    if (outcome.over || thinking) return;
    const c = new Chess(chess.fen());
    let moveRes;
    try {
      moveRes = c.move({ from: from as Square, to: to as Square, promotion: 'q' });
    } catch { return; }
    if (!moveRes) return;

    setThinking(true);
    let bestUci = "";
    let bestSan = "";
    try {
      const evalRes = await fetch("/api/jev-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: chess.fen() }),
      });
      const evalData = await evalRes.json();
      if (evalData.uci && evalData.san) {
        bestUci = evalData.uci;
        bestSan = evalData.san;
      }
    } catch {}

    const userUci = moveRes.from + moveRes.to + (moveRes.promotion || "");
    const isBest = !bestUci || userUci === bestUci || moveRes.san === bestSan;

    setChess(c);
    setFen(c.fen());
    setHistory((prev) => [...prev, moveRes.san]);
    const currentOut = describeOutcome(c);
    setOutcome(currentOut);

    if (currentOut.over) {
      setThinking(false);
      setShowConfetti(currentOut.winner === playerSide);
      setFeedback({
        status: "perfect",
        messageId: "Pertandingan selesai.",
        messageEn: "Game over.",
      });
      return;
    }

    setFeedback({
      status: isBest ? "perfect" : "inaccurate",
      messageId: isBest ? `Brilian! ${moveRes.san} adalah langkah terbaik.` : `Kurang optimal. Disarankan ${bestSan || "langkah lain"}.`,
      messageEn: isBest ? `Brilliant! ${moveRes.san} is the top move.` : `Inaccurate. Suggestion: ${bestSan || "alternative"}.`,
      bestUci,
      bestSan,
    });
    
    setTimeout(() => { triggerStockfishMove(c.fen()); }, 600);
  };

  const handleUndo = () => {
    if (history.length < 2 || thinking) return;
    const c = new Chess();
    const newHistory = [...history];
    newHistory.pop(); newHistory.pop();
    for (const m of newHistory) c.move(m);
    setChess(c);
    setFen(c.fen());
    setHistory(newHistory);
    setOutcome(describeOutcome(c));
    setFeedback({ status: "good", messageId: "Undo sukses.", messageEn: "Undo success." });
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
          <Button onClick={handleUndo} className="w-full mt-4">Undo</Button>
        </div>
        <Card className="bg-[#262421] border-[#36322d] text-white">
          <CardHeader><CardTitle>Analisis</CardTitle></CardHeader>
          <CardContent>
            {feedback && <div className="p-4 rounded-xl bg-[#312e2b] text-sm">{lang === "id" ? feedback.messageId : feedback.messageEn}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
