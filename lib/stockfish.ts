import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Chess } from "chess.js";
import { applyUci, describeOutcome, isKnightFork, isQueenThreatened, isQueenXrayed, type GameOutcome } from "@/lib/chess";
import { getLearnedMove, isBlunderMove, recordMatchExperience } from "./experience";
import type { JevPlaySuccess } from "@/lib/jev";

export type StockfishResult = {
  uci: string;
  scoreCp: number | null;
  san: string;
  fen: string;
  probabilities: Record<string, number>;
  confidence: number;
  droppedMoveCount: number;
  outcome: GameOutcome;
  playedScoreCp?: number | null;
  deltaCp?: number | null;
  pvLine?: string[];
};

type StockfishEval = {
  bestMove: string;
  bestScore: number;
  candidateScores: Map<string, number>;
};

function getStockfishEval(fen: string, depth = 12, multipv = 5): Promise<StockfishEval | null> {
  return new Promise((resolve) => {
    let p: ChildProcessWithoutNullStreams;
    try {
      p = spawn("/usr/games/stockfish") as ChildProcessWithoutNullStreams;
    } catch {
      return resolve(null);
    }

    if (!p || !p.stdin || !p.stdout) {
      return resolve(null);
    }

    let out = "";
    let lastDepth = 0;
    const candidateScores = new Map<string, number>();
    let bestMove: string | null = null;
    let bestScore: number | null = null;
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        try { p.stdin.write("quit\n"); } catch (_) {}
        p.kill();
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);

    p.stdout.on("data", (data: Buffer) => {
      out += data.toString();
      const lines = out.split("\n");
      out = lines.pop() || "";

      for (const line of lines) {
        const dMatch = line.match(/^info depth (\d+)/);
        if (dMatch) {
          const curDepth = parseInt(dMatch[1], 10);
          if (curDepth > lastDepth) {
            lastDepth = curDepth;
            candidateScores.clear();
          }
        }

        const pvMatch = line.match(/^info\s+.*multipv\s+(\d+)\s+.*score\s+(cp|mate)\s+(-?\d+).*pv\s+(.+)$/);
        if (pvMatch) {
          const type = pvMatch[2];
          const val = parseInt(pvMatch[3], 10);
          const rawPv = pvMatch[4].trim().split(/\s+/);
          const uci = rawPv[0];
          const score = type === "mate" ? (val > 0 ? 30000 - val * 100 : -30000 - val * 100) : val;
          candidateScores.set(uci, score);
          if (pvMatch[1] === "1") {
            bestMove = uci;
            bestScore = score;
          }
        }

        const bestMatch = line.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (bestMatch) {
          clearTimeout(timer);
          cleanup();
          resolve({
            bestMove: bestMove || bestMatch[1],
            bestScore: bestScore !== null ? bestScore : 0,
            candidateScores,
          });
          return;
        }
      }
    });

    p.stderr?.on("data", () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    });

    p.on("error", () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    });

    try {
      p.stdin.write("uci\n");
      p.stdin.write(`setoption name MultiPV value ${multipv}\n`);
      p.stdin.write(`position fen ${fen}\n`);
      p.stdin.write(`go depth ${depth} movetime 1200\n`);
    } catch {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    }
  });
}

export function evalSingleMove(fen: string, move: string, depth = 10): Promise<number | null> {
  return new Promise((resolve) => {
    let p: ChildProcessWithoutNullStreams;
    try {
      p = spawn("/usr/games/stockfish") as ChildProcessWithoutNullStreams;
    } catch {
      return resolve(null);
    }

    if (!p || !p.stdin || !p.stdout) {
      return resolve(null);
    }

    let out = "";
    let oppScore: number | null = null;
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        try { p.stdin.write("quit\n"); } catch (_) {}
        p.kill();
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 4000);

    p.stdout.on("data", (data: Buffer) => {
      out += data.toString();
      const lines = out.split("\n");
      out = lines.pop() || "";

      for (const line of lines) {
        const m = line.match(/score (cp|mate) (-?\d+)/);
        if (m) {
          const type = m[1];
          const val = parseInt(m[2], 10);
          oppScore = type === "mate" ? (val > 0 ? 30000 - val * 100 : -30000 - val * 100) : val;
        }

        if (line.includes("bestmove")) {
          clearTimeout(timer);
          cleanup();
          resolve(oppScore !== null ? -oppScore : null);
          return;
        }
      }
    });

    p.stderr?.on("data", () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    });

    p.on("error", () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    });

    try {
      p.stdin.write(`position fen ${fen} moves ${move}\n`);
      p.stdin.write(`go depth ${depth} movetime 1200\n`);
    } catch {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    }
  });
}

interface GuardContext {
  fen: string;
  chess: Chess;
  sf: StockfishEval;
  guardDepth: number;
  maxAllowedDiff: number;
  jevResult: JevPlaySuccess;
}

function guardLearnedExperience(ctx: GuardContext, legals: any[]): StockfishResult | null {
  const learned = getLearnedMove(ctx.fen);
  if (!learned) return null;
  const isLegal = legals.some((m: any) => m.lan === learned.move);
  if (!isLegal) return null;
  try {
    const applied = applyUci(ctx.chess, learned.move);
    return {
      uci: learned.move,
      san: applied.san,
      fen: ctx.chess.fen(),
      probabilities: { [learned.move]: 0.99, ...ctx.jevResult.probabilities },
      confidence: 0.99,
      droppedMoveCount: 0,
      outcome: describeOutcome(ctx.chess),
      scoreCp: learned.score,
    };
  } catch {
    return null;
  }
}

async function guardPromotion(ctx: GuardContext, promoMoves: any[]): Promise<StockfishResult | null> {
  const isSfPromo = promoMoves.some((m: any) => ctx.sf.bestMove.startsWith(m.from + m.to));
  if (isSfPromo || ctx.sf.bestScore >= 20000) {
    try {
      const applied = applyUci(ctx.chess, ctx.sf.bestMove);
      return {
        uci: ctx.sf.bestMove,
        san: applied.san,
        fen: ctx.chess.fen(),
        probabilities: { [ctx.sf.bestMove]: 0.99, ...ctx.jevResult.probabilities },
        confidence: 0.99,
        droppedMoveCount: 0,
        outcome: describeOutcome(ctx.chess),
        scoreCp: ctx.sf.bestScore,
      };
    } catch {
      return null;
    }
  }

  if (promoMoves.length === 0) return null;
  let bestScore = -99999;
  let bestUci: string | null = null;

  for (const pMove of promoMoves) {
    const promoUci = pMove.from + pMove.to + (pMove.promotion || "q");
    let score = ctx.sf.candidateScores.get(promoUci);
    if (score === undefined) {
      score = (await evalSingleMove(ctx.fen, promoUci, ctx.guardDepth)) ?? undefined;
    }
    if (score !== undefined && score > bestScore) {
      bestScore = score;
      bestUci = promoUci;
    }
  }

  if (bestUci && bestScore > -20000) {
    try {
      const applied = applyUci(ctx.chess, bestUci);
      return {
        uci: bestUci,
        san: applied.san,
        fen: ctx.chess.fen(),
        probabilities: { [bestUci]: 0.99, ...ctx.jevResult.probabilities },
        confidence: 0.99,
        droppedMoveCount: 0,
        outcome: describeOutcome(ctx.chess),
        scoreCp: bestScore,
      };
    } catch {
      return null;
    }
  }
  return null;
}

function guardQueenLoss(ctx: GuardContext, delta: number): StockfishResult | null {
  const side = ctx.chess.turn();
  const hasQueen = ctx.chess.board().some((row: any[]) => row.some((sq: any) => sq && sq.color === side && sq.type === "q"));
  if (!hasQueen) return null;

  const queenThreatened = isQueenThreatened(ctx.chess) || isQueenXrayed(ctx.chess);
  if ((queenThreatened && delta > 30) || delta > 120) {
    try {
      const applied = applyUci(ctx.chess, ctx.sf.bestMove);
      return {
        uci: ctx.sf.bestMove,
        san: applied.san,
        fen: ctx.chess.fen(),
        probabilities: { [ctx.sf.bestMove]: 0.95, ...ctx.jevResult.probabilities },
        confidence: 0.95,
        droppedMoveCount: ctx.jevResult.droppedMoveCount,
        outcome: describeOutcome(ctx.chess),
        scoreCp: ctx.sf.bestScore,
      };
    } catch {
      return null;
    }
  }
  return null;
}

function guardEndgame(ctx: GuardContext, delta: number): StockfishResult | null {
  const isEndgame = (ctx.fen.match(/[rnbqRNBQ]/g) || []).length <= 6;
  if (!isEndgame) return null;
  const isLosing = ctx.sf.bestScore <= -120;
  const isDeviating = delta > 10;
  if (isLosing || isDeviating) {
    try {
      const applied = applyUci(ctx.chess, ctx.sf.bestMove);
      return {
        uci: ctx.sf.bestMove,
        san: applied.san,
        fen: ctx.chess.fen(),
        probabilities: { [ctx.sf.bestMove]: 0.95, ...ctx.jevResult.probabilities },
        confidence: 0.95,
        droppedMoveCount: ctx.jevResult.droppedMoveCount,
        outcome: describeOutcome(ctx.chess),
        scoreCp: ctx.sf.bestScore,
      };
    } catch {
      return null;
    }
  }
  return null;
}

async function guardCandidates(ctx: GuardContext): Promise<StockfishResult | null> {
  const candidates = Object.entries(ctx.jevResult.probabilities || {})
    .sort((a, b) => b[1] - a[1])
    .map(([uci]) => uci);

  for (const cand of candidates) {
    if (cand === ctx.jevResult.uci) continue;
    let candScore = ctx.sf.candidateScores.get(cand);
    if (candScore === undefined) {
      candScore = (await evalSingleMove(ctx.fen, cand, ctx.guardDepth)) ?? undefined;
    }
    if (candScore === undefined || candScore <= -20000) continue;

    const isFork = isKnightFork(ctx.chess, cand);
    const bonus = isFork ? 75 : 0;
    const isCandSafe = (ctx.sf.bestScore - (candScore + bonus)) <= ctx.maxAllowedDiff;

    if (isCandSafe) {
      try {
        const applied = applyUci(ctx.chess, cand);
        return {
          uci: cand,
          san: applied.san,
          fen: ctx.chess.fen(),
          probabilities: ctx.jevResult.probabilities,
          confidence: isFork ? 0.95 : (ctx.jevResult.probabilities[cand] ?? 0.5),
          droppedMoveCount: ctx.jevResult.droppedMoveCount,
          outcome: describeOutcome(ctx.chess),
          scoreCp: candScore ?? null,
        };
      } catch {}
    }
  }
  return null;
}

async function evaluateGuardedMove(
  fen: string,
  jevResult: JevPlaySuccess,
  guardDepth: number,
  maxAllowedDiff: number
): Promise<StockfishResult> {
  const chess = new Chess(fen);
  const sf = await getStockfishEval(fen, guardDepth, 5);
  if (!sf) {
    return {
      uci: jevResult.uci,
      san: jevResult.san,
      fen: jevResult.fen,
      probabilities: jevResult.probabilities,
      confidence: jevResult.confidence ?? 0.7,
      droppedMoveCount: jevResult.droppedMoveCount,
      outcome: jevResult.outcome,
      scoreCp: null,
    };
  }

  const ctx: GuardContext = { fen, chess, sf, guardDepth, maxAllowedDiff, jevResult };
  let jevScore = sf.candidateScores.get(jevResult.uci);
  if (jevScore === undefined) {
    jevScore = (await evalSingleMove(fen, jevResult.uci, guardDepth)) ?? undefined;
  }

  const legals = chess.moves({ verbose: true });
  const learnedRes = guardLearnedExperience(ctx, legals);
  if (learnedRes) return learnedRes;

  const promoMoves = legals.filter(
    (m: any) => m.promotion === "q" || (m.piece === "p" && (m.to.endsWith("8") || m.to.endsWith("1")))
  );
  const promoRes = await guardPromotion(ctx, promoMoves);
  if (promoRes) return promoRes;

  const delta = jevScore !== undefined ? sf.bestScore - jevScore : 9999;
  const queenRes = guardQueenLoss(ctx, delta);
  if (queenRes) return queenRes;

  const endgameRes = guardEndgame(ctx, delta);
  if (endgameRes) return endgameRes;

  const isSafe = jevScore !== undefined && delta <= maxAllowedDiff && jevScore > -20000;
  if (isSafe) {
    return {
      uci: jevResult.uci,
      san: jevResult.san,
      fen: jevResult.fen,
      probabilities: jevResult.probabilities,
      confidence: jevResult.confidence ?? 0.7,
      droppedMoveCount: jevResult.droppedMoveCount,
      outcome: jevResult.outcome,
      scoreCp: jevScore ?? null,
    };
  }

  const altRes = await guardCandidates(ctx);
  if (altRes) return altRes;

  try {
    recordMatchExperience(fen, sf.bestMove, sf.bestScore, delta > 150 ? jevResult.uci : undefined);
    const applied = applyUci(chess, sf.bestMove);
    return {
      uci: sf.bestMove,
      san: applied.san,
      fen: chess.fen(),
      probabilities: { [sf.bestMove]: 0.85, ...jevResult.probabilities },
      confidence: 0.85,
      droppedMoveCount: jevResult.droppedMoveCount,
      outcome: describeOutcome(chess),
      scoreCp: sf.bestScore,
    };
  } catch {
    return {
      uci: jevResult.uci,
      san: jevResult.san,
      fen: jevResult.fen,
      probabilities: jevResult.probabilities,
      confidence: jevResult.confidence ?? 0.7,
      droppedMoveCount: jevResult.droppedMoveCount,
      outcome: jevResult.outcome,
      scoreCp: null,
    };
  }
}

export async function guardJevMove(
  fen: string,
  jevResult: JevPlaySuccess,
  depth = 12,
): Promise<StockfishResult> {
  return evaluateGuardedMove(fen, jevResult, Math.max(12, depth), 25);
}

export async function guardJevFlyMove(
  fen: string,
  hybridResult: JevPlaySuccess,
  depth = 14,
): Promise<StockfishResult> {
  // Ketatkan toleransi di endgame (maxDiff 15 cp) agar tidak kecolongan taktik pion bebas & skakmat
  const isEndgame = (fen.match(/[rnbqRNBQ]/g) || []).length <= 6;
  const maxDiff = isEndgame ? 10 : 20;
  return evaluateGuardedMove(fen, hybridResult, Math.max(14, depth), maxDiff);
}

export async function playStockfishMove(fen: string, depth = 14, playedUci?: string): Promise<StockfishResult> {
  // Strict FEN validation to prevent UCI command injection.
  if (!/^[0-9a-zA-Z\/\s\-_]+$/.test(fen)) {
    throw new Error("Invalid FEN string format");
  }

  const chess = new Chess(fen);
  if (chess.isGameOver()) {
    throw new Error("Game is already over");
  }

  return new Promise((resolve, reject) => {
    const p = spawn("/usr/games/stockfish");
    let out = "";
    const topMoves = new Map<number, string>();
    const topScores = new Map<number, number>();
    let topPvLine: string[] = [];
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        try { p.stdin.write("quit\n"); } catch (_) {}
        p.kill();
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      const fallbackMove = topMoves.get(1) || (chess.moves({ verbose: true })[0]?.lan);
      if (fallbackMove) {
        try {
          const applied = applyUci(chess, fallbackMove);
          return resolve({
            uci: fallbackMove,
            san: applied.san,
            scoreCp: topScores.get(1) ?? null,
            fen: chess.fen(),
            probabilities: { [fallbackMove]: 1.0 },
            confidence: 0.8,
            droppedMoveCount: 0,
            outcome: describeOutcome(chess),
          });
        } catch (_) {}
      }
      reject(new Error("Stockfish calculation timeout"));
    }, 6000);

    p.stdout.on("data", (data: Buffer) => {
      out += data.toString();
      const lines = out.split("\n");
      out = lines.pop() || "";

      for (const line of lines) {
        const pvMatch = line.match(/^info\s+.*multipv\s+(\d+)\s+.*pv\s+(.+)$/);
        if (pvMatch) {
          const pvId = parseInt(pvMatch[1], 10);
          const rawPv = pvMatch[2].trim().split(/\s+/);
          if (rawPv.length > 0) {
            topMoves.set(pvId, rawPv[0]);
            if (pvId === 1) {
              topPvLine = rawPv;
            }
          }
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (cpMatch) topScores.set(pvId, parseInt(cpMatch[1], 10));
          else if (mateMatch) { const m = parseInt(mateMatch[1], 10); topScores.set(pvId, m > 0 ? 30000 : -30000); }
        }

        const bestMatch = line.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (bestMatch) {
          clearTimeout(timeout);
          cleanup();

          const bestMove = bestMatch[1];
          const m2 = topMoves.get(2);
          const m3 = topMoves.get(3);
          const probs: Record<string, number> = { [bestMove]: 0.70 };
          if (m2 && m2 !== bestMove) probs[m2] = 0.20;
          if (m3 && m3 !== bestMove && m3 !== m2) probs[m3] = 0.10;
          const confidence = probs[bestMove] ?? 0.70;

          try {
            const applied = applyUci(chess, bestMove);
            const bestScoreCp = topScores.get(1) ?? null;

            (async () => {
              let playedScoreCp: number | null = null;
              let deltaCp: number | null = null;

              if (playedUci) {
                if (playedUci === bestMove || bestMove.startsWith(playedUci) || playedUci.startsWith(bestMove)) {
                  playedScoreCp = bestScoreCp;
                  deltaCp = 0;
                } else {
                  let foundPv: number | null = null;
                  for (const [pvId, uci] of topMoves.entries()) {
                    if (uci === playedUci || uci.startsWith(playedUci) || playedUci.startsWith(uci)) {
                      foundPv = pvId;
                      break;
                    }
                  }
                  if (foundPv !== null && topScores.has(foundPv)) {
                    playedScoreCp = topScores.get(foundPv) ?? null;
                    if (bestScoreCp !== null && playedScoreCp !== null) {
                      deltaCp = Math.max(0, bestScoreCp - playedScoreCp);
                    }
                  } else {
                    try {
                      const single = await evalSingleMove(fen, playedUci, Math.min(depth, 8));
                      if (single !== null) {
                        playedScoreCp = single;
                        if (bestScoreCp !== null) {
                          deltaCp = Math.max(0, bestScoreCp - single);
                        }
                      }
                    } catch (_) {}
                    if (deltaCp === null && bestScoreCp !== null && topScores.size > 0) {
                      const worstTop = Math.min(...Array.from(topScores.values()));
                      deltaCp = Math.max(95, bestScoreCp - worstTop + 30);
                    }
                  }
                }
              }

              resolve({
                uci: bestMove,
                san: applied.san,
                scoreCp: bestScoreCp,
                playedScoreCp,
                deltaCp,
                fen: chess.fen(),
                probabilities: probs,
                confidence,
                droppedMoveCount: 0,
                outcome: describeOutcome(chess),
                pvLine: topPvLine,
              });
            })().catch((err) => reject(err));
          } catch (applyErr) {
            reject(applyErr);
          }
          return;
        }
      }
    });

    p.stderr.on("data", (err) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(err.toString()));
    });

    p.stdin.write("setoption name MultiPV value 5\n");
    p.stdin.write(`position fen ${fen}\n`);
    p.stdin.write(`go depth ${depth} movetime 1200\n`);
  });
}
