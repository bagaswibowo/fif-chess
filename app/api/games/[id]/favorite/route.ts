/**
 * app/api/games/[id]/favorite/route.ts (ticket S2-T2, G11)
 * PATCH /api/games/[id]/favorite → toggle games.favorited (optimistic di client).
 * Guardrail: hanya game milik user session yang bisa di-toggle.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser, loadUsers } from "@/lib/auth-store";

export const runtime = "nodejs";

async function currentUserId(request: Request): Promise<string | null> {
  try {
    const users = await loadUsers();
    const me = currentUser(request, users);
    if (!me) return null;
    // users.json id (u-*) bukan Postgres uuid — petakan via username (sprint1 §Migration).
    const pgRows = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [me.username]);
    if (pgRows.length === 0) return null;
    return String((pgRows[0] as { id: string }).id);
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
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
