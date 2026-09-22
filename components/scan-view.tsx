"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { IconScan3D } from "@/components/icons3d";

type Props = {
  onLoadFen: (fen: string) => void;
  lang?: "id" | "en";
};

export function ScanView({ onLoadFen, lang = "id" }: Props) {
  const [fenInput, setFenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewFen, setPreviewFen] = useState<string | null>(null);

  const handleValidate = () => {
    const trimmed = fenInput.trim();
    if (!trimmed) {
      setError(lang === "id" ? "Silakan masukkan string FEN posisi catur." : "Please enter a FEN position string.");
      setPreviewFen(null);
      return;
    }

    try {
      const chess = new Chess(trimmed);
      setPreviewFen(chess.fen());
      setError(null);
    } catch {
      setError(lang === "id" ? "Format FEN tidak valid. Periksa kembali urutan bidak." : "Invalid FEN format. Please check pieces notation.");
      setPreviewFen(null);
    }
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
    <div className="flex flex-col lg:flex-row gap-6 items-start max-w-5xl mx-auto w-full">
      <div className="w-full max-w-[480px] mx-auto aspect-square">
        {previewFen ? (
          <Chessboard
            options={{
              id: "scan-preview-board",
              position: previewFen,
              allowDragging: false,
              lightSquareStyle: { backgroundColor: "#f0d9b5" },
              darkSquareStyle: { backgroundColor: "#b58863" },
              boardStyle: {
                borderRadius: "14px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              },
            }}
          />
        ) : (
          <div className="w-full h-full bg-[#262421] border-2 border-dashed border-[#3d3a37] rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-3">
            <IconScan3D size={56} />
            <div className="font-bold text-white text-base">
              {lang === "id" ? "Pratinjau Posisi Papan Catur" : "Board Position Preview"}
            </div>
            <p className="text-xs text-neutral-400 max-w-xs">
              {lang === "id"
                ? "Masukkan notasi FEN dari turnamen OTB atau pilih preset di samping untuk melihat posisi bidak."
                : "Enter FEN string from your OTB game or select a preset to preview position."}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 w-full">
        <Card className="bg-[#262421] border-[#3d3a37] shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 bg-[#22201d] border-b border-[#36322d]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <IconScan3D size={24} />
                <Badge variant="outline" className="border-[#81b64c]/40 text-[#81b64c] font-bold">
                  {lang === "id" ? "Impor Posisi OTB" : "OTB Position Import"}
                </Badge>
              </div>
              <Badge variant="secondary" className="bg-[#1f1d1a] border border-[#36322d] text-xs">
                FEN 2.0
              </Badge>
            </div>
            <CardTitle className="text-xl mt-2 text-white">
              {lang === "id" ? "Impor dan Analisis Papan Fisik" : "Import and Analyze Physical Game"}
            </CardTitle>
            <CardDescription className="text-neutral-400 font-medium">
              {lang === "id"
                ? "Salin notasi posisi dari lembar turnamen FIDE atau platform catur untuk dianalisis oleh Stockfish."
                : "Paste FEN notation from your tournament scoresheet to evaluate with Stockfish."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 block">
                {lang === "id" ? "Input Notasi FEN:" : "Input FEN String:"}
              </label>
              <textarea
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                placeholder="r1bqk2r/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R1BQ1RK1 w kq - 0 9"
                rows={3}
                className="w-full bg-[#1a1816] border border-[#36322d] rounded-xl p-3 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#81b64c]"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-300 font-medium">
                {error}
              </div>
            )}

            <div className="flex gap-2.5">
              <Button onClick={handleValidate} className="btn-chess-dark flex-1 text-xs py-2.5">
                {lang === "id" ? "Pratinjau Posisi" : "Preview Position"}
              </Button>
              <Button
                onClick={handleLoadToBoard}
                disabled={!previewFen}
                className="btn-chess-green flex-1 text-xs py-2.5 font-bold uppercase tracking-wider"
              >
                {lang === "id" ? "Analisis di Engine" : "Load to Engine"}
              </Button>
            </div>

            <div className="pt-3 border-t border-[#36322d] space-y-2">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                {lang === "id" ? "Preset Pembukaan Populer:" : "Popular Opening Presets:"}
              </div>
              <div className="space-y-1.5">
                {PRESET_POSITIONS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setFenInput(p.fen);
                      setPreviewFen(p.fen);
                      setError(null);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-[#1f1d1a] border border-[#36322d] hover:border-[#81b64c] transition-all flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-white">{p.name}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">Pilih</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
