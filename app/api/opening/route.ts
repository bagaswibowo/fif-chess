/**
 * app/api/opening/route.ts
 * Port of com.chess.compengine.v2.ChessEngineImpl.k(d<?>): g23<OpeningInfo>
 * and .l(String): g23<s1> (FEN lookup)
 * from chess.com APK v4.10.20 (REA MCP decompilation).
 *
 * POST /api/opening  { fen } -> opening info + FEN lookup
 */

import { NextResponse } from "next/server";
import { lookupFen, type FenLookupResponse } from "@/lib/opening-book";
import { validateFen } from "chess.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const fen = obj.fen;

  if (typeof fen !== "string") {
    return NextResponse.json({ error: "Missing 'fen' field.", retryable: false }, { status: 400 });
  }

  const fenCheck = validateFen(fen);
  if (!fenCheck.ok) {
    return NextResponse.json({ error: fenCheck.error ?? "Invalid FEN.", retryable: false }, { status: 400 });
  }

  const result: FenLookupResponse = lookupFen(fen);
  return NextResponse.json(result);
}
