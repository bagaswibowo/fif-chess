import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { classifyMove } from "@/lib/chess-move-badges";
import { buildPlayerSummary, type MoveAnalysis, type MoveClassificationType } from "@/lib/caps-evaluator";

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const startTime = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Twirp request body must be valid JSON.', retryable: false },
      { status: 400 }
    );
  }

  const reqObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const history = Array.isArray(reqObj.history) ? (reqObj.history as string[]) : [];

  if (history.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty history moves list.', retryable: false },
      { status: 400 }
    );
  }

  const chess = new Chess();
  const analyses: MoveAnalysis[] = [];

  for (let i = 0; i < history.length; i++) {
    const fenBefore = chess.fen();
    const turn = chess.turn();
    const san = history[i];

    let moveRes;
    try {
      moveRes = chess.move(san);
    } catch {
      break;
    }

    if (!moveRes) break;

    const uci = `${moveRes.from}${moveRes.to}${moveRes.promotion || ''}`;
    const fenAfter = chess.fen();

    const badge = classifyMove(fenBefore, uci, san);
    let classification: MoveClassificationType = 'best';
    let deltaCp = 0;

    switch (badge.type) {
      case 'brilliant':
        classification = 'brilliant';
        deltaCp = 0;
        break;
      case 'great':
        classification = 'great';
        deltaCp = 5;
        break;
      case 'best':
        classification = 'best';
        deltaCp = 0;
        break;
      case 'book':
        classification = 'book';
        deltaCp = 0;
        break;
      case 'blunder':
        classification = 'blunder';
        deltaCp = 250;
        break;
      case 'mistake':
        classification = 'mistake';
        deltaCp = 110;
        break;
      default:
        classification = 'inaccuracy';
        deltaCp = 45;
        break;
    }

    analyses.push({
      san,
      uci,
      fenBefore,
      fenAfter,
      turn,
      evalBefore: 0,
      evalAfter: 0,
      deltaCp,
      classification,
      commentary: badge.desc,
    });
  }

  const whiteSummary = buildPlayerSummary(analyses, 'w');
  const blackSummary = buildPlayerSummary(analyses, 'b');

  return NextResponse.json({
    service: 'chess.analysis.v1.AnalysisService',
    method: 'GetGameAnalysis',
    white: whiteSummary,
    black: blackSummary,
    moves: analyses,
    durationMs: Date.now() - startTime,
  });
}
