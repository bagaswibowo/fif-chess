import { playFlyBrainMove } from "@/lib/flybrain/service";
import { NextResponse } from 'next/server';
import { JevRequestError, playJevMove } from '@/lib/jev';
import { playStockfishMove, guardJevMove, guardJevFlyMove } from '@/lib/stockfish';
import { Chess, validateFen } from 'chess.js';
import { applyUci, describeOutcome } from '@/lib/chess';
import { GATE_COOKIE, gateConfigured, readCookie, sessionValid } from '@/lib/gate';

export const runtime = 'nodejs';

function apiKey(): string | undefined {
  const value = process.env.TYPESAFE_API_KEY;
  return value && value.trim().length > 0 ? value : undefined;
}

function parseEngine(bodyObj: Record<string, unknown>): 'stockfish' | 'jev' | 'fly' | 'jev-fly' {
  const v = bodyObj.engine;
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

  // Hybrid Jev + FlyBrain + guard taktis Stockfish: gabungan semantik Jev
  // (bila API hidup) + connectome FlyBrain, divalidasi Stockfish supaya
  // tidak blunder dan tetap pintar mempromosikan pion.
  if (engine === "jev-fly") {
    try {
      let hybrid;
      const key = apiKey();
      if (!key) throw new JevRequestError("TYPESAFE_API_KEY not set", 503, false);
      try {
        hybrid = await playJevMove(fen, { apiKey: key, seed, history });
      } catch (jevErr) {
        // Jev API tak tersedia (SSL/network) — pakai FlyBrain murni sbg hybrid.
        console.warn("jev-fly: Jev API unavailable, using FlyBrain:", jevErr instanceof Error ? jevErr.message : jevErr);
        const flyRes = playFlyBrainMove(fen);
        if (!flyRes) {
          return NextResponse.json({ error: "Hybrid engine could not compute a move.", retryable: false }, { status: 400 });
        }
        hybrid = {
          uci: flyRes.uci,
          san: flyRes.san,
          fen: flyRes.fen,
          probabilities: flyRes.probabilities,
          confidence: flyRes.confidence,
          droppedMoveCount: 0,
          outcome: flyRes.outcome,
          request: {} as any,
        };
      }
      const guarded = await guardJevFlyMove(fen, hybrid, depth);
      return NextResponse.json({
        uci: guarded.uci,
        san: guarded.san,
        fen: guarded.fen,
        probabilities: guarded.probabilities,
        confidence: guarded.confidence,
        droppedMoveCount: guarded.droppedMoveCount,
        outcome: guarded.outcome,
        scoreCp: (guarded as any).scoreCp ?? null,
        engine: "jev-fly",
      });
    } catch (err) {
      console.error("jev-fly execution failed:", err);
      const flyRes = playFlyBrainMove(fen);
      if (flyRes) {
        return NextResponse.json(flyRes);
      }
      return NextResponse.json({ error: "Hybrid engine failed.", retryable: true }, { status: 502 });
    }
  }

  if (engine === 'stockfish') {
    try {
      const playedUci = typeof bodyObj.playedUci === 'string' ? bodyObj.playedUci : undefined;
      const result = await playStockfishMove(fen, depth, playedUci);
      return NextResponse.json({
        uci: result.uci,
        san: result.san,
        fen: result.fen,
        probabilities: result.probabilities,
        confidence: result.confidence,
        droppedMoveCount: result.droppedMoveCount,
        outcome: result.outcome,
        scoreCp: (result as any).scoreCp ?? null,
        playedScoreCp: result.playedScoreCp ?? null,
        deltaCp: result.deltaCp ?? null,
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
    // If TYPESAFE_API_KEY is not set, use local neural connectome FlyBrain or tactical engine
    // so Jev vs Stockfish arena plays continuously without halting
    try {
      const flyResult = playFlyBrainMove(fen);
      if (flyResult) {
        return NextResponse.json(flyResult);
      }
    } catch (fbErr) {
      console.warn("FlyBrain fallback error for Jev:", fbErr);
    }

    try {
      const sfResult = await playStockfishMove(fen, Math.max(4, depth - 2));
      return NextResponse.json({
        uci: sfResult.uci,
        san: sfResult.san,
        fen: sfResult.fen,
        probabilities: sfResult.probabilities,
        confidence: sfResult.confidence,
        droppedMoveCount: sfResult.droppedMoveCount,
        outcome: sfResult.outcome,
        scoreCp: (sfResult as any).scoreCp ?? null,
      });
    } catch (sfErr) {
      console.error("Stockfish fallback failed for Jev:", sfErr);
      return NextResponse.json(
        { error: 'TYPESAFE_API_KEY is not set. Add your TypeSafe API key to play against Jev.', retryable: false },
        { status: 503 },
      );
    }
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
    // Jev tidak selalu tersedia (API eksternal bisa down / sertifikat SSL
    // invalid, mis. jam sistem tertinggal → CERT_NOT_YET_VALID). Jangan biarkan
    // arena/solver macet: fallback ke FlyBrain lokal lalu Stockfish.
    console.warn("Jev move failed, falling back:", error instanceof Error ? error.message : error);
    try {
      const flyResult = playFlyBrainMove(fen);
      if (flyResult) {
        return NextResponse.json({ ...flyResult, engine: "fly-jev-fallback" });
      }
    } catch (fbErr) {
      console.warn("FlyBrain fallback for Jev failed:", fbErr);
    }
    try {
      const sfResult = await playStockfishMove(fen, Math.max(4, depth - 2));
      return NextResponse.json({
        uci: sfResult.uci,
        san: sfResult.san,
        fen: sfResult.fen,
        probabilities: sfResult.probabilities,
        confidence: sfResult.confidence,
        droppedMoveCount: sfResult.droppedMoveCount,
        outcome: sfResult.outcome,
        scoreCp: (sfResult as any).scoreCp ?? null,
        engine: "stockfish-jev-fallback",
      });
    } catch (sfErr) {
      console.error("Stockfish fallback for Jev failed:", sfErr);
    }
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
