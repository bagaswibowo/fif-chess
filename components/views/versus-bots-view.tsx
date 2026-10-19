"use client";

import React, { useState } from "react";
import { BOT_PERSONAS, type BotPersona } from "@/lib/bot-personas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconBot3D, IconPlay3D, IconTrophy3D, IconLightning3D, IconTarget3D } from "@/components/icons3d";

export interface VersusBotsViewProps {
  lang?: "id" | "en";
  onSelectBot: (bot: BotPersona) => void;
}

export function VersusBotsView({ lang = "id", onSelectBot }: VersusBotsViewProps) {
  const [filter, setFilter] = useState<"all" | "beginner" | "intermediate" | "master">("all");

  const filteredBots = BOT_PERSONAS.filter((bot) => {
    if (filter === "beginner") return bot.rating <= 1000;
    if (filter === "intermediate") return bot.rating > 1000 && bot.rating <= 2000;
    if (filter === "master") return bot.rating > 2000;
    return true;
  });

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <IconBot3D size={28} />
            <span>{lang === "id" ? "Lawan Bot Komputer" : "Play vs Computer Bots"}</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            {lang === "id"
              ? "Pilih bot kepribadian dengan gaya pembukaan & tingkat kesulitan unik (Arsitektur CEE / Komodo Settings)."
              : "Choose personality bots with custom opening books and tactical difficulty curves."}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "all" ? "bg-[var(--primary)] text-white shadow-xs" : "text-neutral-400 hover:text-white"
            }`}
          >
            {lang === "id" ? "Semua" : "All"}
          </button>
          <button
            onClick={() => setFilter("beginner")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "beginner" ? "bg-[var(--primary)] text-white shadow-xs" : "text-neutral-400 hover:text-white"
            }`}
          >
            {lang === "id" ? "Pemula" : "Beginner"}
          </button>
          <button
            onClick={() => setFilter("intermediate")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "intermediate" ? "bg-[var(--primary)] text-white shadow-xs" : "text-neutral-400 hover:text-white"
            }`}
          >
            {lang === "id" ? "Menengah" : "Intermediate"}
          </button>
          <button
            onClick={() => setFilter("master")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "master" ? "bg-[var(--primary)] text-white shadow-xs" : "text-neutral-400 hover:text-white"
            }`}
          >
            Master
          </button>
        </div>
      </div>

      {/* Bot Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredBots.map((bot) => (
          <Card
            key={bot.id}
            className="bg-[var(--card)] border border-[var(--border)] hover:border-amber-500/50 p-4 rounded-2xl flex flex-col justify-between transition-all duration-200 group hover:shadow-lg"
          >
            <div className="space-y-3">
              {/* Bot Avatar & Badge */}
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform">
                  <IconBot3D size={32} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className="bg-amber-600 text-white font-mono text-[10px] font-black uppercase px-2 py-0.5">
                    {bot.title}
                  </Badge>
                  <span className="text-xs font-mono font-bold text-neutral-300">
                    Elo {bot.rating}
                  </span>
                </div>
              </div>

              {/* Bot Name & Bio */}
              <div>
                <h3 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                  {bot.name}
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed mt-1 line-clamp-2">
                  {lang === "id" ? bot.descriptionId : bot.descriptionEn}
                </p>
              </div>

              {/* Tactical Stats Tags */}
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono">
                <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                  Depth {bot.depth}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] capitalize">
                  {bot.aggression}
                </span>
              </div>
            </div>

            {/* Play CTA */}
            <Button
              onClick={() => onSelectBot(bot)}
              className="w-full mt-4 ctl ctl-primary text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <IconPlay3D size={16} />
              <span>{lang === "id" ? "Tantang Bot" : "Play Bot"}</span>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
