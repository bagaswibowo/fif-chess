/**
 * lib/tournament-types.ts (S6-T5, ADR-009 D5 — kontrak docs/contracts/sprint6.md §1.5)
 * Tipe arena tournament S6: satu sumber untuk route /api/tournament + sweeper
 * + frontend. Tabel `tournaments` + `tournament_players` (migrasi
 * docs/db/sprint6-migration.sql, naming sesuai kontrak — BUKAN
 * `tournament_joiners` dari draft awal docs/db/sprint6.md).
 */
export type TournamentStatus = "registration" | "live" | "finished";

export interface TournamentArena {
  id: string;
  name: string;
  /** Format tunggal "<menit>+<inkremen>" (regex \d{1,3}\+\d{1,3}, ADR-009 D2). */
  timeControl: string;
  rated: boolean;
  status: TournamentStatus;
  /** Epoch ms. */
  startAt: number;
  capacity: number;
  /** Jumlah tournament_players status 'joined' (count riil, no-mock). */
  entrants: number;
  /** Entrants yang sudah ter-pair saat arena live (null saat registration). */
  currentPlayers?: number | null;
}

export interface TournamentPlayer {
  username: string;
  rating: number;
  joinedAt: number;
}
