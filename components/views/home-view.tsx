"use client";

/**
 * components/views/home-view.tsx
 * Parity Penuh Antarmuka Chess.com Dashboard (01_Home_Dashboard.html & captures)
 * Terintegrasi dengan Inovasi Ilmiah JEV-Chess (YOLO11 OTB Scanner & FlyBrain Connectome).
 *
 * Struktur:
 *  1. Header Profile: Avatar + Username + Country + 0 Day Streak Badge
 *  2. Hero 4-Column Grid:
 *     - Card 1: Bermain Online (Time Controls 10m/3m/5m + Big Green CTA + 4 Quick Mode Buttons)
 *     - Card 2: Jawab Teka-Teki (MiniBoard Kayu Taktik + Rating 571 + Action)
 *     - Card 3: Pelajaran Berikutnya (MiniBoard Kayu Pembukaan + Serang di Pusat)
 *     - Card 4: Lawan Bot & Inovasi (MiniBoard Tema AI + Stockfish 19 & Jev Elo 3550+)
 *  3. Section Inovasi Khas JEV-Chess:
 *     - Scan Papan Catur Fisik (YOLO11 Computer Vision)
 *     - FlyBrain Neural Connectome Visualizer
 *  4. Split 2-Kolom Utama:
 *     - Kolom Kiri: Riwayat Permainan (Tabel format catur lengkap + Skor + Akurasi + Tombol Ulasan)
 *     - Kolom Kanan (Sidebar): Teka-Teki Harian (Board preview + Solve count), Mulai Rekor Anda (Streak S-S-R-K-J-S-M), Liga Civitas, Teman Komunitas, Statistik.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Swords,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  Bot,
  GraduationCap,
  Check,
  Clock,
  Zap,
} from "lucide-react";
import {
  IconFire3D,
  IconPuzzle3D,
  IconScan3D,
  IconAiBrain3D,
  IconMedal3D,
  IconTimeBlitz,
  IconTimeRapid,
  IconPlay3D,
  IconCheck3D,
} from "@/components/icons3d";
import type { SessionUser } from "@/lib/use-session";

export type HomeNavTarget =
  | "puzzles"
  | "daily"
  | "review"
  | "archive"
  | "play"
  | "scan"
  | "bots"
  | "leaderboard"
  | "tournaments"
  | "courses"
  | "learn"
  | "friends";

type Props = {
  user?: SessionUser | null;
  onNavigate: (tab: HomeNavTarget) => void;
  onPlayGame?: (gameId: string) => void;
  onReviewGame?: (gameId: string) => void;
  onAuthRequest?: () => void;
};

// Helper renderer untuk 8x8 Chessboard Miniatur Taktil (0 dependencies, 100% cepat)
function MiniBoard({ fen, className = "" }: { fen: string; className?: string }) {
  const squares = useMemo(() => {
    const ranks = fen.split(" ")[0].split("/");
    const board: (string | null)[][] = [];
    for (const rank of ranks) {
      const row: (string | null)[] = [];
      for (const ch of rank) {
        if (ch >= "1" && ch <= "8") {
          for (let i = 0; i < parseInt(ch, 10); i++) row.push(null);
        } else {
          const color = ch === ch.toUpperCase() ? "w" : "b";
          const type = ch.toUpperCase();
          row.push(`${color}${type}`);
        }
      }
      board.push(row);
    }
    return board;
  }, [fen]);

  return (
    <div
      className={`aspect-square grid grid-cols-8 grid-rows-8 rounded-lg overflow-hidden shadow-inner border border-[#45423e] ${className}`}
      style={{ minWidth: "96px", minHeight: "96px" }}
    >
      {squares.map((row, rIdx) =>
        row.map((piece, cIdx) => {
          const isDark = (rIdx + cIdx) % 2 === 1;
          return (
            <div
              key={`${rIdx}-${cIdx}`}
              className="relative w-full h-full flex items-center justify-center"
              style={{ backgroundColor: isDark ? "#b58863" : "#f0d9b5" }}
            >
              {piece && (
                <img
                  src={`/pieces/staunty/${piece}.png`}
                  alt={piece}
                  className="w-[88%] h-[88%] object-contain select-none pointer-events-none drop-shadow"
                  loading="lazy"
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// Preset posisi papan miniatur khas Chess.com
const FEN_PUZZLE = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const FEN_LESSON = "rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3";
const FEN_BOT = "r1b1k2r/pppp1ppp/8/4n3/1b2P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 6";
const FEN_DAILY = "2r3k1/1p3ppp/pb1p4/3P4/1P2bP2/P3N2q/5R1P/4Q1K1 b - - 0 28";

export function HomeView({ user, onNavigate, onPlayGame, onReviewGame, onAuthRequest }: Props) {
  const [selectedTc, setSelectedTc] = useState<string>("10+0");
  const username = user?.username ?? "zenwisteriaclarines";
  const elo = user?.elo ?? 1200;

  return (
    <div className="w-full max-w-[1260px] mx-auto px-2 sm:px-4 py-3 space-y-6 text-[#c3c2c1]">
      {/* 1. HEADER PROFILE & STREAK (Pola Chess.com: Avatar + User Tagline + 0 Day Streak) */}
      <header className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#363431]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-black text-lg shadow-md border border-[#4a4743]">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-white hover:text-[#81b64c] transition-colors cursor-pointer">
                {username}
              </span>
              <span className="text-[10px] bg-[#363431] text-[#989795] font-bold px-1.5 py-0.5 rounded border border-[#45423e]">
                🇮🇩 ID
              </span>
            </div>
            <p className="text-xs text-[#989795]">
              Rating Cepat: <span className="text-white font-bold">{elo}</span> · Anggota Tel-U
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!user && onAuthRequest && (
            <button
              onClick={onAuthRequest}
              className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-[#363431] border border-[#81b64c] text-[#81b64c] hover:bg-[#81b64c]/10 transition-colors shadow-sm"
            >
              Masuk / Daftar
            </button>
          )}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#262421] border border-[#3d3a34] shadow-sm cursor-pointer hover:border-[#81b64c] transition-colors"
            title="Rentetan Harian Teka-Teki & Permainan"
          >
            <IconFire3D size={20} aria-hidden="true" />
            <div>
              <span className="text-xs font-black text-white block leading-tight">0 Day Streak</span>
              <span className="text-[10px] text-[#989795] block">Mulai Rekor Anda</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. HERO PLAY GRID (4 CARDS: Bermain Online, Teka-Teki, Pelajaran, Lawan Bot) */}
      <section
        aria-label="Aktivitas Utama Catur"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch"
      >
        {/* Card 1: Bermain Online (Quick Start & 4 Mode Links) */}
        <div className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-3.5 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-black text-white uppercase tracking-wider">Bermain Online</h2>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Live
              </span>
            </div>

            {/* Time Selector Buttons */}
            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
              {[
                { tc: "10+0", label: "10 mnt", desc: "Cepat" },
                { tc: "3+0", label: "3 mnt", desc: "Kilat" },
                { tc: "5+0", label: "5 mnt", desc: "Kilat" },
              ].map((item) => (
                <button
                  key={item.tc}
                  onClick={() => setSelectedTc(item.tc)}
                  className={`py-1 px-1.5 rounded-lg border text-center transition-all ${
                    selectedTc === item.tc
                      ? "bg-[#363431] border-[#81b64c] text-white shadow-sm font-black"
                      : "bg-[#1f1e1b] border-[#363431] text-[#989795] hover:border-neutral-500 font-bold"
                  }`}
                >
                  <div className="text-xs leading-tight">{item.label}</div>
                  <div className="text-[9px] opacity-70">{item.desc}</div>
                </button>
              ))}
            </div>

            {/* Big Green Tactile CTA Button */}
            <button
              onClick={() => onNavigate("play")}
              className="w-full py-2.5 rounded-xl font-black text-xs uppercase text-black tracking-wider transition-all transform active:scale-95 shadow-[0_4px_0_#45753c] hover:brightness-105"
              style={{ backgroundColor: "#81b64c" }}
            >
              Mulai Permainan
            </button>
          </div>

          {/* 4 Mode Links Grid */}
          <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2.5 border-t border-[#363431]">
            <button
              onClick={() => onNavigate("play")}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#312e2b] border border-[#3d3a34] text-[11px] font-bold text-white hover:bg-[#3d3a34] transition-colors"
            >
              <Swords size={14} className="text-[#81b64c]" />
              <span className="truncate">Main Online</span>
            </button>
            <button
              onClick={() => onNavigate("tournaments")}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#312e2b] border border-[#3d3a34] text-[11px] font-bold text-white hover:bg-[#3d3a34] transition-colors"
            >
              <Trophy size={14} className="text-amber-400" />
              <span className="truncate">Turnamen</span>
            </button>
            <button
              onClick={() => onNavigate("bots")}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#312e2b] border border-[#3d3a34] text-[11px] font-bold text-white hover:bg-[#3d3a34] transition-colors"
            >
              <Bot size={14} className="text-blue-400" />
              <span className="truncate">Lawan Pelatih</span>
            </button>
            <button
              onClick={() => onNavigate("friends")}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#312e2b] border border-[#3d3a34] text-[11px] font-bold text-white hover:bg-[#3d3a34] transition-colors"
            >
              <Users size={14} className="text-purple-400" />
              <span className="truncate">Lawan Teman</span>
            </button>
          </div>
        </div>

        {/* Card 2: Jawab Teka-Teki (Tactics MiniBoard Preview) */}
        <div
          onClick={() => onNavigate("puzzles")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigate("puzzles");
          }}
          className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-3.5 flex flex-col justify-between shadow-md cursor-pointer hover:border-[#81b64c] transition-all group"
        >
          <div className="flex justify-center mb-2">
            <MiniBoard fen={FEN_PUZZLE} className="w-28 h-28 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-white group-hover:text-[#81b64c] transition-colors">
                Jawab Teka-Teki
              </span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                ⭐ 571
              </span>
            </div>
            <p className="text-[11px] text-[#989795] line-clamp-1 mb-2">Latihan taktis sesuai kemampuanmu</p>
            <button className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#312e2b] border border-[#3d3a34] text-white group-hover:bg-[#81b64c] group-hover:text-black group-hover:border-[#81b64c] transition-all">
              Jawab Teka-Teki →
            </button>
          </div>
        </div>

        {/* Card 3: Pelajaran Berikutnya (Lessons MiniBoard Preview) */}
        <div
          onClick={() => onNavigate("learn")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigate("learn");
          }}
          className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-3.5 flex flex-col justify-between shadow-md cursor-pointer hover:border-blue-400 transition-all group"
        >
          <div className="flex justify-center mb-2">
            <MiniBoard fen={FEN_LESSON} className="w-28 h-28 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">
              Pelajaran Berikutnya
            </div>
            <div className="text-xs font-black text-white group-hover:text-blue-400 transition-colors mb-1 truncate">
              Serang di Pusat
            </div>
            <p className="text-[11px] text-[#989795] line-clamp-1 mb-2">Kuasai kotak tengah dengan bidak</p>
            <button className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#312e2b] border border-[#3d3a34] text-white group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 transition-all">
              Lanjutkan Belajar →
            </button>
          </div>
        </div>

        {/* Card 4: Lawan Bot AI & Connectome (Bot MiniBoard Preview) */}
        <div
          onClick={() => onNavigate("bots")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigate("bots");
          }}
          className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-3.5 flex flex-col justify-between shadow-md cursor-pointer hover:border-purple-400 transition-all group"
        >
          <div className="flex justify-center mb-2">
            <MiniBoard fen={FEN_BOT} className="w-28 h-28 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-white group-hover:text-purple-400 transition-colors truncate">
                Stockfish 19 &amp; Jev
              </span>
              <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">
                3550+
              </span>
            </div>
            <p className="text-[11px] text-[#989795] line-clamp-1 mb-2">Invincible NNUE + Neural Connectome</p>
            <button className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#312e2b] border border-[#3d3a34] text-white group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 transition-all">
              Lawan Bot →
            </button>
          </div>
        </div>
      </section>

      {/* 3. INOVASI ILMIAH KHAS JEV-CHESS (Computer Vision YOLO11 & Connectome Visualizer) */}
      <section aria-label="Inovasi Riset JEV" className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div
          onClick={() => onNavigate("scan")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigate("scan");
          }}
          className="rounded-2xl border border-amber-500/30 bg-[#262421] p-4 flex items-start gap-3.5 cursor-pointer hover:border-amber-400 transition-all shadow-md active:scale-[0.99] group"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0 group-hover:bg-amber-500/20 transition-colors">
            <IconScan3D size={26} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                Scan Papan Catur Fisik (OTB)
              </span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                YOLO11
              </span>
            </div>
            <p className="text-xs text-[#989795] leading-relaxed">
              Foto papan catur turnamen nyata untuk diubah instan menjadi FEN dan dibuka 1-klik di papan analisis Stockfish 19.
            </p>
          </div>
        </div>

        <div
          onClick={() => onNavigate("bots")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNavigate("bots");
          }}
          className="rounded-2xl border border-purple-500/30 bg-[#262421] p-4 flex items-start gap-3.5 cursor-pointer hover:border-purple-400 transition-all shadow-md active:scale-[0.99] group"
        >
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 shrink-0 group-hover:bg-purple-500/20 transition-colors">
            <IconAiBrain3D size={26} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black text-white group-hover:text-purple-400 transition-colors">
                FlyBrain Connectome AI
              </span>
              <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">
                Neurosymbolic
              </span>
            </div>
            <p className="text-xs text-[#989795] leading-relaxed">
              Jelajahi visualisasi graf aktivasi saraf kognitif saat Stockfish dan TypeSafe Jev menimbang langkah catur.
            </p>
          </div>
        </div>
      </section>

      {/* 4. SPLIT 2-KOLOM UTAMA (KIRI: Riwayat Permainan | KANAN: Sidebar Widgets) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* KOLOM KIRI (Main Column: Riwayat Permainan Lengkap) */}
        <section
          aria-labelledby="game-history-heading"
          className="lg:col-span-8 rounded-2xl border border-[#3d3a34] bg-[#262421] p-4 shadow-md space-y-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#363431]">
            <h2 id="game-history-heading" className="text-sm font-black text-white uppercase tracking-wider">
              Riwayat Permainan
            </h2>
            <button
              onClick={() => onNavigate("archive")}
              className="text-xs font-bold text-[#81b64c] hover:underline"
            >
              Lihat Semua Arsip →
            </button>
          </div>

          {/* Tabel Game History ala Chess.com */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="text-[11px] font-bold text-[#989795] border-b border-[#363431] pb-2">
                  <th className="py-2 px-2">WAKTU</th>
                  <th className="py-2 px-2">PEMAIN</th>
                  <th className="py-2 px-2 text-center">HASIL</th>
                  <th className="py-2 px-2 text-center">AKURASI</th>
                  <th className="py-2 px-2 text-center">LANGKAH</th>
                  <th className="py-2 px-2">TANGGAL</th>
                  <th className="py-2 px-2 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#312e2b]">
                {[
                  {
                    id: "g-101",
                    tc: "3 mnt",
                    icon: Zap,
                    white: "hjemmehelten",
                    wElo: 212,
                    black: username,
                    bElo: 195,
                    result: "1 - 0",
                    won: false,
                    accuracy: "82.4%",
                    moves: 29,
                    date: "28 Okt 2026",
                  },
                  {
                    id: "g-102",
                    tc: "3 hari",
                    icon: Clock,
                    white: "SumitaLahiri",
                    wElo: 805,
                    black: username,
                    bElo: 400,
                    result: "1 - 0",
                    won: false,
                    accuracy: "76.1%",
                    moves: 2,
                    date: "27 Okt 2026",
                  },
                  {
                    id: "g-103",
                    tc: "10 mnt",
                    icon: Clock,
                    white: username,
                    wElo: 358,
                    black: "fatimaistrying",
                    bElo: 358,
                    result: "½ - ½",
                    won: null,
                    accuracy: "88.7%",
                    moves: 46,
                    date: "26 Okt 2026",
                  },
                  {
                    id: "g-104",
                    tc: "10 mnt",
                    icon: Clock,
                    white: "wahidinsyahrir",
                    wElo: 1240,
                    black: "Agusrozy14",
                    bElo: 1215,
                    result: "1 - 0",
                    won: true,
                    accuracy: "85.3%",
                    moves: 34,
                    date: "25 Okt 2026",
                  },
                  {
                    id: "g-105",
                    tc: "5 mnt",
                    icon: Zap,
                    white: "febrinugroho",
                    wElo: 1180,
                    black: "PolyBhattacharjee",
                    bElo: 1150,
                    result: "0 - 1",
                    won: false,
                    accuracy: "79.8%",
                    moves: 38,
                    date: "24 Okt 2026",
                  },
                ].map((row) => (
                  <tr key={row.id} className="hover:bg-[#312e2b]/60 transition-colors">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5 font-bold text-neutral-300">
                        <row.icon size={13} className="text-amber-400" />
                        <span>{row.tc}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="font-bold text-white flex flex-col">
                        <span className="truncate max-w-[140px]">
                          ⚪ {row.white} <span className="text-[#989795] font-normal">({row.wElo})</span>
                        </span>
                        <span className="truncate max-w-[140px]">
                          ⚫ {row.black} <span className="text-[#989795] font-normal">({row.bElo})</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-black text-xs ${
                          row.won === true
                            ? "bg-[#81b64c]/20 text-[#81b64c]"
                            : row.won === false
                            ? "bg-red-500/20 text-red-400"
                            : "bg-neutral-500/20 text-neutral-300"
                        }`}
                      >
                        {row.result}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-400">
                      {row.accuracy}
                    </td>
                    <td className="py-2.5 px-2 text-center text-[#989795] font-bold">
                      {row.moves}
                    </td>
                    <td className="py-2.5 px-2 text-[#989795] whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        onClick={() => onNavigate("review")}
                        className="px-2.5 py-1 rounded bg-[#312e2b] border border-[#3d3a34] hover:bg-[#81b64c] hover:text-black hover:border-[#81b64c] font-black text-[11px] text-white transition-all shadow-sm"
                      >
                        Ulasan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* KOLOM KANAN (Sidebar Widgets: Teka-Teki Harian, Streak Kalender, Liga, Teman, Stats) */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Widget 1: Teka-Teki Harian (Daily Puzzle) */}
          <div className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#363431]">
              <span className="text-xs font-black text-white uppercase tracking-wider">Teka-Teki Harian</span>
              <span className="text-[10px] font-bold text-amber-400">Resmi Hari Ini</span>
            </div>

            <div className="flex justify-center py-1">
              <MiniBoard fen={FEN_DAILY} className="w-36 h-36" />
            </div>

            <div>
              <div className="text-xs font-black text-white">Let Your Pieces Cook</div>
              <div className="text-[11px] text-[#989795] mb-2">Diselesaikan oleh 123.817 pemain</div>
              <button
                onClick={() => onNavigate("daily")}
                className="w-full py-2 rounded-xl font-black text-xs uppercase text-black tracking-wider transition-all transform active:scale-95 shadow-[0_3px_0_#45753c] hover:brightness-105"
                style={{ backgroundColor: "#81b64c" }}
              >
                Selesaikan Teka-Teki Harian
              </button>
            </div>
          </div>

          {/* Widget 2: Mulai Rekor Anda (Streak 7 Hari Kalender) */}
          <div className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-4 shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-wider">Mulai Rekor Anda</span>
              <IconFire3D size={16} />
            </div>
            <p className="text-[11px] text-[#989795]">Bermain atau jawab puzzle setiap hari untuk membangun streak</p>
            <div className="flex items-center justify-between pt-1">
              {["S", "S", "R", "K", "J", "S", "M"].map((day, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px] border ${
                      idx === 1
                        ? "bg-[#81b64c] text-black border-[#81b64c] shadow-sm"
                        : "bg-[#1f1e1b] border-[#363431] text-[#989795]"
                    }`}
                  >
                    {idx === 1 ? <Check size={14} /> : day}
                  </div>
                  <span className="text-[9px] text-[#989795]">{day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Widget 3: Elite League / Peringkat Civitas */}
          <div className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-4 shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-wider">Elite League</span>
              <Trophy size={14} className="text-amber-400" />
            </div>
            <p className="text-xs font-bold text-white">
              Anda berada di peringkat <span className="text-[#81b64c]">38th</span>
            </p>
            <p className="text-[11px] text-[#989795]">Liga Divisi Civitas FIF Telkom University</p>
            <button
              onClick={() => onNavigate("leaderboard")}
              className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#312e2b] border border-[#3d3a34] text-white hover:bg-[#3d3a34] transition-colors"
            >
              Lihat Klasemen Lengkap
            </button>
          </div>

          {/* Widget 4: Teman Komunitas */}
          <div className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-4 shadow-md space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-[#363431]">
              <span className="text-xs font-black text-white uppercase tracking-wider">Teman</span>
              <Users size={14} className="text-purple-400" />
            </div>
            <div className="space-y-1.5">
              {[
                { name: "wahidinsyahrir", elo: 1240, status: "Online" },
                { name: "Agusrozy14", elo: 1215, status: "Bermain..." },
                { name: "wsningrat", elo: 1190, status: "Offline" },
                { name: "febrinugroho", elo: 1180, status: "Offline" },
              ].map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-[#312e2b] transition-colors"
                >
                  <span className="font-bold text-white truncate max-w-[130px]">
                    @{f.name} <span className="text-[#989795] font-normal">({f.elo})</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      f.status === "Online"
                        ? "text-[#81b64c]"
                        : f.status === "Bermain..."
                        ? "text-amber-400"
                        : "text-[#989795]"
                    }`}
                  >
                    ● {f.status}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => onNavigate("friends")}
              className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#312e2b] border border-[#3d3a34] text-white hover:bg-[#3d3a34] transition-colors"
            >
              Bermain dengan Teman
            </button>
          </div>

          {/* Widget 5: Statistik Permainan */}
          <div className="rounded-2xl border border-[#3d3a34] bg-[#262421] p-4 shadow-md space-y-2">
            <div className="text-xs font-black text-white uppercase tracking-wider pb-1 border-b border-[#363431]">
              Statistik Permainan
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#1f1e1b] p-2 rounded-lg border border-[#363431]">
                <div className="text-[10px] text-[#989795]">Teka-Teki Selesai</div>
                <div className="text-sm font-black text-amber-400">804</div>
              </div>
              <div className="bg-[#1f1e1b] p-2 rounded-lg border border-[#363431]">
                <div className="text-[10px] text-[#989795]">Pelajaran Diikuti</div>
                <div className="text-sm font-black text-blue-400">29</div>
              </div>
              <div className="bg-[#1f1e1b] p-2 rounded-lg border border-[#363431]">
                <div className="text-[10px] text-[#989795]">Rating Cepat</div>
                <div className="text-sm font-black text-emerald-400">400</div>
              </div>
              <div className="bg-[#1f1e1b] p-2 rounded-lg border border-[#363431]">
                <div className="text-[10px] text-[#989795]">Rating Kilat</div>
                <div className="text-sm font-black text-purple-400">358</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
