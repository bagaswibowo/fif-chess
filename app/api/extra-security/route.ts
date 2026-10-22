/**
 * app/api/extra-security/route.ts
 * Port of com.chess.features.settings.extrasecurity.ExtraSecurityServiceImpl
 * + chesscom.trust_and_safety.v1 (challenge/issue/verify/disable)
 * from chess.com APK v4.10.20 (REA MCP decompilation).
 *
 * Endpoints (all require gate session cookie jev_gate):
 *   POST /api/extra-security/issue   -> issueChallenge
 *   POST /api/extra-security/verify  { code } -> verifyChallenge
 *   POST /api/extra-security/disable { password } -> disableExtraSecurity
 *   GET  /api/extra-security/state   -> getExtraSecurityState
 */

import { NextResponse } from "next/server";
import {
  issueChallenge,
  verifyChallenge,
  disableExtraSecurity,
  getExtraSecurityState,
  isExtraSecurityEnabled,
} from "@/lib/extra-security";
import { readCookie, GATE_COOKIE } from "@/lib/gate";

export const runtime = "nodejs";

function sessionId(request: Request): string {
  return readCookie(request, GATE_COOKIE) || `anon-${Date.now()}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op") || "state";

  if (op === "state") {
    const state = getExtraSecurityState(sessionId(request));
    return NextResponse.json(state);
  }

  return NextResponse.json({ error: "Unknown op.", retryable: false }, { status: 400 });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op") || "issue";

  if (op === "issue") {
    const result = await issueChallenge(request);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (op === "verify") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
    }
    const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const code = obj.code;
    if (typeof code !== "string") {
      return NextResponse.json({ error: "Missing 'code' field.", retryable: false }, { status: 400 });
    }
    const result = await verifyChallenge(request, code);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (op === "disable") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
    }
    const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const password = obj.password;
    if (typeof password !== "string") {
      return NextResponse.json({ error: "Missing 'password' field.", retryable: false }, { status: 400 });
    }
    const result = await disableExtraSecurity(request, password);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: "Unknown op.", retryable: false }, { status: 400 });
}
