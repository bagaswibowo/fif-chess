/**
 * app/api/courses/route.ts (S7-T1, ADR-010 D1)
 * GET /api/courses[?opening=<eco>] → { courses: CourseSummary[] }.
 * Konten course statis lib/courses.ts; progress riil SQL-derived
 * (puzzle_attempts) + lesson completion (file store). [NO-NEW-TABLE].
 * Auth FIX-1: 401 / 403 account_pending / 503 service_unavailable.
 *
 * ?opening=<eco> (CTA Explorer S6-T1): subset course yang min. 1 step
 * opening dengan ref === eco, flag matched: true.
 */
import { NextResponse } from "next/server";
import { resolvePgUser } from "@/lib/puzzle-api";
import { COURSES, type Course } from "@/lib/courses";
import { computeCourseProgress } from "./progress";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;

  const eco = request.url.includes("opening=")
    ? new URL(request.url).searchParams.get("opening")?.trim() || null
    : null;

  // ?opening=<eco>: hanya course dengan min. 1 step opening ref === eco.
  const filtered: Course[] = eco
    ? COURSES.filter((c) => c.steps.some((s) => s.kind === "opening" && s.ref === eco))
    : COURSES;

  const rows = await Promise.all(
    filtered.map(async (course) => {
      const progress = await computeCourseProgress(me.pgId, me.username, course);
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        stepCount: course.steps.length,
        progressPct: progress.progressPct,
        ...(eco ? { matched: true as const } : {}),
      };
    }),
  );

  return NextResponse.json({ courses: rows });
}
