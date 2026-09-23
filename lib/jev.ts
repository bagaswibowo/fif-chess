import { Chess } from "chess.js";
import {
  applyUci,
  describeOutcome,
  getLegalMoves,
  parseFen,
  selectMovesForChoice,
  sideToMove,
  type Side,
  type GameOutcome,
} from "@/lib/chess";

export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
export const MOVE_QUESTION_ID = "move";

export const MOVE_INSTRUCTIONS =
  "Select the single best legal chess move for the side to move. " +
  "Priority order: (1) deliver checkmate if available; (2) escape check — king safety is paramount, NEVER move the king into danger or sacrifice it for any piece; " +
  "(3) capture the highest-value undefended opponent piece; (4) execute the listed tactical motif (checkmate > check > fork > skewer > removal-of-defender > discovered-attack > capture); " +
  "(5) avoid moving to squares attacked by opponent pawns or pieces; " +
  "(6) castle to improve king safety when available. " +
  "Each option includes SAN, flags (capture/promotion/motif), and material delta Δ (positive = you gain material). " +
  "Never trade your king for any piece. Prefer Δ>0 captures. Avoid moves that leave your king exposed.";

export type JevState = {
  fen: string;
  side_to_move: "white" | "black";
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

export function buildJevRequest(fen: string): BuiltJevRequest {
  const chess = parseFen(fen);
  if (chess.isGameOver()) {
    throw new Error("The game is already over; there is no move to pick.");
  }

  const { selected, dropped } = selectMovesForChoice(getLegalMoves(chess));
  const criteria: Record<string, string> = {};
  // Enrich each option with tactical motif, capture/promotion flags, and material delta.
  for (const move of selected) {
    // Clone board and apply the move to assess material impact.
    const after = new Chess(chess.fen());
    after.move({ from: move.from, to: move.to, promotion: move.promotion as any });
    const materialDelta = computeMaterialDelta(chess, after, sideToMove(chess));
    const notes: string[] = [];
    if (move.isCapture) notes.push('capture');
    if (move.isPromotion) notes.push(`prom=${move.promotion}`);
    if (move.motif && move.motif !== 'none') notes.push(`motif=${move.motif}`);
    notes.push(`Δ${materialDelta}`);
    criteria[move.uci] = `${move.san} (${notes.join(', ')})`;
  }

  // Simple material evaluation: sum of piece values for a side.
  function computeMaterialDelta(before: Chess, after: Chess, side: Side): number {
    const colorChar = side === "white" ? "w" : "b";
    const score = (c: Chess) => {
      const board = c.board();
      const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      let total = 0;
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = board[r]?.[f];
          if (p && p.color === colorChar) {
            total += values[p.type] ?? 0;
          }
        }
      }
      return total;
    };
    return score(after) - score(before);
  }

  return {
    request: {
      state: {
        fen: chess.fen(),
        side_to_move: sideToMove(chess),
      },
      model: JEV_MODEL,
      questions: {
        move: {
          type: "choice",
          instructions: MOVE_INSTRUCTIONS,
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
};

export async function playJevMove(
  fen: string,
  { apiKey, fetchImpl = fetch }: PlayDeps,
): Promise<JevPlaySuccess> {
  const built = buildJevRequest(fen);
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
