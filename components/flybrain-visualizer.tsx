"use client";

import React, { useState } from "react";
import { ExternalLink, Brain, Eye, Activity, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { IconAiBrain3D, IconLightning3D, IconLightbulb3D } from "@/components/icons3d";

export type TopNeuron = {
  id: number;
  region: string;
  activity: number;
  codexUrl: string;
};

export type FlyDiagnostics = {
  scoreCp: number;
  mood: "smug" | "thinking" | "panic";
  regionalActivity: {
    optic: number;
    sensory: number;
    central: number;
    motor: number;
  };
  eyeMap: number[]; // 64 values (0..63)
  topNeurons: TopNeuron[];
};

interface FlyBrainVisualizerProps {
  diagnostics?: FlyDiagnostics | null;
  isThinking?: boolean;
}

export function FlyBrainVisualizer({ diagnostics, isThinking }: FlyBrainVisualizerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"brain" | "eye" | "neurons">("brain");

  const mood = diagnostics?.mood || "thinking";
  const scoreCp = diagnostics?.scoreCp ?? 0;

  const moodConfig = {
    smug: {
      label: "Merasa Unggul (Smug)",
      bg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
      desc: "Konektom menilai posisi ini sangat menguntungkan.",
    },
    panic: {
      label: "Waspada / Tertekan (Panic)",
      bg: "bg-rose-500/15 border-rose-500/40 text-rose-400",
      desc: "Konektom mendeteksi tekanan tinggi atau ancaman skak.",
    },
    thinking: {
      label: "Menganalisis Impuls",
      bg: "bg-cyan-500/15 border-cyan-500/40 text-cyan-400",
      desc: "Gelombang aksi merambat di 134.209 neuron Drosophila.",
    },
  }[mood];

  const regional = diagnostics?.regionalActivity || {
    optic: 0.42,
    sensory: 0.38,
    central: 0.65,
    motor: 0.51,
  };

  return (
    <div className="w-full bg-[#1e1c18] border border-[#3d3830] rounded-xl overflow-hidden shadow-2xl transition-all duration-300">
      {/* Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 bg-[#262421] border-b border-[#3d3830] flex items-center justify-between cursor-pointer hover:bg-[#2d2a26] transition-colors select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            {isThinking ? <IconLightning3D size={20} /> : <IconAiBrain3D size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                FlyBrain Connectome Lab
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#312e2b] text-neutral-400 border border-[#443e37]">
                134k Neurons
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {isThinking ? "Menjalankan forward pass konektom..." : moodConfig.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-2 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${moodConfig.bg}`}>
            <span className="relative flex h-2 w-2">
              {isThinking && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isThinking ? "bg-cyan-500" : "bg-emerald-500"}`}></span>
            </span>
            {isThinking ? "Thinking" : `${scoreCp > 0 ? "+" : ""}${(scoreCp / 100).toFixed(1)}`}
          </div>
          <button className="text-neutral-400 hover:text-white transition-colors" aria-label="Toggle panel">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body Content */}
      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Navigation Tabs */}
          <div className="flex bg-[#141310] p-1 rounded-lg border border-[#332f29] text-xs">
            <button
              onClick={() => setActiveTab("brain")}
              className={`flex-1 py-1.5 rounded-md font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "brain"
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Aktivitas Otak</span>
            </button>
            <button
              onClick={() => setActiveTab("eye")}
              className={`flex-1 py-1.5 rounded-md font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "eye"
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Mata Majemuk</span>
            </button>
            <button
              onClick={() => setActiveTab("neurons")}
              className={`flex-1 py-1.5 rounded-md font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "neurons"
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>CodEx Lookup</span>
            </button>
          </div>

          {/* TAB 1: REGIONAL BRAIN ACTIVITY */}
          {activeTab === "brain" && (
            <div className="space-y-3">
              <div className="text-[11px] text-neutral-400 flex items-center justify-between">
                <span>Rambatan Sinyal Biologis (16 Timesteps)</span>
                <span className="text-amber-400/90 font-mono">Drosophila FAFB v783</span>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Lobus Optik (Visual)", val: regional.optic, color: "from-sky-500 to-blue-600" },
                  { label: "Neuron Sensorik", val: regional.sensory, color: "from-amber-500 to-yellow-500" },
                  { label: "Otak Tengah (Keputusan)", val: regional.central, color: "from-purple-500 to-indigo-600" },
                  { label: "Neuron Motorik (Langkah)", val: regional.motor, color: "from-emerald-500 to-teal-500" },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-neutral-300 font-mono">
                      <span>{item.label}</span>
                      <span className="font-bold text-neutral-200">{(item.val * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#12110e] border border-[#2d2924] overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${item.color} transition-all duration-500 rounded-full`}
                        style={{ width: `${Math.min(100, Math.max(8, item.val * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2.5 rounded-lg bg-[#141310] border border-[#2b2722] text-[11px] text-neutral-400 leading-relaxed flex items-start gap-2">
                <IconLightbulb3D size={14} className="shrink-0 mt-0.5" />
                <span>
                  <span className="text-neutral-300 font-semibold">Prinsip Biologis:</span> Sinyal papan catur diinjeksikan ke 2.048 neuron fotoreseptor, dihantarkan lewat 2,7 juta sinapsis dengan hukum Dale (ACh merangsang, GABA/Glutamat menghambat).
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: COMPOUND EYE HEATMAP */}
          {activeTab === "eye" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Fotoreseptor Mata Majemuk (64 Petak)</span>
                <span className="font-mono text-cyan-400">Ommatidia Grid</span>
              </div>

              {/* 8x8 Hex/Square Eye Canvas Simulation */}
              <div className="grid grid-cols-8 gap-1 p-2 bg-[#12110e] rounded-lg border border-[#2a2621]">
                {Array.from({ length: 64 }).map((_, sq) => {
                  const intensity = diagnostics?.eyeMap?.[sq] ?? (sq % 2 === 0 ? 0.2 : 0.4);
                  return (
                    <div
                      key={sq}
                      className="aspect-square rounded-[3px] border border-white/5 transition-all duration-300 relative group cursor-pointer"
                      style={{
                        backgroundColor: `rgba(245, 158, 11, ${Math.max(0.08, Math.min(0.9, intensity))})`,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/80 rounded-[3px] text-[8px] font-mono text-white transition-opacity">
                        {(intensity * 100).toFixed(0)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-neutral-400">
                Petak yang lebih terang menunjukkan area papan catur yang menerima eksitasi visual tertinggi dari retina lalat.
              </p>
            </div>
          )}

          {/* TAB 3: CODEX NEURON LOOKUP */}
          {activeTab === "neurons" && (
            <div className="space-y-2.5">
              <div className="text-[11px] text-neutral-400 flex items-center justify-between">
                <span>Neuron Paling Aktif Saat Ini</span>
                <span className="text-amber-400 font-mono text-[10px]">codex.flywire.ai</span>
              </div>

              <div className="space-y-1.5">
                {(diagnostics?.topNeurons || [
                  { id: 41208, region: "Central Brain (Memori)", activity: 0.94, codexUrl: "https://codex.flywire.ai" },
                  { id: 18402, region: "Descending (Motorik)", activity: 0.88, codexUrl: "https://codex.flywire.ai" },
                  { id: 72105, region: "Optic Lobe (Visual)", activity: 0.82, codexUrl: "https://codex.flywire.ai" },
                  { id: 93411, region: "Sensory / Ascending", activity: 0.77, codexUrl: "https://codex.flywire.ai" },
                ]).map((n, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-[#141310] border border-[#2b2722] flex items-center justify-between text-xs hover:border-[#443d35] transition-colors"
                  >
                    <div>
                      <div className="font-mono font-bold text-neutral-200 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Neuron #{n.id}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400">{n.region}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {(n.activity * 100).toFixed(0)}%
                      </span>
                      <a
                        href={n.codexUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-md bg-[#23201c] hover:bg-amber-500/20 text-neutral-400 hover:text-amber-300 transition-colors"
                        title="Buka rekonstruksi 3D di FlyWire Codex"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="https://codex.flywire.ai"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center justify-center gap-2 transition-all mt-2"
              >
                <span>Eksplorasi Seluruh Konektom di FlyWire Codex</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
