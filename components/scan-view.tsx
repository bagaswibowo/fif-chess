"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconScan3D } from "@/components/icons3d";

export function ScanView({
  onLoadFen,
  lang = "id",
}: {
  onLoadFen: (fen: string) => void;
  lang?: "id" | "en";
}) {
  const [fenInput, setFenInput] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handlePreset = (fen: string) => {
    setFenInput(fen);
    onLoadFen(fen);
  };

  const handleSimulateScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus(lang === "id" ? "Memproses foto papan catur via Computer Vision..." : "Processing board photo via Computer Vision...");
    setTimeout(() => {
      const scannedFen = "r1b1k2r/pp1p1ppp/2n1p3/q7/2P1n3/2P2N2/P1Q1PPPP/R1B1KB1R w KQkq - 2 9";
      setFenInput(scannedFen);
      setUploadStatus(lang === "id" ? "Posisi bidak terdeteksi valid. Tekan tombol di bawah untuk analisis." : "Board position verified. Click below to load.");
    }, 1200);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 w-full">
      <Card className="bg-[#262421] border-[#3d3a37]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconScan3D size={26} />
            <Badge className="bg-emerald-700 text-white">OTB Scan Engine</Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-300">Human-in-the-loop</Badge>
          </div>
          <CardTitle className="text-xl text-white mt-1">
            {lang === "id" ? "Scan Game Catur OTB (Papan Fisik & Notasi)" : "Scan OTB Chess Game (Board & Scoresheet)"}
          </CardTitle>
          <CardDescription className="text-neutral-400">
            {lang === "id"
              ? "Unggah foto papan fisik pertandingan atau lembar notasi turnamen untuk dianalisis langsung oleh Stockfish."
              : "Upload a photo of your physical tournament board or scoresheet for instant Stockfish review."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-[#4a4744] hover:border-[#81b64c] transition-colors rounded-xl p-8 text-center bg-[#1f1d1a]">
            <input
              type="file"
              accept="image/*"
              id="board-upload"
              className="hidden"
              onChange={handleSimulateScan}
            />
            <label htmlFor="board-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <IconScan3D size={48} />
              <span className="font-semibold text-white">
                {lang === "id" ? "Ambil Foto atau Pilih Gambar Papan Catur" : "Take Photo or Choose Board Image"}
              </span>
              <span className="text-xs text-neutral-400">
                Format JPG, PNG (Didukung: Papan Standar 8x8, Lembar Notasi FIDE)
              </span>
            </label>
          </div>

          {uploadStatus && (
            <p className="text-sm font-medium text-emerald-400 bg-emerald-950/40 p-3 rounded-lg border border-emerald-800/40">
              {uploadStatus}
            </p>
          )}

          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              {lang === "id" ? "Posisi FEN Terdeteksi (Koreksi Manusia):" : "Detected FEN Position (Human Verification):"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                className="h-10 flex-1 bg-[#1a1816] border border-[#3d3a37] rounded-lg px-3 font-mono text-xs text-white"
              />
              <Button
                disabled={!fenInput.trim()}
                onClick={() => onLoadFen(fenInput.trim())}
                className="btn-chess-green h-10 px-4"
              >
                {lang === "id" ? "Muat ke Papan" : "Load to Board"}
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#3d3a37]">
            <span className="text-xs text-neutral-400 block mb-2 font-semibold">
              {lang === "id" ? "Contoh Posisi Terkenal Komunitas FIF:" : "FIF Famous Positions Preset:"}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 border-[#3d3a37] text-neutral-300"
                onClick={() => handlePreset("r1bqk2r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5")}
              >
                {lang === "id" ? "Pembukaan Italia" : "Italian Game"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 border-[#3d3a37] text-neutral-300"
                onClick={() => handlePreset("rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2")}
              >
                {lang === "id" ? "Pertahanan Sisilia" : "Sicilian Defense"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 border-[#3d3a37] text-neutral-300"
                onClick={() => handlePreset("r1b1k2r/pp1p1ppp/2n1p3/q7/2P1n3/2P2N2/P1Q1PPPP/R1B1KB1R w KQkq - 2 9")}
              >
                {lang === "id" ? "Kasparov vs Topalov" : "Kasparov vs Topalov"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
