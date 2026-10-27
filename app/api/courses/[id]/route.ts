/**
 * app/api/courses/[id]/route.ts (S7-T1, ADR-010 D1)
 * GET /api/courses/[id] → { course: Course, progress: CourseProgress }.
 * 404 course tak dikenal. Progress riil SQL-derived (lihat progress.ts).
 * Auth FIX-1: 401 / 403 account_pending / 503 service_unavailable.
 */
import { NextResponse } from "next/server";
import { resolvePgUser } from "@/lib/puzzle-api";
import { courseById } from "@/lib/courses";
import { computeCourseProgress } from "../progress";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;
  const { id } = await ctx.params;
  const course = courseById(id);
  if (!course) {
    return NextResponse.json(
      { error: "Kursus tidak ditemukan.", code: "course_not_found", retryable: false },
      { status: 404 },
    );
  }
  const progress = await computeCourseProgress(me.pgId, me.username, course);
  return NextResponse.json({ course, progress });
}
