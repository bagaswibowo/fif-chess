"use client";

/**
 * lib/sound.ts (V7 — ui-parity-v2, P1)
 * Web Audio cue engine original: move / capture / check / game-end
 * disintesis dengan oscillator — BUKAN file audio berhak cipta.
 *
 * DHH rule: playCue(name, { visual }) HANYA boleh dipanggil bersama aksi
 * visual yang sedang tampil di frame yang sama (highlight langkah, banner,
 * shake). Tidak ada cue tanpa pasangan visual.
 *
 * Mute: persist di localStorage ("jev_sound_muted"); toggle dari gear
 * BoardChrome (V1). Tidak autoplay: AudioContext dibuat lazy saat playCue
 * pertama yang selalu terjadi setelah interaksi user (langkah papan).
 */

export type CueName = "move" | "capture" | "check" | "game-end" | "error";

const MUTE_KEY = "jev_sound_muted";

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return true;
  }
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    window.dispatchEvent(new CustomEvent("jev:sound-muted", { detail: { muted } }));
  } catch {
    /* storage penuh/blocked — cue engine tetap jalan untuk session ini */
  }
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = {
  type: OscillatorType;
  from: number;
  to?: number;
  start?: number;
  dur: number;
  gain?: number;
};

function tone(ac: AudioContext, t0: number, o: ToneOpts): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const start = t0 + (o.start ?? 0);
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.from, start);
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.to, start + o.dur);
  g.gain.setValueAtTime(o.gain ?? 0.5, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + o.dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(start);
  osc.stop(start + o.dur + 0.02);
}

function synth(ac: AudioContext, name: CueName): void {
  const t = ac.currentTime;
  switch (name) {
    case "move":
      tone(ac, t, { type: "sine", from: 280, to: 70, dur: 0.11, gain: 0.7 });
      break;
    case "capture":
      tone(ac, t, { type: "triangle", from: 620, to: 140, dur: 0.06, gain: 0.8 });
      tone(ac, t, { type: "sine", from: 220, to: 50, start: 0.01, dur: 0.14, gain: 0.9 });
      break;
    case "check":
      tone(ac, t, { type: "sine", from: 659.25, dur: 0.22, gain: 0.5 });
      tone(ac, t, { type: "sine", from: 987.77, start: 0.03, dur: 0.22, gain: 0.5 });
      break;
    case "game-end":
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(ac, t, { type: "sine", from: f, start: i * 0.1, dur: 0.25, gain: 0.4 }),
      );
      break;
    case "error":
      tone(ac, t, { type: "square", from: 180, to: 90, dur: 0.12, gain: 0.25 });
      break;
  }
}

/**
 * Mainkan cue. `visual` WAJIB true dan hanya dipanggil dari handler yang
 * juga memicu highlight/banner pada render yang sama (DHH rule).
 */
export function playCue(name: CueName, opts?: { visual?: boolean }): void {
  if (!opts?.visual) return; // DHH: tanpa pasangan visual → tanpa suara
  if (isSoundMuted()) return;
  const ac = getCtx();
  if (!ac || ac.state !== "running") return; // tidak autoplay sebelum gesture user
  synth(ac, name);
}
