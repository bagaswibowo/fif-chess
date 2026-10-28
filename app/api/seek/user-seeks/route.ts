/**
 * app/api/seek/user-seeks/route.ts
 * GET /api/seek/user-seeks → seek aktif milik user (bootstrap/refresh, realtime via WS matcher/<userId>).
 */
import { NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/puzzle-api";
import { getUserSeek } from "@/lib/realtime/seek-pool.ts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // S9-T1: sesi-pending/rejected → 403 (bukan 401). In-memory pool (guardrail:
  // tidak ada query PG di route ini).
  const meRes = await resolveSessionUser(request);
  if (!meRes.ok) return meRes.response;
  const userId = meRes.user.id;
  const seek = await getUserSeek(userId);
  return NextResponse.json({ seeks: seek ? [seek] : [] });
}
