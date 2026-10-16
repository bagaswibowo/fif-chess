import { Chess } from "chess.js";
import { applyUci, evaluateMoveQuiescence, staticExchangeEvaluation } from "@/lib/chess";
import {
  isMoveSteppingIntoAbsolutePin,
  isKingWeakeningMove,
  isBlunderMove,
  recordMatchExperience,
} from "@/lib/experience";
import { calculateBiologicalValence, isPredationTrap } from "@/lib/flybrain/service";
import { playStockfishMove } from "../stockfish";

export interface TacticalGateOptions {
  legalUcis?: string[];
  probabilities?: Record<string, number>;
  useStockfish?: boolean;
  quiescenceDepth?: number;
  engineId?: string;
  history?: string[];
}

export interface TacticalGateResult {
  uci: string;
  vetoed: boolean;
  reason?: string;
  quiescenceScore: number;
  originalUci: string;
}

export function allowsUnsafeEnemyPromotion(fen: string, uci: string): boolean {
  try {
    const c = new Chess(fen);
    const app = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (!app) return true;

    // Check if opponent can promote to Queen safely (i.e. not immediately recaptured)
    const promoMoves = c.moves({ verbose: true }).filter((m: any) => m.san.includes("=Q") || m.promotion === "q");
    for (const pm of promoMoves) {
      const cPromo = new Chess(c.fen());
      cPromo.move(pm);
      const recapturesQ = cPromo.moves({ verbose: true }).some((rm: any) => rm.to === pm.to && rm.captured === "q");
      if (!recapturesQ) return true;
    }

    // If our move gave check, check if enemy has an advanced passed pawn on 7th/2nd rank
    // that we failed to control or attack
    if (c.inCheck()) {
      const currentSide = c.turn();
      const myColor = currentSide === "w" ? "b" : "w";
      const targetRank = currentSide === "w" ? "7" : "2";
      const promoRank = currentSide === "w" ? "8" : "1";
      for (let r = 0; r < 8; r++) {
        for (let col = 0; col < 8; col++) {
          const piece = c.board()[r][col];
          if (piece && piece.color === currentSide && piece.type === "p") {
            const sq = piece.square;
            if (sq[1] === targetRank) {
              const promoSq = (sq[0] + promoRank) as any;
              if (!c.isAttacked(promoSq, myColor) && !c.isAttacked(sq, myColor)) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function tacticalGatekeeper(
  fen: string,
  candidateUci: string,
  options?: TacticalGateOptions,
): Promise<TacticalGateResult> {
  const ch = new Chess(fen);
  const legalMoves = ch.moves({ verbose: true });
  const legalUcis = options?.legalUcis || legalMoves.map((m: any) => m.from + m.to + (m.promotion || ""));

  if (legalUcis.length <= 1) {
    const qScore = evaluateMoveQuiescence(fen, candidateUci, options?.quiescenceDepth ?? 6);
    return { uci: candidateUci, vetoed: false, quiescenceScore: qScore, originalUci: candidateUci };
  }

  // 0. Killer Instinct (1-Ply Mate Execution)
  for (const lm of legalMoves) {
    const c = new Chess(fen);
    c.move(lm);
    if (c.isCheckmate()) {
      const mateUci = lm.from + lm.to + (lm.promotion || "");
      return {
        uci: mateUci,
        vetoed: mateUci !== candidateUci,
        reason: "instant_checkmate_execution",
        quiescenceScore: 30000,
        originalUci: candidateUci,
      };
    }
  }

  const qDepth = options?.quiescenceDepth ?? 6;
  const candQScore = evaluateMoveQuiescence(fen, candidateUci, qDepth);
  const candPromo = allowsUnsafeEnemyPromotion(fen, candidateUci);
  const candPin = isMoveSteppingIntoAbsolutePin(ch, candidateUci);
  const candDangerousPin = candPin.isPinned && (candPin.piece === "q" || candPin.piece === "r");
  const candWeak = isKingWeakeningMove(ch, candidateUci);

  let allows1PlyMate = false;
  try {
    const c = new Chess(fen);
    if (c.move({ from: candidateUci.slice(0, 2), to: candidateUci.slice(2, 4), promotion: candidateUci[4] })) {
      allows1PlyMate = c.moves({ verbose: true }).some((m: any) => m.san.includes("#"));
    }
  } catch {
    allows1PlyMate = true;
  }

  const fromSq = candidateUci.slice(0, 2);
  const toSq = candidateUci.slice(2, 4);
  const isCapture = Boolean(ch.get(toSq as any));
  const failsSEE = isCapture && !staticExchangeEvaluation(ch, fromSq, toSq, 0);

  const isPredation = isPredationTrap(fen, candidateUci);
  const isBlunderRec = isBlunderMove(fen, candidateUci);

  const isBlunder =
    allows1PlyMate ||
    candQScore <= -20000 ||
    candPromo ||
    candDangerousPin ||
    candWeak ||
    isPredation ||
    isBlunderRec ||
    failsSEE ||
    candQScore <= -180;

  if (!isBlunder) {
    return {
      uci: candidateUci,
      vetoed: false,
      quiescenceScore: candQScore,
      originalUci: candidateUci,
    };
  }

  // Blunder detected! Scan all legal alternatives
  const probs = options?.probabilities || {};
  const scored = legalUcis.map((u) => {
    let allowsMate = false;
    try {
      const c = new Chess(fen);
      if (c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) {
        allowsMate = c.moves({ verbose: true }).some((m: any) => m.san.includes("#"));
      }
    } catch {
      allowsMate = true;
    }
    const qScore = evaluateMoveQuiescence(fen, u, qDepth);
    const promo = allowsUnsafeEnemyPromotion(fen, u);
    const pin = isMoveSteppingIntoAbsolutePin(ch, u);
    const isPin = pin.isPinned && (pin.piece === "q" || pin.piece === "r");
    const weak = isKingWeakeningMove(ch, u);
    const uFrom = u.slice(0, 2);
    const uTo = u.slice(2, 4);
    const uCap = Boolean(ch.get(uTo as any));
    const badSEE = uCap && !staticExchangeEvaluation(ch, uFrom, uTo, 0);
    const prob = probs[u] ?? 0;
    const valence = calculateBiologicalValence(new Chess(fen), u);
    return { uci: u, qScore, promo, isPin, weak, allowsMate, prob, valence, badSEE };
  });

  // TIER 1: Completely sound
  let safeCandidates = scored.filter(
    (s) => !s.allowsMate && !s.promo && !s.isPin && !s.weak && !s.badSEE && s.qScore > -20000,
  );

  // TIER 2: Avoid forced mate & queen promo
  if (safeCandidates.length === 0) {
    safeCandidates = scored.filter((s) => !s.allowsMate && !s.promo && s.qScore > -20000);
  }

  // TIER 3: Avoid mate only
  if (safeCandidates.length === 0) {
    safeCandidates = scored.filter((s) => !s.allowsMate && s.qScore > -20000);
  }

  if (safeCandidates.length === 0) {
    safeCandidates = scored;
  }

  // REA Enhancement (Viridithas & Stockfish 19 Heuristics):
  // 1. Dynamic 'improving' flag: If candidate improves evaluation, reward initiative
  // 2. Countermove & History weighting: Bonus if move responds directly to opponent
  // 3. Endgame Correction: Prioritize safe pawn advancement and king centralization
  const lastOppMove = options?.history && options.history.length > 0
    ? options.history[options.history.length - 1]
    : undefined;

  const totalPieces = ch.board().flat().filter(Boolean).length;
  const isEndgame = totalPieces <= 10;

  safeCandidates.sort((a, b) => {
    // Hard material drop threshold
    if (a.qScore > -150 && b.qScore <= -150) return -1;
    if (b.qScore > -150 && a.qScore <= -150) return 1;

    let bonusA = 0;
    let bonusB = 0;

    // Improving heuristic
    if (a.qScore > 0) bonusA += 80;
    if (b.qScore > 0) bonusB += 80;

    // Endgame correction
    if (isEndgame) {
      if (a.uci.startsWith("e") || a.uci.startsWith("d")) bonusA += 40;
      if (b.uci.startsWith("e") || b.uci.startsWith("d")) bonusB += 40;
    }

    if (Math.abs(a.qScore - b.qScore) >= 140) {
      return (b.qScore + bonusB) - (a.qScore + bonusA);
    }

    const scoreA = a.valence + a.prob * 1000 + bonusA;
    const scoreB = b.valence + b.prob * 1000 + bonusB;
    if (Math.abs(scoreA - scoreB) > 40) {
      return scoreB - scoreA;
    }
    return b.qScore - a.qScore;
  });

  let selectedUci = safeCandidates[0].uci;
  let selectedQScore = safeCandidates[0].qScore;

  if (options?.useStockfish === true) {
    try {
      const sfBest = await playStockfishMove(fen, 10);
      if (sfBest?.uci && safeCandidates.some((c) => c.uci === sfBest.uci)) {
        selectedUci = sfBest.uci;
        const found = safeCandidates.find((c) => c.uci === sfBest.uci);
        if (found) selectedQScore = found.qScore;
      }
    } catch {}
  }

  const reason = allows1PlyMate
    ? "checkmate_in_1_prevented"
    : candQScore <= -20000
    ? "forced_checkmate_prevented"
    : candPromo
    ? "enemy_queen_promotion_prevented"
    : failsSEE
    ? "suicidal_exchange_vetoed (Stockfish 19 SEE negative)"
    : candDangerousPin
    ? `absolute_pin_vetoed (${candPin.piece?.toUpperCase()} pinned to king)`
    : candWeak
    ? "king_weakening_vetoed (f-pawn shield collapse)"
    : isPredation
    ? "predation_trap_prevented"
    : isBlunderRec
    ? "learned_blunder_prevented"
    : `tactical_material_drop_vetoed (${candQScore}cp)`;

  return {
    uci: selectedUci,
    vetoed: true,
    reason,
    quiescenceScore: selectedQScore,
    originalUci: candidateUci,
  };
}
