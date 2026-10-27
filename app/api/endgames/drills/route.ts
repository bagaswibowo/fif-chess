/**
 * app/api/endgames/drills/route.ts (ticket S4-T4, extended S7-T5)
 * GET /api/endgames/drills → daftar set drill endgame (kurasi statis
 * lib/endgame-drills.ts) + progress % per set untuk user login.
 * Progress = solved-unique / total set, derive dari puzzle_attempts —
 * tanpa tabel baru (docs/db/sprint4.md, YAGNI S4-T4).
 *
 * S7-T5 (ADR-010 D6) — param NEW additive, respons shape TIDAK berubah
 * (field per set id/title/description/total/solved/progressPct),
 * S4 consumers tetap jalan. Progress & filter dihitung SQL-SIDE:
 *   ?theme=<endgameThemeKey>  — pilih set DrillSet.theme tsb (nilai valid
 *                               = field DrillSet.theme existing; nilai lain
 *                               = 400). Membership puzzle tetap SQL-side
 *                               ($3::text = ANY(p.themes) → GIN
 *                               idx_puzzles_themes_gin).
 *   ?minProgress=<0..100>     — filter set oleh progressPct TERHITUNG SQL-SIDE
 *                               (CTE set→total/solved/progressPct, lalu
 *                               WHERE progressPct >= $4) — guardrail
 *                               no-client-side-filter. Default 0 = tanpa
 *                               filter (behavior S4-T4 exact).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";
import { DRILL_SETS, type DrillSet } from "@/lib/endgame-drills";

export const runtime = "nodejs";

/** Nilai theme valid = field DrillSet.theme existing (D6). */
const VALID_THEMES = new Set(DRILL_SETS.map((s) => s.theme));

export interface DrillSetDto {
  id: string;
  title: string;
  description: string;
  total: number;
  solved: number;
  progressPct: number;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;

  // S7-T5: ?theme= — pilih set; nilai tak dikenal = 400 (guardrail D6).
  const themeParam = url.searchParams.get("theme");
  let sets: DrillSet[] = DRILL_SETS;
  if (themeParam) {
    if (!VALID_THEMES.has(themeParam)) {
      return NextResponse.json(
        { error: "theme tidak dikenal (harus salah satu tema drill endgame).", code: "invalid_theme", retryable: false },
        { status: 400 },
      );
    }
    sets = DRILL_SETS.filter((s) => s.theme === themeParam);
  }

  // S7-T5: ?minProgress= — integer 0..100 (default 0); nilai tak valid = 400.
  const minProgressParam = url.searchParams.get("minProgress");
  let minProgress = 0;
  if (minProgressParam !== null && minProgressParam !== "") {
    if (!/^\d+$/.test(minProgressParam) || Number(minProgressParam) > 100) {
      return NextResponse.json(
        { error: "minProgress harus integer 0..100.", code: "invalid_minProgress", retryable: false },
        { status: 400 },
      );
    }
    minProgress = Number(minProgressParam);
  }

  // Verifikasi SQL-side per set. progressPct dihitung dalam CTE (SQL-side,
  // sumber tunggal) lalu CTE difilter WHERE progressPct >= $4 (guardrail D6).
  // Rumus CTE (CASE guard total=0 + round(100.0 * ...)) identik dengan rumus
  // S4 Math.round untuk semua nilai valid → saat minProgress=0 respons
  // IDENTIK S4-T4 (TL regression gate: tanpa param = behavior S4 exact).
  // Set yang terfilter CTE (progressPct < minProgress) tidak menghasilkan baris
  // → dikembalikan null → dibuang dari respons.
  const results = await Promise.all(
    sets.map(async (set) => {
      const res = await query<{ total: number; solved: number; progressPct: number }>(
        `WITH s AS (
           SELECT count(*)::int AS total,
                  count(DISTINCT CASE WHEN a.correct THEN a.puzzle_id END)::int AS solved,
                  CASE WHEN count(*) = 0 THEN 0
                       ELSE round(100.0 * count(DISTINCT CASE WHEN a.correct THEN a.puzzle_id END) / count(*))::int
                  END AS progressPct
           FROM puzzles p
           LEFT JOIN puzzle_attempts a
             ON a.puzzle_id = p.id AND a.user_id = $1::uuid
           WHERE p.id = ANY($2::uuid[]) AND $3::text = ANY(p.themes)
         )
         SELECT total, solved, progressPct FROM s WHERE progressPct >= $4::int`,
        [me.pgId, set.puzzleIds, set.theme, minProgress],
      );
      const r = res[0];
      if (!r) return null; // set terfilter SQL (progressPct < minProgress)
      return {
        id: set.id,
        title: set.title,
        description: set.description,
        total: Number(r.total),
        solved: Number(r.solved),
        progressPct: Number(r.progressPct),
      };
    }),
  );

  const outSets: DrillSetDto[] = results.filter((r): r is DrillSetDto => r !== null);
  return NextResponse.json({ sets: outSets });
}
