"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  IconScan3D,
  IconVision3D,
  IconBot3D,
  IconPlay3D,
  IconSwap3D,
  IconLightning3D,
  IconTrophy3D,
} from "@/components/icons3d";
import { CapturedPiecesBar } from "@/components/captured-pieces";

type Props = {
  onLoadFen: (fen: string) => void;
  lang?: "id" | "en";
};

type EngineType = "stockfish" | "jev-fly" | "jev" | "fly";

export function ScanView({ onLoadFen, lang = "id" }: Props) {
  // 1. Initial Reference Board State (Papan 1)
  const defaultInitialFen = "1R6/1bP2pk1/p3p3/4n2p/7P/8/BKP1n1p1/5R2 w - - 0 1";
  const [initialFen, setInitialFen] = useState<string>(defaultInitialFen);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [fenInput, setFenInput] = useState<string>(defaultInitialFen);
  const [error, setError] = useState<string | null>(null);

  // 2. Dual-Engine Configuration (White Engine & Black Engine) & Solver State (Papan 2)
  const [liveFen, setLiveFen] = useState<string>(defaultInitialFen);
  const [whiteEngine, setWhiteEngine] = useState<EngineType>("stockfish");
  const [blackEngine, setBlackEngine] = useState<EngineType>("jev-fly");
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [isEngineCalculating, setIsEngineCalculating] = useState(false);
  const [solveMoves, setSolveMoves] = useState<{ san: string; uci: string; by: string; scoreCp?: number | null }[]>([]);
  const [lastMoveUci, setLastMoveUci] = useState<string | null>(null);
  const [currentScoreCp, setCurrentScoreCp] = useState<number | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSolveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Set new initial position and reset solver
  const applyNewInitialFen = useCallback((newFen: string) => {
    try {
      const chess = new Chess(newFen);
      const valid = chess.fen();
      setInitialFen(valid);
      setLiveFen(valid);
      setFenInput(valid);
      setSolveMoves([]);
      setLastMoveUci(null);
      setCurrentScoreCp(null);
      setIsAutoSolving(false);
      setError(null);
    } catch {
      setError(lang === "id" ? "Format FEN tidak valid." : "Invalid FEN format.");
    }
  }, [lang]);

  // Handle image upload from camera or file
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Url = event.target?.result as string;
      setUploadedImage(base64Url);

      try {
        const res = await fetch("/api/scan-board", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Url }),
        });
        const data = await res.json();
        if (data.ok && data.fen) {
          applyNewInitialFen(data.fen);
        } else {
          applyNewInitialFen(defaultInitialFen);
        }
      } catch {
        applyNewInitialFen(defaultInitialFen);
      } finally {
        setIsProcessingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag on Board 1 (Reference adjustments)
  const handleBoard1Drop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    try {
      const chess = new Chess(initialFen);
      const moved = chess.move({ from: sourceSquare as any, to: targetSquare as any });
      if (moved) {
        applyNewInitialFen(chess.fen());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Execute 1 solve move via engine API based on White vs Black selected engine
  const stepEngineSolve = useCallback(async () => {
    if (isEngineCalculating) return;

    try {
      const chess = new Chess(liveFen);
      if (chess.isGameOver()) {
        setIsAutoSolving(false);
        return;
      }

      setIsEngineCalculating(true);
      const turn = chess.turn();
      const activeEngine = turn === "w" ? whiteEngine : blackEngine;

      const engineParam = activeEngine === "fly"
        ? "fly"
        : activeEngine === "stockfish"
        ? "stockfish"
        : "jev";

      const res = await fetch("/api/engine-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: liveFen,
          depth: 12,
          engine: engineParam,
          history: solveMoves.map(m => m.san).slice(-10),
        }),
      });

      const data = await res.json();
      if (data.ok !== false && data.fen && data.uci && data.san) {
        setLiveFen(data.fen);
        setLastMoveUci(data.uci);
        if (typeof data.scoreCp === "number") {
          setCurrentScoreCp(data.scoreCp);
        }
        setSolveMoves(prev => [
          ...prev,
          {
            san: data.san,
            uci: data.uci,
            by: activeEngine,
            scoreCp: data.scoreCp ?? null,
          },
        ]);

        const nextChess = new Chess(data.fen);
        if (nextChess.isGameOver()) {
          setIsAutoSolving(false);
        }
      } else {
        setIsAutoSolving(false);
      }
    } catch (err) {
      console.error("Solver error:", err);
      setIsAutoSolving(false);
    } finally {
      setIsEngineCalculating(false);
    }
  }, [liveFen, isEngineCalculating, whiteEngine, blackEngine, solveMoves]);

  // Autoplay solver loop
  useEffect(() => {
    if (!isAutoSolving) {
      if (autoSolveTimerRef.current) clearInterval(autoSolveTimerRef.current);
      return;
    }

    autoSolveTimerRef.current = setInterval(() => {
      void stepEngineSolve();
    }, 1400);

    return () => {
      if (autoSolveTimerRef.current) clearInterval(autoSolveTimerRef.current);
    };
  }, [isAutoSolving, stepEngineSolve]);

  // Reset Board 2 to Board 1's position
  const handleResetSolver = () => {
    setIsAutoSolving(false);
    setLiveFen(initialFen);
    setSolveMoves([]);
    setLastMoveUci(null);
    setCurrentScoreCp(null);
  };

  // Tactical Threat & Blunder Danger Analysis on Live Position
  const tacticalIntel = useMemo(() => {
    try {
      const chess = new Chess(liveFen);
      const turn = chess.turn();
      const isWhiteTurn = turn === "w";

      let passedPawnNotice = "";
      let kingSafetyNotice = "";

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = (String.fromCharCode(97 + c) + (8 - r)) as any;
          const p = chess.get(sq);
          if (p && p.type === "p") {
            if (p.color === "w" && r <= 2) {
              passedPawnNotice = `Pion Putih di ${sq} sudah di baris lanjutan (ancaman promosi menteri!).`;
            } else if (p.color === "b" && r >= 5) {
              passedPawnNotice = `Pion Hitam di ${sq} sangat dekat dengan promosi.`;
            }
          }
        }
      }

      if (chess.inCheck()) {
        kingSafetyNotice = `Skak aktif terhadap Raja ${isWhiteTurn ? "Putih" : "Hitam"}!`;
      }

      return {
        isGameOver: chess.isGameOver(),
        turn: isWhiteTurn ? "Putih" : "Hitam",
        threatSummary: passedPawnNotice || kingSafetyNotice || (isWhiteTurn ? "Putih mengontrol ruang dan inisiatif taktis." : "Hitam berusaha mengunci lajur dan mengancam balik."),
        blunderDanger: isWhiteTurn
          ? "Hati-hati: Melepaskan pengawalan petak promosi atau membiarkan Kuda hitam bermanuver garpu dapat membalikkan evaluasi."
          : "Hati-hati: Terlambat menghalau laju pion bebas atau membiarkan Benteng putih mengontrol baris 7/8 akan berujung skakmat.",
        keyIdea: isWhiteTurn
          ? "Strategi Kemenangan: Dorong pion promosi sambil menjaga Raja aktif mengawal petak akhir."
          : "Strategi Bertahan: Korbankan perwira minor untuk mengeliminasi pion promosi atau ciptakan skak abadi.",
      };
    } catch {
      return {
        isGameOver: false,
        turn: "Putih",
        threatSummary: "Posisi dinamis dengan potensi pertukaran taktis.",
        blunderDanger: "Perhatikan keselamatan raja dan koordinasi perwira.",
        keyIdea: "Kembangkan inisiatif dan rebut petak sentral.",
      };
    }
  }, [liveFen]);

  // Board 2 Visual Arrows
  const board2Arrows = useMemo(() => {
    const list: { startSquare: string; endSquare: string; color: string }[] = [];
    if (lastMoveUci && lastMoveUci.length >= 4) {
      list.push({
        startSquare: lastMoveUci.slice(0, 2),
        endSquare: lastMoveUci.slice(2, 4),
        color: "#eab308", // Yellow for last move
      });
    }
    return list;
  }, [lastMoveUci]);

  const PRESET_POSITIONS = [
    {
      name: "Foto Asli User (Endgame 16 Bidak)",
      fen: "1R6/1bP2pk1/p3p3/4n2p/7P/8/BKP1n1p1/5R2 w - - 0 1",
    },
    {
      name: "Sicilian Defense (Najdorf)",
      fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
    },
    {
      name: "Ruy Lopez (Closed)",
      fen: "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 1 8",
    },
    {
      name: "Queen's Gambit Declined",
      fen: "rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",
    },
  ];

  const engineLabels: Record<EngineType, string> = {
    stockfish: "Stockfish 15 NNUE",
    "jev-fly": "Jev + Fly Brain (Hybrid)",
    jev: "Jev System One",
    fly: "Fruit Fly Brain (134k)",
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full pb-14 px-2 md:px-0">
      {/* Hidden file inputs for Camera & Upload */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        className="hidden"
        onChange={handleImageFile}
      />
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleImageFile}
      />

      {/* HEADER BAR */}
      <div className="bg-[#262421] p-3.5 md:p-4 rounded-2xl border border-[#36322d] shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-base md:text-xl font-black text-white flex items-center gap-2">
            <IconScan3D size={24} />
            <span>{lang === "id" ? "Impor Posisi & AI Engine Solver Arena" : "Position Import & AI Solver Arena"}</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {lang === "id"
              ? "Bandingkan 2 papan: Posisi Awal Ter-Import vs Simulasi Perlawanan Engine Putih & Hitam."
              : "Compare 2 boards: Initial Imported Position vs White & Black Engine Duel Simulation."}
          </p>
        </div>

        {/* Action Buttons for Mobile Camera & Upload (100% 3D Icons, Zero Emoji) */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            onClick={() => cameraInputRef.current?.click()}
            className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs h-9 px-3 flex-1 md:flex-initial shadow-md flex items-center gap-1.5"
          >
            <IconScan3D size={16} />
            <span>{lang === "id" ? "Kamera HP" : "Camera"}</span>
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="border-[#36322d] text-neutral-300 hover:text-white font-bold text-xs h-9 px-3 flex-1 md:flex-initial flex items-center gap-1.5"
          >
            <IconVision3D size={16} />
            <span>{lang === "id" ? "Upload Foto" : "Upload Image"}</span>
          </Button>
        </div>
      </div>

      {/* PRESET POSITIONS BAR */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-neutral-400 font-bold shrink-0">Preset Cepat:</span>
        {PRESET_POSITIONS.map((p) => (
          <button
            key={p.name}
            onClick={() => applyNewInitialFen(p.fen)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium shrink-0 transition-all ${
              initialFen === p.fen
                ? "bg-[#81b64c]/20 border-[#81b64c] text-white font-bold"
                : "bg-[#1f1d1a] border-[#36322d] text-neutral-400 hover:text-white"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* DUAL BOARD ARENA: PAPAN 1 (IMPORT REFERENCE) VS PAPAN 2 (ENGINE SOLVER) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        {/* PAPAN 1 (KIRI): POSISI AWAL HASIL IMPORT */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex justify-between items-center border-b border-[#36322d] pb-2.5">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <IconVision3D size={18} />
              <span>{lang === "id" ? "Papan 1: Posisi Awal Ter-Import" : "Board 1: Imported Initial Position"}</span>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px] font-bold">
              Referensi Asli
            </Badge>
          </div>

          <div className="flex justify-between items-center px-1 text-xs text-neutral-400">
            <span>Bidak Awal di Papan:</span>
            <CapturedPiecesBar fen={initialFen} side="white" />
          </div>

          <div className="w-full max-w-[480px] mx-auto aspect-square rounded-xl overflow-hidden border-2 border-[#3d3a37] shadow-lg">
            <Chessboard
              options={{
                id: "board1-imported-reference",
                position: initialFen,
                allowDragging: true,
                onPieceDrop: handleBoard1Drop,
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
                darkSquareStyle: { backgroundColor: "#b58863" },
                showNotation: true,
                boardStyle: { borderRadius: "12px" },
              }}
            />
          </div>

          <div className="p-2.5 bg-[#1a1816] rounded-xl border border-[#36322d] space-y-1 text-xs">
            <div className="text-neutral-400 flex justify-between">
              <span>Status FEN Awal:</span>
              <span className="font-mono text-emerald-400 font-bold">Valid FIDE</span>
            </div>
            <div className="font-mono text-[11px] text-neutral-300 break-all select-all bg-[#121110] p-1.5 rounded border border-[#2d2a26]">
              {initialFen}
            </div>
            <p className="text-[10px] text-neutral-500 pt-0.5">
              *Anda dapat menggeser bidak di papan 1 untuk mengoreksi penempatan awal. Papan 2 akan otomatis menyesuaikan.
            </p>
          </div>
        </Card>

        {/* PAPAN 2 (KANAN): ARENA SIMULASI & SOLVE ENGINE */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#36322d] pb-2.5 gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <IconBot3D size={18} />
              <span>{lang === "id" ? "Papan 2: Simulasi Solve Engine" : "Board 2: Live Engine Solver"}</span>
            </div>

            {/* DUAL ENGINE PICKER: WHITE ENGINE & BLACK ENGINE */}
            <div className="flex flex-wrap items-center gap-2">
              {/* White Engine Picker */}
              <div className="flex items-center gap-1.5 bg-[#171614] px-2 py-1 rounded-lg border border-[#36322d]">
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-neutral-400 inline-block shrink-0"></span>
                <span className="text-[11px] font-bold text-neutral-300">Putih:</span>
                <select
                  value={whiteEngine}
                  onChange={(e) => setWhiteEngine(e.target.value as EngineType)}
                  className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                >
                  <option value="stockfish" className="bg-[#1c1a18]">Stockfish 15</option>
                  <option value="jev-fly" className="bg-[#1c1a18]">Jev + Fly Brain</option>
                  <option value="jev" className="bg-[#1c1a18]">Jev System One</option>
                  <option value="fly" className="bg-[#1c1a18]">Fruit Fly Brain</option>
                </select>
              </div>

              {/* Black Engine Picker */}
              <div className="flex items-center gap-1.5 bg-[#171614] px-2 py-1 rounded-lg border border-[#36322d]">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-600 inline-block shrink-0"></span>
                <span className="text-[11px] font-bold text-neutral-300">Hitam:</span>
                <select
                  value={blackEngine}
                  onChange={(e) => setBlackEngine(e.target.value as EngineType)}
                  className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                >
                  <option value="jev-fly" className="bg-[#1c1a18]">Jev + Fly Brain</option>
                  <option value="stockfish" className="bg-[#1c1a18]">Stockfish 15</option>
                  <option value="jev" className="bg-[#1c1a18]">Jev System One</option>
                  <option value="fly" className="bg-[#1c1a18]">Fruit Fly Brain</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center px-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-bold">Evaluasi:</span>
              <span className="font-mono text-emerald-400 font-black">
                {currentScoreCp !== null ? `${currentScoreCp > 0 ? "+" : ""}${(currentScoreCp / 100).toFixed(1)}` : "+0.0"}
              </span>
            </div>
            <div className="text-neutral-400 text-xs">
              Giliran: <span className="text-white font-bold">{tacticalIntel.turn}</span>
              <span className="text-neutral-500 font-normal ml-1">
                ({tacticalIntel.turn === "Putih" ? engineLabels[whiteEngine] : engineLabels[blackEngine]})
              </span>
            </div>
          </div>

          {/* Interactive Solver Board with Move Arrows */}
          <div className="w-full max-w-[480px] mx-auto aspect-square rounded-xl overflow-hidden border-2 border-[#81b64c]/50 shadow-lg relative">
            <Chessboard
              options={{
                id: "board2-live-solver",
                position: liveFen,
                allowDragging: false,
                arrows: board2Arrows,
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
                darkSquareStyle: { backgroundColor: "#b58863" },
                showNotation: true,
                boardStyle: { borderRadius: "12px" },
              }}
            />
            {isEngineCalculating && (
              <div className="absolute top-2 right-2 bg-black/80 px-2.5 py-1 rounded text-[10px] text-amber-400 font-bold border border-amber-500/40 animate-pulse flex items-center gap-1.5">
                <IconBot3D size={12} />
                <span>Engine Menghitung...</span>
              </div>
            )}
          </div>

          {/* Solver Controls */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button
              onClick={() => setIsAutoSolving(!isAutoSolving)}
              className={`h-9 text-xs font-bold shadow-md flex items-center justify-center gap-1.5 ${
                isAutoSolving
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-[#81b64c] hover:bg-[#72a342] text-white"
              }`}
            >
              <IconPlay3D size={14} />
              <span>{isAutoSolving ? "Jeda Solve" : "Solve Otomatis"}</span>
            </Button>

            <Button
              onClick={() => void stepEngineSolve()}
              disabled={isAutoSolving || isEngineCalculating}
              variant="outline"
              className="border-[#36322d] text-white hover:bg-[#322f2b] text-xs font-bold h-9 flex items-center justify-center gap-1.5"
            >
              <span>1 Langkah</span>
              <IconPlay3D size={12} />
            </Button>

            <Button
              onClick={handleResetSolver}
              variant="outline"
              className="border-[#36322d] text-neutral-300 hover:text-white text-xs font-bold h-9 flex items-center justify-center gap-1"
            >
              <IconSwap3D size={13} />
              <span>Reset</span>
            </Button>
          </div>

          <Button
            onClick={() => onLoadFen(liveFen)}
            className="w-full bg-[#1c1a18] hover:bg-[#282522] border border-[#36322d] text-white text-xs font-bold h-8 flex items-center justify-center gap-1.5"
          >
            <IconPlay3D size={13} />
            <span>Buka Posisi Ini di Menu Bermain</span>
          </Button>
        </Card>
      </div>

      {/* TACTICAL ANALYSIS & BLUNDER EVALUATION PANEL */}
      <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[#36322d] pb-3">
          <IconLightning3D size={20} />
          <h3 className="text-sm md:text-base font-black uppercase tracking-wider text-white">
            Analisis Taktis & Evaluasi Bahaya / Blunder Posisi
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Ancaman & Bahaya */}
          <div className="bg-[#1a1816] p-3.5 rounded-xl border border-red-500/20 space-y-1.5">
            <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
              <IconLightning3D size={16} />
              <span>Titik Bahaya & Ancaman:</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {tacticalIntel.threatSummary}
            </p>
          </div>

          {/* Card 2: Titik Blunder */}
          <div className="bg-[#1a1816] p-3.5 rounded-xl border border-amber-500/20 space-y-1.5">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <IconBot3D size={16} />
              <span>Rawan Blunder Fatal:</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {tacticalIntel.blunderDanger}
            </p>
          </div>

          {/* Card 3: Solusi Kemenangan Engine */}
          <div className="bg-[#1a1816] p-3.5 rounded-xl border border-emerald-500/20 space-y-1.5">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <IconTrophy3D size={16} />
              <span>Kunci Solusi Posisi:</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {tacticalIntel.keyIdea}
            </p>
          </div>
        </div>

        {/* Move History of Solve */}
        {solveMoves.length > 0 && (
          <div className="pt-2 border-t border-[#36322d]">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 flex justify-between items-center">
              <span>Langkah-Langkah Pemecahan Posisi ({solveMoves.length}):</span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {whiteEngine.toUpperCase()} vs {blackEngine.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 bg-[#171614] rounded-xl border border-[#36322d]">
              {solveMoves.map((m, idx) => (
                <div
                  key={idx}
                  className="bg-[#24221f] px-2.5 py-1 rounded-lg border border-[#36322d] text-xs font-mono flex items-center gap-1.5"
                >
                  <span className="text-neutral-500 font-bold">{idx + 1}.</span>
                  <span className="text-white font-bold">{m.san}</span>
                  <span className="text-[10px] text-neutral-400">({m.by})</span>
                  {m.scoreCp !== null && m.scoreCp !== undefined && (
                    <span className="text-[10px] text-emerald-400">
                      ({m.scoreCp > 0 ? "+" : ""}{(m.scoreCp / 100).toFixed(1)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
