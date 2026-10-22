/**
 * coach-audio.ts — S2-T1 preferensi coach audio (Sprint 2 design doc §1.3).
 * Satu toggle mute/play; state persist di localStorage lintas sesi.
 */

const KEY = "jev_chess_coach_audio_muted";

export function loadCoachAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveCoachAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    // storage bisa gagal (private mode) — preferensi tidak persist, bukan fatal.
  }
}
