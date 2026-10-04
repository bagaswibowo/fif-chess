"use client";

// Impor Posisi & AI Engine Solver Arena (v2.5 Blank Slate First)
// Fitur:
// 1. Tampilan Awal Blank Slate: Papan catur TIDAK dirender sebelum ada posisi yang diimpor/dipilih.
// 2. Pusat Aksi Impor: Kamera HP / Webcam, Upload Foto Papan Catur, Preset Cepat, atau Tempel FEN.
// 3. Papan Catur Proporsional Besar (~500px) hanya muncul ketika posisi aktif telah dimuat.
// 4. Tombol "Ganti / Pindai Posisi Lain" untuk kembali ke ruang impor awal tanpa refresh.
// 5. Integrasi Multimodal Vision via OmniRoute + chess.js validation.

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
import { EvalBar } from "@/components/eval-bar";
import { BoardControls } from "@/components/board-controls";
import { PerspectiveCropModal } from "@/components/perspective-crop-modal";
import { NotationTable } from "@/components/notation-table";

type Props = {
  onLoadFen: (fen: string) => void;
  lang?: "id" | "en";
};

type EngineType = "stockfish" | "jev-fly" | "jev" | "fly";
type ViewTab = "solver" | "reference" | "compare";

const PRESET_POSITIONS = [
  { name: "Foto Papan Fisik (Elephant Gambit)", fen: "rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3" },
  { name: "Foto Papan Catur Kayu (Midgame)", fen: "r1bqkbnr/pppp1ppp/8/4p3/3nP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4" },
  { name: "Foto Endgame Rd7", fen: "7k/3r1q2/1P3pp1/2R4p/8/5QPP/5PK1/8 w - - 0 1" },
  { name: "Sicilian Najdorf (Standar)", fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6" },
];

function sanitizeAndRepairFen(rawFen: string): string | null {
  if (!rawFen || typeof rawFen !== "string") return null;
  let fen = rawFen.trim();
  if (!fen.includes(" ")) fen += " w - - 0 1";

  try {
    const c = new Chess(fen);
    return c.fen();
  } catch {
    // Attempt repair
  }

  try {
    const parts = fen.split(" ");
    const ranks = parts[0].split("/");
    if (ranks.length !== 8) return null;

    let hasWhiteKing = parts[0].includes("K");
    let hasBlackKing = parts[0].includes("k");

    const expanded = ranks.map((rank, rankIdx) => {
      let squares: string[] = [];
      for (const ch of rank) {
        if (ch >= "1" && ch <= "8") {
          for (let i = 0; i < parseInt(ch, 10); i++) squares.push("");
        } else {
          squares.push(ch);
        }
      }
      if (squares.length < 8) {
        while (squares.length < 8) squares.push("");
      } else if (squares.length > 8) {
        squares = squares.slice(0, 8);
      }
      if (rankIdx === 0 || rankIdx === 7) {
        squares = squares.map((sq) => (sq.toLowerCase() === "p" ? "" : sq));
      }
      return squares;
    });

    if (!hasWhiteKing) {
      if (!expanded[7][4] || expanded[7][4] === "") expanded[7][4] = "K";
      else {
        const idx = expanded[7].findIndex((s) => s === "");
        if (idx !== -1) expanded[7][idx] = "K";
        else expanded[7][4] = "K";
      }
    }

    if (!hasBlackKing) {
      if (!expanded[0][4] || expanded[0][4] === "") expanded[0][4] = "k";
      else {
        const idx = expanded[0].findIndex((s) => s === "");
        if (idx !== -1) expanded[0][idx] = "k";
        else expanded[0][4] = "k";
      }
    }

    const recompressed = expanded
      .map((row) => {
        let r = "";
        let empty = 0;
        for (const sq of row) {
          if (!sq) {
            empty++;
          } else {
            if (empty > 0) {
              r += empty;
              empty = 0;
            }
            r += sq;
          }
        }
        if (empty > 0) r += empty;
        return r;
      })
      .join("/");

    const candidate = recompressed + " " + (parts[1] || "w") + " " + (parts[2] || "-") + " " + (parts[3] || "-") + " " + (parts[4] || "0") + " " + (parts[5] || "1");
    const c = new Chess(candidate);
    return c.fen();
  } catch {
    return null;
  }
}

function compressImage(dataUrl: string, maxDim = 800): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function ScanView({ onLoadFen, lang = "id" }: Props) {
  // State: Mulai dengan posisi kosong (belum ada papan yang dimuat)
  const [hasPositionLoaded, setHasPositionLoaded] = useState<boolean>(false);
  const [initialFen, setInitialFen] = useState<string>("");
  const [liveFen, setLiveFen] = useState<string>("");
  const [fenInput, setFenInput] = useState<string>("");

  const [activeTab, setActiveTab] = useState<ViewTab>("solver");
  const [scanBoardOrientation, setScanBoardOrientation] = useState<"white" | "black">("white");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [pendingCropImage, setPendingCropImage] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [selectedPieceTool, setSelectedPieceTool] = useState<string | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [fullscreenScan, setFullscreenScan] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        setFullscreenScan((v) => !v);
      } else if (e.key === "z" || e.key === "Z") {
        setScanBoardOrientation((o) => (o === "white" ? "black" : "white"));
      } else if (e.key === "Escape" && fullscreenScan) {
        setFullscreenScan(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenScan]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelScanning = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessingImage(false);
    setScanProgress(null);
    setError(lang === "id" ? "Pemindaian dibatalkan." : "Scan cancelled.");
  }, [lang]);

  const processAndScanImage = async (rawBase64: string, prewarped = false) => {
    setIsProcessingImage(true);
    setError(null);
    setScanProgress({ percent: 15, stage: "Mengompresi gambar & resolusi..." });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(() => {
      controller.abort();
    }, 45000);

    try {
      const compressed = await compressImage(rawBase64, 800);
      setScanProgress({ percent: 45, stage: "Mengunggah data gambar ke AI Vision..." });

      const p1 = setTimeout(() => {
        setScanProgress({ percent: 70, stage: "Menganalisis 64 petak papan catur & posisi bidak..." });
      }, 1000);
      const p2 = setTimeout(() => {
        setScanProgress({ percent: 90, stage: "Memvalidasi notasi FEN..." });
      }, 3000);

      const res = await fetch("/api/scan-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: compressed, prewarped }),
        signal: controller.signal,
      });

      clearTimeout(p1);
      clearTimeout(p2);
      clearTimeout(timer);

      const data = await res.json().catch(() => ({ ok: false, error: "Respons server tidak valid." }));
      if (data.ok && data.fen) {
        setScanProgress({ percent: 100, stage: "Selesai! Memuat posisi ke papan..." });
        setTimeout(() => {
          // Preview dulu di Papan Referensi & Edit Posisi — user bisa membetulkan
          // bidak hasil scan (drag) sebelum membawanya ke Simulator.
          applyNewInitialFen(data.fen, "Foto berhasil dipindai! Periksa & betulkan bidak bila perlu, lalu lanjut ke Solver.");
          setActiveTab("reference");
          setScanProgress(null);
          setIsProcessingImage(false);
        }, 400);
      } else {
        // Gagal jujur dari server (mis. tidak ada engine vision yang aktif).
        // Tampilkan pesan server + arahkan ke editing manual di papan referensi.
        setError(
          data.error ||
            (lang === "id"
              ? "Posisi tidak terbaca. Coba foto yang lebih terang & tegak lurus, atau tempel FEN manual / muat posisi lalu edit bidaknya di tab Papan Referensi."
              : "Position unreadable. Try a brighter, straight-on photo, paste FEN manually, or edit pieces on the reference board.")
        );
        setScanProgress(null);
        setIsProcessingImage(false);
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        setError("Pemindaian memakan waktu terlalu lama atau dibatalkan. Silakan gunakan preset cepat atau tempel FEN.");
      } else {
        setError(err.message || "Terjadi kesalahan saat memproses gambar.");
      }
      setScanProgress(null);
      setIsProcessingImage(false);
    } finally {
      abortControllerRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Live Web Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Live Detection State (kamera kontinu + scan berulang)
  const [isLiveDetectOpen, setIsLiveDetectOpen] = useState(false);
  const [liveDetectStatus, setLiveDetectStatus] = useState<"idle" | "detecting" | "success" | "error">("idle");
  const [liveDetectFen, setLiveDetectFen] = useState<string | null>(null);
  const [liveDetectError, setLiveDetectError] = useState<string | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveAbortRef = useRef<boolean>(false);

  // Dual-Engine Solver State
  const [whiteEngine, setWhiteEngine] = useState<EngineType>("stockfish");
  const [blackEngine, setBlackEngine] = useState<EngineType>("jev-fly");
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [isEngineCalculating, setIsEngineCalculating] = useState(false);
  const [solveMoves, setSolveMoves] = useState<{ san: string; uci: string; by: string; scoreCp?: number | null }[]>([]);
  const [currentScoreCp, setCurrentScoreCp] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSolveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const applyNewInitialFen = useCallback(
    (newFen: string, msg?: string) => {
      const repaired = sanitizeAndRepairFen(newFen);
      if (repaired) {
        setInitialFen(repaired);
        setLiveFen(repaired);
        setFenInput(repaired);
        setSolveMoves([]);
        setCurrentScoreCp(null);
        setIsAutoSolving(false);
        setError(null);
        setHasPositionLoaded(true);
        if (msg) {
          setScanSuccessMessage(msg);
          setTimeout(() => setScanSuccessMessage(null), 4000);
        }
      } else {
        setError(lang === "id" ? "Format FEN tidak valid atau posisi tidak terbaca." : "Invalid FEN format.");
      }
    },
    [lang]
  );

  const handleResetToBlank = () => {
    setIsAutoSolving(false);
    setHasPositionLoaded(false);
    setInitialFen("");
    setLiveFen("");
    setFenInput("");
    setSolveMoves([]);
    setCurrentScoreCp(null);
    setError(null);
    setScanSuccessMessage(null);
  };

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
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Url = canvas.toDataURL("image/jpeg", 0.90);
        stopWebcam();
        // Simpan foto untuk opsi "Sesuaikan Sudut Manual", lalu langsung scan.
        setPendingCropImage(base64Url);
        void processAndScanImage(base64Url);
      }
    } catch (e: any) {
      setError(e.message || "Gagal mengambil snapshot kamera.");
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        // Simpan foto asli untuk opsi "Sesuaikan Sudut Manual", lalu langsung scan.
        setPendingCropImage(base64Url);
        void processAndScanImage(base64Url);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmCropAndScan = async (warpedBase64: string) => {
    setIsCropModalOpen(false);
    setPendingCropImage(null);
    // Gambar sudah di-warp jadi persegi 800x800 oleh modal crop —
    // server bisa membaca 64 petak langsung tanpa deteksi papan.
    await processAndScanImage(warpedBase64, true);
  };

  // ===== LIVE DETECTION: kamera kontinu + scan berulang sampai FEN stabil =====
  const stopLiveDetection = useCallback(() => {
    liveAbortRef.current = true;
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
    setIsLiveDetectOpen(false);
    setLiveDetectStatus("idle");
  }, []);

  const startLiveDetection = useCallback(async () => {
    stopLiveDetection();
    setError(null);
    setLiveDetectError(null);
    setLiveDetectFen(null);
    setLiveDetectStatus("detecting");
    setIsLiveDetectOpen(true);
    liveAbortRef.current = false;

    const openStream = async (): Promise<MediaStream | null> => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        try {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch {
          return null;
        }
      }
    };

    const stream = await openStream();
    if (liveAbortRef.current) {
      stream?.getTracks().forEach((t) => t.stop());
      return;
    }
    if (!stream) {
      setLiveDetectStatus("error");
      setLiveDetectError(lang === "id" ? "Izin kamera tidak diberikan." : "Camera permission denied.");
      return;
    }
    liveStreamRef.current = stream;
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
      liveVideoRef.current.play().catch(() => {});
    }

    // Loop scan: ambil frame -> kirim ke /api/scan-board -> ulang.
    // Berhenti otomatis saat FEN stabil 2x berturut-turut.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let lastFen: string | null = null;
    let stableCount = 0;

    while (!liveAbortRef.current) {
      const video = liveVideoRef.current;
      if (!video || video.readyState < 2 || !liveStreamRef.current) break;

      let base64: string;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) break;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        base64 = canvas.toDataURL("image/jpeg", 0.85);
      } catch {
        break;
      }

      setLiveDetectStatus("detecting");
      try {
        const compressed = await compressImage(base64, 800);
        const res = await fetch("/api/scan-board", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: compressed }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (liveAbortRef.current) break;

        if (data.ok && data.fen && typeof data.fen === "string") {
          // Bandingkan hanya bagian posisi (field pertama FEN) supaya stabil
          const fenBoard = (data.fen as string).split(" ")[0];
          if (fenBoard === lastFen) {
            stableCount += 1;
          } else {
            stableCount = 1;
            lastFen = fenBoard;
          }
          setLiveDetectFen(data.fen as string);
          if (stableCount >= 2) {
            setLiveDetectStatus("success");
            applyNewInitialFen(data.fen as string, "Live detection berhasil — posisi stabil terbaca!");
            setTimeout(() => stopLiveDetection(), 900);
            break;
          }
        } else {
          setLiveDetectFen(null);
        }
      } catch {
        // Jaringan/server gagal sekali: tunggu lalu coba lagi.
      }

      await sleep(1500);
    }
  }, [applyNewInitialFen, lang, stopLiveDetection]);

  const handleSkipCropAndScan = async (rawBase64: string) => {
    setIsCropModalOpen(false);
    setPendingCropImage(null);
    await processAndScanImage(rawBase64);
  };

  // Edit posisi bebas di papan referensi: BUKAN gerakan catur legal — bidak
  // dipindah/ditukar/dihapus bebas untuk mengoreksi hasil scan. chess.move()
  // menolak gerakan ilegal (mis. raja di bawah serangan) sehingga drag gagal;
  // manipulasi FEN langsung memperbolehkan semua penempatan.
  // Drag bidak KELUAR papan (targetSquare null) = hapus bidak.
  const handleBoard1Drop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }): boolean => {
    try {
      const chess = new Chess(initialFen);
      const piece = chess.get(sourceSquare as any);
      if (!piece) return false;
      if (!targetSquare) {
        // Dilepas di luar papan → hapus bidak dari posisi.
        chess.remove(sourceSquare as any);
        const delFen = chess.fen();
        if (delFen && delFen.split(" ")[0]) {
          applyNewInitialFen(delFen);
          return true;
        }
        return false;
      }
      if (targetSquare === sourceSquare) return false;
      chess.remove(sourceSquare as any);
      chess.put(piece, targetSquare as any);
      const newFen = chess.fen();
      // Terima walau posisi "ilegal" secara aturan main: validasi minimal
      // hanya butuh FEN yang bisa di-parse. Papan referensi memang tempat
      // membetulkan hasil scan yang salah penempatan.
      if (newFen && newFen.split(" ")[0]) {
        applyNewInitialFen(newFen);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Mode hapus bidak: klik bidak di papan referensi untuk menghapusnya.
  const handleReferenceSquareClick = ({ square, piece }: { square: string; piece?: { pieceType?: string } | null }) => {
    if (!isDeleteMode || !piece) return;
    try {
      const chess = new Chess(initialFen);
      if (!chess.get(square as any)) return;
      chess.remove(square as any);
      const newFen = chess.fen();
      if (newFen && newFen.split(" ")[0]) applyNewInitialFen(newFen);
    } catch {
      /* abaikan */
    }
  };

  // Solver Engine Step
  const stepEngineSolve = useCallback(async () => {
    if (isEngineCalculating || !liveFen) return;

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
            : activeEngine === "jev-fly"
              ? "jev-fly"
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
        // Tampilkan alasan kegagalan — jangan berhenti diam-diam.
        setError(data.error || "Engine gagal menghitung langkah.");
        setIsAutoSolving(false);
      }
    } catch {
      setError("Tidak dapat menghubungi engine. Periksa koneksi lalu coba lagi.");
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
    }, 600);
    return () => {
      if (autoSolveTimerRef.current) clearInterval(autoSolveTimerRef.current);
    };
  }, [isAutoSolving, stepEngineSolve]);

  const tacticalIntel = useMemo(() => {
    if (!liveFen) return { turn: "Putih", evalSummary: "-", danger: "-", keyIdea: "-" };
    try {
      const chess = new Chess(liveFen);
      const turn = chess.turn();
      const isWhiteTurn = turn === "w";
      const ply = chess.history().length;

      if (ply <= 4 && liveFen.includes("3pp3/4P3/5N2")) {
        return {
          turn: isWhiteTurn ? "Putih" : "Hitam",
          evalSummary: "Elephant Gambit (1. e4 e5 2. Nf3 d5). Hitam menantang pusat secara agresif.",
          danger: isWhiteTurn
            ? "Hati-hati: Hitam dapat mengorbankan pion untuk inisiatif cepat jika Putih lengah."
            : "Bahaya: Putih dapat memakan pion d5 (exd5 atau Nxe5) dan unggul perwira aktif.",
          keyIdea: isWhiteTurn
            ? "Langkah Kunci Putih: 3. exd5 e4 4. Qe2 Nf6 5. d3 untuk mengunci pion tengah hitam."
            : "Langkah Kunci Hitam: 3... e4 mendorong pion untuk mengusir Kuda f3 Putih.",
        };
      }

      return {
        turn: isWhiteTurn ? "Putih" : "Hitam",
        evalSummary: isWhiteTurn
          ? "Putih memegang tempo dan koordinasi perwira aktif."
          : "Hitam mencari serangan balik dan keseimbangan petak sentral.",
        danger: isWhiteTurn
          ? "Hati-hati serangan taktis mendadak ke sayap raja."
          : "Bahaya: Terobosan pion atau penetrasi perwira berat lawan.",
        keyIdea: isWhiteTurn
          ? "Kembangkan perwira aktif dan kuasai lajur terbuka."
          : "Jaga struktur pion dan pertahankan koordinasi raja.",
      };
    } catch {
      return { turn: "Putih", evalSummary: "Posisi dinamis", danger: "Perhatikan keselamatan raja", keyIdea: "Inisiatif sentral" };
    }
  }, [liveFen]);

  // ==========================================
  // VIEW 1: INITIAL BLANK SLATE WORKSPACE
  // Papan catur TIDAK dirender sebelum ada posisi yang diimpor
  // ==========================================
  if (!hasPositionLoaded) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4 pb-8">
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageFile} />

        {/* PERSPECTIVE CROP MODAL (OCE / CAMSCANNER) */}
      {isCropModalOpen && pendingCropImage && (
        <PerspectiveCropModal
          imageUrl={pendingCropImage}
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          onConfirm={handleConfirmCropAndScan}
          onSkip={handleSkipCropAndScan}
          lang={lang}
        />
      )}
        {/* NOTIFICATIONS */}
        {/* SCAN PROGRESS BAR WITH CANCEL BUTTON */}
      {scanProgress && (
        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--primary)] stack-tight animate-in fade-in">
          <div className="row-between items-center text-xs font-bold text-white mb-1">
            <div className="flex items-center gap-2">
              <IconVision3D size={16} />
              <span>{scanProgress.stage}</span>
            </div>
            <span className="font-mono text-[var(--primary)] font-black">{scanProgress.percent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden border border-[var(--border)]">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300 rounded-full"
              style={{ width: `${scanProgress.percent}%` }}
            />
          </div>
          <div className="row-between items-center pt-1">
            <span className="text-xs text-[var(--muted-foreground)]">
              *Hasil scan dapat keliru — selalu periksa & perbaiki bidak di tab Papan Referensi sebelum dianalisis
            </span>
            <button
              type="button"
              onClick={cancelScanning}
              className="ctl ctl-xs ctl-danger font-bold px-2.5"
            >
              Batalkan
            </button>
          </div>
        </div>
      )}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconClose3D size={16} />
              <span>{error}</span>
            </div>
            <button className="text-xs underline" onClick={() => setError(null)}>Tutup</button>
          </div>
        )}

        {/* BLANK SLATE IMPORT CONTAINER */}
        <div
          className="panel p-6 md:p-10 text-center stack items-center justify-center rounded-2xl transition-all"
          style={{
            background: "var(--card)",
            border: "2px dashed var(--border)",
          }}
        >
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mb-3">
            <IconScan3D size={32} />
          </div>

          <h2 className="text-base md:text-lg font-black text-white m-0">
            Import Posisi Papan Catur
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] max-w-md mt-1 mb-6 leading-relaxed">
            Pindai posisi dari kamera, unggah foto papan, atau gunakan Live Detection — kamera membaca papan fisik secara kontinu sampai posisi terbaca stabil.
          </p>

          {/* ACTION CARDS — 3 tombol besar dengan kontras terbaca */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
            {/* KAMERA — kartu utama */}
            <button
              onClick={() => void startWebcam("environment")}
              disabled={isProcessingImage}
              className="group relative flex flex-col items-center gap-1.5 py-6 px-3 rounded-2xl text-white text-center transition-all active:scale-[0.97] disabled:opacity-50 border border-[var(--primary)] bg-[var(--primary)] hover:brightness-110 shadow-[0_6px_20px_-6px_var(--primary)]"
            >
              <IconScan3D size={28} />
              <span className="text-sm font-black">Kamera</span>
              <span className="text-[11px] font-medium text-white/85 leading-snug">Ambil foto posisi via kamera HP / webcam</span>
            </button>

            {/* UPLOAD FOTO */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingImage}
              className="group relative flex flex-col items-center gap-1.5 py-6 px-3 rounded-2xl text-center transition-all active:scale-[0.97] disabled:opacity-50 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/60 hover:bg-[var(--card)] shadow-sm"
            >
              <IconVision3D size={28} />
              <span className="text-sm font-black text-white">{isProcessingImage ? "Memproses AI..." : "Upload Foto"}</span>
              <span className="text-[11px] font-medium text-neutral-400 leading-snug">Pindai foto papan / screenshot</span>
            </button>

            {/* LIVE DETECTION */}
            <button
              onClick={() => void startLiveDetection()}
              disabled={isProcessingImage}
              className="group relative flex flex-col items-center gap-1.5 py-6 px-3 rounded-2xl text-center transition-all active:scale-[0.97] disabled:opacity-50 border border-emerald-500/50 bg-emerald-950/40 hover:border-emerald-400 hover:bg-emerald-900/40 shadow-sm"
            >
              <span className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse absolute -top-1 -right-2.5 ring-2 ring-emerald-950" />
                <IconLightning3D size={28} />
              </span>
              <span className="text-sm font-black text-emerald-300">Live Detection</span>
              <span className="text-[11px] font-medium text-emerald-200/70 leading-snug">Deteksi papan fisik secara kontinu</span>
            </button>
          </div>
        </div>

        {/* LIVE DETECTION MODAL */}
        {isLiveDetectOpen && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
            <div className="panel p-4 stack max-w-sm w-full relative max-h-[92dvh] overflow-y-auto custom-scrollbar" style={{ background: "var(--card)", borderColor: "var(--primary)" }}>
              <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Detection — Arahkan Kamera ke Papan
                </span>
                <button className="ctl ctl-xs ctl-quiet" onClick={stopLiveDetection}>
                  <IconClose3D size={14} />
                </button>
              </div>
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black border-2 border-emerald-500/60 flex items-center justify-center">
                <video ref={liveVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-4 pointer-events-none grid grid-cols-8 grid-rows-8 border border-emerald-400/80 rounded-lg">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div key={i} className="border border-emerald-400/20" />
                  ))}
                </div>
                {liveDetectFen && (
                  <div className="absolute bottom-2 left-2 right-2 px-2 py-1.5 rounded-lg bg-black/70 text-[10px] font-mono text-emerald-300 truncate" title={liveDetectFen}>
                    {liveDetectFen}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 pt-1 min-h-[2rem]">
                {liveDetectStatus === "detecting" && (
                  <span className="text-xs text-neutral-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Membaca papan...
                  </span>
                )}
                {liveDetectStatus === "success" && (
                  <span className="text-xs text-emerald-300 flex items-center gap-1.5 font-bold">
                    <IconCheck3D size={14} /> Posisi terbaca & dimuat!
                  </span>
                )}
                {liveDetectStatus === "error" && (
                  <span className="text-xs text-red-400">{liveDetectError || "Gagal membaca papan."}</span>
                )}
              </div>
              <button type="button" onClick={stopLiveDetection} className="ctl ctl-sm w-full font-bold">
                Tutup Live Detection
              </button>
            </div>
          </div>
        )}

        {/* WEBCAM MODAL IF ACTIVE */}
        {isCameraOpen && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
            <div className="panel p-4 stack max-w-sm w-full relative max-h-[92dvh] overflow-y-auto custom-scrollbar" style={{ background: "var(--card)", borderColor: "var(--primary)" }}>
              <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <IconScan3D size={16} /> Pemindai Kamera Papan Catur
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
                  <span>{isProcessingImage ? "Memproses AI Vision..." : "Ambil & Pindai"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ACTIVE POSITION LOADED (BOARD RENDERED)
  // Papan catur aktif beserta simulasi AI Solver & Kontrol
  // ==========================================
  return (
    <div
      className={
        fullscreenScan
          ? "fixed inset-0 z-50 bg-[var(--background)] text-white flex flex-col p-2 sm:p-3 overflow-hidden animate-in fade-in duration-200"
          : "w-full max-w-6xl mx-auto space-y-3 pb-6"
      }
    >
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageFile} />

      {/* PERSPECTIVE CROP MODAL (OCE / CAMSCANNER) */}
      {isCropModalOpen && pendingCropImage && (
        <PerspectiveCropModal
          imageUrl={pendingCropImage}
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          onConfirm={handleConfirmCropAndScan}
          onSkip={handleSkipCropAndScan}
          lang={lang}
        />
      )}
      {/* TOP CONTROL BAR */}
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
            onClick={handleResetToBlank}
            className="ctl ctl-xs ctl-quiet flex items-center gap-1.5 font-bold"
            title="Kembali ke halaman impor awal untuk memindai posisi lain"
          >
            <IconSwap3D size={14} />
            <span>Pindai Posisi Lain</span>
          </button>
          <button
            onClick={() => void startWebcam("environment")}
            className="ctl ctl-xs flex items-center gap-1.5 font-bold"
            disabled={isProcessingImage}
          >
            <IconScan3D size={14} />
            <span>Kamera</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="ctl ctl-xs flex items-center gap-1.5 font-bold"
            disabled={isProcessingImage}
          >
            <IconVision3D size={14} />
            <span>Ganti Foto</span>
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

      {/* SUCCESS / ERROR NOTIFICATION */}
      {/* SCAN PROGRESS BAR WITH CANCEL BUTTON */}
      {scanProgress && (
        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--primary)] stack-tight animate-in fade-in">
          <div className="row-between items-center text-xs font-bold text-white mb-1">
            <div className="flex items-center gap-2">
              <IconVision3D size={16} />
              <span>{scanProgress.stage}</span>
            </div>
            <span className="font-mono text-[var(--primary)] font-black">{scanProgress.percent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden border border-[var(--border)]">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300 rounded-full"
              style={{ width: `${scanProgress.percent}%` }}
            />
          </div>
          <div className="row-between items-center pt-1">
            <span className="text-[10px] text-[var(--muted-foreground)]">
              *Otomatis dikompresi & dimaksimalkan agar cepat diproses AI
            </span>
            <button
              type="button"
              onClick={cancelScanning}
              className="ctl ctl-xs ctl-danger font-bold px-2.5"
            >
              Batalkan
            </button>
          </div>
        </div>
      )}
      {scanSuccessMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <IconCheck3D size={16} />
          <span>{scanSuccessMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconClose3D size={16} />
            <span>{error}</span>
          </div>
          <button className="text-xs underline" onClick={() => setError(null)}>Tutup</button>
        </div>
      )}

      {/* WEBCAM MODAL IF ACTIVE */}
      {isCameraOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
          <div className="panel p-4 stack max-w-sm w-full relative" style={{ background: "var(--card)", borderColor: "var(--primary)" }}>
            <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <IconScan3D size={16} /> Pemindai Kamera Papan Catur
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
        <button onClick={() => applyNewInitialFen(fenInput, "Notasi FEN diterapkan!")} className="ctl ctl-xs ctl-primary font-bold shrink-0">
          <IconCheck3D size={12} />
          <span>Terapkan</span>
        </button>

        {/* Quick Presets */}
        <div className="row items-center gap-1 shrink-0 overflow-x-auto">
          {PRESET_POSITIONS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyNewInitialFen(p.fen, `Posisi ${p.name} dimuat!`)}
              className={`ctl ctl-xs transition-all ${
                initialFen === p.fen ? "ctl-active ring-1 ring-[var(--primary)] font-bold" : "ctl-quiet"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* VIEWPORT MODE TABS */}
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

      {/* TAB 1: ARENA DUAL ENGINE SOLVER (PROPORTIONAL FULL SIZE ~500px) */}
      {activeTab === "solver" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-1">
          {/* LEFT: FULL SIZE SOLVER BOARD */}
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

            <BoardControls
              variant="toolbar"
              orientation={scanBoardOrientation}
              onFlipOrientation={() => setScanBoardOrientation((o) => (o === "white" ? "black" : "white"))}
              isFullscreen={fullscreenScan}
              onToggleFullscreen={() => setFullscreenScan((v) => !v)}
              showShortcuts={true}
              className="mt-2"
            />

            <div className="flex justify-center w-full">
              <div className="flex gap-2.5 items-stretch w-full max-w-[min(100%,calc(100dvh-230px))]">
                <EvalBar fen={liveFen} scoreCp={currentScoreCp} orientation={scanBoardOrientation} />
                <div className="aspect-square flex-1 min-w-0 rounded-2xl overflow-hidden border-2 border-[var(--primary)] shadow-lg relative bg-[var(--card)]">
                  <Chessboard
                    options={{
                      id: "board-solver-full",
                      position: liveFen,
                      boardOrientation: scanBoardOrientation,
                      allowDragging: false,
                      darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                      lightSquareStyle: { backgroundColor: "var(--board-light)" },
                      animationDurationInMs: 250,
                    }}
                  />
                  {isEngineCalculating && (
                    <div className="absolute top-2 right-2 bg-black/85 px-2 py-0.5 rounded text-[10px] text-[var(--primary)] font-bold border border-[var(--primary)] animate-pulse">
                      Engine Menghitung...
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: CONTROLS & TACTICAL ANALYSIS */}
          <div className="lg:col-span-5 stack-tight">
            {/* Dual Engine Selection Card */}
            <div className="panel p-3 stack-tight" style={{ background: "var(--card)" }}>
              <div className="row-between text-xs font-bold text-white pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <span>Dual Engine Solver</span>
                <span className="font-mono text-[var(--primary)]">
                  Eval: {currentScoreCp !== null ? `${currentScoreCp > 0 ? "+" : ""}${(currentScoreCp / 100).toFixed(1)}` : "+0.0"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div>
                  <label className="text-xs text-[var(--muted-foreground)] font-bold block mb-0.5">Putih Melangkah:</label>
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
                  <label className="text-xs text-[var(--muted-foreground)] font-bold block mb-0.5">Hitam Melangkah:</label>
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

            {/* Tactical Intel Card */}
            <div className="panel p-3 stack-tight text-xs" style={{ background: "var(--card)" }}>
              <div className="flex items-center gap-1.5 font-bold text-white pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <IconLightning3D size={16} />
                <span>Analisis Taktis Posisi Ini</span>
              </div>

              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <div className="text-xs font-bold text-[var(--primary)] flex items-center gap-1">
                  <IconTrophy3D size={13} />
                  <span>Solusi &amp; Rencana Taktis:</span>
                </div>
                <p className="text-neutral-300 m-0 leading-snug">{tacticalIntel.keyIdea}</p>
              </div>

              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <IconBot3D size={13} />
                  <span>Titik Bahaya / Blunder:</span>
                </div>
                <p className="text-neutral-300 m-0 leading-snug">{tacticalIntel.danger}</p>
              </div>

              {/* Moves Table — gaya tabel notasi seragam (pasangan Putih/Hitam) */}
              {solveMoves.length > 0 && (
                <div className="pt-1">
                  <NotationTable
                    title="Notasi Langkah"
                    whiteLabel={whiteEngine}
                    blackLabel={blackEngine}
                    plyCount={solveMoves.length}
                    bodyMaxHeightClass="max-h-48"
                    rows={(() => {
                      const rows: { no: number; white?: string; black?: string; whiteScoreCp?: number | null; blackScoreCp?: number | null; latest?: boolean }[] = [];
                      solveMoves.forEach((m, idx) => {
                        const no = Math.floor(idx / 2) + 1;
                        let row = rows.find((r) => r.no === no);
                        if (!row) { row = { no }; rows.push(row); }
                        if (idx % 2 === 0) {
                          row.white = m.san;
                          row.whiteScoreCp = m.scoreCp ?? null;
                        } else {
                          row.black = m.san;
                          row.blackScoreCp = m.scoreCp ?? null;
                        }
                      });
                      const last = rows[rows.length - 1];
                      if (last) last.latest = true;
                      return rows;
                    })()}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAPAN REFERENSI & EDIT POSISI */}
      {activeTab === "reference" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-1">
          <div className="lg:col-span-7 panel p-3 stack-tight" style={{ background: "var(--card)" }}>
            <div className="row-between pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-bold text-xs md:text-sm text-white flex items-center gap-2">
                <IconVision3D size={18} /> Papan 1: Referensi Asli (Edit Bidak)
              </span>
              <CapturedPiecesBar fen={initialFen} side="white" />
            </div>

            {/* Kontrol papan DI ATAS (konsisten dengan tab Solver & AI Coach) */}
            <BoardControls
              variant="toolbar"
              orientation={scanBoardOrientation}
              onFlipOrientation={() => setScanBoardOrientation((o) => (o === "white" ? "black" : "white"))}
              showShortcuts={true}
              className="mt-2"
            />

            <div className="w-full mx-auto aspect-square max-w-[min(100%,calc(100dvh-230px))] rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-lg bg-[var(--card)]">
              <Chessboard
                options={{
                  id: "board-ref-full",
                  position: initialFen,
                  boardOrientation: scanBoardOrientation,
                  allowDragging: true,
                  onPieceDrop: handleBoard1Drop,
                  onSquareClick: handleReferenceSquareClick,
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                }}
              />
            </div>
          </div>

          <div className="lg:col-span-5 panel p-3.5 stack text-xs" style={{ background: "var(--card)" }}>
            <span className="font-bold text-sm text-white">Detail Posisi Ter-Import</span>
            <p className="prose-note m-0 text-xs">
              Geser bidak untuk membetulkan penempatan, seret bidak <strong>keluar papan</strong> untuk menghapus, atau aktifkan Mode Hapus lalu klik bidak yang salah deteksi.
            </p>

            {/* Mode Hapus Bidak */}
            <button
              onClick={() => setIsDeleteMode((v) => !v)}
              className={`ctl ctl-sm w-full font-bold justify-center flex items-center gap-1.5 ${
                isDeleteMode ? "ctl-danger" : "ctl-quiet"
              }`}
              title="Aktifkan lalu klik bidak di papan untuk menghapusnya"
            >
              <IconClose3D size={14} />
              <span>{isDeleteMode ? "Mode Hapus: AKTIF — klik bidak untuk hapus" : "Mode Hapus Bidak"}</span>
            </button>

            <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] stack-tight font-mono text-xs break-all select-all text-emerald-300">
              {initialFen}
            </div>

            <button
              onClick={() => setActiveTab("solver")}
              className="ctl ctl-sm ctl-primary font-bold justify-center mt-2 flex items-center gap-1.5"
            >
              <IconBot3D size={14} />
              <span>Gunakan di Simulator (Dual-Engine Solver)</span>
            </button>

            {pendingCropImage && (
              <button
                onClick={() => setIsCropModalOpen(true)}
                className="ctl ctl-sm ctl-quiet font-bold justify-center flex items-center gap-1.5"
              >
                <IconScan3D size={14} />
                <span>Sesuaikan Sudut Papan Manual (bila hasil meleset)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BANDINGKAN KEDUANYA — papan sejajar + captured kedua sisi */}
      {activeTab === "compare" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch pt-1">
          {/* Papan 1 */}
          <div className="panel p-3 flex flex-col" style={{ background: "var(--card)" }}>
            <div className="row-between pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-bold text-xs text-white">Papan 1: Referensi Asli</span>
              <span className="font-mono text-xs text-[var(--primary)] font-bold">Awal</span>
            </div>
            {/* Hitam yang memakan ( pieces hitam yg dimiliki Putih ) */}
            <div className="pt-1.5">
              <CapturedPiecesBar fen={initialFen} side="black" />
            </div>
            <div className="w-full aspect-square rounded-xl overflow-hidden border border-[var(--border)]">
              <Chessboard
                options={{
                  id: "board-compare-1",
                  position: initialFen,
                  boardOrientation: scanBoardOrientation,
                  allowDragging: true,
                  onPieceDrop: handleBoard1Drop,
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                }}
              />
            </div>
            {/* Putih yang memakan */}
            <div className="pt-1.5">
              <CapturedPiecesBar fen={initialFen} side="white" />
            </div>
          </div>

          {/* Papan 2 */}
          <div className="panel p-3 flex flex-col" style={{ background: "var(--card)" }}>
            <div className="row-between pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-bold text-xs text-white">Papan 2: Live Solver</span>
              <span className="font-mono text-xs text-[var(--primary)] font-bold">
                Eval: {currentScoreCp !== null ? `${currentScoreCp > 0 ? "+" : ""}${(currentScoreCp / 100).toFixed(1)}` : "+0.0"}
              </span>
            </div>
            <div className="pt-1.5">
              <CapturedPiecesBar fen={liveFen} side="black" />
            </div>
            <div className="w-full aspect-square rounded-xl overflow-hidden border border-[var(--primary)]">
              <Chessboard
                options={{
                  id: "board-compare-2",
                  position: liveFen,
                  boardOrientation: scanBoardOrientation,
                  allowDragging: false,
                  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--board-light)" },
                }}
              />
            </div>
            <div className="pt-1.5">
              <CapturedPiecesBar fen={liveFen} side="white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
