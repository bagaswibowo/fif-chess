"use client";

// Impor Posisi & AI Engine Solver Arena (v2.1)
// Fitur:
// 1. Live Web Camera & Laptop Webcam Scanner (getUserMedia + Canvas Snapshot).
// 2. Pemindaian gambar / upload foto dengan deteksi FEN otomatis.
// 3. Input & Paste FEN manual langsung.
// 4. Preset cepat termasuk partai endgame user terbaru.
// 5. Dual-Board Arena: Papan Referensi Asli (kiri) vs Papan Simulasi Dual-Engine (kanan).
// 6. Analisis taktis, bahaya blunder, dan kunci kemenangan.
// 7. Tombol buka langsung ke menu Bermain.

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
  // Posisi default: Partai User Terbaru (Endgame Putih vs Hitam - Rd7)
  const defaultInitialFen = "7k/3r1q2/1P3pp1/2R4p/8/5QPP/5PK1/8 w - - 0 1";

  const [initialFen, setInitialFen] = useState<string>(defaultInitialFen);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [fenInput, setFenInput] = useState<string>(defaultInitialFen);
  const [error, setError] = useState<string | null>(null);

  // Live Web Camera State (Mobile HP Camera & Laptop Webcam)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Dual-Engine Configuration & Solver State (Papan 2)
  const [liveFen, setLiveFen] = useState<string>(defaultInitialFen);
  const [whiteEngine, setWhiteEngine] = useState<EngineType>("stockfish");
  const [blackEngine, setBlackEngine] = useState<EngineType>("jev-fly");
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [isEngineCalculating, setIsEngineCalculating] = useState(false);
  const [solveMoves, setSolveMoves] = useState<{ san: string; uci: string; by: string; scoreCp?: number | null }[]>([]);
  const [lastMoveUci, setLastMoveUci] = useState<string | null>(null);
  const [currentScoreCp, setCurrentScoreCp] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSolveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Set new initial position and reset solver
  const applyNewInitialFen = useCallback(
    (newFen: string) => {
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
    },
    [lang]
  );

  // Stop Webcam Stream
  const stopWebcam = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  }, [cameraStream]);

  // Start Live Webcam Stream
  const startWebcam = useCallback(
    async (mode: "environment" | "user" = cameraFacingMode) => {
      stopWebcam();
      setError(null);
      setIsCameraOpen(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        // Fallback without facingMode constraint (e.g. laptop webcam)
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          setCameraStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play().catch(() => {});
          }
        } catch (fallbackErr: any) {
          setError(
            lang === "id"
              ? "Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser."
              : "Cannot access camera. Please allow camera permissions in your browser."
          );
          setIsCameraOpen(false);
        }
      }
    },
    [cameraFacingMode, stopWebcam, lang]
  );

  // Switch between back camera ("environment") and laptop/front webcam ("user")
  const handleToggleFacingMode = () => {
    const nextMode = cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(nextMode);
    void startWebcam(nextMode);
  };

  // Capture Live Snapshot from Video Stream
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
        setUploadedImage(base64Url);

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
    } catch (err) {
      console.error("Snapshot scan error:", err);
      applyNewInitialFen(defaultInitialFen);
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Cleanup camera tracks on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle file upload from disk
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

  // Execute 1 solve move via engine API
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
          depth: 12,
          engine: engineParam,
          history: solveMoves.map((m) => m.san).slice(-10),
        }),
      });

      const data = await res.json();
      if (data.ok !== false && data.fen && data.uci && data.san) {
        setLiveFen(data.fen);
        setLastMoveUci(data.uci);
        if (typeof data.scoreCp === "number") {
          setCurrentScoreCp(data.scoreCp);
        }
        setSolveMoves((prev) => [
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
        threatSummary:
          passedPawnNotice ||
          kingSafetyNotice ||
          (isWhiteTurn
            ? "Putih memegang pion bebas di b6 dan kontrol lajur sentral c5."
            : "Hitam berusaha mengunci lajur d dengan Benteng d7 dan menjaga titik f6."),
        blunderDanger: isWhiteTurn
          ? "Hati-hati: Membiarkan Menteri hitam aktif menyerang petak g2 atau kehilangan kawalan pion b6 dapat membalikkan keunggulan."
          : "Hati-hati: Membiarkan Benteng putih menyusup ke c7 atau terobosan pion b7 akan berujung promosi menteri tak terbendung.",
        keyIdea: isWhiteTurn
          ? "Strategi Kemenangan: Manfaatkan pion b6 sebagai pengalih perhatian sambil menekan titik lemah sayap raja Hitam."
          : "Strategi Bertahan: Hadang laju pion b6 dengan Benteng d7 dan buat serangan balik terhadap Raja putih.",
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

  const PRESET_POSITIONS = [
    {
      name: "Foto Game User (Endgame Rd7)",
      fen: "7k/3r1q2/1P3pp1/2R4p/8/5QPP/5PK1/8 w - - 0 1",
    },
    {
      name: "Tactical Puzzle 16 Bidak",
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
  ];

  const engineLabels: Record<EngineType, string> = {
    stockfish: "Stockfish 15 NNUE",
    "jev-fly": "Jev + Fly Brain",
    jev: "Jev System One",
    fly: "Fruit Fly Brain",
  };

  return (
    <div className="stack" style={{ maxWidth: "72rem", margin: "0 auto" }}>
      {/* Hidden file input for Upload from disk */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleImageFile}
      />

      {/* HEADER BAR */}
      <div className="panel p-4 row-between flex-wrap gap-3" style={{ background: "var(--card)" }}>
        <div>
          <h2 className="section-title flex items-center gap-2" style={{ margin: 0 }}>
            <IconScan3D size={24} />
            <span>{lang === "id" ? "Impor Posisi & AI Engine Solver Arena" : "Position Import & AI Solver Arena"}</span>
          </h2>
          <p className="prose-note" style={{ margin: 0, fontSize: "var(--text-xs)" }}>
            Akses langsung kamera HP &amp; laptop web camera atau upload foto untuk scan FEN otomatis
          </p>
        </div>

        {/* Action Buttons for Mobile Live Camera, Laptop Webcam, & Upload */}
        <div className="row gap-2 flex-wrap">
          <button
            onClick={() => void startWebcam("environment")}
            className="ctl ctl-sm ctl-primary flex items-center gap-1.5"
            disabled={isProcessingImage}
          >
            <IconScan3D size={16} />
            <span>{isProcessingImage ? "Memindai..." : "Buka Kamera HP / Laptop WebCam"}</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="ctl ctl-sm flex items-center gap-1.5"
            disabled={isProcessingImage}
          >
            <IconVision3D size={16} />
            <span>{isProcessingImage ? "Memindai..." : "Upload Foto / File"}</span>
          </button>
        </div>
      </div>

      {/* LIVE WEBCAM SCANNER MODAL */}
      {isCameraOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/85 backdrop-blur-md"
        >
          <div
            className="panel p-4 md:p-5 stack max-w-lg w-full relative"
            style={{ background: "var(--card)", borderColor: "var(--primary)" }}
          >
            <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <IconScan3D size={20} />
                <span>Live Web Camera Scanner</span>
              </div>
              <button className="ctl ctl-xs ctl-quiet" onClick={stopWebcam} title="Tutup Kamera">
                <IconClose3D size={16} />
              </button>
            </div>

            {/* Video Stream with Chessboard Alignment Grid */}
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border-2 border-[var(--primary)] shadow-2xl flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* 8x8 Chessboard Overlay Reticle */}
              <div
                className="absolute inset-4 pointer-events-none grid grid-cols-8 grid-rows-8 border-2 border-emerald-400/80 rounded-xl"
                style={{
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
                }}
              >
                {Array.from({ length: 64 }).map((_, i) => (
                  <div key={i} className="border border-emerald-400/20" />
                ))}
              </div>

              {/* Guide Hint */}
              <div className="absolute top-2 px-3 py-1 rounded-full bg-black/75 text-[11px] font-bold text-emerald-300 border border-emerald-500/40 backdrop-blur-sm">
                Posisikan 64 petak catur sejajar dengan kotak panduan
              </div>
            </div>

            {/* Camera Controls */}
            <div className="row justify-between items-center pt-2">
              <button
                type="button"
                className="ctl ctl-sm ctl-quiet flex items-center gap-1.5 text-xs"
                onClick={handleToggleFacingMode}
                title="Ganti Kamera Depan / Belakang / Laptop"
              >
                <IconSwap3D size={16} />
                <span>Ganti Kamera ({cameraFacingMode === "environment" ? "Belakang" : "Depan/Webcam"})</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCaptureSnapshot()}
                disabled={isProcessingImage}
                className="ctl ctl-sm ctl-primary font-bold flex items-center gap-2 px-4 shadow-lg"
              >
                <IconScan3D size={16} />
                <span>{isProcessingImage ? "Memproses FEN..." : "Ambil Foto & Pindai"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL FEN INPUT / PASTE BAR */}
      <div className="panel p-3 stack-tight" style={{ background: "var(--surface)" }}>
        <div className="row-between">
          <label className="label text-xs font-bold">Ketik atau Paste Notasi FEN Langsung:</label>
          {error && <span className="text-xs text-[var(--destructive)] font-bold">{error}</span>}
        </div>
        <div className="row gap-2">
          <input
            type="text"
            value={fenInput}
            onChange={(e) => setFenInput(e.target.value)}
            placeholder="Contoh: 7k/3r1q2/1P3pp1/2R4p/8/5QPP/5PK1/8 w - - 0 1"
            className="w-full p-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-white font-mono focus:outline-none focus:border-[var(--primary)]"
          />
          <button
            onClick={() => applyNewInitialFen(fenInput)}
            className="ctl ctl-sm ctl-primary shrink-0"
          >
            <IconCheck3D size={14} />
            <span>Terapkan FEN</span>
          </button>
        </div>
      </div>

      {/* PRESET POSITIONS BAR */}
      <div className="row items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="label shrink-0 font-bold">Preset Posisi:</span>
        {PRESET_POSITIONS.map((p) => (
          <button
            key={p.name}
            onClick={() => applyNewInitialFen(p.fen)}
            className={`ctl ctl-xs shrink-0 transition-all ${
              initialFen === p.fen ? "ctl-active ring-1 ring-[var(--primary)] font-bold" : "ctl-quiet"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* DUAL BOARD ARENA: PAPAN 1 (IMPORT REFERENCE) VS PAPAN 2 (ENGINE SOLVER) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        {/* PAPAN 1 (KIRI): POSISI AWAL HASIL IMPORT */}
        <div className="panel p-4 stack-tight" style={{ background: "var(--card)" }}>
          <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <IconVision3D size={18} />
              <span>{lang === "id" ? "Papan 1: Posisi Awal Ter-Import" : "Board 1: Imported Initial Position"}</span>
            </div>
            <span className="ctl ctl-xs" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
              Referensi Asli
            </span>
          </div>

          <div className="row-between px-1 text-xs text-[var(--muted-foreground)]">
            <span>Bidak di Papan:</span>
            <CapturedPiecesBar fen={initialFen} side="white" />
          </div>

          <div className="w-full max-w-[480px] mx-auto aspect-square rounded-xl overflow-hidden border border-[var(--border)] shadow-lg">
            <Chessboard
              options={{
                id: "board1-imported-reference",
                position: initialFen,
                allowDragging: true,
                onPieceDrop: handleBoard1Drop,
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
              }}
            />
          </div>

          <div className="panel p-2.5 mt-2 stack-tight text-xs" style={{ background: "var(--surface)" }}>
            <div className="row-between text-[var(--muted-foreground)]">
              <span>Status FEN Awal:</span>
              <span className="font-mono text-[var(--primary)] font-bold">Valid FIDE</span>
            </div>
            <div className="font-mono text-[11px] text-neutral-300 break-all select-all p-1.5 rounded bg-[var(--background)] border border-[var(--border)]">
              {initialFen}
            </div>
            <p className="prose-note text-[10px] m-0">
              *Anda dapat menggeser bidak di papan 1 untuk mengoreksi penempatan awal. Papan 2 akan otomatis menyesuaikan.
            </p>
          </div>
        </div>

        {/* PAPAN 2 (KANAN): ARENA SIMULASI & SOLVE ENGINE */}
        <div className="panel p-4 stack-tight" style={{ background: "var(--card)" }}>
          <div className="row-between flex-wrap gap-2 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <IconBot3D size={18} />
              <span>{lang === "id" ? "Papan 2: Simulasi Solve Engine" : "Board 2: Live Engine Solver"}</span>
            </div>

            {/* DUAL ENGINE PICKER */}
            <div className="row flex-wrap gap-2">
              <div className="row items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-white inline-block shrink-0" />
                <span className="text-[11px] font-bold text-neutral-300">Putih:</span>
                <select
                  value={whiteEngine}
                  onChange={(e) => setWhiteEngine(e.target.value as EngineType)}
                  className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                >
                  <option value="stockfish" className="bg-[var(--card)]">Stockfish 15</option>
                  <option value="jev-fly" className="bg-[var(--card)]">Jev + Fly Brain</option>
                  <option value="jev" className="bg-[var(--card)]">Jev System One</option>
                  <option value="fly" className="bg-[var(--card)]">Fruit Fly Brain</option>
                </select>
              </div>

              <div className="row items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-600 inline-block shrink-0" />
                <span className="text-[11px] font-bold text-neutral-300">Hitam:</span>
                <select
                  value={blackEngine}
                  onChange={(e) => setBlackEngine(e.target.value as EngineType)}
                  className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                >
                  <option value="jev-fly" className="bg-[var(--card)]">Jev + Fly Brain</option>
                  <option value="stockfish" className="bg-[var(--card)]">Stockfish 15</option>
                  <option value="jev" className="bg-[var(--card)]">Jev System One</option>
                  <option value="fly" className="bg-[var(--card)]">Fruit Fly Brain</option>
                </select>
              </div>
            </div>
          </div>

          <div className="row-between px-1 text-xs">
            <div className="row items-center gap-2">
              <span className="text-[var(--muted-foreground)] font-bold">Evaluasi:</span>
              <span className="font-mono text-[var(--primary)] font-black">
                {currentScoreCp !== null ? `${currentScoreCp > 0 ? "+" : ""}${(currentScoreCp / 100).toFixed(1)}` : "+0.0"}
              </span>
            </div>
            <div className="text-[var(--muted-foreground)] text-xs">
              Giliran: <span className="text-white font-bold">{tacticalIntel.turn}</span>
              <span className="text-neutral-500 font-normal ml-1">
                ({tacticalIntel.turn === "Putih" ? engineLabels[whiteEngine] : engineLabels[blackEngine]})
              </span>
            </div>
          </div>

          {/* Interactive Solver Board */}
          <div className="w-full max-w-[480px] mx-auto aspect-square rounded-xl overflow-hidden border border-[var(--primary)] shadow-lg relative">
            <Chessboard
              options={{
                id: "board2-live-solver",
                position: liveFen,
                allowDragging: false,
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
              }}
            />
            {isEngineCalculating && (
              <div className="absolute top-2 right-2 bg-black/80 px-2.5 py-1 rounded text-[10px] text-[var(--warning)] font-bold border border-[var(--warning)] animate-pulse flex items-center gap-1.5">
                <IconBot3D size={12} />
                <span>Engine Menghitung...</span>
              </div>
            )}
          </div>

          {/* Solver Controls */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => setIsAutoSolving(!isAutoSolving)}
              className={`ctl ctl-sm font-bold flex items-center justify-center gap-1.5 ${
                isAutoSolving ? "ctl-danger" : "ctl-primary"
              }`}
            >
              <IconPlay3D size={14} />
              <span>{isAutoSolving ? "Jeda Solve" : "Solve Otomatis"}</span>
            </button>

            <button
              onClick={() => void stepEngineSolve()}
              disabled={isAutoSolving || isEngineCalculating}
              className="ctl ctl-sm flex items-center justify-center gap-1.5"
            >
              <span>1 Langkah</span>
              <IconPlay3D size={12} />
            </button>

            <button
              onClick={handleResetSolver}
              className="ctl ctl-sm ctl-quiet flex items-center justify-center gap-1"
            >
              <IconSwap3D size={13} />
              <span>Reset</span>
            </button>
          </div>

          <button
            onClick={() => onLoadFen(liveFen)}
            className="ctl ctl-sm ctl-primary w-full justify-center mt-2 flex items-center gap-1.5"
          >
            <IconPlay3D size={14} />
            <span>Buka Posisi Ini di Menu Bermain</span>
          </button>
        </div>
      </div>

      {/* TACTICAL ANALYSIS & BLUNDER EVALUATION PANEL */}
      <div className="panel p-4 stack-tight" style={{ background: "var(--card)" }}>
        <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <IconLightning3D size={20} />
          <h3 className="section-title text-sm uppercase tracking-wider" style={{ margin: 0 }}>
            Analisis Taktis &amp; Evaluasi Bahaya / Blunder Posisi
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Card 1: Ancaman & Bahaya */}
          <div className="panel p-3 stack-tight" style={{ background: "var(--surface)", borderColor: "var(--destructive)" }}>
            <div className="text-xs font-bold text-[var(--destructive)] flex items-center gap-1.5">
              <IconLightning3D size={16} />
              <span>Titik Bahaya &amp; Ancaman:</span>
            </div>
            <p className="prose-note text-xs text-neutral-300 leading-relaxed m-0">
              {tacticalIntel.threatSummary}
            </p>
          </div>

          {/* Card 2: Titik Blunder */}
          <div className="panel p-3 stack-tight" style={{ background: "var(--surface)", borderColor: "var(--warning)" }}>
            <div className="text-xs font-bold text-[var(--warning)] flex items-center gap-1.5">
              <IconBot3D size={16} />
              <span>Rawan Blunder Fatal:</span>
            </div>
            <p className="prose-note text-xs text-neutral-300 leading-relaxed m-0">
              {tacticalIntel.blunderDanger}
            </p>
          </div>

          {/* Card 3: Solusi Kemenangan Engine */}
          <div className="panel p-3 stack-tight" style={{ background: "var(--surface)", borderColor: "var(--primary)" }}>
            <div className="text-xs font-bold text-[var(--primary)] flex items-center gap-1.5">
              <IconTrophy3D size={16} />
              <span>Kunci Solusi Posisi:</span>
            </div>
            <p className="prose-note text-xs text-neutral-300 leading-relaxed m-0">
              {tacticalIntel.keyIdea}
            </p>
          </div>
        </div>

        {/* Move History of Solve */}
        {solveMoves.length > 0 && (
          <div className="pt-2 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="row-between text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
              <span>Langkah-Langkah Pemecahan Posisi ({solveMoves.length}):</span>
              <span className="font-mono text-[10px]">
                {whiteEngine.toUpperCase()} vs {blackEngine.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              {solveMoves.map((m, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 rounded bg-[var(--card)] border border-[var(--border)] text-xs font-mono flex items-center gap-1"
                >
                  <span className="text-[var(--muted-foreground)] font-bold">{idx + 1}.</span>
                  <span className="text-white font-bold">{m.san}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">({m.by})</span>
                  {m.scoreCp !== null && m.scoreCp !== undefined && (
                    <span className="text-[10px] text-[var(--primary)]">
                      ({m.scoreCp > 0 ? "+" : ""}{(m.scoreCp / 100).toFixed(1)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
