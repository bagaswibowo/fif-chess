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
  "Select the best legal chess move for the side to move. Evaluate tactical and strategic consequences strictly: 1. NEVER play moves tagged [FATAL BLUNDER] or [TEMPO LOSS]. 2. If your piece is attacked, move it to a SAFE square or defend it. 3. DO NOT move your Queen repeatedly back and forth while other pieces remain undeveloped. 4. Control the center, develop Knights and Bishops, and castle early. 5. Consider [FLY BRAIN RECOMMENDED] biological intuition moves for natural development.";

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
  fly_brain_top_moves: string[];
  strategic_guidance: string;
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

export function buildJevRequest(fen: string, seed?: number, history: string[] = []): BuiltJevRequest {
  const chess = parseFen(fen);
  if (chess.isGameOver()) {
    throw new Error("The game is already over; there is no move to pick.");
  }

  const myColor = chess.turn();
  const oppColor = myColor === "w" ? "b" : "w";
  const board = chess.board();
  const ply = history.length;

  // 1. Biological Fly Brain Sensory Forward Pass (134k Drosophila neurons)
  const flyResult = evaluateWithFlyBrain(fen);
  const flyMoves = flyResult?.moves ?? [];
  const flyTop3 = flyMoves.slice(0, 3);
  const flyTopUcis = new Set(flyTop3.map((m) => m.uci));

  // 2. Identify threatened own pieces and capturable opponent pieces
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

  // Count recent Queen moves from history
  const recentMyMoves = history
    .filter((_, idx) => (myColor === "w" ? idx % 2 === 0 : idx % 2 === 1))
    .slice(-6);
  const queenMovesCount = recentMyMoves.filter((m) => m.startsWith("Q")).length;

  let strategicGuidance = "";
  if (ply < 24 && queenMovesCount >= 2) {
    strategicGuidance = "CRITICAL LESSON: Queen has already moved repeatedly. Do NOT shuffle Queen again. Develop minor pieces (Knights/Bishops) or activate Rooks!";
  } else if (ply < 16) {
    strategicGuidance = "Opening Principle: Control center (e4/d4/e5/d5), develop Knights and Bishops actively, and castle King to safety.";
  } else {
    strategicGuidance = "Middlegame Strategy: Coordinate Rooks on open files, create pawn breaks, and watch out for opponent Knight infiltrations.";
  }

  const tacticalSituation = chess.isCheck()
    ? "ALERT: King is in CHECK! Must safely block, capture the checker, or move the king."
    : threatenedPieces.length > 0
    ? `TACTICAL ALERT: ${threatenedPieces.length} piece(s) under direct attack: ${threatenedPieces.join(", ")}. Defend or rescue safely!`
    : capturableOpponents.length > 0
    ? `OPPORTUNITY: Opponent has vulnerable piece(s) to capture: ${capturableOpponents.join(", ")}.`
    : "Position is calm. Proceed with sound development and king safety.";

  // 3. Build semantic descriptions with Static Exchange Evaluation & Fly Brain tags
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

    if (move.isCheckmate) {
      desc += "[BEST] DELIVERS CHECKMATE and wins the game!";
    } else if (move.isCapture) {
      const capName = raw?.captured ? (PIECE_NAMES[raw.captured] ?? raw.captured) : "piece";
      const capVal = raw?.captured ? (PIECE_VALUES[raw.captured] ?? 1) : 1;

      if (destAttacked && pVal > capVal) {
        desc += `[FATAL BLUNDER] Sacrifices ${pName} for lower-value ${capName} on ${move.to} (DO NOT PLAY)`;
      } else if (!destAttacked) {
        desc += `[WINNING] Cleanly captures undefended opponent ${capName} on ${move.to}`;
      } else {
        desc += `Equal capture: ${pName} trades for opponent ${capName} on ${move.to}`;
      }
      if (move.isPromotion) desc += " and promotes to Queen";
    } else if (move.isCastle) {
      desc += "[BEST STRATEGY] Castles king to safe corner and connects rooks";
    } else if (raw && raw.piece === "q" && ply < 24 && queenMovesCount >= 2 && !destAttacked) {
      desc += `[TEMPO LOSS] Moves Queen again to ${move.to} while other pieces need development (AVOID)`;
    } else if (raw && destAttacked) {
      desc += `[DANGER] Moves ${pName} to ${move.to} which is under enemy attack!`;
    } else if (raw && chess.isAttacked(raw.from, oppColor)) {
      desc += `[RESCUE] Safely rescues threatened ${pName} from ${raw.from} to safe square ${move.to}`;
    } else if (move.isCheck) {
      desc += `[ACTIVE] ${pName} attacks opponent King with CHECK`;
    } else if (isFlyTop) {
      desc += `[FLY BRAIN RECOMMENDED] Biological connectome prioritizes this development move to ${move.to}`;
    } else if (raw && (raw.piece === "n" || raw.piece === "b" || raw.piece === "r")) {
      desc += `[DEVELOPMENT] Develops and activates ${pName} to ${move.to}`;
    } else {
      desc += `Moves ${pName} to ${move.to}`;
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
        fly_brain_top_moves: flyTop3.map((m) => `${m.san} (${(m.prob * 100).toFixed(0)}%)`),
        strategic_guidance: strategicGuidance,
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
  /** Seed to break ties — different value = different move */
  seed?: number;
  /** Recent move history to prevent repetitive blunders & tempo waste */
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

  // 4. Neuro-Symbolic Blend: Jev (Semantic) + FlyBrain (Biological Connectome)
  const flyMap: Record<string, number> = {};
  for (const fm of built.flyMoves) {
    flyMap[fm.uci] = fm.prob;
  }

  const blendedProbs: Record<string, number> = {};
  for (const uci of built.legalUcis) {
    const pJev = resolved.probabilities[uci] ?? 0;
    const pFly = flyMap[uci] ?? 0;
    // 50% Jev Semantic Reasoning + 50% Fly Connectome Biological Instinct
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
      "TypeSafe rate-limited this request (429). Wait a moment and retry. No move was invented.",
      429,
      true,
    );
  }
  if (status === 529) {
    return new JevRequestError(
      "TypeSafe is overloaded (529). Retry shortly. No move was invented.",
      529,
      true,
    );
  }
  if (status === 422) {
    return new JevRequestError(
      "TypeSafe rejected the request as invalid (422). No move was applied.",
      422,
      true,
    );
  }
  return new JevRequestError(
    `TypeSafe request failed (${status}). No move was invented.`,
    status >= 400 && status < 600 ? status : 502,
    true,
  );
}
