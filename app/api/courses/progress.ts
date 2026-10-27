/**
 * app/api/courses/progress.ts (S7-T1, ADR-010 D1) — helper progress riil
 * untuk course. Semua angka di-derive SQL-side dari `puzzle_attempts`
 * (NO-NEW-TABLE): tema dari `puzzles.themes` (GIN), drill set dari
 * lib/endgame-drills.ts (pola api/endgames/drills), lesson dari file
 * store lib/learn-store.ts. Tidak ada angka statis / mock.
 */
import { query } from "@/lib/db";
import { drillSetById } from "@/lib/endgame-drills";
import { loadLearn } from "@/lib/learn-store";
import type { Course, CourseStep, CourseStepKind } from "@/lib/courses";

export interface CourseStepProgress {
  stepId: string;
  kind: CourseStepKind;
  total: number; // domain: jumlah puzzle/set/lesson
  solved: number; // riil: correct-unique di domain tsb
  progressPct: number; // 0..100 bulat
  complete: boolean; // progressPct === 100
}

export interface CourseProgress {
  steps: CourseStepProgress[];
  progressPct: number; // rata-rata step (0..100, bulat)
}

/** Stat total/solved-unique per tema (pola api/puzzles/themes, GIN). */
async function themeStats(pgId: string, themes: string[]) {
  const map = new Map<string, { total: number; solved: number }>();
  if (themes.length === 0) return map;
  const rows = await query<{ theme: string; total: string; solved: string }>(
    `SELECT t.theme,
            count(DISTINCT p.id)::text AS total,
            count(DISTINCT CASE WHEN a.correct = true THEN a.puzzle_id END)::text AS solved
     FROM puzzles p
     CROSS JOIN LATERAL unnest(p.themes) AS t(theme)
     LEFT JOIN puzzle_attempts a
       ON a.puzzle_id = p.id AND a.user_id = $1::uuid
     WHERE t.theme = ANY($2::text[])
     GROUP BY t.theme`,
    [pgId, themes],
  );
  for (const r of rows) map.set(r.theme, { total: Number(r.total), solved: Number(r.solved) });
  return map;
}

/** Stat total/solved-unique satu drill set (pola api/endgames/drills). */
async function setStats(pgId: string, setId: string) {
  const set = drillSetById(setId);
  if (!set) return { total: 0, solved: 0 };
  const rows = await query<{ total: string; solved: string }>(
    `SELECT count(*)::text AS total,
            count(DISTINCT CASE WHEN a.correct = true THEN a.puzzle_id END)::text AS solved
     FROM puzzles p
     LEFT JOIN puzzle_attempts a
       ON a.puzzle_id = p.id AND a.user_id = $1::uuid
     WHERE p.id = ANY($2::uuid[]) AND $3::text = ANY(p.themes)`,
    [pgId, set.puzzleIds, set.theme],
  );
  return { total: Number(rows[0]?.total ?? 0), solved: Number(rows[0]?.solved ?? 0) };
}

/**
 * Hitung progress riil satu course untuk user. `kind "opening"`
 * mereferensikan tema puzzle `opening` (ECO step = drill riil D3),
 * bukan per-ECO (tidak ada sumber per-ECO — no-mock).
 */
export async function computeCourseProgress(
  pgId: string,
  username: string,
  course: Course,
): Promise<CourseProgress> {
  const themeKeys = [
    ...new Set(
      course.steps
        .filter((s) => s.kind === "puzzleTheme" || s.kind === "opening")
        .map((s) => (s.kind === "opening" ? "opening" : s.ref)),
    ),
  ];
  const setIds = [
    ...new Set(course.steps.filter((s) => s.kind === "drillSet").map((s) => s.ref)),
  ];

  const [tStats, sStats, learn] = await Promise.all([
    themeStats(pgId, themeKeys),
    (async () => {
      const m = new Map<string, { total: number; solved: number }>();
      for (const id of setIds) m.set(id, await setStats(pgId, id));
      return m;
    })(),
    Promise.resolve(loadLearn(username)),
  ]);

  const steps: CourseStepProgress[] = course.steps.map((step) => {
    let total = 0;
    let solved = 0;
    if (step.kind === "puzzleTheme" || step.kind === "opening") {
      const key = step.kind === "opening" ? "opening" : step.ref;
      const s = tStats.get(key);
      total = s?.total ?? 0;
      solved = s?.solved ?? 0;
    } else if (step.kind === "drillSet") {
      const s = sStats.get(step.ref);
      total = s?.total ?? 0;
      solved = s?.solved ?? 0;
    } else {
      // lesson: total 1, solved = tercatat di learn-state.json (D2.3).
      total = 1;
      solved = learn.lessonsCompleted.includes(step.ref) ? 1 : 0;
    }
    const progressPct = total > 0 ? Math.round((solved / total) * 100) : 0;
    return {
      stepId: step.id,
      kind: step.kind,
      total,
      solved,
      progressPct,
      complete: progressPct === 100,
    };
  });

  const progressPct = steps.length
    ? Math.round(steps.reduce((sum, s) => sum + s.progressPct, 0) / steps.length)
    : 0;

  return { steps, progressPct };
}

export { drillSetById };
