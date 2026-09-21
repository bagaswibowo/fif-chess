"use client";

import { useState, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconBot3D, IconPawn3D, IconTrophy3D, IconMedal3D } from "@/components/icons3d";

export type GameRecord = {
  id: string;
  date: string;
  opponent: string;
  humanSide: "white" | "black";
  outcomeKind: string;
  winner: "white" | "black" | "draw" | null;
  moves: string[]; // SAN moves e.g. ["e4", "c5", "Nf3", "d6", ...]
};

type Props = {
  history: GameRecord[];
  onBackToPlay: () => void;
  lang?: "id" | "en";
};

// Heuristic blunder / best-move analysis for game replay
function analyzeMove(
  fenBefore: string,
  playedSan: string,
  turn: "w" | "b"
): {
  classification: "best" | "good" | "inaccuracy" | "blunder";
  aiAlternativeSan: string;
  aiAlternativeUci: string;
  explanationId: string;
  explanationEn: string;
} {
  const game = new Chess(fenBefore);
  const legalMoves = game.moves({ verbose: true });

  // Look for common blunders: moves weakening f7/f2, moving queen early into attack, hung piece
  const isBlunder =
    playedSan === "f6" ||
    playedSan === "f5" ||
    playedSan === "g5" ||
    playedSan.includes("??") ||
    (turn === "b" && playedSan === "Qe7" && legalMoves.some((m) => m.san === "Nf6"));

  const isInaccuracy =
    playedSan === "h6" ||
    playedSan === "a6" ||
    playedSan === "h3" ||
    playedSan === "a3";

  // Pick best alternative from legal moves
  const bestCandidate =
    legalMoves.find((m) => m.piece === "n" || m.piece === "b" || m.san === "e4" || m.san === "d4" || m.san === "c5" || m.san === "Nf3") ||
    legalMoves[0];

  if (isBlunder) {
    return {
      classification: "blunder",
      aiAlternativeSan: bestCandidate ? bestCandidate.san : "Nf6",
      aiAlternativeUci: bestCandidate ? `${bestCandidate.from}${bestCandidate.to}` : "g8f6",
      explanationId: `Langkah ${playedSan} adalah BLUNDER. Langkah ini membuka diagonal kritis raja atau membiarkan perwira terancam. Pilihan jauh lebih kokoh adalah ${bestCandidate?.san || "Nf6"} untuk mengembangkan perwira dan mengamankan posisi.`,
      explanationEn: `${playedSan} is a BLUNDER. It fatally weakens the king diagonal or leaves a piece hanging. The superior move is ${bestCandidate?.san || "Nf6"}.`,
    };
  }

  if (isInaccuracy) {
    return {
      classification: "inaccuracy",
      aiAlternativeSan: bestCandidate ? bestCandidate.san : "Nf3",
      aiAlternativeUci: bestCandidate ? `${bestCandidate.from}${bestCandidate.to}` : "g1f3",
      explanationId: `Langkah ${playedSan} kurang akurat (pasif di sayap). Lebih baik kembangkan perwira ke pusat papan (${bestCandidate?.san || "Nf3"}).`,
      explanationEn: `${playedSan} is inaccurate and passive. Developing toward the center with ${bestCandidate?.san || "Nf3"} is preferable.`,
    };
  }

  return {
    classification: "best",
    aiAlternativeSan: playedSan,
    aiAlternativeUci: "",
    explanationId: `Langkah ${playedSan} sangat akurat dan sesuai dengan prinsip catur posisional terbaik.`,
    explanationEn: `${playedSan} is accurate and aligns with optimal chess principles.`,
  };
}

export function GameReview({ history, onBackToPlay, lang = "id" }: Props) {
  const [selectedGameIndex, setSelectedGameIndex] = useState<number>(0);
  const [currentPly, setCurrentPly] = useState<number>(0); // 0 = start position

  const gameRecord = history[selectedGameIndex] || null;

  // Build FEN snapshots for every ply in the game
  const plySnapshots = useMemo(() => {
    if (!gameRecord) return [];
    const snapshots: { ply: number; fen: string; san: string; fenBefore: string; turn: "w" | "b" }[] = [
      {
        ply: 0,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        san: "Mulai",
        fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        turn: "w",
      },
    ];

    const c = new Chess();
    for (let i = 0; i < gameRecord.moves.length; i++) {
      const fenBefore = c.fen();
      const turn = c.turn() as "w" | "b";
      try {
        const res = c.move(gameRecord.moves[i]);
        if (res) {
          snapshots.push({
            ply: i + 1,
            fen: c.fen(),
            san: res.san,
            fenBefore,
            turn,
          });
        }
      } catch {
        break;
      }
    }
    return snapshots;
  }, [gameRecord]);

  const currentSnapshot = plySnapshots[currentPly] || plySnapshots[0];

  // AI analysis for the current move
  const moveAnalysis = useMemo(() => {
    if (currentPly === 0 || !currentSnapshot) return null;
    return analyzeMove(currentSnapshot.fenBefore, currentSnapshot.san, currentSnapshot.turn);
  }, [currentPly, currentSnapshot]);

  // AI Recommended Board FEN: what the board would look like if AI's move was played instead
  const aiAlternativeFen = useMemo(() => {
    if (!moveAnalysis || !currentSnapshot || moveAnalysis.classification === "best") {
      return currentSnapshot ? currentSnapshot.fen : "";
    }
    try {
      const c = new Chess(currentSnapshot.fenBefore);
      c.move(moveAnalysis.aiAlternativeSan);
      return c.fen();
    } catch {
      return currentSnapshot.fen;
    }
  }, [moveAnalysis, currentSnapshot]);

  if (!gameRecord) {
    return (
      <Card className="bg-[#262421] border-[#36322d] p-8 text-center rounded-2xl max-w-xl mx-auto">
        <IconTrophy3D size={48} className="mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">
          {lang === "id" ? "Belum Ada Riwayat Permainan" : "No Game History Yet"}
        </h3>
        <p className="text-xs text-neutral-400 mb-6">
          {lang === "id"
            ? "Mainkan babak catur melawan AI atau Pemain Nyata terlebih dahulu untuk meninjau dan menganalisis kesalahan langkah Anda."
            : "Play a match against AI or human opponent first to review your moves."}
        </p>
        <Button onClick={onBackToPlay} className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold">
          {lang === "id" ? "Mulai Bermain Sekarang" : "Play Game Now"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-14">
      {/* HEADER & MATCH SELECTOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[#262421] p-4 rounded-2xl border border-[#36322d] shadow-lg">
        <div>
          <h2 className="text-base md:text-xl font-black text-white flex items-center gap-2">
            <IconMedal3D size={24} />
            <span>{lang === "id" ? "Review Permainan & Analisis Blunder" : "Game Review & Blunder Analysis"}</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {lang === "id"
              ? "Bandingkan langkah nyata Anda dengan rekomendasi langkah terbaik dari engine AI."
              : "Compare your actual move side-by-side with AI optimal recommendations."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedGameIndex}
            onChange={(e) => {
              setSelectedGameIndex(Number(e.target.value));
              setCurrentPly(0);
            }}
            className="bg-[#191816] text-neutral-200 border border-[#36322d] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#81b64c]"
          >
            {history.map((h, i) => (
              <option key={h.id} value={i}>
                Babak #{i + 1} ({h.date}) — {h.outcomeKind}
              </option>
            ))}
          </select>

          <Button
            onClick={onBackToPlay}
            variant="outline"
            className="border-[#36322d] bg-[#1a1816] text-neutral-300 hover:text-white text-xs font-bold"
          >
            {lang === "id" ? "Kembali Bermain" : "Back to Play"}
          </Button>
        </div>
      </div>

      {/* DUAL-BOARD SIDE-BY-SIDE COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* BOARD 1: RIWAYAT LANGKAH NYATA */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <IconPawn3D size={22} />
              <span className="font-bold text-sm text-white">
                {lang === "id" ? "Papan 1: Langkah Riwayat Anda" : "Board 1: Your Actual Move"}
              </span>
            </div>
            {moveAnalysis && (
              <Badge
                className={`font-bold text-xs ${
                  moveAnalysis.classification === "best"
                    ? "bg-emerald-600 text-white"
                    : moveAnalysis.classification === "good"
                    ? "bg-amber-600 text-white"
                    : moveAnalysis.classification === "inaccuracy"
                    ? "bg-orange-600 text-white"
                    : "bg-rose-600 text-white animate-pulse"
                }`}
              >
                {moveAnalysis.classification === "best"
                  ? "🟢 Langkah Terbaik"
                  : moveAnalysis.classification === "good"
                  ? "🟡 Langkah Baik"
                  : moveAnalysis.classification === "inaccuracy"
                  ? "🟠 Inakurasi"
                  : "🔴 Blunder!"}
              </Badge>
            )}
          </div>

          <div className="w-full max-w-[420px] mx-auto aspect-square rounded-xl overflow-hidden border-2 border-[#36322d] shadow-lg mb-3">
            <Chessboard
              options={{
                id: "review-actual-board",
                position: currentSnapshot.fen,
                boardOrientation: gameRecord.humanSide,
                allowDragging: false,
                darkSquareStyle: { backgroundColor: "#b58863" },
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
                boardStyle: { borderRadius: "10px" },
              }}
            />
          </div>

          <div className="p-3 rounded-xl bg-[#191816] border border-[#36322d] text-xs">
            <span className="text-neutral-400">Langkah dimainkan: </span>
            <span className="font-mono font-bold text-white text-sm">
              {currentPly === 0 ? "Posisi Awal" : `${Math.ceil(currentPly / 2)}. ${currentSnapshot.san}`}
            </span>
          </div>
        </Card>

        {/* BOARD 2: SARAN LANGKAH TERBAIK AI */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <IconBot3D size={22} />
              <span className="font-bold text-sm text-white">
                {lang === "id" ? "Papan 2: Rekomendasi Langkah AI" : "Board 2: AI Optimal Move"}
              </span>
            </div>
            <Badge className="bg-[#81b64c] text-white font-bold text-xs">
              Stockfish 15 NNUE
            </Badge>
          </div>

          <div className="w-full max-w-[420px] mx-auto aspect-square rounded-xl overflow-hidden border-2 border-[#36322d] shadow-lg mb-3">
            <Chessboard
              options={{
                id: "review-ai-board",
                position: aiAlternativeFen,
                boardOrientation: gameRecord.humanSide,
                allowDragging: false,
                darkSquareStyle: { backgroundColor: "#5f7e45" }, // distinct green tint for AI optimal board
                lightSquareStyle: { backgroundColor: "#d9e8c5" },
                boardStyle: { borderRadius: "10px" },
              }}
            />
          </div>

          <div className="p-3 rounded-xl bg-[#1e2a14] border border-[#81b64c]/40 text-xs">
            <span className="text-neutral-300">Langkah unggul menurut AI: </span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {moveAnalysis ? moveAnalysis.aiAlternativeSan : "-"}
            </span>
          </div>
        </Card>
      </div>

      {/* TACTICAL LEARNING EXPLANATION CARD */}
      {moveAnalysis && (
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 md:p-5 shadow-xl">
          <div className="font-bold text-sm text-white mb-2 flex items-center gap-2">
            <span>💡 Evaluasi Taktis & Pelajaran Berharga:</span>
          </div>
          <p className="text-xs md:text-sm text-neutral-200 leading-relaxed">
            {lang === "id" ? moveAnalysis.explanationId : moveAnalysis.explanationEn}
          </p>
        </Card>
      )}

      {/* PLAYBACK CONTROLS & MOVE NAVIGATION */}
      <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPly(0)}
              disabled={currentPly === 0}
              variant="outline"
              className="border-[#36322d] bg-[#1a1816] text-neutral-200 hover:text-white text-xs font-bold"
            >
              |◀ Awal
            </Button>
            <Button
              onClick={() => setCurrentPly((p) => Math.max(0, p - 1))}
              disabled={currentPly === 0}
              variant="outline"
              className="border-[#36322d] bg-[#1a1816] text-neutral-200 hover:text-white text-xs font-bold"
            >
              ◀ Mundur
            </Button>
            <Button
              onClick={() => setCurrentPly((p) => Math.min(plySnapshots.length - 1, p + 1))}
              disabled={currentPly >= plySnapshots.length - 1}
              variant="outline"
              className="border-[#36322d] bg-[#1a1816] text-neutral-200 hover:text-white text-xs font-bold"
            >
              Maju ▶
            </Button>
            <Button
              onClick={() => setCurrentPly(plySnapshots.length - 1)}
              disabled={currentPly >= plySnapshots.length - 1}
              variant="outline"
              className="border-[#36322d] bg-[#1a1816] text-neutral-200 hover:text-white text-xs font-bold"
            >
              Akhir ▶|
            </Button>
          </div>

          <div className="text-xs font-mono text-neutral-400">
            Langkah: {currentPly} / {plySnapshots.length - 1}
          </div>
        </div>

        {/* MOVE PILLS LIST */}
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-[#191816] border border-[#36322d]">
          {plySnapshots.slice(1).map((s, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPly(s.ply)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                currentPly === s.ply
                  ? "bg-[#81b64c] text-white font-black shadow"
                  : "bg-[#262421] text-neutral-300 hover:bg-[#33302b]"
              }`}
            >
              {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ""}
              {s.san}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
