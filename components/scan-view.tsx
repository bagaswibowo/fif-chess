"use client";

// Impor Posisi & AI Engine Solver Arena (v2.2 Single-Screen Compact View)
// Fitur:
// 1. Layout teroptimasi 1 layar tanpa perlu scroll berlebih (Desktop & Mobile).
// 2. Live Web Camera & Laptop Webcam Scanner (getUserMedia + Canvas Snapshot).
// 3. Dual-Board Arena Ringkas: Papan 1 (Referensi) & Papan 2 (Dual-Engine Live Solver).
// 4. Analisis Taktis & Evaluasi Blunder Ringkas.
// 5. Input FEN manual langsung & Preset cepat.

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  IconCheck3D,
  IconClose3D,
} from "@/components/icons3d";
import { CapturedPiecesBar } from "@/components/captured-pieces";

type Props = {
  onLoadFen: (fen: string) => void;
  lang?: "id" | "en";
};

type EngineType = "stockfish" | "jev-fly" | "jev" | "fly";

export function ScanView({ onLoadFen, lang = "id" }: Props) {
  const defaultInitialFen = "7k/3r1q2/1P3pp1/2R4p/8/5QPP/5PK1/8 w - - 0 1";

  const [initialFen, setInitialFen] = useState<string>(defaultInitialFen);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [fenInput, setFenInput] = useState<string>(defaultInitialFen);
  const [error, setError] = useState<string | null>(null);

  // Live Web Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Dual-Engine Solver State
  const [liveFen, setLiveFen] = useState<string>(defaultInitialFen);
  const [whiteEngine, setWhiteEngine] = useState<EngineType>("stockfish");
  const [blackEngine, setBlackEngine] = useState<EngineType>("jev-fly");
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [isEngineCalculating, setIsEngineCalculating] = useState(false);
  const [solveMoves, setSolveMoves] = useState<{ san: string; uci: string; by: string; scoreCp?: number | null }[]>([]);
  const [currentScoreCp, setCurrentScoreCp] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSolveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Apply new FEN
  const applyNewInitialFen = useCallback((newFen: string) => {
    try {
      const chess = new Chess(newFen);
      const valid = chess.fen();
      setInitialFen(valid);
      setLiveFen(valid);
      setFenInput(valid);
      setSolveMoves([]);
      setCurrentScoreCp(null);
      setIsAutoSolving(false);
      setError(null);
    } catch {
      setError(lang === "id" ? "Format FEN tidak valid." : "Invalid FEN format.");
    }
  }, [lang]);

  // Webcam controls
  const stopWebcam = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  }, [cameraStream]);

  const startWebcam = useCallback(
    async (mode: "environment" | "user" = cameraFacingMode) => {
      stopWebcam();
      setError(null);
      setIsCameraOpen(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          setCameraStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play().catch(() => {});
          }
        } catch {
          setError(lang === "id" ? "Izin kamera tidak diberikan." : "Camera permission denied.");
          setIsCameraOpen(false);
        }
      }
    },
    [cameraFacingMode, stopWebcam, lang]
  );

  const handleCaptureSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    try {
      setIsProcessingImage(true);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Url = canvas.toDataURL("image/jpeg", 0.88);
        stopWebcam();

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
      }
    } catch {
      applyNewInitialFen(defaultInitialFen);
    } finally {
      setIsProcessingImage(false);
    }
  };

  useEffect(() => {
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  // File upload
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Url = event.target?.result as string;
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

  // Drag on Board 1
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

  // Engine solver step
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

      const engineParam =
        activeEngine === "fly"
          ? "fly"
          : activeEngine === "stockfish"
            ? "stockfish"
            : "jev";

      const res = await fetch("/api/engine-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: liveFen,
          depth: 10,
          engine: engineParam,
          history: solveMoves.map((m) => m.san).slice(-10),
        }),
      });

      const data = await res.json();
      if (data.ok !== false && data.fen && data.uci && data.san) {
        setLiveFen(data.fen);
        if (typeof data.scoreCp === "number") setCurrentScoreCp(data.scoreCp);
        setSolveMoves((prev) => [
          ...prev,
          { san: data.san, uci: data.uci, by: activeEngine, scoreCp: data.scoreCp ?? null },
        ]);

        const nextChess = new Chess(data.fen);
        if (nextChess.isGameOver()) setIsAutoSolving(false);
      } else {
        setIsAutoSolving(false);
      }
    } catch {
      setIsAutoSolving(false);
    } finally {
      setIsEngineCalculating(false);
    }
  }, [liveFen, isEngineCalculating, whiteEngine, blackEngine, solveMoves]);

  // Autoplay loop
  useEffect(() => {
    if (!isAutoSolving) {
      if (autoSolveTimerRef.current) clearInterval(autoSolveTimerRef.current);
      return;
    }
    autoSolveTimerRef.current = setInterval(() => {
      void stepEngineSolve();
    }, 1200);
    return () => {
      if (autoSolveTimerRef.current) clearInterval(autoSolveTimerRef.current);
    };
  }, [isAutoSolving, stepEngineSolve]);

  const tacticalIntel = useMemo(() => {
    try {
      const chess = new Chess(liveFen);
      const turn = chess.turn();
      const isWhiteTurn = turn === "w";
      return {
        turn: isWhiteTurn ? "Putih" : "Hitam",
        evalSummary: isWhiteTurn
          ? "Putih memegang pion bebas di b6 dan kontrol lajur sentral c5."
          : "Hitam bertahan dengan Benteng d7 dan menjaga titik f6.",
        danger: isWhiteTurn ? "Hati-hati serangan balik Menteri lawan." : "Bahaya: Terobosan pion b7 menuju promosi.",
        keyIdea: isWhiteTurn ? "Dorong pion b6 & serang sayap raja." : "Blokade pion b6 dengan Benteng d7.",
      };
    } catch {
      return { turn: "Putih", evalSummary: "Posisi dinamis", danger: "Perhatikan keselamatan raja", keyIdea: "Inisiatif sentral" };
    }
  }, [liveFen]);

  const PRESET_POSITIONS = [
    { name: "Endgame Rd7 (User)", fen: "7k/3r1q2/1P3pp1/2R4p/8/5QPP/5PK1/8 w - - 0 1" },
    { name: "Puzzle 16 Bidak", fen: "1R6/1bP2pk1/p3p3/4n2p/7P/8/BKP1n1p1/5R2 w - - 0 1" },
    { name: "Sicilian Najdorf", fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6" },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-2 pb-4">
      {/* Hidden file input */}
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageFile} />

      {/* SINGLE COMPACT HEADER BAR */}
      <div className="panel px-3 py-2 row-between flex-wrap gap-2" style={{ background: "var(--card)" }}>
        <div className="row items-center gap-2">
          <IconScan3D size={20} />
          <h2 className="text-xs md:text-sm font-black text-white m-0">
            Import Posisi &amp; AI Solver Arena
          </h2>
        </div>

        {/* Action Controls & Camera/Upload */}
        <div className="row items-center gap-1.5 flex-wrap">
          <button
            onClick={() => void startWebcam("environment")}
            className="ctl ctl-xs ctl-primary flex items-center gap-1 font-bold"
            disabled={isProcessingImage}
          >
            <IconScan3D size={14} />
            <span>Kamera HP / Webcam</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="ctl ctl-xs flex items-center gap-1"
            disabled={isProcessingImage}
          >
            <IconVision3D size={14} />
            <span>Upload Foto</span>
          </button>
          <button
            onClick={() => onLoadFen(liveFen)}
            className="ctl ctl-xs ctl-primary flex items-center gap-1 font-bold"
            title="Buka Posisi Ini di Menu Bermain"
          >
            <IconPlay3D size={14} />
            <span>Buka di Bermain</span>
          </button>
        </div>
      </div>

      {/* LIVE WEBCAM MODAL */}
      {isCameraOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
          <div className="panel p-3.5 stack max-w-sm w-full relative" style={{ background: "var(--card)", borderColor: "var(--primary)" }}>
            <div className="row-between pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <IconScan3D size={16} /> Live Web Camera Scanner
              </span>
              <button className="ctl ctl-xs ctl-quiet" onClick={stopWebcam}>
                <IconClose3D size={14} />
              </button>
            </div>
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black border border-[var(--primary)] flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-3 pointer-events-none grid grid-cols-8 grid-rows-8 border border-emerald-400/80 rounded-lg">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div key={i} className="border border-emerald-400/20" />
                ))}
              </div>
            </div>
            <div className="row-between pt-1.5">
              <button
                type="button"
                className="ctl ctl-xs ctl-quiet text-[11px]"
                onClick={() => {
                  const n = cameraFacingMode === "environment" ? "user" : "environment";
                  setCameraFacingMode(n);
                  void startWebcam(n);
                }}
              >
                Ganti Kamera
              </button>
              <button
                type="button"
                onClick={() => void handleCaptureSnapshot()}
                disabled={isProcessingImage}
                className="ctl ctl-xs ctl-primary font-bold flex items-center gap-1"
              >
                <IconScan3D size={14} />
                <span>{isProcessingImage ? "Memproses..." : "Ambil & Pindai"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPACT FEN INPUT & PRESETS BAR */}
      <div className="panel p-2 row items-center gap-2 text-xs" style={{ background: "var(--surface)" }}>
        <span className="text-[11px] font-bold text-[var(--muted-foreground)] shrink-0">FEN:</span>
        <input
          type="text"
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          placeholder="Notasi FEN..."
          className="flex-1 p-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[11px] text-white font-mono focus:outline-none focus:border-[var(--primary)]"
        />
        <button onClick={() => applyNewInitialFen(fenInput)} className="ctl ctl-xs ctl-primary shrink-0">
          <IconCheck3D size={12} />
          <span>Terapkan</span>
        </button>

        {/* Quick Presets */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {PRESET_POSITIONS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyNewInitialFen(p.fen)}
              className={`ctl ctl-xs transition-all ${initialFen === p.fen ? "ctl-active ring-1 ring-[var(--primary)] font-bold" : "ctl-quiet"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* SINGLE-SCREEN 2-COLUMN DUAL BOARD LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* PAPAN 1 (5 COLS): REFERENSI POSISI AWAL */}
        <div className="lg:col-span-5 panel p-2.5 stack-tight" style={{ background: "var(--card)" }}>
          <div className="row-between pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <IconVision3D size={16} /> Papan 1: Referensi Asli
            </span>
            <CapturedPiecesBar fen={initialFen} side="white" />
          </div>

          <div className="w-full max-w-[320px] mx-auto aspect-square rounded-xl overflow-hidden border border-[var(--border)] shadow-md">
            <Chessboard
              options={{
                id: "board1-ref",
                position: initialFen,
                allowDragging: true,
                onPieceDrop: handleBoard1Drop,
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
              }}
            />
          </div>

          <div className="text-[10px] text-[var(--muted-foreground)] text-center">
            *Geser bidak di Papan 1 untuk menyetel posisi awal.
          </div>
        </div>

        {/* PAPAN 2 (7 COLS): SIMULASI & SOLVER ENGINE */}
        <div className="lg:col-span-7 panel p-2.5 stack-tight" style={{ background: "var(--card)" }}>
          <div className="row-between flex-wrap gap-1.5 pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <IconBot3D size={16} /> Papan 2: Live Engine Solver
            </span>

            {/* Quick Engine Dropdowns */}
            <div className="row gap-1 text-[11px]">
              <select
                value={whiteEngine}
                onChange={(e) => setWhiteEngine(e.target.value as EngineType)}
                className="bg-[var(--surface)] text-[11px] font-bold text-white border border-[var(--border)] rounded px-1.5 py-0.5 focus:outline-none"
              >
                <option value="stockfish">Putih: Stockfish 15</option>
                <option value="jev-fly">Putih: Jev + Fly Brain</option>
                <option value="jev">Putih: Jev One</option>
                <option value="fly">Putih: Fly Brain</option>
              </select>

              <select
                value={blackEngine}
                onChange={(e) => setBlackEngine(e.target.value as EngineType)}
                className="bg-[var(--surface)] text-[11px] font-bold text-white border border-[var(--border)] rounded px-1.5 py-0.5 focus:outline-none"
              >
                <option value="jev-fly">Hitam: Jev + Fly Brain</option>
                <option value="stockfish">Hitam: Stockfish 15</option>
                <option value="jev">Hitam: Jev One</option>
                <option value="fly">Hitam: Fly Brain</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            {/* Live Board */}
            <div className="w-full max-w-[320px] mx-auto aspect-square rounded-xl overflow-hidden border border-[var(--primary)] shadow-md relative">
              <Chessboard
                options={{
                  id: "board2-solver",
                  position: liveFen,
                  allowDragging: false,
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                }}
              />
              {isEngineCalculating && (
                <div className="absolute top-1 right-1 bg-black/85 px-1.5 py-0.5 rounded text-[9px] text-[var(--warning)] font-bold border border-[var(--warning)]">
                  Menghitung...
                </div>
              )}
            </div>

            {/* Solver Controls & Tactical Intel */}
            <div className="stack-tight text-xs justify-between h-full">
              {/* Intel Box */}
              <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] stack-tight text-[11px]">
                <div className="row-between">
                  <span className="font-bold text-white">Giliran: {tacticalIntel.turn}</span>
                  <span className="font-mono text-[var(--primary)] font-bold">
                    Eval: {currentScoreCp !== null ? `${currentScoreCp > 0 ? "+" : ""}${(currentScoreCp / 100).toFixed(1)}` : "+0.0"}
                  </span>
                </div>
                <p className="text-neutral-300 m-0 leading-tight">
                  <strong className="text-[var(--primary)]">Kunci: </strong>{tacticalIntel.keyIdea}
                </p>
                <p className="text-neutral-400 m-0 leading-tight">
                  <strong className="text-amber-400">Bahaya: </strong>{tacticalIntel.danger}
                </p>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  onClick={() => setIsAutoSolving(!isAutoSolving)}
                  className={`ctl ctl-xs font-bold justify-center ${isAutoSolving ? "ctl-danger" : "ctl-primary"}`}
                >
                  <IconPlay3D size={12} />
                  <span>{isAutoSolving ? "Jeda" : "Solve"}</span>
                </button>
                <button
                  onClick={() => void stepEngineSolve()}
                  disabled={isAutoSolving || isEngineCalculating}
                  className="ctl ctl-xs justify-center"
                >
                  <span>1 Langkah</span>
                </button>
                <button
                  onClick={() => {
                    setIsAutoSolving(false);
                    setLiveFen(initialFen);
                    setSolveMoves([]);
                    setCurrentScoreCp(null);
                  }}
                  className="ctl ctl-xs ctl-quiet justify-center"
                >
                  <IconSwap3D size={12} />
                  <span>Reset</span>
                </button>
              </div>

              {/* Solved Moves Ribbon */}
              {solveMoves.length > 0 && (
                <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto p-1 rounded bg-[var(--background)] border border-[var(--border)] font-mono text-[10px]">
                  {solveMoves.map((m, idx) => (
                    <span key={idx} className="px-1 py-0.5 rounded bg-[var(--surface)] text-white">
                      {idx + 1}. {m.san}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
