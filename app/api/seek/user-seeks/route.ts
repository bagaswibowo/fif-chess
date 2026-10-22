/**
 * app/api/seek/user-seeks/route.ts
 * GET /api/seek/user-seeks → seek aktif milik user (bootstrap/refresh, realtime via WS matcher/<userId>).
 */
import { NextResponse } from "next/server";
import { currentUser, loadUsers } from "@/lib/auth-store";
import { getUserSeek } from "@/lib/realtime/seek-pool.ts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let userId: string | null = null;
  try {
    const users = await loadUsers();
    const me = currentUser(request, users);
    userId = me ? me.id : null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const seek = await getUserSeek(userId);
  return NextResponse.json({ seeks: seek ? [seek] : [] });
}
