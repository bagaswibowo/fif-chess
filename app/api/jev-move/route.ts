import { NextResponse } from "next/server";
import { playStockfishMove } from "@/lib/stockfish";
import { validateFen } from "chess.js";
import { sideToMove } from "@/lib/chess";

export const runtime = "nodejs";

function apiKey(): string | undefined {
  const value = process.env.TYPESAFE_API_KEY;
  return value && value.trim().length > 0 ? value : undefined;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with fen and optional turn.", retryable: false },
      { status: 400 },
    );
  }

  const fen =
    body && typeof body === "object" && "fen" in body
      ? (body as { fen?: unknown }).fen
      : undefined;

  const requestedTurn =
    body && typeof body === "object" && "turn" in body
      ? (body as { turn?: unknown }).turn
      : undefined;

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

  if (typeof requestedTurn === "string" && requestedTurn !== "") {
    const chess = fenCheck.data.chess;
    const actualSide = sideToMove(chess);
    const expectedSide = requestedTurn === "white" ? "white" : requestedTurn === "black" ? "black" : "";
    if (expectedSide && actualSide !== expectedSide) {
      return NextResponse.json(
        { error: `Turn mismatch: FEN indicates ${actualSide} to move, but client sent ${requestedTurn}.`, retryable: false },
        { status: 422 },
      );
    }
  }

  try {
    const result = await playStockfishMove(fen);
    return NextResponse.json({
      uci: result.uci,
      san: result.san,
      fen: result.fen,
      multiPv: result.multiPv,
      evalDelta: result.evalDelta,
      motif: result.motif,
      confidence: result.confidence,
      outcome: result.outcome,
    });
  } catch (stockfishErr) {
    console.warn("Stockfish error, returning error response:");
  }

  return NextResponse.json(
    {
      error: stockfishErr instanceof Error ? stockfishErr.message : "Stockfish calculation failed. Engine unavailable.",
      retryable: true,
    },
    { status: 503 },
  );
}
