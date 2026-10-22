/**
 * app/api/bot-chat/route.ts
 * Port of com.chess.compengine.binary.BinaryEngine.k(...): fetchBotChatV2
 * from chess.com APK v4.10.20 (REA MCP decompilation).
 *
 * POST /api/bot-chat  { fen, gameResult, playerColor, botUsername? }
 * -> BotChatV2-shaped coach explanation
 */

import { NextResponse } from "next/server";
import { fetchBotChatV2, type BotChatResponse } from "@/lib/bot-chat";

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
  const gameResult = obj.gameResult;
  const playerColor = obj.playerColor;

  if (typeof fen !== "string") {
    return NextResponse.json({ error: "Missing 'fen' field.", retryable: false }, { status: 400 });
  }

  const result: BotChatResponse = await fetchBotChatV2(
    fen,
    typeof gameResult === "string" ? gameResult : "*",
    typeof playerColor === "string" ? playerColor : "w",
    typeof obj.botUsername === "string" ? obj.botUsername : "Jev"
  );

  return NextResponse.json(result);
}
