"use client";

import React from "react";
import { IconBot3D } from "@/components/icons3d";
import { Badge } from "@/components/ui/badge";

export type TacticalCommentaryData = {
  moveSan?: string;
  actorName?: string;
  summary?: string;
  target?: string;
  prediction?: string;
  strategicPlan?: string;
  strategicGoal?: string;
  chain3Moves?: string;
  tacticalBadge?: { name: string; description: string; badgeColor: string } | null;
  pvText?: string;
  lastUci?: string;
  threatFrom?: string;
  threatTo?: string;
  predFrom?: string;
  predTo?: string;
  stratFrom?: string;
  stratTo?: string;
};

export function TacticalCommentaryCard({
  commentary,
  scoreCp = null,
  badgeTitle = "Komentator & Taktik AI",
  badgeSubtitle,
  isLive = false,
}: {
  commentary?: TacticalCommentaryData | null;
  scoreCp?: number | null;
  badgeTitle?: string;
  badgeSubtitle?: string;
  isLive?: boolean;
}) {
  const evalValue = scoreCp !== null && typeof scoreCp === "number" ? scoreCp / 100 : null;

  return (
    <div className="rounded-xl border border-[var(--border)] text-white shadow-xl overflow-hidden flex flex-col bg-[var(--card)] w-full">
      {/* HEADER */}
      <div className="py-2 px-3 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
        <div className="flex items-center gap-2">
          <IconBot3D size={18} className="shrink-0 text-emerald-400" />
          <div className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
            <span>{badgeTitle}</span>
            {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {evalValue !== null && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] text-emerald-400 font-bold">
              Eval: {evalValue > 0 ? "+" + evalValue.toFixed(2) : evalValue.toFixed(2)}
            </span>
          )}
          {badgeSubtitle && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
              {badgeSubtitle}
            </Badge>
          )}
        </div>
      </div>

      {/* CONTENT: Compact & Complete (No Clipping, Semua 4 Aspek Terlihat) */}
      <div className="p-2.5 sm:p-3 space-y-2 text-[12px] leading-relaxed overflow-y-auto max-h-[min(560px,72dvh)] custom-scrollbar">
        {/* 4 LABEL INDIKATOR VISUAL */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px] font-bold">
          <div className="flex items-center justify-center gap-1 text-neutral-300">
            <span className="w-2 h-2 rounded bg-yellow-500 border border-yellow-300 shrink-0" />
            <span className="truncate">Langkah</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-red-400">
            <span className="w-2 h-2 rounded bg-red-500 border border-red-300 shrink-0" />
            <span className="truncate">Ancaman</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-sky-400">
            <span className="w-2 h-2 rounded bg-sky-400 border border-sky-300 shrink-0" />
            <span className="truncate">Prediksi</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded bg-emerald-500 border border-emerald-300 shrink-0" />
            <span className="truncate">Strategi</span>
          </div>
        </div>

        {commentary ? (
          <>
            {/* BADGE TAKTIS & PENJELASAN (KOMPAK) */}
            {commentary.tacticalBadge && (
              <div className="p-2 rounded-lg border border-amber-500/40 text-[11.5px] text-neutral-200 leading-snug bg-[var(--surface)] space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10.5px] font-black px-2 py-0.2 rounded-full border shadow-sm inline-block ${commentary.tacticalBadge.badgeColor}`}>
                    {commentary.tacticalBadge.name}
                  </span>
                </div>
                <div className="italic text-neutral-300 text-[11px] pt-0.5">
                  {commentary.tacticalBadge.description}
                </div>
              </div>
            )}

            {/* RINGKASAN LANGKAH & ANCAMAN */}
            <div className="space-y-1 bg-[var(--surface)]/50 p-2 rounded-lg border border-[var(--border)] text-[11.5px]">
              {commentary.summary && (
                <div className="flex items-start gap-1.5">
                  <span className="text-yellow-400 font-bold shrink-0">● Langkah:</span>
                  <span className="text-white font-bold leading-tight">{commentary.summary}</span>
                </div>
              )}
              {commentary.target && (
                <div className="flex items-start gap-1.5">
                  <span className="text-red-400 font-bold shrink-0">● Ancaman:</span>
                  <span className="text-neutral-200 font-medium leading-tight">{commentary.target}</span>
                </div>
              )}
            </div>

            {/* PREDIKSI BALASAN LAWAN (SKY BLUE) */}
            <div className="p-2 rounded-xl border border-sky-500/40 text-[11.5px] shadow-inner" style={{ background: "rgba(14, 34, 48, 0.75)" }}>
              <div className="font-bold text-sky-400 text-xs flex items-center justify-between mb-0.5">
                <span>Prediksi Respons Lawan:</span>
                <span className="text-[10px] text-sky-300/80 font-mono">Sebelum Lawan Melangkah</span>
              </div>
              <div className="text-sky-100 italic font-medium leading-tight">
                {commentary.prediction || "Menganalisis respon langkah lawan..."}
              </div>
            </div>

            {/* TUJUAN STRATEGI BIDAK (EMERALD GREEN) - Selalu Tampil */}
            <div className="p-2 rounded-xl border border-emerald-500/40 text-[11.5px] shadow-inner" style={{ background: "rgba(6, 40, 28, 0.75)" }}>
              <div className="font-bold text-emerald-400 text-xs flex items-center justify-between mb-1">
                <span>Tujuan Strategi {commentary.moveSan ? `(${commentary.moveSan})` : ""}:</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/25 text-emerald-300 rounded font-semibold border border-emerald-500/40">
                  {commentary.strategicGoal || "Posisi & Manuver"}
                </span>
              </div>
              <div className="text-emerald-100 font-medium leading-tight mb-1">
                {commentary.strategicPlan || "Mengembangkan koordinasi perwira dan memperkuat inisiatif ruang pertarungan."}
              </div>
              {commentary.chain3Moves && (
                <div className="font-mono text-[10px] p-1.5 rounded-lg bg-emerald-950/90 border border-emerald-500/30 text-emerald-200 leading-snug">
                  <span className="text-emerald-400 font-sans text-[10.5px] font-bold block mb-0.5">Proyeksi Rantai Langkah (s/d 3 Langkah):</span>
                  {commentary.chain3Moves}
                </div>
              )}
            </div>

            {/* PV LINE */}
            {commentary.pvText && (
              <div className="font-mono text-[10px] p-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300 leading-tight break-words">
                <span className="text-neutral-400 font-sans text-[10.5px] font-bold block mb-0.5">Variasi Langkah PV:</span>
                {commentary.pvText}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-neutral-400 italic text-xs">
            Menunggu langkah pertama untuk mengaktifkan analisis taktik &amp; strategi...
          </div>
        )}
      </div>
    </div>
  );
}
