/**
 * extra-security.ts
 * Port of com.chess.features.settings.extrasecurity.ExtraSecurityServiceImpl
 * + chesscom.trust_and_safety.v1 (challenge/issue/verify/disable)
 * from chess.com APK v4.10.20 (REA MCP decompilation).
 *
 * Mirrors the chess.com extra-security contract:
 *   - issueChallenge(): create a pending security challenge
 *   - verifyChallenge(code): verify a user-submitted challenge code
 *   - disable(): disable extra security
 *   - checkPendingChallenge(): check if a challenge is pending
 *
 * FIXES (Tech Lead JEV-003, JEV-005):
 * - Silent catch {} replaced with context-aware logging on passwordMatches failure
 * - hmacCode is now used for challenge code generation (HMAC-backed, not dead code)
 * - In-memory Map is kept for dev but documented as production must-use Redis/DB
 *   (state does not survive restart and is not shared across instances)
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { passwordMatches, readCookie, GATE_COOKIE } from "@/lib/gate";

export interface ExtraSecurityState {
  enabled: boolean;
  pendingChallenge: boolean;
  challengeCode?: string;
  challengeExpiresAt?: number;
  attempts: number;
  lastError?: string;
}

export interface IssueChallengeResponse {
  ok: boolean;
  challengeId: string;
  expiresInSeconds: number;
  message: string;
}

export interface VerifyChallengeResponse {
  ok: boolean;
  enabled: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
// JEV-005: This in-memory Map is a DEV-ONLY store. It does NOT survive server
// restart and is NOT shared across instances/replicas. Production MUST replace
// this with Redis or PostgreSQL (see schema in docs/planning/project-plan.md,
// tables: extra_security_sessions, rate_limits).
const securityStore = new Map<string, ExtraSecurityState>();

function getState(sessionId: string): ExtraSecurityState {
  let st = securityStore.get(sessionId);
  if (!st) {
    st = { enabled: false, pendingChallenge: false, attempts: 0 };
    securityStore.set(sessionId, st);
  }
  return st;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateChallengeCode(): string {
  // JEV-005: HMAC-backed code generation using crypto random bytes + HMAC.
  const random = crypto.getRandomValues(new Uint8Array(8));
  const secret = process.env.SITE_HMAC_KEY || "dev-insecure-secret";
  const hmac = createHmac("sha256", secret).update(Buffer.from(random)).digest("hex");
  const digits = hmac.replace(/[^0-9]/g, "").slice(0, 6);
  return digits.padStart(6, "0");
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function isExtraSecurityEnabled(sessionId: string): boolean {
  return getState(sessionId).enabled;
}

export function getExtraSecurityState(sessionId: string): ExtraSecurityState {
  return getState(sessionId);
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export async function issueChallenge(request: Request): Promise<IssueChallengeResponse> {
  const cookie = readCookie(request, GATE_COOKIE);
  const sessionId = cookie || `anon-${Date.now()}`;
  const st = getState(sessionId);

  if (st.enabled) {
    return {
      ok: false,
      challengeId: "",
      expiresInSeconds: 0,
      message: "Extra security already enabled",
    };
  }

  const code = generateChallengeCode();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  st.pendingChallenge = true;
  st.challengeCode = code;
  st.challengeExpiresAt = expiresAt;
  st.attempts = 0;
  st.lastError = undefined;
  securityStore.set(sessionId, st);

  // eslint-disable-next-line no-console
  console.debug(`[chess-com] extra-security issueChallenge: session=${sessionId} code=${code}`);

  return {
    ok: true,
    challengeId: sessionId,
    expiresInSeconds: 600,
    message: "Security challenge issued. Enter the code to enable extra security.",
  };
}

export async function verifyChallenge(
  request: Request,
  code: string
): Promise<VerifyChallengeResponse> {
  const cookie = readCookie(request, GATE_COOKIE);
  const sessionId = cookie || `anon-${Date.now()}`;
  const st = getState(sessionId);

  if (!st.pendingChallenge || !st.challengeCode || !st.challengeExpiresAt) {
    return { ok: false, enabled: false, message: "No pending challenge" };
  }

  if (Date.now() > st.challengeExpiresAt) {
    st.pendingChallenge = false;
    st.challengeCode = undefined;
    st.lastError = "Challenge expired";
    securityStore.set(sessionId, st);
    return { ok: false, enabled: false, message: "Challenge expired" };
  }

  st.attempts += 1;

  // Constant-time comparison against the issued code (prevents timing side-channel)
  const ok = constantTimeEquals(st.challengeCode, code);

  if (ok) {
    st.enabled = true;
    st.pendingChallenge = false;
    st.challengeCode = undefined;
    st.attempts = 0;
    st.lastError = undefined;
    securityStore.set(sessionId, st);
    return { ok: true, enabled: true, message: "Extra security enabled" };
  }

  if (st.attempts >= 5) {
    st.pendingChallenge = false;
    st.challengeCode = undefined;
    st.lastError = "Too many attempts";
    securityStore.set(sessionId, st);
    return { ok: false, enabled: false, message: "Too many attempts. Challenge invalidated." };
  }

  st.lastError = "Invalid code";
  securityStore.set(sessionId, st);
  return { ok: false, enabled: false, message: "Invalid code" };
}

export async function disableExtraSecurity(
  request: Request,
  password: string
): Promise<VerifyChallengeResponse> {
  const cookie = readCookie(request, GATE_COOKIE);
  const sessionId = cookie || `anon-${Date.now()}`;
  const st = getState(sessionId);

  if (!st.enabled) {
    return { ok: false, enabled: false, message: "Extra security not enabled" };
  }

  // Require account password to disable (mirrors chess.com re-auth gate)
  let pwOk = false;
  try {
    pwOk = await passwordMatches(password);
  } catch (err) {
    // JEV-003: replace silent catch with context-aware logging
    // eslint-disable-next-line no-console
    console.error(
      `[chess-com] extra-security disable: passwordMatches error for session=${sessionId}: ` +
      (err instanceof Error ? err.message : String(err))
    );
    st.lastError = "Password verification error";
    securityStore.set(sessionId, st);
    return { ok: false, enabled: true, message: "Password verification error" };
  }

  if (!pwOk) {
    st.lastError = "Invalid password";
    securityStore.set(sessionId, st);
    return { ok: false, enabled: true, message: "Invalid password" };
  }

  st.enabled = false;
  st.pendingChallenge = false;
  st.challengeCode = undefined;
  st.attempts = 0;
  st.lastError = undefined;
  securityStore.set(sessionId, st);

  return { ok: true, enabled: false, message: "Extra security disabled" };
}
