/**
 * app/api/seek/route.ts
 * Seek pool API (ticket S1-T2, ADR-001/002, docs/db/sprint1.md §1 — Redis-only).
 *
 * POST   /api/seek  { tc, mode } → buat seek; matcher langsung dipicu
 * DELETE /api/seek  cancel seek milik user + publish GameRemoved
 * GET    /api/seek  status seek milik user (bootstrap, realtime via WS)
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { currentUser, loadUsers } from "@/lib/auth-store";
import { onSeekCreated, cancelSeek } from "@/lib/realtime/matcher.ts";
import { addSeek, getUserSeek, removeUserSeek, type SeekTicket } from "@/lib/realtime/seek-pool.ts";
import { isValidTimeControl } from "@/lib/time-control";

export const runtime = "nodejs";

async function currentUserId(request: Request): Promise<string | null> {
  try {
    const users = await loadUsers();
    const me = currentUser(request, users);
    return me ? me.id : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const seek = await getUserSeek(userId);
  return NextResponse.json({ seek });
}

export async function POST(request: Request) {
  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required. Login first.", retryable: false }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const tc = typeof body.tc === "string" ? body.tc.trim() : "";
  const mode = body.mode === "rated" ? "rated" : "casual";
  // S6-T2 (ADR-009 D2.2): tc custom \d{1,3}+\d{1,3} (1..999 menit + 1..999 detik)
  // — satu util validasi (lib/time-control.ts); kategori turun di query
  // (aturan api/leaderboard), bukan dikirim client.
  if (!isValidTimeControl(tc)) {
    return NextResponse.json({ error: "TC harus format '<menit>+<inkremen>' (1..999+1..999), mis. '10+0' atau '30+3'.", retryable: false }, { status: 400 });
  }

  // Rating + id user dari DB (sumber tunggal rating/FK games; seek tidak menyalin apa pun ke DB).
  const me = (await loadUsers()).find((u) => u.id === userId);
  const rows = me
    ? await query("SELECT id, rating FROM users WHERE username = $1 LIMIT 1", [me.username])
    : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "User tidak ditemukan.", retryable: false }, { status: 404 });
  }
  const pgUserId = String((rows[0] as { id: string }).id);
  const rating = Number((rows[0] as { rating: number }).rating) || 1200;

  // Re-seek = cancel seek lama dulu (satu seek aktif per user).
  await removeUserSeek(userId).catch((err: unknown) => console.error("[seek] re-seek cleanup gagal:", err));

  const seek: SeekTicket = {
    seekId: randomUUID(),
    userId,
    pgUserId,
    rating,
    tc,
    mode,
    createdAt: Date.now(),
  };
  await addSeek(seek);
  onSeekCreated(seek); // matcher dipicu saat publish seek (bukan cron)

  return NextResponse.json({ ok: true, seek }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const seek = await getUserSeek(userId);
  const ok = seek ? await cancelSeek(seek.seekId, userId) : false;
  return NextResponse.json({ ok });
}
