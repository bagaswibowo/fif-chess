/**
 * Tipe event realtime shared server & klien (ADR-002 #3) + topic builder
 * tunggal (ADR-001 #4). Satu sumber — tidak ada string topic tersebar.
 */

export type GameAdded = { type: "game_added"; gameId: string; white: string; black: string };
export type GameRemoved = { type: "game_removed"; gameId: string };
export type GameStarted = { type: "game_started"; gameId: string; white: string; black: string };
export type MoveMade = { type: "move_made"; gameId: string; san: string; fen: string; moveNumber: number };
export type GameEnded = { type: "game_ended"; gameId: string; result: string };
export type PresenceChanged = { type: "presence_changed"; userId: string; online: boolean };
export type PlayingCountChanged = { type: "playing_count_changed"; count: number };
export type ChallengeReceived = { type: "challenge_received"; challengeId: string; fromUserId: string; fromUsername: string };
export type ChallengeResolved = { type: "challenge_resolved"; challengeId: string; accepted: boolean };

// ── Sprint 6 (ADR-009 D3/D5 — docs/contracts/sprint6.md §2.2, additive) ──
// D3 — game-flow. gameId = code room in-memory (FIF-XXXXXX, pola PvpRoom.code)
// untuk game api/pvp, atau pg uuid untuk game challenge/seek (konsisten
// behavior GameStarted/GameEnded existing — tidak dinormalisasi di S6).
export type GameAborted = { type: "game_aborted"; gameId: string; reason: "aborted" };
export type DrawOffered = { type: "draw_offered"; gameId: string; fromUser: string };
export type DrawDeclined = { type: "draw_declined"; gameId: string };
// D3.2 — konteks "rematch dari partai X" untuk modal game-over; dipublish
// route /api/challenge ke matcher/<target> (di atas ChallengeReceived).
export type RematchRequested = { type: "rematch_requested"; gameId: string; challengeId: string; fromUser: string };
// D5 — tournament (topic tournament/<id> + salinan toasts/<creator>).
export type TournamentUpdated = {
  type: "tournament_updated";
  tournamentId: string;
  status: "registration" | "live" | "finished";
  entrants: number;
};

export type RealtimeEvent =
  | GameAdded
  | GameRemoved
  | GameStarted
  | MoveMade
  | GameEnded
  | PresenceChanged
  | PlayingCountChanged
  | ChallengeReceived
  | ChallengeResolved
  | GameAborted
  | DrawOffered
  | DrawDeclined
  | RematchRequested
  | TournamentUpdated;

export const gameTopic = (gameId: string) => `game/${gameId}/moves`;
export const matcherTopic = (userId: string) => `matcher/${userId}`;
export const presenceTopic = (userId: string) => `presence/${userId}`;
export const toastsTopic = (userId: string) => `toasts/${userId}`;
/** S6-T5 (D5.4): topik arena tournament (id = uuid tabel tournaments). */
export const tournamentTopic = (tournamentId: string) => `tournament/${tournamentId}`;
