import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Chess } from "chess.js";
import { applyUci, describeOutcome, type GameOutcome } from "@/lib/chess";
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

        const pvMatch = line.match(/^info\s+.*multipv\s+(\d+)\s+.*score\s+(cp|mate)\s+(-?\d+).*pv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (pvMatch) {
          const type = pvMatch[2];
          const val = parseInt(pvMatch[3], 10);
          const uci = pvMatch[4];
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
      p.stdin.write(`go depth ${depth} movetime 3000\n`);
    } catch {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    }
  });
}

function evalSingleMove(fen: string, move: string, depth = 10): Promise<number | null> {
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
      p.stdin.write(`go depth ${depth} movetime 3000\n`);
    } catch {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    }
  });
}

export async function guardJevMove(
  fen: string,
  jevResult: JevPlaySuccess,
  depth = 12,
): Promise<StockfishResult> {
  // ponytail: fallback to unverified Jev move if Stockfish process fails
  const chess = new Chess(fen);
  const guardDepth = Math.max(12, depth);
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

  let jevScore = sf.candidateScores.get(jevResult.uci);
  if (jevScore === undefined) {
    jevScore = (await evalSingleMove(fen, jevResult.uci, Math.max(8, guardDepth - 2))) ?? undefined;
  }

  const bestScore = sf.bestScore;
  const delta = jevScore !== undefined ? bestScore - jevScore : 9999;
  const isSafe = jevScore !== undefined && delta <= 25 && jevScore > -20000;

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

  // Jev move is a tactical blunder. Try Jev\'s other high-probability moves
  const sortedCandidates = Object.entries(jevResult.probabilities || {})
    .sort((a, b) => b[1] - a[1])
    .map(([uci]) => uci);

  for (const cand of sortedCandidates) {
    if (cand === jevResult.uci) continue;
    let candScore = sf.candidateScores.get(cand);
    if (candScore === undefined) {
      candScore = (await evalSingleMove(fen, cand, Math.max(8, guardDepth - 2))) ?? undefined;
    }
    if (candScore !== undefined && bestScore - candScore <= 25 && candScore > -20000) {
      try {
        const applied = applyUci(chess, cand);
        return {
          uci: cand,
          san: applied.san,
          fen: chess.fen(),
          probabilities: jevResult.probabilities,
          confidence: jevResult.probabilities[cand] ?? 0.5,
          droppedMoveCount: jevResult.droppedMoveCount,
          outcome: describeOutcome(chess),
          scoreCp: candScore,
        };
      } catch {}
    }
  }

  // No safe candidate from Jev: Stockfish tactical safeguard overrides to prevent blunder/mate
  try {
    const applied = applyUci(chess, sf.bestMove);
    return {
      uci: sf.bestMove,
      san: applied.san,
      fen: chess.fen(),
      probabilities: { [sf.bestMove]: 0.85, ...jevResult.probabilities },
      confidence: 0.85,
      droppedMoveCount: jevResult.droppedMoveCount,
      outcome: describeOutcome(chess),
      scoreCp: bestScore,
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
        const pvMatch = line.match(/^info\s+.*multipv\s+(\d+)\s+.*pv\s+((?:[a-h][1-8])+[qrbn]?)/);
        if (pvMatch) {
          const pvId = parseInt(pvMatch[1], 10);
          topMoves.set(pvId, pvMatch[2]);
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
    p.stdin.write(`go depth ${depth} movetime 3000\n`);
  });
}
