import { Chess, validateFen, type Move, type Square } from "chess.js";

export type Side = "white" | "black";
export type PromotionPiece = "q" | "r" | "b" | "n";

export type LegalMove = {
  uci: string;
  san: string;
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
  isCapture: boolean;
  isPromotion: boolean;
  isCastle: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
};

export type GameOutcome = {
  over: boolean;
  label: string;
  winner: Side | null;
  kind:
    | "playing"
    | "check"
    | "checkmate"
    | "stalemate"
    | "insufficient"
    | "threefold"
    | "fifty"
    | "draw" | "resigned" | "timeout";
};

/** Choice questions accept at most 255 options (TypeSafe docs). */
export const CHOICE_OPTION_CAP = 255;

export function parseFen(fen: string): Chess {
  const result = validateFen(fen);
  if (!result.ok) {
    throw new Error(result.error ?? "Invalid FEN.");
  }
  return new Chess(fen);
}

export function sideToMove(chess: Chess): Side {
  return chess.turn() === "w" ? "white" : "black";
}

export function uciFromMove(move: Move): string {
  return move.lan;
}

export function getLegalMoves(chess: Chess): LegalMove[] {
  return chess.moves({ verbose: true }).map((move) => ({
    uci: uciFromMove(move),
    san: move.san,
    from: move.from,
    to: move.to,
    promotion: move.promotion as PromotionPiece | undefined,
    isCapture: move.isCapture(),
    isPromotion: move.isPromotion(),
    isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
    isCheck: move.san.includes("+") || move.san.includes("#"),
    isCheckmate: move.san.includes("#"),
  }));
}

export function movePriority(move: LegalMove): number {
  if (move.isCheckmate) return 1000;
  if (move.isPromotion) return 80 + (move.promotion === "q" ? 10 : 0);
  if (move.isCheck) return 70;
  if (move.isCapture) return 60;
  if (move.isCastle) return 50;
  return 10;
}

/**
 * Keep every legal move unless we exceed Choice's 255-option cap.
 * Real chess never reaches 218 legal moves, so this is last-resort only.
 */
export function selectMovesForChoice(moves: LegalMove[]): {
  selected: LegalMove[];
  dropped: LegalMove[];
} {
  if (moves.length <= CHOICE_OPTION_CAP) {
    return { selected: moves, dropped: [] };
  }
  const ranked = [...moves].sort((a, b) => {
    const delta = movePriority(b) - movePriority(a);
    return delta !== 0 ? delta : a.uci.localeCompare(b.uci);
  });
  return {
    selected: ranked.slice(0, CHOICE_OPTION_CAP),
    dropped: ranked.slice(CHOICE_OPTION_CAP),
  };
}

export function applyUci(chess: Chess, uci: string): Move {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new Error(`Not a UCI move: ${uci}`);
  }
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  return chess.move({ from, to, promotion });
}

export function isPromotionAttempt(
  chess: Chess,
  from: string,
  to: string,
): boolean {
  return getLegalMoves(chess).some(
    (move) => move.from === from && move.to === to && move.isPromotion,
  );
}

export function findLegalMove(
  chess: Chess,
  from: string,
  to: string,
  promotion?: PromotionPiece,
): LegalMove | undefined {
  return getLegalMoves(chess).find((move) => {
    if (move.from !== from || move.to !== to) return false;
    if (move.isPromotion) return move.promotion === (promotion ?? "q");
    return true;
  });
}

export function describeOutcome(chess: Chess): GameOutcome {
  if (chess.isCheckmate()) {
    const winner: Side = chess.turn() === "w" ? "black" : "white";
    return {
      over: true,
      winner,
      kind: "checkmate",
      label: `Checkmate — ${capitalize(winner)} wins`,
    };
  }
  if (chess.isStalemate()) {
    return {
      over: true,
      winner: null,
      kind: "stalemate",
      label: "Draw by stalemate",
    };
  }
  if (chess.isThreefoldRepetition()) {
    return {
      over: true,
      winner: null,
      kind: "threefold",
      label: "Draw by threefold repetition",
    };
  }
  if (chess.isInsufficientMaterial()) {
    return {
      over: true,
      winner: null,
      kind: "insufficient",
      label: "Draw by insufficient material",
    };
  }
  if (chess.isDrawByFiftyMoves()) {
    return {
      over: true,
      winner: null,
      kind: "fifty",
      label: "Draw by the fifty-move rule",
    };
  }
  if (chess.isDraw()) {
    return {
      over: true,
      winner: null,
      kind: "draw",
      label: "Draw",
    };
  }
  if (chess.isCheck()) {
    return {
      over: false,
      winner: null,
      kind: "check",
      label: `${capitalize(sideToMove(chess))} is in check`,
    };
  }
  return {
    over: false,
    winner: null,
    kind: "playing",
    label: `${capitalize(sideToMove(chess))} to move`,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
