/**
 * app/api/puzzles/rush/start/route.ts (S3-T3)
 * POST { mode: "3min"|"5min"|"endless" } -> { sessionId, timeLeftSec }.
 */
import { NextResponse } from "next/server";
import { resolvePgUser } from "@/lib/puzzle-api";
import { createSession, getSession, timeLeftSec, type RushMode } from "@/lib/puzzle-rush";

export const runtime = "nodejs";

const MODES: RushMode[] = ["3min", "5min", "endless"];

export async function POST(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const mode = String(body.mode ?? "") as RushMode;
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: "mode harus 3min|5min|endless.", retryable: false }, { status: 400 });
  }
  const sessionId = await createSession(me.pgId, mode);
  const s = (await getSession(sessionId))!;
  return NextResponse.json({ sessionId, mode, timeLeftSec: timeLeftSec(s) });
}
