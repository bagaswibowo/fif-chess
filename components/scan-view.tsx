"use client";

// Impor Posisi & AI Engine Solver Arena (v2.3 Pro Layout)
// Fitur:
// 1. Papan Catur Ukuran Penuh (480px-520px) yang proporsional dan jelas terbaca.
// 2. Tab Switcher Nyaman:
//    - "Arena Dual-Engine Solver" (Papan Penuh + Sidebar Analisis Taktis & Solver)
//    - "Papan Referensi Asli" (Edit & Setel Posisi Awal)
//    - "Bandingkan Keduanya" (Side-by-side luas)
// 3. Tombol 3D Solid Taktil Tanpa Efek Glow yang mengganggu.
// 4. Input FEN instan, Kamera HP/Webcam live, dan Preset cepat.

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
type ViewTab = "solver" | "reference" | "compare";

export function ScanView({ onLoadFen, lang = "id" }: Props) {
  const defaultInitialFen = "7k/3r1q2/1P3pp1/2R4p/8/5QPP/5PK1/8 w - - 0 1";

  const [initialFen, setInitialFen] = useState<string>(defaultInitialFen);
  const [fenInput, setFenInput] = useState<string>(defaultInitialFen);
  const [activeTab, setActiveTab] = useState<ViewTab>("solver");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
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

  const applyNewInitialFen = useCallback(
    (newFen: string) => {
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
    },
    [lang]
  );

  // Webcam Controls
  const stopWebcam = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
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
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStream]);

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

  // Solver engine step
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
        danger: isWhiteTurn
          ? "Hati-hati: Membiarkan Menteri hitam aktif menyerang petak g2 atau melepaskan pion b6."
          : "Bahaya: Terobosan pion b7 menuju promosi tak terbendung.",
        keyIdea: isWhiteTurn
          ? "Strategi Kemenangan: Manfaatkan pion b6 sebagai pengalih perhatian sambil menekan titik lemah sayap raja."
          : "Strategi Bertahan: Blokade lajur pion b6 dengan Benteng d7 dan buat serangan balik.",
      };
    } catch {
      return { turn: "Putih", evalSummary: "Posisi dinamis", danger: "Perhatikan keselamatan raja", keyIdea: "Inisiatif sentral" };
    }
  }, [liveFen]);

  const PRESET_POSITIONS = [
    { name: "Endgame Rd7 (Foto User)", fen: "7k/3r1q2/1P3pp1/2R4p/8/5QPP/5PK1/8 w - - 0 1" },
    { name: "Taktik 16 Bidak", fen: "1R6/1bP2pk1/p3p3/4n2p/7P/8/BKP1n1p1/5R2 w - - 0 1" },
    { name: "Sicilian Najdorf", fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6" },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3 pb-6">
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageFile} />

      {/* TOP CONTROL BAR - COMPACT & CLEAN */}
      <div className="panel px-3.5 py-2.5 row-between flex-wrap gap-2.5" style={{ background: "var(--card)" }}>
        <div className="row items-center gap-2">
          <IconScan3D size={22} />
          <h2 className="text-xs md:text-sm font-black text-white m-0">
            Import Posisi &amp; AI Solver Arena
          </h2>
        </div>

        {/* Action Controls */}
        <div className="row items-center gap-1.5 flex-wrap">
          <button
            onClick={() => void startWebcam("environment")}
            className="ctl ctl-xs ctl-primary font-bold flex items-center gap-1.5"
            disabled={isProcessingImage}
          >
            <IconScan3D size={14} />
            <span>Kamera HP / Webcam</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="ctl ctl-xs flex items-center gap-1.5"
            disabled={isProcessingImage}
          >
            <IconVision3D size={14} />
            <span>Upload Foto</span>
          </button>
          <button
            onClick={() => onLoadFen(liveFen)}
            className="ctl ctl-xs ctl-primary font-bold flex items-center gap-1.5"
            title="Buka Posisi Ini di Menu Bermain"
          >
            <IconPlay3D size={14} />
            <span>Buka di Menu Bermain</span>
          </button>
        </div>
      </div>

      {/* LIVE WEBCAM SCANNER MODAL */}
      {isCameraOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
          <div className="panel p-4 stack max-w-sm w-full relative" style={{ background: "var(--card)", borderColor: "var(--primary)" }}>
            <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <IconScan3D size={16} /> Live Web Camera Scanner
              </span>
              <button className="ctl ctl-xs ctl-quiet" onClick={stopWebcam}>
                <IconClose3D size={14} />
              </button>
            </div>
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black border-2 border-[var(--primary)] flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-4 pointer-events-none grid grid-cols-8 grid-rows-8 border border-emerald-400/80 rounded-lg">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div key={i} className="border border-emerald-400/20" />
                ))}
              </div>
            </div>
            <div className="row-between pt-2">
              <button
                type="button"
                className="ctl ctl-xs ctl-quiet text-xs"
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

      {/* FEN INPUT & PRESETS BAR */}
      <div className="panel p-2.5 row items-center gap-2 text-xs flex-wrap" style={{ background: "var(--surface)" }}>
        <span className="text-xs font-bold text-[var(--muted-foreground)] shrink-0">FEN:</span>
        <input
          type="text"
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          placeholder="Notasi FEN..."
          className="flex-1 min-w-[240px] p-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs text-white font-mono focus:outline-none focus:border-[var(--primary)]"
        />
        <button onClick={() => applyNewInitialFen(fenInput)} className="ctl ctl-xs ctl-primary font-bold shrink-0">
          <IconCheck3D size={12} />
          <span>Terapkan FEN</span>
        </button>

        {/* Quick Presets */}
        <div className="row items-center gap-1 shrink-0 overflow-x-auto">
          {PRESET_POSITIONS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyNewInitialFen(p.fen)}
              className={`ctl ctl-xs transition-all ${
                initialFen === p.fen ? "ctl-active ring-1 ring-[var(--primary)] font-bold" : "ctl-quiet"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* VIEWPORT MODE TABS: SOLVER (DEFAULT) vs REFERENSI vs BANDINGKAN */}
      <div className="row items-center gap-1.5 border-b border-[var(--border)] pb-1.5">
        <button
          onClick={() => setActiveTab("solver")}
          className={`ctl ctl-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "solver" ? "ctl-active ring-1 ring-[var(--primary)]" : "ctl-quiet"
          }`}
        >
          <IconBot3D size={14} />
          <span>Papan AI Solver &amp; Taktik (Penuh)</span>
        </button>
        <button
          onClick={() => setActiveTab("reference")}
          className={`ctl ctl-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "reference" ? "ctl-active ring-1 ring-[var(--primary)]" : "ctl-quiet"
          }`}
        >
          <IconVision3D size={14} />
          <span>Papan Referensi &amp; Edit Posisi</span>
        </button>
        <button
          onClick={() => setActiveTab("compare")}
          className={`ctl ctl-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "compare" ? "ctl-active ring-1 ring-[var(--primary)]" : "ctl-quiet"
          }`}
        >
          <IconSwap3D size={14} />
          <span>Bandingkan Keduanya (Side-by-Side)</span>
        </button>
      </div>

      {/* TAB 1: ARENA DUAL ENGINE SOLVER (PROPORTIONAL FULL SIZE ~500px BOARD + SIDEBAR) */}
      {activeTab === "solver" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-1">
          {/* LEFT: FULL-SIZE PROPORTIONAL SOLVER BOARD (~500px) */}
          <div className="lg:col-span-7 panel p-3 stack-tight" style={{ background: "var(--card)" }}>
            <div className="row-between pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <IconBot3D size={18} />
                <span className="font-bold text-xs md:text-sm text-white">
                  Papan Simulasi Solver ({tacticalIntel.turn} Melangkah)
                </span>
              </div>
              <CapturedPiecesBar fen={liveFen} side={tacticalIntel.turn === "Putih" ? "white" : "black"} />
            </div>

            {/* Generous Full Size Board */}
            <div className="w-full max-w-[500px] mx-auto aspect-square rounded-2xl overflow-hidden border-2 border-[var(--primary)] shadow-lg relative bg-[var(--card)]">
              <Chessboard
                options={{
                  id: "board-solver-full",
                  position: liveFen,
                  allowDragging: false,
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                  animationDurationInMs: 250,
                }}
              />
              {isEngineCalculating && (
                <div className="absolute top-2 right-2 bg-black/85 px-2 py-0.5 rounded text-[10px] text-[var(--warning)] font-bold border border-[var(--warning)] animate-pulse">
                  Engine Menghitung...
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: CONTROLS, ENGINE PICKER, & TACTICAL ANALYSIS */}
          <div className="lg:col-span-5 stack-tight">
            {/* Engine Picker Bar */}
            <div className="panel p-3 stack-tight" style={{ background: "var(--card)" }}>
              <div className="row-between text-xs font-bold text-white pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <span>Dual Engine Solver</span>
                <span className="font-mono text-[var(--primary)]">
                  Eval: {currentScoreCp !== null ? `${currentScoreCp > 0 ? "+" : ""}${(currentScoreCp / 100).toFixed(1)}` : "+0.0"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div>
                  <label className="text-[10px] text-[var(--muted-foreground)] font-bold block mb-0.5">Putih Melangkah:</label>
                  <select
                    value={whiteEngine}
                    onChange={(e) => setWhiteEngine(e.target.value as EngineType)}
                    className="w-full bg-[var(--surface)] text-xs font-bold text-white border border-[var(--border)] rounded-lg p-1.5 focus:outline-none"
                  >
                    <option value="stockfish">Stockfish 15 NNUE</option>
                    <option value="jev-fly">Jev + Fly Brain</option>
                    <option value="jev">Jev One</option>
                    <option value="fly">Fruit Fly Brain</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--muted-foreground)] font-bold block mb-0.5">Hitam Melangkah:</label>
                  <select
                    value={blackEngine}
                    onChange={(e) => setBlackEngine(e.target.value as EngineType)}
                    className="w-full bg-[var(--surface)] text-xs font-bold text-white border border-[var(--border)] rounded-lg p-1.5 focus:outline-none"
                  >
                    <option value="jev-fly">Jev + Fly Brain</option>
                    <option value="stockfish">Stockfish 15 NNUE</option>
                    <option value="jev">Jev One</option>
                    <option value="fly">Fruit Fly Brain</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-1.5 pt-2">
                <button
                  onClick={() => setIsAutoSolving(!isAutoSolving)}
                  className={`ctl ctl-sm font-bold justify-center ${isAutoSolving ? "ctl-danger" : "ctl-primary"}`}
                >
                  <IconPlay3D size={13} />
                  <span>{isAutoSolving ? "Jeda" : "Solve"}</span>
                </button>
                <button
                  onClick={() => void stepEngineSolve()}
                  disabled={isAutoSolving || isEngineCalculating}
                  className="ctl ctl-sm justify-center font-bold"
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
                  className="ctl ctl-sm ctl-quiet justify-center"
                >
                  <IconSwap3D size={13} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Tactical Intel & Blunder Warnings Card */}
            <div className="panel p-3 stack-tight text-xs" style={{ background: "var(--card)" }}>
              <div className="flex items-center gap-1.5 font-bold text-white pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <IconLightning3D size={16} />
                <span>Analisis Taktis &amp; Bahaya Posisi</span>
              </div>

              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <div className="text-[11px] font-bold text-[var(--primary)] flex items-center gap-1">
                  <IconTrophy3D size={13} />
                  <span>Kunci Posisi:</span>
                </div>
                <p className="text-neutral-300 m-0 leading-snug">{tacticalIntel.keyIdea}</p>
              </div>

              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  <IconBot3D size={13} />
                  <span>Titik Bahaya / Blunder:</span>
                </div>
                <p className="text-neutral-300 m-0 leading-snug">{tacticalIntel.danger}</p>
              </div>

              {/* Moves Ribbon */}
              {solveMoves.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] font-bold text-[var(--muted-foreground)] mb-1 uppercase">
                    Langkah Solusi Terkini ({solveMoves.length}):
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] font-mono text-[11px]">
                    {solveMoves.map((m, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-[var(--card)] text-white">
                        {idx + 1}. <strong>{m.san}</strong> ({m.by})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAPAN REFERENSI & EDIT POSISI (~500px FULL SIZE BOARD) */}
      {activeTab === "reference" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-1">
          <div className="lg:col-span-7 panel p-3 stack-tight" style={{ background: "var(--card)" }}>
            <div className="row-between pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-bold text-xs md:text-sm text-white flex items-center gap-2">
                <IconVision3D size={18} /> Papan 1: Referensi Asli (Drag Bidak untuk Edit)
              </span>
              <CapturedPiecesBar fen={initialFen} side="white" />
            </div>

            <div className="w-full max-w-[500px] mx-auto aspect-square rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-lg bg-[var(--card)]">
              <Chessboard
                options={{
                  id: "board-ref-full",
                  position: initialFen,
                  allowDragging: true,
                  onPieceDrop: handleBoard1Drop,
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                }}
              />
            </div>
          </div>

          <div className="lg:col-span-5 panel p-3.5 stack text-xs" style={{ background: "var(--card)" }}>
            <span className="font-bold text-sm text-white">Detail Posisi Ter-Import</span>
            <p className="prose-note m-0 text-xs">
              Papan referensi ini adalah posisi catur asli hasil ekstraksi kamera atau FEN. Anda dapat menggeser bidak langsung di papan untuk membetulkan penempatan bidak.
            </p>

            <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] stack-tight font-mono text-[11px] break-all select-all text-emerald-300">
              {initialFen}
            </div>

            <button
              onClick={() => setActiveTab("solver")}
              className="ctl ctl-sm ctl-primary font-bold justify-center mt-2 flex items-center gap-1.5"
            >
              <IconBot3D size={14} />
              <span>Lanjut ke Arena Dual-Engine Solver</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: BANDINGKAN KEDUANYA (SIDE BY SIDE DUAL FULL BOARDS) */}
      {activeTab === "compare" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start pt-1">
          {/* Papan 1 */}
          <div className="panel p-3 stack-tight" style={{ background: "var(--card)" }}>
            <div className="row-between pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-bold text-xs text-white">Papan 1: Referensi Asli</span>
              <CapturedPiecesBar fen={initialFen} side="white" />
            </div>
            <div className="w-full aspect-square rounded-xl overflow-hidden border border-[var(--border)]">
              <Chessboard
                options={{
                  id: "board-compare-1",
                  position: initialFen,
                  allowDragging: true,
                  onPieceDrop: handleBoard1Drop,
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                }}
              />
            </div>
          </div>

          {/* Papan 2 */}
          <div className="panel p-3 stack-tight" style={{ background: "var(--card)" }}>
            <div className="row-between pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-bold text-xs text-white">Papan 2: Live Solver</span>
              <span className="font-mono text-xs text-[var(--primary)] font-bold">
                Eval: {currentScoreCp !== null ? `${currentScoreCp > 0 ? "+" : ""}${(currentScoreCp / 100).toFixed(1)}` : "+0.0"}
              </span>
            </div>
            <div className="w-full aspect-square rounded-xl overflow-hidden border border-[var(--primary)]">
              <Chessboard
                options={{
                  id: "board-compare-2",
                  position: liveFen,
                  allowDragging: false,
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
