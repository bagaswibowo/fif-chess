/**
 * app/api/puzzles/themes/route.ts (S3-T4, G8b)
 * GET /api/puzzles/themes?theme= — agregasi per tema SQL-side (unnest(themes),
 * GIN index untuk filter). Mastery = % puzzle tema yang sudah dijaw benar user.
 * Label Indonesia dari lib/puzzle-themes.ts.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";
import { THEME_LIST, themeLabel } from "@/lib/puzzle-themes";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const themeFilter = url.searchParams.get("theme")?.trim() || null;
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;

  // FIX (sprint6 QA): parameter kondisional (WHERE t.theme = $1 hanya saat
  // filter) bikin PG 42P18 "could not determine data type of parameter $1"
  // saat nilai null / posisi param bergeser. Restrukturisasi: SEMUA placeholder
  // selalu ada di SQL dengan tipe eksplisit, nilai null = tanpa filter.
  const rows = await query<{ theme: string; total: string; attempted: string; correct: string }>(
    `SELECT t.theme,
            count(DISTINCT p.id)::text AS total,
            count(DISTINCT CASE WHEN a.id IS NOT NULL THEN p.id END)::text AS attempted,
            count(DISTINCT CASE WHEN a.correct = true THEN p.id END)::text AS correct
     FROM puzzles p
     CROSS JOIN LATERAL unnest(p.themes) AS t(theme)
     LEFT JOIN puzzle_attempts a
       ON a.puzzle_id = p.id AND a.user_id = $2::uuid
     WHERE ($1::text IS NULL OR t.theme = $1::text)
     GROUP BY t.theme`,
    [themeFilter, me?.pgId ?? null],
  );

  const byKey = new Map(rows.map((r) => [r.theme, r]));
  const themes = THEME_LIST
    .filter((t) => !themeFilter || t.key === themeFilter)
    .map((t) => {
      const r = byKey.get(t.key);
      const total = r ? Number(r.total) : 0;
      const attempted = r ? Number(r.attempted) : 0;
      const correct = r ? Number(r.correct) : 0;
      // Mastery = % puzzle tema yang sudah dijaw benar (capped 100).
      const masteryPct = total > 0 ? Math.min(100, Math.round((correct / total) * 100)) : 0;
      return {
        theme: t.key, label: themeLabel(t.key),
        total, attempted, correct, masteryPct,
      };
    });

  themes.sort((a, b) => b.masteryPct - a.masteryPct || b.total - a.total);
  return NextResponse.json({ themes });
}
