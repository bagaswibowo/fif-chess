/**
 * app/api/engine-uci/route.ts
 * Port of com.chess.compengine.v2.ExternalUciEngine.send() + ChessEngineImpl.shutdown()
 * from chess.com APK v4.10.20 (REA MCP decompilation).
 *
 * Endpoints:
 *   POST /api/engine-uci/send   { line } -> send UCI command to engine
 *   POST /api/engine-uci/shutdown -> send "quit" to engine
 *   POST /api/engine-uci/read   { timeoutMs } -> read one line from engine stdout
 */

import { NextResponse } from "next/server";
import { uciSend, uciShutdown, uciReadLine } from "@/lib/chess-com-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const { line, timeoutMs } = obj;

  // Determine sub-operation via ?op= or body.op
  const url = new URL(request.url);
  const op = (url.searchParams.get("op") || obj.op || "send") as string;

  if (op === "shutdown") {
    const result = await uciShutdown();
    return NextResponse.json({
      ok: result.ok,
      line: result.line,
      error: result.error,
    });
  }

  if (op === "read") {
    const result = await uciReadLine(typeof timeoutMs === "number" ? timeoutMs : 3000);
    return NextResponse.json(result);
  }

  // default: send
  if (typeof line !== "string") {
    return NextResponse.json({ error: "Missing 'line' field (UCI command string).", retryable: false }, { status: 400 });
  }

  const result = await uciSend(line);
  return NextResponse.json({
    ok: result.ok,
    line: result.line,
    error: result.error,
  });
}
