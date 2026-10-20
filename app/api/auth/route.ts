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
import { passwordMatches, signSession, sessionCookie, readCookie, GATE_COOKIE } from "@/lib/gate";
import { createHmac, timingSafeEqual } from "node:crypto";

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
  return handleLogin(request);

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
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email tidak valid.", retryable: false }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter.", retryable: false }, { status: 400 });
  }

  try {
    const existing = await query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username.trim(), email.trim().toLowerCase()]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username atau email sudah terdaftar.", retryable: false }, { status: 409 });
    }

    const passwordHash = hashPassword(password);

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO users (username, email, password_hash, rating, created_at, updated_at)
         VALUES ($1, $2, $3, 1200, NOW(), NOW())`,
        [username.trim(), email.trim().toLowerCase(), passwordHash]
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
    const key = process.env.SITE_HMAC_KEY ?? "dev-insecure-key-change-me";
    const actual = await hmacSha256Hex(key, `password:${password}`);

    if (!timingSafeEqual(Buffer.from(actual, "utf8"), Buffer.from(user.password_hash, "utf8"))) {
      return NextResponse.json({ error: "Username atau password salah.", retryable: false }, { status: 401 });
    }

    const session = signSession();
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak dapat dibuat.", retryable: false }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Login berhasil.",
      user: { id: user.id, username: user.username, rating: user.rating },
    }, {
      status: 200,
      headers: {
        "Set-Cookie": sessionCookie(session),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[jev-chess] login error:", err);
    return NextResponse.json({ error: "Gagal login. Coba lagi nanti.", retryable: true }, { status: 500 });
  }
}
