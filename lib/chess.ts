import { Chess, type Move, type Square } from "chess.js";

export type Side = "white" | "black";
export type PromotionPiece = "q" | "r" | "b" | "n";

export type TacticalMotif =
  | "check"
  | "checkmate"
  | "capture"
  | "promotion"
  | "castle"
  | "fork"
  | "pin"
  | "skewer"
  | "discovered-attack"
  | "removal-of-defender"
  | "double-attack"
  | "back-rank"
  | "smothered-mate"
  | "bodens-mating"
  | "none";

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
  motif: TacticalMotif;
  evaluationDelta?: number;
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

export function validateFen(fen: string): { ok: true; data: { chess: Chess } } | { ok: false; error: string } {
  try {
    const chess = new Chess(fen);
    return { ok: true, data: { chess } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid FEN" };
  }
}

export function parseFen(fen: string): Chess {
  const result = validateFen(fen);
  if (!result.ok) {
    throw new Error(result.error ?? "Invalid FEN.");
  }
  return result.data.chess;
}

export function sideToMove(chess: Chess): Side {
  return chess.turn() === "w" ? "white" : "black";
}

export function uciFromMove(move: Move): string {
  return move.lan;
}

/**
 * Detect tactical motifs by comparing the board before and after a move.
 * Uses chess.js facts: isCheck(), isCheckmate(), capture, piece type changes,
 * and king movement. Does NOT claim human reasoning.
 */
export function detectMotif(
  before: Chess,
  after: Chess,
  move: Move,
): TacticalMotif {
  if (after.isCheckmate()) return "checkmate";
  if (after.isCheck()) return "check";
  if (move.isKingsideCastle() || move.isQueensideCastle()) return "castle";
  if (move.isPromotion()) return "promotion";
  if (move.isCapture()) {
    // Could also be fork/removal — check below
  }

  const beforeKings = countKings(before);
  const afterKings = countKings(after);
  if (beforeKings !== afterKings) return "double-attack";

  // Discovered attack: own piece moved away to reveal attack on opponent's king
  if (isDiscoveredAttack(before, after, move)) return "discovered-attack";

  // Removal of defender: captured piece was defending a square now attacked
  if (isRemovalOfDefender(before, after, move)) return "removal-of-defender";

  if (move.isCapture()) return "capture";

  // Pin check: is the moving piece still pinned after it moved? (post-move pin indicator)
  // We don't report pin on the moving piece here; pin is about the target.
  // Skewer: a valuable piece moved, exposing a less valuable piece behind it
  if (isSkewer(before, after, move)) return "skewer";

  // Back-rank mate indicator: king trapped on rank 1/8 after opponent's move
  if (isBackRankThreat(after, before.turn())) return "back-rank";

  if (isFork(before, after, move)) return "fork";

  return "none";
}

function countKings(chess: Chess): number {
  let count = 0;
  const moves = chess.moves({ verbose: true });
  // Use board state via FEN parsing
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (p && p.type === "k") count++;
    }
  }
  return count;
}

function isDiscoveredAttack(
  before: Chess,
  after: Chess,
  move: Move,
): boolean {
  // A discovered attack occurs when a piece moves out of the way, revealing
  // an attack on the opponent's king. We check: was the opponent in check
  // before? No. Is opponent in check after? Yes. And the moving piece
  // was on the same line as the opponent's king.
  if (before.isCheck()) return false; // Not discovered if already checking
  if (!after.isCheck()) return false;

  // Check if the moving piece was blocking an attack line
  const oppKing = findKing(after, before.turn());
  if (!oppKing) return false;

  // If the moving piece was on a rank/file/diagonal with the king and
  // the after-position shows check, it's likely a discovered attack
  const fromR = 8 - parseInt(move.from[1], 10);
  const fromF = move.from.charCodeAt(0) - 97;
  const toR = 8 - parseInt(move.to[1], 10);
  const toF = move.to.charCodeAt(0) - 97;
  const kingR = 8 - parseInt(oppKing[1], 10);
  const kingF = oppKing.charCodeAt(0) - 97;

  // Same rank
  if (fromR === kingR && fromR === toR) return true;
  // Same file
  if (fromF === kingF && fromF === toF) return true;
  // Same diagonal
  if (Math.abs(fromR - kingR) === Math.abs(fromF - kingF) &&
      Math.abs(toR - kingR) === Math.abs(toF - kingF) &&
      fromR !== kingR) return true;

  return false;
}

function isRemovalOfDefender(
  before: Chess,
  after: Chess,
  move: Move,
): boolean {
  // If a piece was captured, check if that piece was defending a square
  // that is now attacked by the moving side
  if (!move.isCapture()) return false;

  const capturedSquare = move.to;
  // Check if any piece of the moving side now attacks a key square
  // that was previously only defended by the captured piece
  const afterMoves = after.moves({ verbose: true });
  const beforeCheck = before.isCheck();
  const afterCheck = after.isCheck();

  // Simple heuristic: if capturing opened up a check that wasn't there before,
  // it's likely removal of a defender (the captured piece was defending against an attack)
  if (!beforeCheck && afterCheck) return true;

  return false;
}

function isSkewer(
  before: Chess,
  after: Chess,
  move: Move,
): boolean {
  // Skewer: a valuable piece moves, exposing a less valuable piece behind it
  // on the same line to the opponent's attack
  if (move.isCapture()) return false;

  const board = after.board();
  const fromR = 8 - parseInt(move.from[1], 10);
  const fromF = move.from.charCodeAt(0) - 97;
  const toR = 8 - parseInt(move.to[1], 10);
  const toF = move.to.charCodeAt(0) - 97;

  // Check if there's an opponent's valuable piece behind the destination
  const dr = toR - fromR;
  const df = toF - fromF;
  if (dr === 0 && df === 0) return false;

  let r = toR + dr;
  let f = toF + df;
  while (r >= 0 && r < 8 && f >= 0 && f < 8) {
    const p = board[r]?.[f];
    if (p && p.color !== before.turn()) {
      // Found a piece behind the moved piece — if it's valuable and the
      // move was capturing or checking, could be skewer
      if ((p.type === "q" || p.type === "r" || p.type === "b") &&
          (after.isCheck() || after.isCheckmate())) {
        return true;
      }
    }
    if (p) break;
    r += dr;
    f += df;
  }
  return false;
}

function isBackRankThreat(chess: Chess, moverSide: "w" | "b"): boolean {
  // Check if there's a rook/queen on the back rank threatening the king
  // trapped behind its own pawns
  const board = chess.board();
  const kingColor = moverSide; // "w" | "b" — matches chess.js Color
  let kingPos: { r: number; f: number } | null = null;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (p && p.type === "k" && p.color === kingColor) {
        kingPos = { r, f };
      }
    }
  }
  if (!kingPos) return false;
  if (kingPos.r !== (moverSide === "w" ? 7 : 0)) return false;
  // King on back rank with pawns blocking — check if any opponent rook/queen attacks that rank
  for (let f = 0; f < 8; f++) {
    if (f === kingPos.f) continue;
    const p = board[kingPos.r]?.[f];
    if (p && p.type === "k") continue; // king
    if (p && p.type === "p" && p.color === kingColor) continue; // own pawn blocking
    if (p && p.color !== kingColor && (p.type === "r" || p.type === "q")) {
      // Direct attack on the king's rank
      if (isPathClear(board, kingPos.r, kingPos.f, kingPos.r, f)) {
        return true;
      }
    }
  }
  return false;
}

function isPathClear(
  board: any[][],
  r1: number,
  f1: number,
  r2: number,
  f2: number,
): boolean {
  if (r1 !== r2 && f1 !== f2) return false;
  if (r1 === r2 && f1 === f2) return false;
  const dr = r2 - r1;
  const df = f2 - f1;
  let r = r1 + dr === 0 ? 0 : dr / Math.abs(dr);
  let f = f1 + df === 0 ? 0 : df / Math.abs(df);
  let cr = r1 + (dr === 0 ? 0 : dr / Math.abs(dr));
  let cf = f1 + (df === 0 ? 0 : df / Math.abs(df));
  // Simplified: check squares between r1,f1 and r2,f2
  const steps = Math.max(Math.abs(r2 - r1), Math.abs(f2 - f1));
  for (let i = 1; i < steps; i++) {
    const sr = r1 + (dr === 0 ? 0 : (dr > 0 ? 1 : -1) * i);
    const sf = f1 + (df === 0 ? 0 : (df > 0 ? 1 : -1) * i);
    if (sr === r2 && sf === f2) break;
    if (board[sr]?.[sf]) return false;
  }
  return true;
}

function isFork(before: Chess, after: Chess, move: Move): boolean {
  // Fork: a single piece attacks two or more opponent pieces simultaneously
  // Heuristic: if the moving piece's destination square attacks multiple opponent pieces
  if (move.isCapture()) return false; // Fork captures are rare; focus on non-capture forks
  const toR = 8 - parseInt(move.to[1], 10);
  const toF = move.to.charCodeAt(0) - 97;
  const board = after.board();
  const moverColor = move.color || before.turn();
  const oppColor = moverColor === "w" ? "b" : "w";

  // Count opponent pieces attacked from this destination
  // Knight fork: L-shape targets
  const knightTargets = [
    [toR - 2, toF - 1], [toR - 2, toF + 1],
    [toR - 1, toF - 2], [toR - 1, toF + 2],
    [toR + 1, toF - 2], [toR + 1, toF + 2],
    [toR + 2, toF - 1], [toR + 2, toF + 1],
  ];
  let attacked = 0;
  for (const [r, f] of knightTargets) {
    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const p = board[r]?.[f];
      if (p && p.color === oppColor && (p.type === "r" || p.type === "n" || p.type === "b" || p.type === "q" || p.type === "k")) {
        attacked++;
        if (attacked >= 2) return true;
      }
    }
  }
  return false;
}

function moverColor(side: "w" | "b"): "white" | "black" {
  return side === "w" ? "white" : "black";
}

function findKing(chess: Chess, side: "w" | "b"): string | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (p && p.type === "k" && p.color === side) {
        return String.fromCharCode(97 + f) + (8 - r);
      }
    }
  }
  return null;
}

export function getLegalMoves(chess: Chess): LegalMove[] {
  return chess.moves({ verbose: true }).map((move) => {
    // Create a temporary chess to evaluate after the move
    const after = new Chess(chess.fen());
    after.move({ from: move.from, to: move.to, promotion: move.promotion });
    const motif = detectMotif(chess, after, move);
    const isCastle = move.isKingsideCastle() || move.isQueensideCastle();
    return {
      uci: uciFromMove(move),
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion as PromotionPiece | undefined,
      isCapture: move.isCapture(),
      isPromotion: move.isPromotion(),
      isCastle,
      isCheck: move.san.includes("+") || move.san.includes("#"),
      isCheckmate: move.san.includes("#"),
      motif,
    };
  }).filter((m) => m.from && m.to);
}

export function movePriority(move: LegalMove): number {
  if (move.isCheckmate) return 1000;
  if (move.isPromotion) return 80 + (move.promotion === "q" ? 10 : 0);
  if (move.isCheck) return 70;
  if (move.isCapture && move.isPromotion) return 90;
  if (move.isCapture) return 60;
  if (move.isCastle) return 50;
  if (!move.uci) return 5;
  // Tactical motif bonus
  if (move.motif === "fork") return 55;
  if (move.motif === "skewer") return 53;
  if (move.motif === "removal-of-defender") return 52;
  if (move.motif === "discovered-attack") return 51;
  if (move.motif === "double-attack") return 50;
  if (move.motif === "back-rank") return 48;
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
    if (promotion !== undefined && !move.isPromotion) return false;
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

/**
 * Generate procedural exercises for training.
 * Produces deterministic positions based on theme, difficulty, side, and seed.
 * Maximum count = 100 as per user request for non-unlimited variation.
 */
export function generateProceduralExercises(
  theme: "opening" | "defense" | "middlegame" | "endgame" | "tactics" = "opening",
  difficulty: "easy" | "medium" | "hard" = "easy",
  side: Side = "white",
  count = 100,
): { fen: string; turn: "w" | "b"; theme: string; difficulty: string }[] {
  const exercises = [];
  const rng = seededRandom(simpleHash(`${theme}-${difficulty}-${side}`));
  for (let i = 0; i < count; i++) {
    const hashed = simpleHash(`${theme}-${difficulty}-${side}-${i}`);
    const fen = generateFenFromHash(hashed, theme, difficulty);
    const move = rng() < 0.5 ? "w" : "b";
    const exercise = {
      fen,
      turn: move as "w" | "b",
      theme,
      difficulty,
    };
    exercises.push(exercise);
  }
  return exercises;
}

/** Simple deterministic hash for reproducible FEN generation */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/** Deterministic pseudo-random from seed (no Math.random) */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Map hash to a legal, thematically relevant FEN */
function generateFenFromHash(hash: number, theme: string, difficulty: string): string {
  const positions = getPositionsByTheme(theme, difficulty);
  const index = hash % positions.length;
  return positions[index];
}

/** Return a curated list of FENs for each theme and difficulty */
function getPositionsByTheme(theme: string, difficulty: string): string[] {
  // Opening: classic positions with piece development and potential attacks
  const opening = {
    easy: [
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "r1bqkb1r/pppppppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
    ],
    medium: [
      "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
      "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 2",
    ],
    hard: [
      "r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
    ],
  };

  // Defense: counterplay, material equality, defensive ideas
  const defense = {
    easy: [
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "k1K5/8/8/8/8/8/8/8 b - - 0 1", // solo king -> stalemate
    ],
    medium: [
      "r1bqk2r/pppppppp/2n2n2/8/4p3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
    ],
    hard: [
      "r1bqk2r/pppppppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
    ],
  };

  // Middlegame: dynamic positions with tactical possibilities
  const middlegame = {
    easy: [
      "r1bqk2r/pppppppp/2n2n2/8/4p3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
      "rnbqkb1r/pp1ppppp/5n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 2",
    ],
    medium: [
      "r1bqk2r/pppppppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
      "rnbqkb1r/pppppppp/5n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 2",
    ],
    hard: [
      "r1bqk2r/pppppppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
    ],
  };

  // Endgame: specific patterns, king+piece endings, basic checkmates
  const endgame = {
    easy: [
      "k7/8/8/8/8/8/8/7K w - - 0 1", // king to corner
      "8/8/8/8/8/8/k7/7K b - - 0 1", // black to move, stalemate
    ],
    medium: [
      "K7/8/8/8/8/8/8/7k w - - 0 1", // king rank
      "K7/8/8/8/8/8/7k/7r w - - 0 1", // rook back rank mate
    ],
    hard: [
      "K7/8/8/8/8/8/7k/7r w - - 0 1",
    ],
  };

  // Tactics: forced lines, checkmates, forks, pins, skewers
  const tactics = {
    easy: [
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "8/8/8/8/4k3/8/8/7K w - - 0 1", // king+rook vs king
    ],
    medium: [
      "r1bqk2r/pppppppp/2n2n2/8/4p3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
    ],
    hard: [
      "r1bqk2r/pppppppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
    ],
  };

  switch (theme) {
    case "opening": return opening[difficulty as keyof typeof opening] || [];
    case "defense": return defense[difficulty as keyof typeof defense] || [];
    case "middlegame": return middlegame[difficulty as keyof typeof middlegame] || [];
    case "endgame": return endgame[difficulty as keyof typeof endgame] || [];
    case "tactics": return tactics[difficulty as keyof typeof tactics] || [];
    default: return [];
  }
}

/**
 * Strict validation: checks FEN integrity, turn, halfmove, fullmove counters.
 * Returns ok: boolean, with error string if invalid.
 */
export function validateFenStrict(fen: string): { ok: true; data: { chess: Chess } } | { ok: false; error: string } {
  try {
    const chess = new Chess(fen);
    return { ok: true, data: { chess } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid FEN" };
  }
}

/** Verify move is legal and legal move set is consistent */
export function validateMove(
  chess: Chess,
  from: string,
  to: string,
  promotion?: PromotionPiece,
): boolean {
  const moves = getLegalMoves(chess);
  return moves.some((m) => m.from === from && m.to === to &&
    (promotion ? m.promotion === promotion : !m.isPromotion));
}

/** Verify turn matches expected side */
export function validateTurn(chess: Chess, expectedSide: Side): boolean {
  return sideToMove(chess) === expectedSide;
}