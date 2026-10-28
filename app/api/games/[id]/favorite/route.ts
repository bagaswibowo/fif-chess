/**
 * app/api/games/[id]/favorite/route.ts (ticket S2-T2, G11)
 * PATCH /api/games/[id]/favorite → toggle games.favorited (optimistic di client).
 * Guardrail: hanya game milik user session yang bisa di-toggle.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveSessionUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

async function currentUserId(request: Request): Promise<string | Response> {
  // S9-T1 (G0.1): guard sesi via resolveSessionUser — pending/rejected dapat
  // 403 account_pending/account_rejected (bukan 401).
  const me = await resolveSessionUser(request);
  if (!me.ok) return me.response;
  // users.json id (u-*) bukan Postgres uuid — petakan via username (sprint1 §Migration).
  try {
    const pgRows = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [me.user.username]);
    if (pgRows.length === 0) {
      // Drift R4: sesi valid approved tapi username tak ada di PG → 403 akun belum tersinkron.
      return NextResponse.json({ error: "Akun belum tersinkron dengan database. Coba lagi nanti.", code: "account_missing", retryable: true }, { status: 403 });
    }
    return String((pgRows[0] as { id: string }).id);
  } catch (err) {
    console.error("[games/[id]/favorite] DB gagal saat map user PG:", err);
    return NextResponse.json({ error: "Layanan sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true }, { status: 503 });
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId(request);
  if (typeof userId !== "string") return userId;
  const { id } = await ctx.params;

  // UPDATE scoped: id + pemilik game. RETURNING memberi state baru untuk
  // response — client tidak perlu round-trip kedua setelah optimistic toggle.
  const rows = await query(
    `UPDATE games SET favorited = NOT favorited
     WHERE id = $1 AND (white_user_id = $2 OR black_user_id = $2)
     RETURNING favorited`,
    [id, userId],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Game tidak ditemukan / bukan milik Anda.", retryable: false }, { status: 404 });
  }
  const favorited = Boolean((rows[0] as { favorited: boolean }).favorited);
  return NextResponse.json({ ok: true, id, favorited });
}
