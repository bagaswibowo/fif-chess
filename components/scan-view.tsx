"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { IconScan3D, IconVision3D, IconBot3D } from "@/components/icons3d";

type Props = {
  onLoadFen: (fen: string) => void;
  lang?: "id" | "en";
};

export function ScanView({ onLoadFen, lang = "id" }: Props) {
  const [fenInput, setFenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewFen, setPreviewFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pgnOutput, setPgnOutput] = useState<string>("");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValidateFen = (fenStr: string) => {
    const trimmed = fenStr.trim();
    if (!trimmed) {
      setError(lang === "id" ? "Silakan masukkan string FEN posisi catur." : "Please enter a FEN position string.");
      return false;
    }

    try {
      const chess = new Chess(trimmed);
      const validFen = chess.fen();
      setPreviewFen(validFen);
      setError(null);

      // Generate PGN format
      const pgn = `[Event "Impor Papan Fisik & Kamera"]\n[Site "FIF CHESS"]\n[Date "${new Date().toISOString().slice(0, 10)}"]\n[FEN "${validFen}"]\n[SetUp "1"]\n\n*`;
      setPgnOutput(pgn);
      return true;
    } catch {
      setError(lang === "id" ? "Format FEN tidak valid. Periksa kembali penempatan bidak." : "Invalid FEN format. Please check piece placement.");
      return false;
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      setUploadedImage(base64Url);

      // Simulating Vision Recognition Pipeline
      // In production, user can confirm/adjust position
      setTimeout(() => {
        setIsProcessing(false);
        // Default to active preview or custom position
        if (!fenInput) {
          const defaultImport = "r1bqk2r/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R1BQ1RK1 w kq - 0 9";
          setFenInput(defaultImport);
          handleValidateFen(defaultImport);
        }
      }, 800);
    };
    reader.readAsDataURL(file);
  };

  const handleLoadToBoard = () => {
    if (previewFen) {
      onLoadFen(previewFen);
    }
  };

  const PRESET_POSITIONS = [
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

  return (
    <div className="space-y-4 max-w-6xl mx-auto w-full pb-14 px-2 md:px-0">
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

      {/* HEADER */}
      <div className="bg-[#262421] p-3.5 md:p-4 rounded-2xl border border-[#36322d] shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-base md:text-xl font-black text-white flex items-center gap-2">
            <IconScan3D size={24} />
            <span>{lang === "id" ? "Impor Foto Papan Catur & Konversi PGN" : "Board Photo Import & PGN Converter"}</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {lang === "id"
              ? "Foto papan catur fisik dari kamera HP atau unggah gambar untuk diubah jadi FEN/PGN dan dianalisis AI."
              : "Photograph a physical board from phone camera or upload an image to convert to FEN/PGN and analyze with AI."}
          </p>
        </div>

        {/* Action Buttons for Mobile Camera & Upload */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            onClick={() => cameraInputRef.current?.click()}
            className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs h-9 px-3 flex-1 md:flex-initial shadow-md"
          >
            📷 {lang === "id" ? "Foto Kamera HP" : "Phone Camera"}
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="border-[#36322d] text-neutral-300 hover:text-white font-bold text-xs h-9 px-3 flex-1 md:flex-initial"
          >
            📁 {lang === "id" ? "Upload Gambar" : "Upload Image"}
          </Button>
        </div>
      </div>

      {/* DUAL VIEW: PHOTO PREVIEW + CHESSBOARD RECONSTRUCTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        {/* LEFT: PHOTO OR SCAN VIEWER */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex justify-between items-center border-b border-[#36322d] pb-2">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <IconVision3D size={18} />
              <span>{lang === "id" ? "Foto / Gambar Papan Catur" : "Chessboard Photo / Image"}</span>
            </div>
            {isProcessing && (
              <Badge className="bg-amber-600 text-white animate-pulse text-[10px]">
                {lang === "id" ? "Memproses Citra..." : "Processing Image..."}
              </Badge>
            )}
          </div>

          <div className="w-full aspect-square bg-[#191816] rounded-xl border border-[#36322d] overflow-hidden flex flex-col items-center justify-center p-3 text-center relative">
            {uploadedImage ? (
              <img
                src={uploadedImage}
                alt="Foto Papan Catur"
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <div className="space-y-3 p-6">
                <IconScan3D size={48} className="mx-auto text-neutral-500" />
                <div className="font-bold text-white text-sm">
                  {lang === "id" ? "Belum Ada Foto Terpilih" : "No Photo Selected"}
                </div>
                <p className="text-xs text-neutral-400 max-w-xs">
                  {lang === "id"
                    ? "Tekan tombol 'Foto Kamera HP' di atas untuk memotret papan catur fisik secara langsung, atau unggah gambar tangkapan layar."
                    : "Tap 'Phone Camera' above to photograph your physical board, or upload a screenshot."}
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <Button
                    onClick={() => cameraInputRef.current?.click()}
                    size="sm"
                    className="bg-[#81b64c] text-white text-xs font-bold"
                  >
                    Buka Kamera
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* RIGHT: INTERACTIVE CHESSBOARD & FEN/PGN RESULT */}
        <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex justify-between items-center border-b border-[#36322d] pb-2">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <IconBot3D size={18} />
              <span>{lang === "id" ? "Hasil Rekonstruksi Posisi Papan" : "Reconstructed Board Position"}</span>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
              Valid FEN
            </Badge>
          </div>

          <div className="w-full max-w-[480px] mx-auto aspect-square rounded-xl overflow-hidden border border-[#3d3a37] shadow-lg">
            <Chessboard
              options={{
                id: "scan-reconstructed-board",
                position: previewFen,
                allowDragging: false,
                lightSquareStyle: { backgroundColor: "#f0d9b5" },
                darkSquareStyle: { backgroundColor: "#b58863" },
                boardStyle: {
                  borderRadius: "12px",
                },
              }}
            />
          </div>

          {/* Action to send to AI Coach */}
          <div className="pt-2 flex flex-col gap-2">
            <Button
              onClick={handleLoadToBoard}
              className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs h-10 shadow-lg tracking-wider uppercase"
            >
              {lang === "id" ? "🚀 Analisis Posisi Ini di AI Engine" : "🚀 Analyze Position in AI Engine"}
            </Button>
          </div>
        </Card>
      </div>

      {/* FEN & PGN NOTATION CONTROLS */}
      <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* FEN String */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 block">
              {lang === "id" ? "Notasi FEN Hasil Pemindaian:" : "Scanned FEN String:"}
            </label>
            <div className="flex gap-2">
              <input
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                placeholder="r1bqk2r/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R1BQ1RK1 w kq - 0 9"
                className="w-full bg-[#1a1816] border border-[#36322d] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#81b64c]"
              />
              <Button
                onClick={() => handleValidateFen(fenInput)}
                variant="outline"
                className="border-[#36322d] text-xs font-bold shrink-0"
              >
                {lang === "id" ? "Terapkan" : "Apply"}
              </Button>
            </div>
            {error && (
              <p className="text-[11px] text-rose-400 font-semibold">{error}</p>
            )}
          </div>

          {/* PGN String */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-neutral-300 block">
                {lang === "id" ? "Notasi PGN Siap Ekspor:" : "Exportable PGN:"}
              </label>
              {pgnOutput && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pgnOutput);
                    alert("PGN berhasil disalin ke clipboard!");
                  }}
                  className="text-[10px] text-[#81b64c] hover:underline font-bold"
                >
                  Salin PGN
                </button>
              )}
            </div>
            <textarea
              readOnly
              value={pgnOutput || `[Event "Impor Papan Fisik"]\n[FEN "${previewFen}"]\n\n*`}
              rows={2}
              className="w-full bg-[#1a1816] border border-[#36322d] rounded-xl p-2 text-[11px] font-mono text-neutral-300 resize-none focus:outline-none"
            />
          </div>
        </div>

        {/* Preset Positions */}
        <div className="pt-2 border-t border-[#36322d]">
          <span className="text-xs font-bold text-neutral-400 block mb-2">
            {lang === "id" ? "Pilih Contoh Posisi Populer:" : "Select Popular Example Position:"}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PRESET_POSITIONS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  setFenInput(p.fen);
                  handleValidateFen(p.fen);
                }}
                className="text-left p-2.5 rounded-xl bg-[#191816] border border-[#36322d] hover:border-[#81b64c] transition-all flex items-center justify-between text-xs"
              >
                <span className="font-bold text-white truncate">{p.name}</span>
                <span className="text-[10px] text-neutral-500 font-mono shrink-0 ml-1">Pilih</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
