import { NextResponse } from "next/server";
import {
  gateConfigured,
  passwordMatches,
  sessionCookie,
  signSession,
} from "@/lib/gate";

export const runtime = "nodejs";

// In-memory rate limiting against brute-force (5 attempts per 60 seconds per IP)
const failedAttempts = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (!record || now > record.resetTime) {
    return false;
  }
  return record.count >= 5;
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (!record || now > record.resetTime) {
    failedAttempts.set(ip, { count: 1, resetTime: now + 60000 });
  } else {
    record.count += 1;
  }
}

function clearRateLimit(ip: string) {
  failedAttempts.delete(ip);
}

export async function POST(request: Request) {
  if (!gateConfigured()) {
    return NextResponse.json(
      { error: "The site gate is not configured." },
      { status: 503 },
    );
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("cf-connecting-ip") ??
    "127.0.0.1";

  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan gagal. Silakan tunggu 1 menit." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON password." }, { status: 400 });
  }

  const password =
    body && typeof body === "object" && "password" in body
      ? (body as { password?: unknown }).password
      : undefined;

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }

  if (!(await passwordMatches(password))) {
    recordFailedAttempt(clientIp);
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  clearRateLimit(clientIp);

  const token = signSession();
  if (!token) {
    return NextResponse.json(
      { error: "The site gate is not configured." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}
