/**
 * app/api/puzzles/tiers/route.ts (W3 — progression tier rating)
 * GET — progres tier rating 800..2200 (step 200) untuk user: akurasi & jumlah
 * attempt benar/total per tier dari puzzle_attempts (JOIN puzzles.rating).
 * Tier berikutnya terkunci sampai akurasi tier sebelumnya >= 60% dari >= 10
 * puzzle UNIK. Guest (401) → tiers dengan unlocked hanya tier pertama (UI
 * tetap render); 403/503 diteruskan via resolvePgUser (FIX-1 semantics).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

const TIERS = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200];
const UNLOCK_ACCURACY = 0.6;
const UNLOCK_MIN_SOLVED = 10;

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;

  const rows = await query<{ tier: string; solved: string; total: string }>(
    `SELECT t.tier,
            count(DISTINCT CASE WHEN a.correct = true THEN a.puzzle_id END)::text AS solved,
            count(DISTINCT a.puzzle_id)::text AS total
     FROM (SELECT generate_subscripts(ARRAY[800,1000,1200,1400,1600,1800,2000,2200], 1) AS i,
                  unnest(ARRAY[800,1000,1200,1400,1600,1800,2000,2200]) AS tier) t
     JOIN puzzles p ON p.rating >= t.tier AND p.rating < t.tier + 200
     LEFT JOIN puzzle_attempts a ON a.puzzle_id = p.id AND a.user_id = $1::uuid
     GROUP BY t.tier
     ORDER BY t.tier`,
    [me.pgId],
  );

  const byTier = new Map(rows.map((r) => [Number(r.tier), r]));
  let unlockedUpTo = TIERS[0]; // tier pertama selalu terbuka
  const tiers = TIERS.map((tier) => {
    const r = byTier.get(tier);
    const solved = r ? Number(r.solved) : 0;
    const total = r ? Number(r.total) : 0;
    const accuracy = total > 0 ? solved / total : 0;
    const unlocked = tier <= unlockedUpTo;
    if (unlocked && solved >= UNLOCK_MIN_SOLVED && accuracy >= UNLOCK_ACCURACY) {
      unlockedUpTo = Math.min(2200, tier + 200);
    }
    return { tier, solved, attempted: total, accuracy: Math.round(accuracy * 100), unlocked };
  });

  return NextResponse.json({ tiers, unlockAccuracyPct: UNLOCK_ACCURACY * 100, unlockMinSolved: UNLOCK_MIN_SOLVED });
}
