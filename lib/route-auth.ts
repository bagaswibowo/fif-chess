/**
 * lib/route-auth.ts (S10-T1 — Centralized Authentication Deep Module)
 * Satu gerbang otentikasi standar untuk seluruh route API jev-chess.
 * Mengeliminasi duplikasi 401/403/503 dan pemetaan username -> pg uuid.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loadUsers, sessionUserForToken, tokenFromRequest, type UserProfile } from "@/lib/auth-store";

export type PgUser = {
  pgId: string;
  rating: number;
  username: string;
};

export type PgUserResolution =
  | { ok: true; user: PgUser; profile?: UserProfile }
  | { ok: false; response: NextResponse };

export type SessionUserResolution =
  | { ok: true; user: UserProfile }
  | { ok: false; response: NextResponse };

/**
 * Autentikasi menyeluruh (Session + PG User record).
 * Semantics:
 *  - Tanpa session valid -> 401 unauthenticated
 *  - Status pending       -> 403 account_pending
 *  - Status rejected      -> 403 account_rejected
 *  - DB Error             -> 503 service_unavailable
 *  - Drift R4 (no in PG)  -> 403 account_missing
 */
export async function resolvePgUser(request: Request): Promise<PgUserResolution> {
  let users: UserProfile[];
  try {
    users = await loadUsers();
  } catch (err) {
    console.error("[route-auth] loadUsers gagal:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Layanan autentikasi sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
        { status: 503 }
      ),
    };
  }

  const me = sessionUserForToken(tokenFromRequest(request), users);
  if (!me) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required.", code: "unauthenticated", retryable: false },
        { status: 401 }
      ),
    };
  }
  if (me.status === "pending") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akun menunggu persetujuan admin.", code: "account_pending", retryable: false },
        { status: 403 }
      ),
    };
  }
  if (me.status === "rejected") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akun ditolak admin.", code: "account_rejected", retryable: false },
        { status: 403 }
      ),
    };
  }

  try {
    const rows = await query<{ id: string; rating: number; username: string }>(
      "SELECT id, rating, username FROM users WHERE username = $1 LIMIT 1",
      [me.username]
    );
    if (rows.length === 0) {
      console.warn(`[route-auth] R4 drift: user ${JSON.stringify(me.username)} ada di users.json tapi tidak di PG`);
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Akun belum tersinkron dengan database.", code: "account_missing", retryable: true },
          { status: 403 }
        ),
      };
    }
    const r = rows[0];
    return {
      ok: true,
      user: { pgId: String(r.id), rating: Number(r.rating) || 1200, username: String(r.username) },
      profile: me,
    };
  } catch (err) {
    console.error("[route-auth] DB gagal saat query user PG:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
        { status: 503 }
      ),
    };
  }
}

/**
 * Autentikasi session-only (tanpa query PG).
 */
export async function resolveSessionUser(request: Request): Promise<SessionUserResolution> {
  let users: UserProfile[];
  try {
    users = await loadUsers();
  } catch (err) {
    console.error("[route-auth] loadUsers gagal saat resolve session user:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Layanan sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
        { status: 503 }
      ),
    };
  }

  const me = sessionUserForToken(tokenFromRequest(request), users);
  if (!me) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required.", code: "unauthenticated", retryable: false },
        { status: 401 }
      ),
    };
  }
  if (me.status === "pending") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akun menunggu persetujuan admin.", code: "account_pending", retryable: false },
        { status: 403 }
      ),
    };
  }
  if (me.status === "rejected") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akun ditolak admin.", code: "account_rejected", retryable: false },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user: me };
}

/**
 * Helper untuk pemetaan username ke PG UUID secara terpusat.
 */
export async function pgIdByUsername(username: string): Promise<string | null> {
  try {
    const rows = await query<{ id: string }>(
      "SELECT id FROM users WHERE username = $1 LIMIT 1",
      [username]
    );
    return rows.length > 0 ? String(rows[0].id) : null;
  } catch (err) {
    console.error(`[route-auth] Gagal memetakan username ${username} ke PG id:`, err);
    return null;
  }
}

// Alias kanonis
export const routeAuth = resolvePgUser;
export const routeSession = resolveSessionUser;
