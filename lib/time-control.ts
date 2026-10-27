/**
 * lib/time-control.ts (S6-T2, ADR-009 D2.2 — docs/contracts/sprint6.md §1.2)
 * Validasi + derivasi kategori waktu dari time control.
 *
 * FORMAT TUNGGAL: string "<menit>+<inkremen>" (games.time_control,
 * challenges.time_control, SeekTicket.tc). Kategori TIDAK dikirim client —
 * diturunkan server-side dari menit pertama (aturan api/leaderboard):
 * bullet <3, blitz 3..<10, rapid >=10.
 */

/** \d{1,3}\+\d{1,3} — base 1..999 menit, inkremen 1..999 detik (S6-T2 widen). */
export const TC_CUSTOM_REGEX = /^\d{1,3}\+\d{1,3}$/;

export function isValidTimeControl(tc: string): boolean {
  return TC_CUSTOM_REGEX.test(tc.trim());
}

export type TimeCategory = "bullet" | "blitz" | "rapid";

/** Kategori dari "<menit>+<inkremen>" (ui-flow-spec §3, pola api/leaderboard).
 *  NULL / tak-terisi → null (seed 99,99% baris games game_type/time_control
 *  NULL — query wajib toleran, docs/db/sprint6.md §1). */
export function timeCategoryOf(tc: string | null | undefined): TimeCategory | null {
  if (!tc) return null;
  const m = String(tc).match(/^(\d{1,3})\+(\d{1,3})$/);
  if (!m) return null;
  const min = Number(m[1]);
  if (min < 3) return "bullet";
  if (min < 10) return "blitz";
  return "rapid";
}

/** Fragmen SQL kategori dari kolom time_control (pola api/leaderboard) —
 *  toleran NULL (COALESCE ke kategori 'unknown' bila kolom kosong). */
export function timeCategorySql(tcCol: string, gameTypeCol: string, gameType: "bullet" | "blitz" | "rapid"): string {
  const min = `COALESCE(split_part(${tcCol}, '+', 1)::int, 0)`;
  if (gameType === "bullet") return `(${gameTypeCol} = 'live' AND ${min} < 3)`;
  if (gameType === "blitz") return `(${gameTypeCol} = 'live' AND ${min} >= 3 AND ${min} < 10)`;
  return `(${gameTypeCol} = 'live' AND ${min} >= 10)`;
}
