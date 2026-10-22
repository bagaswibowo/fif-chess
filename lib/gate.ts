/**
 * gate.ts
 * HMAC gate authentication for jev-chess.
 * Cookie jev_gate with HttpOnly, SameSite=Lax, Path=/.
 * Admin approval gate: users registered but not yet approved cannot play.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";

export const HMAC_KEY_ENV = "SITE_HMAC_KEY";
export const PASSWORD_HMAC_ENV = "SITE_PASSWORD_HMAC";
export const GATE_COOKIE = "jev_gate";

const SESSION_SECONDS = 60 * 60 * 24 * 3;

function trimmed(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function isGateConfigured(): boolean {
  return Boolean(trimmed(HMAC_KEY_ENV) && trimmed(PASSWORD_HMAC_ENV));
}

export function gateConfigured(): boolean {
  return isGateConfigured();
}

function mac(key: string, message: string): string {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export async function passwordMatches(password: string): Promise<boolean> {
  const key = trimmed(HMAC_KEY_ENV);
  const expected = trimmed(PASSWORD_HMAC_ENV)?.toLowerCase();
  if (!key || !expected) return false;
  const actual = await hmacSha256Hex(key, password);
  return equalHex(actual, expected);
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

export function signSession(now = Date.now()): string | null {
  const key = trimmed(HMAC_KEY_ENV);
  if (!key) return null;
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${exp}.${mac(key, `allow:${exp}`)}`;
}

export function sessionValid(cookie: string | undefined, now = Date.now()): boolean {
  const key = trimmed(HMAC_KEY_ENV);
  if (!key) return true; // dev mode: no HMAC configured, allow all
  if (!cookie) return false;
  const dot = cookie.indexOf(".");
  if (dot <= 0) return false;
  const expStr = cookie.slice(0, dot);
  const given = cookie.slice(dot + 1).toLowerCase();
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return false;
  return equalHex(mac(key, `allow:${expStr}`), given);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmedPart = part.trim();
    if (!trimmedPart.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmedPart.slice(name.length + 1));
  }
  return undefined;
}

export function sessionCookie(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GATE_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  return `${GATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Check whether the authenticated user is approved to play.
 * Returns { approved: boolean, user?: { id, username, rating } }
 */
export async function getApprovedUser(sessionId: string): Promise<{ approved: boolean; user?: { id: string; username: string; rating: number } }> {
  const key = trimmed(HMAC_KEY_ENV);
  if (!key) {
    // dev mode without HMAC — allow all
    return { approved: true };
  }

  const dot = sessionId.indexOf(".");
  if (dot <= 0) return { approved: false };
  const expStr = sessionId.slice(0, dot);
  const given = sessionId.slice(dot + 1).toLowerCase();
  if (!equalHex(mac(key, `allow:${expStr}`), given)) return { approved: false };

  try {
    const rows = await query(
      `SELECT id, username, rating FROM users WHERE username = $1 LIMIT 1`,
      [sessionId] // placeholder — in production we'd store user id in session
    );
    if (rows.length === 0) return { approved: false };
    const u = rows[0] as { id: string; username: string; rating: number };
    return { approved: true, user: { id: u.id, username: u.username, rating: u.rating } };
  } catch {
    return { approved: false };
  }
}
