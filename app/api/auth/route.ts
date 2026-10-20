/**
 * app/api/auth/route.ts
 * Authentication: register & login with admin approval gate.
 * Mirrors chess.com extra-security / account flow but for jev-chess community.
 *
 * POST /api/auth/register  { username, email, password } -> pending approval
 * POST /api/auth/login     { username, password } -> sets jev_gate session cookie
 *
 * Admin (Pak Bagas) approves registrations before user can play.
 */

import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { currentUser, loadUsers, mutateUsers, publicUser, startSession } from "@/lib/auth-store";
import { sessionCookie as sessionCookie2 } from "@/lib/auth-store";
import { passwordMatches, signSession, sessionCookie, readCookie, GATE_COOKIE } from "@/lib/gate";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "bagaswibowo";

function hmacSha256Hex(key: string, message: string): string {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

function hashPassword(password: string): string {
  const key = process.env.SITE_HMAC_KEY ?? "dev-insecure-key-change-me";
  return hmacSha256Hex(key, `password:${password}`);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  // op can arrive via query string (?op=register) or body { action: "register" } —
  // the use-session client sends action in the JSON body, so honor both.
  let op = url.searchParams.get("op") || null;
  if (!op) {
    try {
      const peek = await request.clone().json();
      if (peek && typeof peek === "object" && typeof (peek as Record<string, unknown>).action === "string") {
        op = String((peek as Record<string, unknown>).action);
      }
    } catch {
      // body not JSON; fall through to login
    }
  }
  if (op === "register") {
    return handleRegister(request);
  }
  if (op === "login") {
    return handleLogin(request);
  }
  if (op === "list" || op === "approve" || op === "reject") {
    return handleAdminAction(request, op);
  }
  return handleLogin(request);

}

/** Admin: list users or approve/reject a pending account. Identity comes
 *  from the jev_session cookie (auth-store session table), not client input. */
async function handleAdminAction(request: Request, op: string) {
  const users = await loadUsers();
  const me = currentUser(request, users);
  if (!me || !me.isAdmin) {
    return NextResponse.json({ error: "Hanya admin yang boleh melakukan ini." }, { status: 403 });
  }

  if (op === "list") {
    return NextResponse.json({
      success: true,
      users: users.map(publicUser).sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin)),
    });
  }

  let body: unknown = {};
  try { body = await request.json(); } catch { /* empty body */ }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const targetId = String(obj.userId || "");
  const nextStatus = op === "approve" ? "approved" : "rejected";

  const updated = await mutateUsers((list) => {
    const target = list.find((u) => u.id === targetId);
    if (!target) return { error: "Pengguna tidak ditemukan.", status: 404 } as const;
    if (target.isAdmin) return { error: "Akun admin tidak bisa diubah.", status: 400 } as const;
    target.status = nextStatus;
    return { user: target } as const;
  });
  if ("error" in updated) {
    return NextResponse.json({ error: updated.error }, { status: updated.status });
  }
  return NextResponse.json({ success: true, user: publicUser(updated.user) });
}

async function handleRegister(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const username = obj.username;
  const email = obj.email;
  const password = obj.password;

  if (typeof username !== "string" || username.trim().length < 3) {
    return NextResponse.json({ error: "Username minimal 3 karakter.", retryable: false }, { status: 400 });
  }
  // Email is optional: the registration UI does not collect it. Normalize to
  // null when absent/empty so the nullable email column stays consistent.
  let normalizedEmail: string | null = null;
  if (typeof email === "string" && email.trim().length > 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Email tidak valid.", retryable: false }, { status: 400 });
    }
    normalizedEmail = email.trim().toLowerCase();
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter.", retryable: false }, { status: 400 });
  }

  try {
    const existing = await query(
      "SELECT id FROM users WHERE username = $1 OR (email IS NOT NULL AND email = $2)",
      [username.trim(), normalizedEmail]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username atau email sudah terdaftar.", retryable: false }, { status: 409 });
    }

    const passwordHash = hashPassword(password);

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO users (username, email, password_hash, rating, created_at, updated_at)
         VALUES ($1, $2, $3, 1200, NOW(), NOW())`,
        [username.trim(), normalizedEmail, passwordHash]
      );
    });

    // eslint-disable-next-line no-console
    console.info(`[jev-chess] new user registered (pending approval): ${username}`);
    return NextResponse.json({
      ok: true,
      message: "Pendaftaran berhasil. Menunggu persetujuan admin sebelum dapat bermain.",
    }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[jev-chess] register error:", err);
    return NextResponse.json({ error: "Gagal mendaftar. Coba lagi nanti.", retryable: true }, { status: 500 });
  }
}

/** Legacy per-user scrypt salts migrated from data/users.json. */
const LEGACY_SALTS: Record<string, string> = (() => {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = process.env.JEV_DATA_DIR ?? "/app/data";
    const raw = fs.readFileSync(`${path}/users.json`, "utf8");
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    const list = Array.isArray(parsed) ? parsed : [];
    const map: Record<string, string> = {};
    for (const u of list) {
      if (typeof u.username === "string" && typeof u.passwordSalt === "string") {
        map[u.username] = u.passwordSalt;
      }
    }
    return map;
  } catch {
    return {};
  }
})();

function legacySaltFor(username: string): string | undefined {
  return LEGACY_SALTS[username];
}

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

async function handleLogin(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const username = obj.username;
  const password = obj.password;

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Username dan password diperlukan.", retryable: false }, { status: 400 });
  }

  try {
    const rows = await query(
      `SELECT id, username, password_hash, rating FROM users WHERE username = $1 LIMIT 1`,
      [username.trim()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Username atau password salah.", retryable: false }, { status: 401 });
    }

    const user = rows[0] as { id: string; username: string; password_hash: string; rating: number };

    // Password hashes exist in two legacy formats:
    //  - scrypt+salt 128-hex chars (original accounts; salt lives in data/users.json)
    //  - HMAC-SHA256 64-hex chars (newer registrations)
    // Verify by hash length so neither format is fed to the wrong comparator -
    // timingSafeEqual throws on length mismatch (RangeError -> 500).
    const storedHash = user.password_hash;
    let ok = false;
    if (storedHash.length === 64) {
      const key = process.env.SITE_HMAC_KEY ?? "dev-insecure-key-change-me";
      const actual = await hmacSha256Hex(key, `password:${password}`);
      ok = equalHex(actual, storedHash);
    } else {
      // Legacy scrypt format: per-user salt lives in the migrated users.json.
      const salt = legacySaltFor(user.username);
      if (salt) {
        try {
          const actual = scryptSync(password, salt, 64).toString("hex");
          ok = equalHex(actual, storedHash);
        } catch {
          ok = false;
        }
      }
    }

    if (!ok) {
      return NextResponse.json({ error: "Username atau password salah.", retryable: false }, { status: 401 });
    }

    const session = signSession();
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak dapat dibuat.", retryable: false }, { status: 500 });
    }

    // auth-store session (jev_session) binds the cookie to a userId - the
    // AdminPanel and community features resolve identity through it.
    const full = await loadUsers();
    // users.json is the identity source for sessions; match by username
    // because the Postgres row and users.json use different id schemes.
    const profile = full.find((u) => u.username === user.username);
    const { token, maxAge } = startSession(profile ? profile.id : user.id);

    const res = NextResponse.json({
      ok: true,
      message: "Login berhasil.",
      user: profile
        ? { ...publicUser(profile) }
        : { id: user.id, username: user.username, rating: user.rating, fullName: user.username, role: "", status: "approved", isAdmin: false, elo: user.rating, wins: 0, losses: 0, draws: 0, createdAt: new Date().toISOString() },
    }, {
      status: 200,
      headers: {
        "Set-Cookie": [
          sessionCookie(session),
          sessionCookie2(token, maxAge, request),
        ].join("; "),
      },
    });
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[jev-chess] login error:", err);
    return NextResponse.json({ error: "Gagal login. Coba lagi nanti.", retryable: true }, { status: 500 });
  }
}
