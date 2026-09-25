import { playFlyBrainMove } from "@/lib/flybrain/service";
import { NextResponse } from 'next/server';
import { JevRequestError, playJevMove } from '@/lib/jev';
import { playStockfishMove, guardJevMove } from '@/lib/stockfish';
import { Chess, validateFen } from 'chess.js';
import { applyUci, describeOutcome } from '@/lib/chess';
import { GATE_COOKIE, gateConfigured, readCookie, sessionValid } from '@/lib/gate';

export const runtime = 'nodejs';

function apiKey(): string | undefined {
  const value = process.env.TYPESAFE_API_KEY;
  return value && value.trim().length > 0 ? value : undefined;
}

function parseEngine(bodyObj: Record<string, unknown>): 'stockfish' | 'jev' | 'fly' {
  const v = bodyObj.engine;
  if (v === 'jev') return 'jev';
  if (v === 'fly' || v === 'flybrain') return 'fly';
  return 'stockfish';
}



export async function POST(request: Request) {
  if (!gateConfigured() || !sessionValid(readCookie(request, GATE_COOKIE))) {
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
  const depth = Math.max(1, Math.min(16, Math.round(rawDepth)));

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
  // Seed is used to bias Jev's move selection so each reset produces different play
  const seed = typeof bodyObj.seed === "number" ? bodyObj.seed : 0; const history = Array.isArray(bodyObj.history) ? (bodyObj.history as string[]) : [];

  
  if (engine === "fly") {
    const flyRes = playFlyBrainMove(fen);
    if (flyRes) {
      return NextResponse.json(flyRes);
    }
    return NextResponse.json({ error: "FlyBrain could not compute move for position.", retryable: false }, { status: 400 });
  }

  if (engine === 'stockfish') {
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
    } catch (err) {
      console.error("Stockfish fallback execution:", err);
      const chess = new Chess(fen);
      const legals = chess.moves({ verbose: true });
      if (legals.length > 0) {
        const fb = legals[0];
        const applied = applyUci(chess, fb.lan);
        return NextResponse.json({
          uci: fb.lan,
          san: applied.san,
          fen: chess.fen(),
          probabilities: { [fb.lan]: 1.0 },
          confidence: 0.5,
          droppedMoveCount: 0,
          outcome: describeOutcome(chess),
          scoreCp: 0,
        });
      }
      return NextResponse.json({ error: "No legal moves.", retryable: false }, { status: 400 });
    }
  }

  const key = apiKey();
  if (!key) {
    return NextResponse.json(
      { error: 'TYPESAFE_API_KEY is not set. Add your TypeSafe API key to play against Jev.', retryable: false },
      { status: 503 },
    );
  }

  try {
    // Pass seed to make Jev break ties differently each time
    const jevRaw = await playJevMove(fen, { apiKey: key, seed, history });
    // Hybrid evaluation: Stockfish tactically guards Jev's move so it never blunders or hangs pieces
    const result = await guardJevMove(fen, jevRaw, depth);
    return NextResponse.json({
      uci: result.uci,
      san: result.san,
      fen: result.fen,
      probabilities: result.probabilities,
      confidence: result.confidence,
      droppedMoveCount: result.droppedMoveCount,
      outcome: result.outcome,
      scoreCp: result.scoreCp ?? null,
    });
  } catch (error) {
    if (error instanceof JevRequestError) {
      return NextResponse.json({ error: error.message, retryable: error.retryable }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Jev could not pick a move.',
        retryable: true,
      },
      { status: 502 },
    );
  }
}
