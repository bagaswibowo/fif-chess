import { NextResponse } from "next/server";
import { validateFen } from "@/lib/chess";
import { GATE_COOKIE, gateConfigured, readCookie, sessionValid } from "@/lib/gate";
import { JevRequestError } from "@/lib/jev";
import { playEngineMove, type EngineId } from "@/lib/engines";

export const runtime = 'nodejs';

function parseEngine(bodyObj: Record<string, unknown>): EngineId {
  const v = typeof bodyObj.engine === 'string' ? bodyObj.engine.toLowerCase() : '';
  if (v === 'jev') return 'jev';
  if (v === 'fly' || v === 'flybrain') return 'fly';
  if (v === 'jev-fly' || v === 'jevfly' || v === 'hybrid') return 'jev-fly';
  return 'stockfish';
}

export async function POST(request: Request) {
  if (gateConfigured() && !sessionValid(readCookie(request, GATE_COOKIE))) {
    return NextResponse.json(
      { error: 'Unlock the board before engine will play.', retryable: false },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be JSON.', retryable: false },
      { status: 400 },
    );
  }

  const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const fen = bodyObj.fen;
  const rawDepth = typeof bodyObj.depth === 'number' ? bodyObj.depth : 14;
  const depth = Math.max(6, Math.min(16, Math.round(rawDepth)));

  if (typeof fen !== 'string') {
    return NextResponse.json(
      { error: 'Missing fen. Send the current position as a FEN string.', retryable: false },
      { status: 400 },
    );
  }

  const fenCheck = validateFen(fen);
  if (!fenCheck.ok) {
    return NextResponse.json(
      { error: fenCheck.error ?? 'Invalid FEN.', retryable: false },
      { status: 400 },
    );
  }

  const engine = parseEngine(bodyObj);
  const seed = typeof bodyObj.seed === 'number' ? bodyObj.seed : 0;
  const history = Array.isArray(bodyObj.history) ? (bodyObj.history as string[]) : [];

  try {
    const result = await playEngineMove(engine, {
      fen,
      depth,
      seed,
      history,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof JevRequestError) {
      return NextResponse.json(
        { error: err.message, retryable: err.retryable },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : 'Engine move calculation failed.';
    return NextResponse.json({ error: message, retryable: true }, { status: 500 });
  }
}
