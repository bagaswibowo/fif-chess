/**
 * app/api/learn/bookmarks/route.ts (S7-T2, ADR-010 D2)
 * File store lib/learn-store.ts — TIDAK menyentuh PG. 401 tanpa sesi;
 * 400 untuk payload invalid; TIDAK bisa 503 (source of truth = file).
 *
 * GET  → { bookmarks: string[]; lessonsCompleted: string[] }
 * POST { id: string; kind: "lesson"; on: boolean }
 *      on:true  + kind "lesson" = tandai selesai (+ bookmark on)
 *      on:false + kind "lesson" = hapus keduanya
 *      → { ok: true; bookmarks: string[]; lessonsCompleted: string[] }
 */
import { NextResponse } from "next/server";
import { loadLearn, setLessonFlag } from "@/lib/learn-store";
import { LESSON_IDS } from "@/lib/lessons";
import { loadUsers, sessionUserForToken, tokenFromRequest } from "@/lib/auth-store";

export const runtime = "nodejs";

async function authedUser(request: Request): Promise<string | null> {
  const users = await loadUsers();
  const me = sessionUserForToken(tokenFromRequest(request), users);
  // FIX-1: pending/rejected user juga punya sesi valid untuk fitur
  // kosmetik ini (kontrak S7: 401/400 hanya, no 503 — tidak ada PG).
  return me?.username ?? null;
}

export async function GET(request: Request) {
  const username = await authedUser(request);
  if (!username) {
    return NextResponse.json(
      { error: "Authentication required.", code: "unauthenticated", retryable: false },
      { status: 401 },
    );
  }
  const state = loadLearn(username);
  return NextResponse.json({
    bookmarks: state.bookmarks ?? [],
    lessonsCompleted: state.lessonsCompleted ?? [],
  });
}

export async function POST(request: Request) {
  const username = await authedUser(request);
  if (!username) {
    return NextResponse.json(
      { error: "Authentication required.", code: "unauthenticated", retryable: false },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const kind = body.kind;
  const on = body.on;

  if (!id || !LESSON_IDS.has(id)) {
    return NextResponse.json(
      { error: "id harus lesson id yang valid.", code: "invalid_lesson_id", retryable: false },
      { status: 400 },
    );
  }
  if (kind !== "lesson") {
    return NextResponse.json(
      { error: 'kind hanya "lesson" di Sprint 7 (YAGNI).', code: "unsupported_kind", retryable: false },
      { status: 400 },
    );
  }
  if (typeof on !== "boolean") {
    return NextResponse.json(
      { error: "on harus boolean.", code: "invalid_on", retryable: false },
      { status: 400 },
    );
  }

  // Semantik D2: on=true → tandai selesai (+bookmark); on=false → hapus.
  const result = await setLessonFlag(username, id, on, on);
  return NextResponse.json({ ok: true, bookmarks: result.bookmarks, lessonsCompleted: result.lessonsCompleted });
}
