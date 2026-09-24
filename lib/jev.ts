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

export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
export const MOVE_QUESTION_ID = "move";

export const MOVE_INSTRUCTIONS =
  "Select the best move for the side to move. Evaluate tactical dangers first: if pieces or King are threatened, defend them, capture the attacking piece, or counter-attack. Never play passive king or rook moves when valuable material is attacked. Seize tactical captures, give forcing checks, control the center, and deliver checkmate whenever possible.";

const PIECE_NAMES: Record<string, string> = {
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
  in_check: boolean;
  my_threatened_pieces: string[];
  capturable_opponents: string[];
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
};

export function buildJevRequest(fen: string, seed?: number): BuiltJevRequest {
  const chess = parseFen(fen);
  if (chess.isGameOver()) {
    throw new Error("The game is already over; there is no move to pick.");
  }

  const myColor = chess.turn();
  const oppColor = myColor === "w" ? "b" : "w";
  const board = chess.board();

  // 1. Identify threatened own pieces and capturable opponent pieces
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

  const tacticalSituation = chess.isCheck()
    ? "ALERT: King is in CHECK! Must safely block, capture the checker, or move the king."
    : threatenedPieces.length > 0
    ? `TACTICAL ALERT: ${threatenedPieces.length} piece(s) under direct attack: ${threatenedPieces.join(", ")}. Defend, rescue, or counter-attack immediately!`
    : capturableOpponents.length > 0
    ? `OPPORTUNITY: Opponent has vulnerable piece(s) to capture: ${capturableOpponents.join(", ")}.`
    : "Position is calm. Develop pieces, fight for center, or prepare attacking breakthrough.";

  // 2. Build semantic descriptions for all legal moves
  const { selected, dropped } = selectMovesForChoice(getLegalMoves(chess));
  const rawMoves = chess.moves({ verbose: true });
  const rawMoveMap = new Map(rawMoves.map((m) => [m.lan, m]));

  const criteria: Record<string, string> = {};
  for (const move of selected) {
    const raw = rawMoveMap.get(move.uci);
    let desc = `${move.san}: `;
    const pName = raw ? (PIECE_NAMES[raw.piece] ?? raw.piece) : "piece";

    if (move.isCheckmate) {
      desc += "DELIVERS CHECKMATE and wins the game!";
    } else if (move.isCapture) {
      const capName = raw?.captured ? (PIECE_NAMES[raw.captured] ?? raw.captured) : "piece";
      desc += `${pName} captures opponent ${capName} on ${move.to}`;
      if (move.isPromotion) desc += " and promotes to Queen";
    } else if (move.isCastle) {
      desc += "castles king to safety and connects rooks";
    } else if (raw && chess.isAttacked(raw.from, oppColor)) {
      desc += `rescues threatened ${pName} from ${raw.from} to ${move.to}`;
    } else if (move.isCheck) {
      desc += `${pName} attacks opponent King with CHECK`;
    } else {
      desc += `moves ${pName} to ${move.to}`;
    }

    criteria[move.uci] = desc;
  }

  return {
    request: {
      state: {
        fen: chess.fen(),
        side_to_move: sideToMove(chess),
        in_check: chess.isCheck(),
        my_threatened_pieces: threatenedPieces,
        capturable_opponents: capturableOpponents,
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
};

export async function playJevMove(
  fen: string,
  { apiKey, fetchImpl = fetch, seed }: PlayDeps,
): Promise<JevPlaySuccess> {
  const built = buildJevRequest(fen, seed);
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

  const chess = new Chess(fen);
  let applied;
  try {
    applied = applyUci(chess, resolved.uci);
  } catch {
    throw new JevRequestError(
      `Jev returned "${resolved.uci}", but chess.js rejected it as illegal. No move was applied.`,
      422,
      true,
    );
  }

  return {
    uci: resolved.uci,
    san: applied.san,
    fen: chess.fen(),
    probabilities: resolved.probabilities,
    confidence: resolved.confidence,
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
