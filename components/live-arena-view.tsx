"use client";
import { TacticalCommentaryCard } from "@/components/tactical-commentary-card";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Share2, ArrowLeft, Radio, Eye } from "lucide-react";
import { IconBot3D, IconLightning3D, IconPawn3D } from "@/components/icons3d";
import { EvalBar } from "@/components/eval-bar";
import { CapturedPiecesBar } from "@/components/captured-pieces";

type LiveMatchSummary = {
  id: string;
  whiteName: string;
  blackName: string;
  fen: string;
  plyCount: number;
  createdAt: number;
  updatedAt: number;
  over: boolean;
  outcomeLabel?: string;
  hasCommentary: boolean;
};

export function LiveArenaView({
  lang = "id",
  initialMatchId,
  onBackToPlay,
  onSelectMatch,
}: {
  lang?: "id" | "en";
  initialMatchId?: string | null;
  onBackToPlay?: () => void;
  onSelectMatch?: (id: string) => void;
}) {
  const [matches, setMatches] = useState<LiveMatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(initialMatchId || null);
  const [matchDetail, setMatchDetail] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // Auto-detect spectate param from URL if not provided
  useEffect(() => {
    if (!selectedMatchId && typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("spectate");
      if (p) setSelectedMatchId(p);
    }
  }, [selectedMatchId]);

  // Fetch list of active public broadcasts
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fetchMatches = async () => {
      try {
        const res = await fetch("/api/broadcast");
        if (res.ok) {
          const data = await res.json();
          if (data?.matches) {
            setMatches(data.matches);
          }
        }
      } catch (_) {}
      setLoadingList(false);
      timer = setTimeout(fetchMatches, 3000);
    };

    fetchMatches();
    return () => clearTimeout(timer);
  }, []);

  // Poll selected match details in real-time
  useEffect(() => {
    if (!selectedMatchId) {
      setMatchDetail(null);
      return;
    }

    let timer: NodeJS.Timeout;
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/broadcast?id=${selectedMatchId}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.match) {
            setMatchDetail(data.match);
          }
        }
      } catch (_) {}
      timer = setTimeout(fetchDetail, 1200);
    };

    fetchDetail();
    return () => clearTimeout(timer);
  }, [selectedMatchId]);

  const currentFen = matchDetail?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const comm = matchDetail?.commentary;

  // Compute live arrows for spectator view
  const arrows = useMemo(() => {
    if (!comm) return [];
    const list: { startSquare: string; endSquare: string; color: string }[] = [];
    if (comm.lastUci && comm.lastUci.length >= 4) {
      list.push({ startSquare: comm.lastUci.slice(0, 2), endSquare: comm.lastUci.slice(2, 4), color: "#eab308" });
    }
    if (comm.threatFrom && comm.threatTo && comm.threatFrom !== comm.threatTo) {
      list.push({ startSquare: comm.threatFrom, endSquare: comm.threatTo, color: "#ef4444" });
    }
    if (comm.predFrom && comm.predTo && comm.predFrom !== comm.predTo) {
      list.push({ startSquare: comm.predFrom, endSquare: comm.predTo, color: "#38bdf8" });
    }
    if (comm.stratFrom && comm.stratTo && comm.stratFrom !== comm.stratTo) {
      list.push({ startSquare: comm.stratFrom, endSquare: comm.stratTo, color: "#10b981" });
    }
    return list;
  }, [comm]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/?spectate=${selectedMatchId || ""}` : "";

  // VIEW 1: ARENA FULLSCREEN PENONTON DENGAN KOMENTATOR AI AKTIF
  if (selectedMatchId && matchDetail) {
    return (
      <div className="h-full max-h-full flex flex-col min-h-0 space-y-2 p-1 md:p-2">
        {/* TOP BAR PENONTON */}
        <div className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] shrink-0 shadow-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMatchId(null)}
              className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-neutral-800 border border-[var(--border)] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Daftar Pertarungan</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs md:text-sm font-black text-white uppercase tracking-wider">
                Siaran Langsung: {matchDetail.id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (shareUrl) {
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }
              }}
              className="py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Salin Link Siaran Publik"
            >
              {copiedLink ? <Check size={14} className="text-emerald-300" /> : <Share2 size={14} />}
              <span>{copiedLink ? "Link Tersalin!" : "Bagikan Siaran"}</span>
            </button>
          </div>
        </div>

        {/* TWO-COLUMN SPECTATOR ARENA (Mirip Layout Fullscreen Pemain) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-2 md:gap-3 items-center w-full overflow-hidden">
          {/* SISI KIRI: PAPAN CATUR FULLSCREEN PENONTON */}
          <div className="flex flex-col justify-center items-center h-full max-h-full min-h-0 w-full max-w-[min(100%,var(--board-cap))] mx-auto space-y-1 md:space-y-1.5">
            {/* Kartu Pemain Hitam (Top) */}
            <div className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center font-bold text-xs text-white">
                  ♚
                </div>
                <div>
                  <div className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                    <span>{matchDetail.blackName}</span>
                    <span className="text-xs font-normal text-neutral-400">(Hitam)</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono font-bold">● SEDANG BERTANDING</div>
                </div>
              </div>
              <CapturedPiecesBar fen={currentFen} side="black" />
            </div>

            {/* Papan Catur Fullscreen + Eval Bar */}
            <div className="flex gap-2 items-stretch justify-center w-full aspect-square max-h-full">
              <EvalBar fen={currentFen} scoreCp={matchDetail.scoreCp ?? 0} orientation="white" />
              <div className="aspect-square flex-1 min-w-0 rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-2xl bg-[var(--board-dark)] relative">
                <Chessboard
                  options={{
                    id: "live-spectator-board",
                    position: currentFen,
                    boardOrientation: "white",
                    allowDragging: false,
                    arrows,
                    boardStyle: {
                      backgroundColor: "var(--board-dark)",
                      gridTemplateRows: "repeat(8, 1fr)",
                      gap: 0,
                      width: "100%",
                      height: "100%",
                    },
                    darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                    lightSquareStyle: { backgroundColor: "var(--board-light)" },
                    animationDurationInMs: 250,
                  }}
                />
              </div>
            </div>

            {/* Kartu Pemain Putih (Bottom) */}
            <div className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white border border-neutral-300 flex items-center justify-center font-bold text-xs text-black">
                  ♔
                </div>
                <div>
                  <div className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                    <span>{matchDetail.whiteName}</span>
                    <span className="text-xs font-normal text-neutral-400">(Putih)</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono font-bold">● SEDANG BERTANDING</div>
                </div>
              </div>
              <CapturedPiecesBar fen={currentFen} side="white" />
            </div>
          </div>

          {/* SISI KANAN: KOMENTATOR & TAKTIK AI AKTIF UNTUK PENONTON */}
          <div className="h-full max-h-full min-h-0 flex flex-col overflow-hidden justify-center">
            <TacticalCommentaryCard
              commentary={comm}
              scoreCp={matchDetail?.scoreCp}
              badgeTitle="Komentator & Taktik AI"
              badgeSubtitle="Mode Penonton"
              isLive={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: DIREKTORI DAFTAR PERTARUNGAN LANGSUNG (LIVE DIRECTORY)
  return (
    <div className="h-full max-h-full flex flex-col min-h-0 space-y-4 p-3 md:p-5 overflow-y-auto custom-scrollbar">
      {/* Header Banner */}
      <div className="p-4 md:p-6 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-red-950/40 via-[var(--card)] to-neutral-900/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shadow-lg">
            <Radio size={28} className="text-red-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-wider">
                Pertarungan Langsung (Live Arena)
              </h2>
            </div>
            <p className="text-xs text-neutral-300 mt-0.5">
              Tonton pertarungan catur civitas kampus &amp; AI secara publik lengkap dengan analisis Komentator &amp; Taktik AI.
            </p>
          </div>
        </div>

        {onBackToPlay && (
          <button
            onClick={onBackToPlay}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
          >
            Mulai Bermain Sendiri
          </button>
        )}
      </div>

      {/* Grid Pertandingan Aktif */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <span>Daftar Siaran Aktif</span>
            <Badge className="bg-red-500/20 text-red-300 border border-red-500/40 text-xs">
              {matches.length} Laga Live
            </Badge>
          </div>
        </div>

        {loadingList ? (
          <div className="text-center py-12 text-neutral-400 text-sm">
            Memuat siaran langsung...
          </div>
        ) : matches.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40 text-center space-y-3">
            <Radio size={36} className="mx-auto text-neutral-500" />
            <div className="text-sm font-bold text-neutral-200">
              Belum Ada Pertandingan Publik yang Sedang Berlangsung
            </div>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Saat pemain memulai pertandingan di menu Bermain dan menyetujui siaran publik, laga akan otomatis muncul di sini untuk ditonton semua orang.
            </p>
            {onBackToPlay && (
              <button
                onClick={onBackToPlay}
                className="mt-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold transition-all shadow-sm"
              >
                Mulai Pertandingan Sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {matches.map((m) => (
              <Card
                key={m.id}
                className="panel border-[var(--border)] hover:border-red-500/50 transition-all shadow-md bg-[var(--card)] overflow-hidden flex flex-col justify-between"
              >
                <CardHeader className="p-3 border-b border-[var(--border)] bg-[var(--surface)] flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono text-xs font-bold text-white uppercase">{m.id}</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                    {m.over ? "Selesai" : "Sedang Laga"}
                  </Badge>
                </CardHeader>

                <CardContent className="p-3.5 space-y-3">
                  {/* Pemain Putih vs Hitam */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-white border border-neutral-300 shrink-0" />
                        <span className="font-bold text-white truncate max-w-[150px]">{m.whiteName}</span>
                      </div>
                      <span className="text-neutral-400 font-mono text-[11px]">Putih</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-neutral-900 border border-neutral-600 shrink-0" />
                        <span className="font-bold text-white truncate max-w-[150px]">{m.blackName}</span>
                      </div>
                      <span className="text-neutral-400 font-mono text-[11px]">Hitam</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-neutral-400">
                    <span>{m.plyCount} Langkah</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <IconBot3D size={14} /> AI Komentator Siap
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (onSelectMatch) {
                        onSelectMatch(m.id);
                      } else {
                        setSelectedMatchId(m.id);
                      }
                    }}
                    className="w-full py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <Eye size={15} />
                    <span>Tonton Siaran Langsung</span>
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
