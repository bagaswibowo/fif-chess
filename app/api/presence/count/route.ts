/**
 * app/api/presence/count/route.ts
 * GET /api/presence/count → jumlah user yang sedang dalam game (badge "Bermain N").
 * Sumber: Redis `jev:playing` (SET userId, di-update matcher saat GameAdded — ticket S1-T3).
 * Bootstrap/refresh saja; update realtime via WS topik presence.
 */
import { NextResponse } from "next/server";
import { playingRedis } from "@/lib/realtime/playing-count.ts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const count = await playingRedis().scard("jev:playing");
    return NextResponse.json({ count });
  } catch (err) {
    console.error("[presence] baca playing count gagal:", err);
    return NextResponse.json({ count: 0, degraded: true });
  }
}
