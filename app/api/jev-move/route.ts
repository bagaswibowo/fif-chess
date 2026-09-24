import { NextResponse } from "next/server";
import { JevRequestError, playJevMove } from "@/lib/jev";
import { playStockfishMove, guardJevMove } from "@/lib/stockfish";
import { validateFen } from "chess.js";
import { GATE_COOKIE, gateConfigured, readCookie, sessionValid } from "@/lib/gate";

export const runtime = "nodejs";

function apiKey(): string | undefined {
  const value = process.env.TYPESAFE_API_KEY;
  return value && value.trim().length > 0 ? value : undefined;
}

export async function POST(request: Request) {
  if (!gateConfigured() || !sessionValid(readCookie(request, GATE_COOKIE))) {
    return NextResponse.json(
      { error: "Unlock the board before Jev will play.", retryable: false },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with a fen field.", retryable: false },
      { status: 400 },
    );
  }

  const bodyObj = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const fen = bodyObj.fen;
  const rawDepth = typeof bodyObj.depth === "number" ? bodyObj.depth : 14;
  const depth = Math.max(1, Math.min(16, Math.round(rawDepth)));

  if (typeof fen !== "string") {
    return NextResponse.json(
      { error: "Missing fen. Send the current position as a FEN string.", retryable: false },
      { status: 400 },
    );
  }

  const fenCheck = validateFen(fen);
  if (!fenCheck.ok) {
    return NextResponse.json(
      { error: fenCheck.error ?? "Invalid FEN.", retryable: false },
      { status: 400 },
    );
  }

  // Stockfish 15 NNUE (Invincible mode, Elo 3500+)
  try {
    const result = await playStockfishMove(fen, depth);
    return NextResponse.json({
      uci: result.uci,
      san: result.san,
      fen: result.fen,
      probabilities: result.probabilities,
      confidence: result.confidence,
      droppedMoveCount: result.droppedMoveCount,
      outcome: result.outcome,
      scoreCp: (result as any).scoreCp ?? null,
    });
  } catch (stockfishErr) {
    console.warn("Stockfish error, falling back to Jev:", stockfishErr);
  }

  const key = apiKey();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "TYPESAFE_API_KEY is not set. Add your TypeSafe API key to play against Jev.",
        retryable: false,
      },
      { status: 503 },
    );
  }

  try {
    const jevRaw = await playJevMove(fen, { apiKey: key });
    const result = await guardJevMove(fen, jevRaw, 8);
    return NextResponse.json({
      uci: result.uci,
      san: result.san,
      fen: result.fen,
      probabilities: result.probabilities,
      confidence: result.confidence,
      droppedMoveCount: result.droppedMoveCount,
      outcome: result.outcome,
      scoreCp: (result as any).scoreCp ?? null,
    });
  } catch (error) {
    if (error instanceof JevRequestError) {
      return NextResponse.json(
        { error: error.message, retryable: error.retryable },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Jev could not pick a move. Nothing was applied.",
        retryable: true,
      },
      { status: 502 },
    );
  }
}
