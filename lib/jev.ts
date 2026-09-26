import { Chess, type Square } from "chess.js";
import {
  applyUci,
  describeOutcome,
  getLegalMoves,
  parseFen,
  selectMovesForChoice,
  sideToMove,
  type GameOutcome,
} from "@/lib/chess";
import { evaluateWithFlyBrain, type FlyMoveScore } from "@/lib/flybrain/service";

export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
export const MOVE_QUESTION_ID = "move";

export const MOVE_INSTRUCTIONS =
  "You are an elite Grandmaster chess engine playing with ruthless tactical precision and deep endgame mastery (10,000 Elo ambition). WINNING LAWS: 1. PASSED PAWN PROMOTION: Advance passed pawns relentlessly toward rank 8 to create a Queen! Escort them with your King. 2. BLOCKADE ENEMY PASSED PAWNS: If the opponent has passed pawns, place your Rooks behind them and blockade their promotion square immediately! Never allow enemy pawns to promote unchecked. 3. NEVER SACRIFICE MATERIAL WITHOUT DIRECT CHECKMATE: Do not lose Rooks or wander your King into enemy mating nets. 4. KILLER TACTICS: Forks, pins, skewers, and decisive passed pawn creation.";

export const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 1000,
};

export const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export type JevState = {
  fen: string;
  side_to_move: "white" | "black";
  move_history: string[];
  in_check: boolean;
  my_threatened_pieces: string[];
  capturable_opponents: string[];
  opponent_king_square: string;
  opponent_queen_square: string | null;
  has_passed_pawns: boolean;
  opp_has_passed_pawns: boolean;
  is_endgame: boolean;
  fly_brain_top_moves: string[];
  strategic_mandate: string;
  tactical_situation: string;
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type SystemOneRequest = {
  state: JevState;
  model: typeof JEV_MODEL;
  questions: {
    move: ChoiceQuestion;
  };
};

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

export type BuiltJevRequest = {
  request: SystemOneRequest;
  legalUcis: string[];
  droppedUcis: string[];
  flyMoves: FlyMoveScore[];
};

function isPassedPawn(chess: Chess, fromSq: string, targetColor?: "w" | "b"): boolean {
  const file = fromSq.charCodeAt(0) - 97;
  const rank = parseInt(fromSq[1], 10);
  const color = targetColor || chess.turn();
  const b = chess.board();
  const oppColor = color === "w" ? "b" : "w";

  for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
    for (let r = 0; r < 8; r++) {
      const p = b[r]?.[f];
      if (p && p.color === oppColor && p.type === "p") {
        const pRank = 8 - r;
        if (color === "w" && pRank > rank) return false;
        if (color === "b" && pRank < rank) return false;
      }
    }
  }
  return true;
}

export function buildJevRequest(fen: string, seed?: number, history: string[] = []): BuiltJevRequest {
  const chess = parseFen(fen);
  if (chess.isGameOver()) {
    throw new Error("The game is already over; there is no move to pick.");
  }

  const myColor = chess.turn();
  const oppColor = myColor === "w" ? "b" : "w";
  const board = chess.board();
  const ply = history.length;

  let oppKingSq = "e8";
  let oppQueenSq: string | null = null;
  let hasPassedPawns = false;
  let oppHasPassedPawns = false;
  let totalQueens = 0;
  const oppPassedSquares: string[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]?.[c];
      if (!p) continue;
      const sq = `${String.fromCharCode(97 + c)}${8 - r}`;
      if (p.type === "q") totalQueens++;
      if (p.color === oppColor && p.type === "k") {
        oppKingSq = sq;
      } else if (p.color === oppColor && p.type === "q") {
        oppQueenSq = sq;
      } else if (p.color === myColor && p.type === "p") {
        if (isPassedPawn(chess, sq, myColor)) hasPassedPawns = true;
      } else if (p.color === oppColor && p.type === "p") {
        if (isPassedPawn(chess, sq, oppColor)) {
          oppHasPassedPawns = true;
          oppPassedSquares.push(sq);
        }
      }
    }
  }

  const isEndgame = totalQueens === 0 || ply >= 35;

  // 1. Fly Brain Sensory Forward Pass (134k Drosophila neurons)
  const flyResult = evaluateWithFlyBrain(fen);
  const flyMoves = flyResult?.moves ?? [];
  const flyTop3 = flyMoves.slice(0, 3);
  const flyTopUcis = new Set(flyTop3.map((m) => m.uci));

  // 2. Identify threatened pieces & capturable targets
  const threatenedPieces: string[] = [];
  const capturableOpponents: string[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]?.[c];
      if (!p) continue;
      const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
      if (p.color === myColor && chess.isAttacked(sq, oppColor)) {
        threatenedPieces.push(`${PIECE_NAMES[p.type] ?? p.type} on ${sq}`);
      } else if (p.color === oppColor && chess.isAttacked(sq, myColor)) {
        capturableOpponents.push(`${PIECE_NAMES[p.type] ?? p.type} on ${sq}`);
      }
    }
  }

  let strategicMandate = "";
  if (isEndgame && oppHasPassedPawns && !hasPassedPawns) {
    strategicMandate = `DEFENSIVE CRISIS: Opponent has dangerous passed pawn(s) on ${oppPassedSquares.join(", ")}! Put Rooks on open files behind them to block promotion! Do NOT let King wander into enemy mating corridors.`;
  } else if (isEndgame && hasPassedPawns) {
    strategicMandate = "CRITICAL ENDGAME MANDATE: PUSH PASSED PAWNS TO PROMOTE TO QUEEN! Escort them with your King. Do NOT give up pawns on the other flank.";
  } else if (isEndgame) {
    strategicMandate = "ENDGAME PRINCIPLE: Activate your King safely! Blockade opponent pawn breaks and maintain Rook activity.";
  } else if (oppQueenSq && threatenedPieces.length > 0) {
    strategicMandate = `DEFENSE ALERT: Opponent Queen on ${oppQueenSq} is dangerous! Defend all infiltrated squares firmly.`;
  } else if (ply < 14) {
    strategicMandate = "OPENING BRILLIANCE: Fight for the center, open dynamic diagonals, develop minor pieces aggressively, and maintain King safety.";
  } else {
    strategicMandate = `ATTACKING MANDATE: Pressure opponent King on ${oppKingSq}! Look for tactical forks, double attacks, and decisive passed pawn creation.`;
  }

  const tacticalSituation = chess.isCheck()
    ? "ALERT: King is in CHECK! Safely block, capture the checker, or move the king."
    : oppHasPassedPawns
    ? `DANGER: Opponent passed pawns active on ${oppPassedSquares.join(", ")}. Prioritize blockading their file!`
    : threatenedPieces.length > 0
    ? `TACTICAL BATTLE: ${threatenedPieces.length} piece(s) engaged: ${threatenedPieces.join(", ")}. Defend or counter-strike safely!`
    : capturableOpponents.length > 0
    ? `TARGET SPOTTED: Enemy piece(s) vulnerable: ${capturableOpponents.join(", ")}. Exploit aggressively!`
    : "Position is primed. Advance tactical goals and push passed pawns!";

  // 3. Build rich semantic descriptions
  const { selected, dropped } = selectMovesForChoice(getLegalMoves(chess));
  const rawMoves = chess.moves({ verbose: true });
  const rawMoveMap = new Map(rawMoves.map((m) => [m.lan, m]));

  const criteria: Record<string, string> = {};
  for (const move of selected) {
    const raw = rawMoveMap.get(move.uci);
    let desc = `${move.san}: `;
    const pName = raw ? (PIECE_NAMES[raw.piece] ?? raw.piece) : "piece";
    const pVal = raw ? (PIECE_VALUES[raw.piece] ?? 1) : 1;
    const destAttacked = raw ? chess.isAttacked(raw.to, oppColor) : false;
    const isFlyTop = flyTopUcis.has(move.uci);

    const isPawn = raw?.piece === "p";
    const isPassed = isPawn && isPassedPawn(chess, move.from, myColor);
    const toRank = parseInt(move.to[1], 10);
    const toFile = move.to[0];

    // Check if move blockades opponent passed pawn
    const isBlockadingOppPassed =
      oppHasPassedPawns &&
      (raw?.piece === "r" || raw?.piece === "k") &&
      oppPassedSquares.some((osq) => osq[0] === toFile);

    // Multi-attack & Queen attacks
    let attacksMultiple = false;
    let attacksOppQueen = false;
    try {
      const simChess = new Chess(fen);
      simChess.move({ from: move.uci.slice(0, 2), to: move.uci.slice(2, 4), promotion: move.uci[4] });
      let attackedCount = 0;
      const bSim = simChess.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const pt = bSim[r]?.[c];
          if (pt && pt.color === oppColor) {
            const sqSim = (String.fromCharCode(97 + c) + (8 - r)) as Square;
            if (simChess.isAttacked(sqSim, myColor)) {
              attackedCount++;
              if (pt.type === "q") attacksOppQueen = true;
            }
          }
        }
      }
      attacksMultiple = attackedCount >= 2;
    } catch {}

    if (move.isCheckmate) {
      desc += "[FATAL CHECKMATE] DELIVERS IMMEDIATE CHECKMATE! Wins the game!";
    } else if (move.isPromotion) {
      desc += "[QUEEN PROMOTION] PROMOTES PAWN TO QUEEN! Decisive game-winning promotion!";
    } else if (isPassed && ((myColor === "w" && toRank >= 6) || (myColor === "b" && toRank <= 3))) {
      desc += `[CRITICAL PROMOTION SPRINT] Advances passed pawn to rank ${toRank}! Only ${myColor === "w" ? 8 - toRank : toRank - 1} square(s) from Queen promotion! Top tactical priority!`;
    } else if (isPassed) {
      desc += `[PASSED PAWN PUSH] Advances passed pawn toward promotion on ${move.to}`;
    } else if (isBlockadingOppPassed) {
      desc += `[CRITICAL BLOCKADE] Places ${pName} on file ${toFile} to stop and blockade opponent passed pawn runaway!`;
    } else if (isEndgame && hasPassedPawns && raw && raw.piece === "k") {
      desc += `[KING PASSED PAWN ESCORT] King steps to ${move.to} to actively shield and escort passed pawn to Queen promotion!`;
    } else if (isEndgame && oppHasPassedPawns && raw && raw.piece === "k" && (move.to.startsWith("a") || move.to.startsWith("b")) && destAttacked) {
      desc += `[SUICIDE KING MARCH - AVOID] Wanders King into enemy mating net and rook check corridor on ${move.to}! (AVOID)`;
    } else if (isEndgame && hasPassedPawns && raw && raw.piece === "p" && !isPassed) {
      desc += `[TEMPO LOSS] Wastes crucial endgame move on flank pawn ${move.uci} instead of pushing or blockading passed pawns! (AVOID)`;
    } else if (chess.history().length < 8 && (move.uci === "e2e4" || move.uci === "f2f4" || move.uci === "b2b4" || move.uci === "d2d4" || move.uci === "c2c4")) {
      desc += `[AGGRESSIVE GAMBIT / CENTER DOMINANCE] Sharp dynamic opening thrust attacking central files and unlocking lines to the enemy King!`;
    } else if (move.isCapture) {
      const capName = raw?.captured ? (PIECE_NAMES[raw.captured] ?? raw.captured) : "piece";
      const capVal = raw?.captured ? (PIECE_VALUES[raw.captured] ?? 1) : 1;

      if (destAttacked && pVal > capVal) {
        if (pVal === 5 && capVal === 3) {
          desc += `[EXCHANGE LOSS] Sacrifices Rook for ${capName} on ${move.to} (Gives up the exchange! AVOID)`;
        } else {
          desc += `[FATAL BLUNDER] Sacrifices ${pName} for lower-value ${capName} on ${move.to} (DO NOT PLAY)`;
        }
      } else if (!destAttacked) {
        desc += `[TACTICAL CAPTURE] Cleanly destroys undefended opponent ${capName} on ${move.to}! Wins material!`;
      } else {
        desc += `[EQUAL TRADE] ${pName} strikes opponent ${capName} on ${move.to}`;
      }
    } else if (move.isCheck) {
      desc += `[FORCING CHECK] ${pName} delivers direct CHECK to enemy King on ${oppKingSq}!`;
    } else if (attacksOppQueen) {
      desc += `[ATTACK ENEMY QUEEN] Directly attacks opponent Queen on ${oppQueenSq}!`;
    } else if (attacksMultiple) {
      desc += `[TACTICAL FORK / DOUBLE ATTACK] Moves ${pName} to ${move.to}, striking multiple enemy targets simultaneously!`;
    } else if (isEndgame && raw && raw.piece === "k" && (move.to === "e2" || move.to === "e3" || move.to === "d3" || move.to === "d4" || move.to === "e4" || move.to === "e5" || move.to === "d5" || move.to === "d6")) {
      desc += `[KING CENTRALIZATION] Activates King safely into the center on ${move.to} to control the endgame!`;
    } else if (move.isCastle) {
      desc += "[STRATEGIC FORTRESS] Castles king to safety and activates rook";
    } else if (raw && destAttacked) {
      desc += `[DANGER] Moves ${pName} to ${move.to} which is under enemy attack!`;
    } else if (raw && chess.isAttacked(raw.from, oppColor)) {
      desc += `[RESCUE] Safely rescues threatened ${pName} from ${raw.from} to ${move.to}`;
    } else if (isFlyTop) {
      desc += `[FLY BRAIN RECOMMENDED] 134k Drosophila neurons recommend natural push to ${move.to}`;
    } else if (raw && (raw.piece === "n" || raw.piece === "b" || raw.piece === "r")) {
      desc += `[DEVELOPMENT] Deploys ${pName} forward to ${move.to}`;
    } else {
      desc += `[POSITIONAL] Moves ${pName} to ${move.to}`;
    }

    criteria[move.uci] = desc;
  }

  return {
    request: {
      state: {
        fen: chess.fen(),
        side_to_move: sideToMove(chess),
        move_history: history.slice(-10),
        in_check: chess.isCheck(),
        my_threatened_pieces: threatenedPieces,
        capturable_opponents: capturableOpponents,
        opponent_king_square: oppKingSq,
        opponent_queen_square: oppQueenSq,
        has_passed_pawns: hasPassedPawns,
        opp_has_passed_pawns: oppHasPassedPawns,
        is_endgame: isEndgame,
        fly_brain_top_moves: flyTop3.map((m) => `${m.san} (${(m.prob * 100).toFixed(0)}%)`),
        strategic_mandate: strategicMandate,
        tactical_situation: tacticalSituation,
      },
      model: JEV_MODEL,
      questions: {
        move: {
          type: "choice",
          instructions: `${MOVE_INSTRUCTIONS}${
            seed !== undefined
              ? ` For tie-breaking, prefer option ending with digit ${seed % 10}.`
              : ""
          }`,
          criteria,
        },
      },
    },
    legalUcis: selected.map((move) => move.uci),
    droppedUcis: dropped.map((move) => move.uci),
    flyMoves,
  };
}

export function resolveJevChoice(
  legalUcis: ReadonlySet<string>,
  answer: unknown,
):
  | {
      ok: true;
      uci: string;
      probabilities: Record<string, number>;
      confidence: number | null;
    }
  | { ok: false; error: string } {
  if (!answer || typeof answer !== "object") {
    return {
      ok: false,
      error: "Jev returned an empty or malformed answer. No move was applied.",
    };
  }

  const body = answer as Partial<ChoiceAnswer>;
  if (body.type !== "choice" || typeof body.choice !== "string") {
    return {
      ok: false,
      error: "Jev did not return a Choice answer. No move was applied.",
    };
  }

  if (!legalUcis.has(body.choice)) {
    return {
      ok: false,
      error: `Jev returned "${body.choice}", which is not in the legal set sent to the model. No move was applied.`,
    };
  }

  const probabilities =
    body.probabilities && typeof body.probabilities === "object"
      ? body.probabilities
      : {};

  return {
    ok: true,
    uci: body.choice,
    probabilities,
    confidence: typeof body.confidence === "number" ? body.confidence : null,
  };
}

export class JevRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "JevRequestError";
  }
}

export type JevPlaySuccess = {
  uci: string;
  san: string;
  fen: string;
  probabilities: Record<string, number>;
  confidence: number | null;
  droppedMoveCount: number;
  outcome: GameOutcome;
  request: SystemOneRequest;
};

type PlayDeps = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  seed?: number;
  history?: string[];
};

export async function playJevMove(
  fen: string,
  { apiKey, fetchImpl = fetch, seed, history = [] }: PlayDeps,
): Promise<JevPlaySuccess> {
  const built = buildJevRequest(fen, seed, history);
  const legalSet = new Set(built.legalUcis);

  const response = await fetchImpl(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(built.request),
  });

  if (!response.ok) {
    throw mapHttpError(response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new JevRequestError(
      "TypeSafe returned a response that was not JSON. No move was applied.",
      502,
      true,
    );
  }

  const answers =
    payload && typeof payload === "object"
      ? (payload as { answers?: { move?: unknown } }).answers
      : undefined;

  const resolved = resolveJevChoice(legalSet, answers?.move);
  if (!resolved.ok) {
    throw new JevRequestError(resolved.error, 422, true);
  }

  // Blend Jev (Semantic) + FlyBrain (Connectome)
  const flyMap: Record<string, number> = {};
  for (const fm of built.flyMoves) {
    flyMap[fm.uci] = fm.prob;
  }

  const blendedProbs: Record<string, number> = {};
  for (const uci of built.legalUcis) {
    const pJev = resolved.probabilities[uci] ?? 0;
    const pFly = flyMap[uci] ?? 0;
    blendedProbs[uci] = Number((0.5 * pJev + 0.5 * pFly).toFixed(4));
  }

  const sortedBlended = Object.entries(blendedProbs).sort((a, b) => b[1] - a[1]);
  const bestBlendedUci = sortedBlended.length > 0 ? sortedBlended[0][0] : resolved.uci;

  const chess = new Chess(fen);
  let applied;
  let finalUci = bestBlendedUci;
  try {
    applied = applyUci(chess, bestBlendedUci);
  } catch {
    applied = applyUci(chess, resolved.uci);
    finalUci = resolved.uci;
  }

  return {
    uci: finalUci,
    san: applied.san,
    fen: chess.fen(),
    probabilities: blendedProbs,
    confidence: blendedProbs[finalUci] ?? resolved.confidence,
    droppedMoveCount: built.droppedUcis.length,
    outcome: describeOutcome(chess),
    request: built.request,
  };
}

export function mapHttpError(status: number): JevRequestError {
  if (status === 401) {
    return new JevRequestError(
      "TypeSafe rejected the API key. Check TYPESAFE_API_KEY.",
      401,
      false,
    );
  }
  if (status === 429) {
    return new JevRequestError(
      "TypeSafe rate-limited this request (429). Wait a moment and retry.",
      429,
      true,
    );
  }
  if (status === 529) {
    return new JevRequestError(
      "TypeSafe is overloaded (529). Retry shortly.",
      529,
      true,
    );
  }
  if (status === 422) {
    return new JevRequestError(
      "TypeSafe rejected the request as invalid (422).",
      422,
      true,
    );
  }
  return new JevRequestError(
    `TypeSafe request failed (${status}).`,
    status >= 400 && status < 600 ? status : 502,
    true,
  );
}
