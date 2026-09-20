import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  applyUci,
  CHOICE_OPTION_CAP,
  getLegalMoves,
  selectMovesForChoice,
  type LegalMove,
} from "@/lib/chess";
import {
  buildJevRequest,
  JEV_MODEL,
  MOVE_QUESTION_ID,
  playJevMove,
  resolveJevChoice,
  TYPESAFE_ENDPOINT,
} from "@/lib/jev";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PROMOTION_FEN = "8/P7/8/8/8/8/8/k1K5 w - - 0 1";
const CASTLE_FEN = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

function mockTypeSafe(
  inspect: (request: unknown) => void,
  answer: unknown,
  status = 200,
): typeof fetch {
  return async (input, init) => {
    expect(String(input)).toBe(TYPESAFE_ENDPOINT);
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toMatch(/^Bearer /);
    expect(headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(String(init?.body));
    inspect(body);
    return new Response(
      JSON.stringify({
        model: "jev-latest",
        answers: { move: answer },
      }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  };
}

describe("buildJevRequest", () => {
  it("sends FEN state and a Choice over legal UCI moves with SAN descriptions", () => {
    const chess = new Chess(START_FEN);
    const legal = getLegalMoves(chess);
    const { request, legalUcis, droppedUcis } = buildJevRequest(START_FEN);

    expect(droppedUcis).toEqual([]);
    expect(request.model).toBe(JEV_MODEL);
    expect(request.state).toEqual({
      fen: chess.fen(),
      side_to_move: "white",
    });
    expect(request.questions[MOVE_QUESTION_ID].type).toBe("choice");
    expect(request.questions.move.instructions).toMatch(/UCI/);

    const criteria = request.questions.move.criteria;
    expect(Object.keys(criteria).sort()).toEqual(
      legal.map((move) => move.uci).sort(),
    );
    expect(legalUcis.sort()).toEqual(legal.map((move) => move.uci).sort());

    for (const move of legal) {
      expect(criteria[move.uci]).toBe(move.san);
    }

    expect(criteria.e2e4).toBe("e4");
    expect(criteria.g1f3).toBe("Nf3");
  });

  it("labels promotion and castling options with UCI keys and SAN values", () => {
    const promo = buildJevRequest(PROMOTION_FEN);
    expect(promo.request.questions.move.criteria.a7a8q).toBe("a8=Q#");
    expect(promo.request.questions.move.criteria.a7a8n).toBe("a8=N");
    expect(promo.legalUcis).toContain("a7a8q");

    const castle = buildJevRequest(CASTLE_FEN);
    expect(castle.request.state.side_to_move).toBe("white");
    expect(castle.request.questions.move.criteria.e1g1).toBe("O-O");
    expect(castle.request.questions.move.criteria.e1c1).toBe("O-O-O");
  });
});

describe("resolveJevChoice", () => {
  const startLegal = new Set(getLegalMoves(new Chess(START_FEN)).map((m) => m.uci));

  it("accepts a choice that was in the legal set", () => {
    const resolved = resolveJevChoice(startLegal, {
      type: "choice",
      choice: "e2e4",
      probabilities: { e2e4: 0.7, d2d4: 0.3 },
      confidence: 0.55,
    });
    expect(resolved).toMatchObject({ ok: true, uci: "e2e4" });
  });

  it("rejects an unknown answer and never treats it as a move", () => {
    const resolved = resolveJevChoice(startLegal, {
      type: "choice",
      choice: "not-a-move",
      probabilities: { "not-a-move": 1 },
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toMatch(/not-a-move/);
      expect(resolved.error).toMatch(/not in the legal set/);
    }
  });

  it("rejects a chess-looking move that was not in the sent legal set", () => {
    const resolved = resolveJevChoice(startLegal, {
      type: "choice",
      choice: "e2e5",
    });
    expect(resolved.ok).toBe(false);
  });
});

describe("playJevMove with a mocked TypeSafe response", () => {
  it("proves the request shape and applies only a legal Choice", async () => {
    const before = new Chess(START_FEN).fen();
    let seen: unknown;

    const result = await playJevMove(START_FEN, {
      apiKey: "test-key",
      fetchImpl: mockTypeSafe((body) => {
        seen = body;
      }, {
        type: "choice",
        choice: "e2e4",
        probabilities: { e2e4: 0.61, d2d4: 0.22, g1f3: 0.17 },
        confidence: 0.4,
      }),
    });

    expect(seen).toMatchObject({
      model: "jev-latest",
      state: { fen: before, side_to_move: "white" },
      questions: {
        move: {
          type: "choice",
        },
      },
    });

    const criteria = (seen as { questions: { move: { criteria: Record<string, string> } } })
      .questions.move.criteria;
    expect(Object.keys(criteria)).toEqual(
      expect.arrayContaining(["e2e4", "d2d4", "g1f3"]),
    );
    expect(criteria.e2e4).toBe("e4");

    expect(result.uci).toBe("e2e4");
    expect(result.san).toBe("e4");
    expect(result.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    );
    expect(result.probabilities.e2e4).toBe(0.61);
  });

  it("rejects an illegal Choice and leaves the position unchanged", async () => {
    const before = new Chess(START_FEN).fen();

    await expect(
      playJevMove(START_FEN, {
        apiKey: "test-key",
        fetchImpl: mockTypeSafe(() => undefined, {
          type: "choice",
          choice: "e2e5",
          probabilities: { e2e5: 1 },
        }),
      }),
    ).rejects.toThrow(/e2e5/);

    expect(new Chess(START_FEN).fen()).toBe(before);
  });

  it("rejects an unknown Choice key and does not apply a move", async () => {
    const probe = new Chess(START_FEN);

    await expect(
      playJevMove(START_FEN, {
        apiKey: "test-key",
        fetchImpl: mockTypeSafe(() => undefined, {
          type: "choice",
          choice: "teleport",
        }),
      }),
    ).rejects.toThrow(/teleport/);

    expect(probe.history()).toEqual([]);
    expect(probe.fen()).toBe(START_FEN);
  });
});

describe("applyUci", () => {
  it("applies promotion and castling through chess.js, not Jev", () => {
    const promo = new Chess(PROMOTION_FEN);
    const promoted = applyUci(promo, "a7a8q");
    expect(promoted.san).toBe("a8=Q#");
    expect(promo.isCheckmate()).toBe(true);

    const castle = new Chess(CASTLE_FEN);
    const castled = applyUci(castle, "e1g1");
    expect(castled.san).toBe("O-O");
    expect(castle.fen()).toContain("K");
    expect(castle.get("g1")?.type).toBe("k");
    expect(castle.get("f1")?.type).toBe("r");
  });
});

describe("selectMovesForChoice", () => {
  it("drops the lowest-priority surplus only after the 255-option cap", () => {
    const surplus: LegalMove[] = Array.from({ length: 257 }, (_, i) => ({
      uci: `m${String(i).padStart(3, "0")}`,
      san: `M${i}`,
      from: "a1",
      to: "a2",
      isCapture: i === 0,
      isPromotion: i === 1,
      isCastle: false,
      isCheck: false,
      isCheckmate: i === 2,
    }));

    const { selected, dropped } = selectMovesForChoice(surplus);
    expect(selected).toHaveLength(CHOICE_OPTION_CAP);
    expect(dropped).toHaveLength(2);
    expect(selected.map((m) => m.uci)).toEqual(
      expect.arrayContaining(["m002", "m001", "m000"]),
    );
  });
});
