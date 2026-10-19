"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SessionUser } from "@/lib/use-session";
import { VisionDrill } from "@/components/vision-drill";
import {
  IconMedal3D,
  IconFriends3D,
  IconMessages3D,
  IconSettings3D,
  IconVision3D,
  IconScan3D,
  IconCommunity3D,
  IconBot3D,
  IconLightning3D,
  IconTrophy3D,
  IconStar3D,
  IconPawn3D,
  IconTarget3D,
} from "@/components/icons3d";


interface EcoOpening {
  eco: string;
  name: string;
  moves: string;
  fen: string;
  games: number;
  whiteWin: number;
  draw: number;
  blackWin: number;
  description: string;
}

const ECO_OPENINGS: EcoOpening[] = [
  {
    eco: "B20",
    name: "Sicilian Defense",
    moves: "1. e4 c5",
    fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
    games: 385210,
    whiteWin: 38,
    draw: 32,
    blackWin: 30,
    description: "Pertahanan paling populer dan agresif melawan 1. e4, menciptakan pertarungan sayap asimetris.",
  },
  {
    eco: "C60",
    name: "Ruy Lopez (Spanish Opening)",
    moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
    fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    games: 240110,
    whiteWin: 39,
    draw: 35,
    blackWin: 26,
    description: "Salah satu pembukaan catur klasik tertua, menekan kuda c6 untuk mengontrol petak pusat e5.",
  },
  {
    eco: "D06",
    name: "Queen's Gambit",
    moves: "1. d4 d5 2. c4",
    fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2",
    games: 215800,
    whiteWin: 40,
    draw: 36,
    blackWin: 24,
    description: "Pengorbanan sayap menteri demi merebut dominasi petak pusat papan.",
  },
  {
    eco: "C00",
    name: "French Defense",
    moves: "1. e4 e6",
    fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    games: 160400,
    whiteWin: 37,
    draw: 34,
    blackWin: 29,
    description: "Pertahanan solid dengan rantai pion kuat, menguji kesabaran manuver perwira putih.",
  },
  {
    eco: "B10",
    name: "Caro-Kann Defense",
    moves: "1. e4 c6",
    fen: "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    games: 142300,
    whiteWin: 38,
    draw: 36,
    blackWin: 26,
    description: "Pertahanan sangat kokoh tanpa melemahkan gajah terang, favorit GM Anatoly Karpov.",
  },
  {
    eco: "E60",
    name: "King's Indian Defense (KID)",
    moves: "1. d4 Nf6 2. c4 g6",
    fen: "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
    games: 120500,
    whiteWin: 39,
    draw: 33,
    blackWin: 28,
    description: "Pendekatan hipermodern membiarkan putih menguasai pusat untuk diserang balik di sayap raja.",
  },
  {
    eco: "A04",
    name: "Reti Opening",
    moves: "1. Nf3 d5 2. c4",
    fen: "rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq c3 0 2",
    games: 98400,
    whiteWin: 37,
    draw: 38,
    blackWin: 25,
    description: "Sistem fleksibel tanpa komitmen awal pion pusat, mengontrol pusat dari jauh dengan perwira.",
  },
];

export type MoreSection =
  | "menu"
  | "profile"
  | "stats"
  | "themes"
  | "friends"
  | "messages"
  | "settings"
  | "explorer"
  | "endgames"
  | "drills"
  | "insights"
  | "vision";

interface Props {
  user: SessionUser | null;
  lang?: "id" | "en";
  onOpenDockModal: (type: "friends" | "messages" | "settings") => void;
  onNavigateTab: (tab: any) => void;
}

export function MoreHubView({ user, lang = "id", onOpenDockModal, onNavigateTab }: Props) {
  const [section, setSection] = useState<MoreSection>("menu");

  if (section === "explorer") {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <IconLightning3D size={24} />
              <span>{lang === "id" ? "Penjelajah Pembukaan (Opening Explorer)" : "ECO Opening Explorer"}</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {lang === "id"
                ? "Database statistik langkah pembukaan master catur dunia dan persentase kemenangan."
                : "Master chess opening tree statistics and winning percentages."}
            </p>
          </div>
          <Button variant="outline" onClick={() => setSection("menu")} className="text-xs">
            {lang === "id" ? "← Kembali ke Menu" : "← Back to Menu"}
          </Button>
        </div>

        <div className="space-y-3">
          {ECO_OPENINGS.map((op) => (
            <Card key={op.eco} className="bg-[var(--card)] border border-[var(--border)] p-4 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Badge className="bg-amber-600 text-white font-mono font-black text-xs px-2 py-0.5">
                    {op.eco}
                  </Badge>
                  <h3 className="text-base font-black text-white">{op.name}</h3>
                  <span className="font-mono text-xs text-neutral-400 bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                    {op.moves}
                  </span>
                </div>
                <div className="text-xs text-neutral-400 font-mono">
                  {op.games.toLocaleString()} Games Master
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                {op.description}
              </p>

              {/* Master Winrate Ratio Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                  <span className="text-emerald-400 font-bold">Putih {op.whiteWin}%</span>
                  <span className="text-amber-400 font-bold">Remis {op.draw}%</span>
                  <span className="text-rose-400 font-bold">Hitam {op.blackWin}%</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-neutral-800">
                  <div style={{ width: `${op.whiteWin}%` }} className="bg-emerald-500 h-full" />
                  <div style={{ width: `${op.draw}%` }} className="bg-amber-500 h-full" />
                  <div style={{ width: `${op.blackWin}%` }} className="bg-rose-500 h-full" />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={() => onNavigateTab("play")}
                  variant="outline"
                  className="text-xs ctl ctl-primary h-8"
                >
                  {lang === "id" ? "Latih Posisi Ini →" : "Practice Position →"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (section === "vision") {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <IconVision3D size={24} />
            <span>{lang === "id" ? "Pelatihan Visi Koordinat Papan" : "Vision Coordinate Trainer"}</span>
          </h2>
          <Button variant="outline" onClick={() => setSection("menu")} className="text-xs">
            {lang === "id" ? "← Kembali ke Menu" : "← Back to Menu"}
          </Button>
        </div>
        <VisionDrill lang={lang} />
      </div>
    );
  }

  const menuItems = [
    {
      id: "profile",
      titleId: "Profil Pemain",
      titleEn: "Player Profile",
      descId: "Statistik akun, join date, status rating Tel-U",
      descEn: "Account stats, joined date, rating details",
      icon: <IconTrophy3D size={28} />,
      action: () => setSection("profile"),
      badge: "1650 ELO",
    },
    {
      id: "stats",
      titleId: "Statistik & CAPS",
      titleEn: "Statistics & CAPS",
      descId: "Rasio menang/kalah/remis dan akurasi rata-rata",
      descEn: "Win/loss/draw ratio and average accuracy",
      icon: <IconMedal3D size={28} />,
      action: () => setSection("stats"),
      badge: "88.4% Acc",
    },
    {
      id: "themes",
      titleId: "Corak Papan & Bidak",
      titleEn: "Themes & Visuals",
      descId: "Kustomisasi kayu klasik, kaca modern, neon, dan set bidak 3D",
      descEn: "Customize board wood, glass, neon, and piece sets",
      icon: <IconStar3D size={28} />,
      action: () => onOpenDockModal("settings"),
      badge: "Koleksi",
    },
    {
      id: "friends",
      titleId: "Teman-teman",
      titleEn: "Friends & Social",
      descId: "Daftar kontak online dan tantangan langsung",
      descEn: "Online contacts list and direct game invites",
      icon: <IconFriends3D size={28} />,
      action: () => onOpenDockModal("friends"),
      badge: "Online",
    },
    {
      id: "messages",
      titleId: "Pesan & Notifikasi",
      titleEn: "Messages & Inbox",
      descId: "Kotak masuk obrolan pertandingan dan sistem",
      descEn: "Match chatter and system notifications",
      icon: <IconMessages3D size={28} />,
      action: () => onOpenDockModal("messages"),
      badge: "Kotak Masuk",
    },
    {
      id: "settings",
      titleId: "Pengaturan Permainan",
      titleEn: "Game Settings",
      descId: "Audio, premoves, auto-queen, koordinat, konfirmasi langkah",
      descEn: "Audio sounds, premoves, auto-queen, board coordinates",
      icon: <IconSettings3D size={28} />,
      action: () => onOpenDockModal("settings"),
      badge: "Preferensi",
    },
    {
      id: "explorer",
      titleId: "Penjelajah Pembukaan",
      titleEn: "Opening Explorer",
      descId: "Database teori ECO catur (Sicilian, Ruy Lopez, Queen Gambit)",
      descEn: "ECO chess opening book theory and win percentages",
      icon: <IconLightning3D size={28} />,
      action: () => setSection("explorer"),
      badge: "Database ECO",
    },
    {
      id: "endgames",
      titleId: "Permainan Akhir",
      titleEn: "Endgame Practice",
      descId: "Latihan babak akhir fundamental: Raja + Pion, Benteng, Lucena",
      descEn: "Fundamental endgame positions and technique training",
      icon: <IconPawn3D size={28} />,
      action: () => onNavigateTab("vision"),
      badge: "Endgame",
    },
    {
      id: "vision",
      titleId: "Pelatihan Visi",
      titleEn: "Vision Trainer",
      descId: "Latihan kecepatan membaca notasi dan petak catur dalam 30 detik",
      descEn: "Fast coordinate recognition training in 30 seconds",
      icon: <IconVision3D size={28} />,
      action: () => setSection("vision"),
      badge: "30 Detik",
    },
    {
      id: "scan",
      titleId: "Import & Scan Papan",
      titleEn: "Board Scanner & FEN",
      descId: "Scan foto papan catur fisik atau import notasi FEN / PGN",
      descEn: "Scan physical chessboard photo or import FEN/PGN notation",
      icon: <IconScan3D size={28} />,
      action: () => onNavigateTab("scan"),
      badge: "AI Vision",
    },
    {
      id: "community",
      titleId: "Forum & Klub Catur",
      titleEn: "Community & Clubs",
      descId: "Diskusi taktik Tel-U, leaderboard klub, dan bagikan match",
      descEn: "Campus tactical discussions, club leaderboards, match shares",
      icon: <IconCommunity3D size={28} />,
      action: () => onNavigateTab("community"),
      badge: "Tel-U",
    },
  ];

  if (section === "profile") {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <IconTrophy3D size={24} />
            <span>{lang === "id" ? "Profil Pemain" : "Player Profile"}</span>
          </h2>
          <Button variant="outline" onClick={() => setSection("menu")} className="text-xs">
            {lang === "id" ? "← Kembali" : "← Back"}
          </Button>
        </div>

        <Card className="bg-[var(--card)] border border-[var(--border)] p-5 rounded-2xl space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center font-black text-2xl text-amber-400">
              {user?.fullName ? user.fullName[0].toUpperCase() : "B"}
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                {user?.fullName ?? "Pak Bagas Wibowo"}
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                {user?.username ? `@${user.username}` : "@bagaswibowo"} · {user?.role ?? "Dosen & Peneliti SEAL"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-amber-600 text-white font-mono text-[10px] px-2 py-0.5">
                  TEL-U SEAL
                </Badge>
                <Badge variant="outline" className="border-neutral-700 text-neutral-300 font-mono text-[10px]">
                  Diamond Member
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 text-center">
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Rapid Elo</div>
              <div className="text-lg font-black text-emerald-400 font-mono">1650</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Blitz Elo</div>
              <div className="text-lg font-black text-amber-400 font-mono">1580</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Puzzle Rating</div>
              <div className="text-lg font-black text-cyan-400 font-mono">1890</div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (section === "stats") {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <IconMedal3D size={24} />
            <span>{lang === "id" ? "Statistik Permainan" : "Game Statistics"}</span>
          </h2>
          <Button variant="outline" onClick={() => setSection("menu")} className="text-xs">
            {lang === "id" ? "← Kembali" : "← Back"}
          </Button>
        </div>

        <Card className="bg-[var(--card)] border border-[var(--border)] p-5 rounded-2xl space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-neutral-300">
              <span>Rasio Hasil (Menang 65% / Seri 10% / Kalah 25%)</span>
              <span className="font-mono">128 Match</span>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-neutral-800">
              <div className="bg-emerald-500 h-full w-[65%]" />
              <div className="bg-amber-500 h-full w-[10%]" />
              <div className="bg-rose-500 h-full w-[25%]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-center">
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-neutral-400 font-bold uppercase">Rata-rata Akurasi (CAPS)</div>
              <div className="text-xl font-black text-emerald-400 font-mono">88.4%</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-neutral-400 font-bold uppercase">Langkah Brilian (!!)</div>
              <div className="text-xl font-black text-cyan-400 font-mono">24 Kali</div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-3">
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
          <IconTarget3D size={28} />
          <span>{lang === "id" ? "Selengkapnya (Hub Fitur Catur)" : "More Features Hub"}</span>
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          {lang === "id"
            ? "Akses lengkap seluruh modul catur Chess.com yang direplikasi ke ekosistem JEV Chess."
            : "Complete replication of all Chess.com menu features for JEV Chess."}
        </p>
      </div>

      {/* Grid Menu Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {menuItems.map((item) => (
          <Card
            key={item.id}
            onClick={item.action}
            className="bg-[var(--card)] border border-[var(--border)] hover:border-amber-500/50 p-4 rounded-2xl cursor-pointer transition-all duration-200 group hover:shadow-lg flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                {item.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors truncate">
                    {lang === "id" ? item.titleId : item.titleEn}
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 line-clamp-2 mt-0.5 leading-relaxed">
                  {lang === "id" ? item.descId : item.descEn}
                </p>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] font-mono border-neutral-700 text-neutral-400 shrink-0">
              {item.badge}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
