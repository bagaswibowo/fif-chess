export type GameRecord = {
  id: string;
  /** Epoch ms — sumber kebenaran untuk sorting dan tampilan tanggal/jam. */
  playedAt: number;
  opponent: string;
  humanSide: "white" | "black";
  outcomeKind: string;
  winner: "white" | "black" | "draw" | null;
  moves: string[];
  mode: "ai" | "pvp";
  timeMode: string;
};
