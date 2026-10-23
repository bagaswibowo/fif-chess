/** W3 shared type: satu baris tier dari GET /api/puzzles/tiers. */
export type TierRow = {
  tier: number;
  solved: number;
  attempted: number;
  accuracy: number;
  unlocked: boolean;
};
