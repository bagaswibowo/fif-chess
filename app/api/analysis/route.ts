/**
 * app/api/analysis/route.ts
 * Port of com.chess.compengine.v2.ChessEngineImpl.s(...): iaa<k1>
 * from chess.com APK v4.10.20 (REA MCP decompilation).
 *
 * POST /api/analysis  { gamePgn, gameResult, coachTextId?, coachLocale?, suppressBrilliantSpeech? }
 * -> post-game analysis with per-move evaluation and coach feedback
 */

import { NextResponse } from "next/server";
import { analyzePgn, type PostGameAnalysisResponse } from "@/lib/post-game-analysis";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const gamePgn = obj.gamePgn;
  const gameResult = obj.gameResult;

  if (typeof gamePgn !== "string" || gamePgn.trim().length === 0) {
    return NextResponse.json({ error: "Missing 'gamePgn' field.", retryable: false }, { status: 400 });
  }

  const result: PostGameAnalysisResponse = await analyzePgn(gamePgn, typeof gameResult === "string" ? gameResult : "*", {
    coachTextId: typeof obj.coachTextId === "string" ? obj.coachTextId : undefined,
    coachLocale: typeof obj.coachLocale === "string" ? obj.coachLocale : undefined,
    suppressBrilliantSpeech: typeof obj.suppressBrilliantSpeech === "boolean" ? obj.suppressBrilliantSpeech : undefined,
  });

  return NextResponse.json(result);
}
