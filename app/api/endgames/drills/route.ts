/**
 * app/api/endgames/drills/route.ts (ticket S4-T4)
 * GET /api/endgames/drills → daftar set drill endgame (kurasi statis
 * lib/endgame-drills.ts) + progress % per set untuk user login.
 * Progress = solved-unique / total set, derive dari puzzle_attempts —
 * tanpa tabel baru (docs/db/sprint4.md, YAGNI S4-T4).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPgUser } from "@/lib/puzzle-api";
import { DRILL_SETS } from "@/lib/endgame-drills";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }

  // Verifikasi SQL-side: hitung puzzle set yang benar-benar ada di DB dan
  // solved-unique per set dalam satu query (GIN index pada themes).
  const sets = await Promise.all(
    DRILL_SETS.map(async (set) => {
      const rows = await query<{ total: string; solved: string }>(
        `SELECT count(*) AS total,
                count(DISTINCT CASE WHEN a.correct THEN a.puzzle_id END) AS solved
         FROM puzzles p
         LEFT JOIN puzzle_attempts a
           ON a.puzzle_id = p.id AND a.user_id = $1::uuid
         WHERE p.id = ANY($2::uuid[]) AND $3::text = ANY(p.themes)`,
        [me.pgId, set.puzzleIds, set.theme],
      );
      const total = Number(rows[0]?.total ?? 0);
      const solved = Number(rows[0]?.solved ?? 0);
      return {
        id: set.id,
        title: set.title,
        description: set.description,
        total,
        solved,
        progressPct: total > 0 ? Math.round((solved / total) * 100) : 0,
      };
    }),
  );

  return NextResponse.json({ sets });
}
