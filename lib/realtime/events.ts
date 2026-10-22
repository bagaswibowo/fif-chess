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

export type RealtimeEvent =
  | GameAdded
  | GameRemoved
  | GameStarted
  | MoveMade
  | GameEnded
  | PresenceChanged
  | PlayingCountChanged
  | ChallengeReceived
  | ChallengeResolved;

export const gameTopic = (gameId: string) => `game/${gameId}/moves`;
export const matcherTopic = (userId: string) => `matcher/${userId}`;
export const presenceTopic = (userId: string) => `presence/${userId}`;
export const toastsTopic = (userId: string) => `toasts/${userId}`;
