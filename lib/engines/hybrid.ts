import { Chess, type Square } from "chess.js";
import { applyUci, describeOutcome, isKnightFork, isQueenThreatened, isQueenXrayed } from "@/lib/chess";
import {
  buildJevRequest,
  resolveJevChoice,
  mapHttpError,
  JevRequestError,
  TYPESAFE_ENDPOINT,
  type JevPlaySuccess,
} from "@/lib/jev";
import { playSuperflyMove, playFlyBrainMove, isPredationTrap, calculateBiologicalValence } from "@/lib/flybrain/service";
import { evaluateConnectomeNetwork } from "@/lib/flybrain/connectome-network";
import {
  getLearnedMove,
  isBlunderMove,
  recordMatchExperience,
  reinforceMatchDopamine,
  extractPositionMotifs,
  recallMotifValence,
  isMoveSteppingIntoAbsolutePin,
  isKingWeakeningMove,
  isMoveSuicidalPieceLoss,
} from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
import { evalSingleMove, playStockfishMove } from "../stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";

export interface BoardPieceScan {
  square: Square;
  color: "white" | "black";
  piece: string;
  isDefended: boolean;
  isThreatened: boolean;
  distanceToPromotion?: number;
}

export function scanBoardMatrix(chess: Chess): {
  pieces: BoardPieceScan[];
  piecesDescription: string[];
} {
  const pieces: BoardPieceScan[] = [];
  const piecesDescription: string[] = [];
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const sq = piece.square;
      const color = piece.color === "w" ? "white" : "black";
      const pName = piece.type.toUpperCase();
      const isDef = chess.isAttacked(sq, piece.color);
      const oppColor = piece.color === "w" ? "b" : "w";
      const isThreat = chess.isAttacked(sq, oppColor);

      const scan: BoardPieceScan = {
        square: sq,
        color,
        piece: pName,
        isDefended: isDef,
        isThreatened: isThreat,
      };

      if (piece.type === "p") {
        const rank = parseInt(sq[1], 10);
        scan.distanceToPromotion = piece.color === "w" ? 8 - rank : rank - 1;
      }

      pieces.push(scan);
      piecesDescription.push(
        `${color} ${pName} at ${sq}${isThreat ? " (UNDER ATTACK)" : ""}${isDef ? " (defended)" : " (UNDEFENDED)"}`,
      );
    }
  }

  return { pieces, piecesDescription };
}

async function queryJevPriors(
  fen: string,
  seed: number | undefined,
  history: string[] | undefined,
  key: string,
): Promise<{ resolved: any; legalUcis: string[]; request: any } | null> {
  try {
    const built = buildJevRequest(fen, seed, history ?? []);
    const { piecesDescription } = scanBoardMatrix(new Chess(fen));
    (built.request.state as any).pieces_on_board = piecesDescription;

    const res = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(built.request),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const payload = await res.json();
    const resolved = resolveJevChoice(new Set(built.legalUcis), payload?.answers?.move);
    if (!resolved.ok) return null;

    return { resolved, legalUcis: built.legalUcis, request: built.request };
  } catch (err) {
    console.warn("Jev API call skipped/failed, falling back to Superfly MCTS:", err);
    return null;
  }
}

function doesAllowMate(fen: string, uci: string): boolean {
  try {
    const c = new Chess(fen);
    if (!c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })) return true;
    return c.moves({ verbose: true }).some((m: any) => m.san.includes("#"));
  } catch {
    return true;
  }
}

function applyVncDescendingVeto(fen: string, hybridRaw: JevPlaySuccess): boolean {
  const chBefore = new Chess(fen);
  const legalUcis = chBefore.moves({ verbose: true }).map((m: any) => m.from + m.to + (m.promotion ?? ""));

  const allowsMate = (uci: string): boolean => doesAllowMate(fen, uci);

  const currentUci = hybridRaw.uci;
  const currentAllowsMate = allowsMate(currentUci);
  const currentIsTrap = isPredationTrap(fen, currentUci);
  const currentIsBlunder = isBlunderMove(fen, currentUci);
  const currentPin = isMoveSteppingIntoAbsolutePin(chBefore, currentUci);
  const currentIsAbsolutePin = currentPin.isPinned && (currentPin.piece === "q" || currentPin.piece === "r");
  const currentIsWeakening = isKingWeakeningMove(chBefore, currentUci);

  // Jika langkah saat ini aman dari skakmat, jebakan, blunder, pin mutlak, dan pelemahan raja, pertahankan!
  if (!currentAllowsMate && !currentIsTrap && !currentIsBlunder && !currentIsAbsolutePin && !currentIsWeakening) return false;

  recordMatchExperience(fen, undefined, undefined, currentUci);

  // Cari kandidat teraman:
  // TIER 1: Bebas skakmat, bebas jebakan material, bebas blunder, bebas pin mutlak, bebas pelemahan raja
  // TIER 2: Bebas skakmat (prioritas mutlak bertahan hidup melawan skakmat)
  const candidatesTier1: string[] = [];
  const candidatesTier2: string[] = [];

  for (const uci of legalUcis) {
    if (!allowsMate(uci)) {
      candidatesTier2.push(uci);
      const pin = isMoveSteppingIntoAbsolutePin(chBefore, uci);
      const isAbsPin = pin.isPinned && (pin.piece === "q" || pin.piece === "r");
      const isWeak = isKingWeakeningMove(chBefore, uci);
      if (!isPredationTrap(fen, uci) && !isBlunderMove(fen, uci) && !isAbsPin && !isWeak) {
        candidatesTier1.push(uci);
      }
    }
  }

  const probs = hybridRaw.probabilities || {};
  candidatesTier1.sort((a, b) => (probs[b] ?? 0) - (probs[a] ?? 0));
  candidatesTier2.sort((a, b) => (probs[b] ?? 0) - (probs[a] ?? 0));

  const bestCandidate = candidatesTier1[0] || candidatesTier2[0];
  if (bestCandidate && bestCandidate !== currentUci) {
    const ch = new Chess(fen);
    const app = applyUci(ch, bestCandidate);
    if (app) {
      hybridRaw.uci = bestCandidate;
      hybridRaw.san = app.san;
      hybridRaw.fen = ch.fen();
      hybridRaw.outcome = describeOutcome(ch);
      hybridRaw.probabilities = { [bestCandidate]: 1.0 };
      return true;
    }
  }
  return false;
}

function allowsUnsafeEnemyPromotion(fen: string, uci: string): boolean {
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

async function ensureTacticalSafety(
  fen: string,
  candidateUci: string,
  legalUcis: string[]
): Promise<{ uci: string; vetoed: boolean; reason?: string }> {
  if (legalUcis.length <= 1) return { uci: candidateUci, vetoed: false };

  // 1. Cek langsung: apakah candidateUci membiarkan lawan skakmat ATAU promosi menjadi Menteri di giliran berikutnya?
  try {
    const testCh = new Chess(fen);
    const testApp = testCh.move({
      from: candidateUci.slice(0, 2),
      to: candidateUci.slice(2, 4),
      promotion: candidateUci[4],
    });
    if (testApp) {
      const oppMoves = testCh.moves({ verbose: true });
      const allowsMate = oppMoves.some((m: any) => m.san.includes("#"));
      const allowsPromo = allowsUnsafeEnemyPromotion(fen, candidateUci);

      if (allowsMate || allowsPromo) {
        // Cari langkah alternatif yang bebas skakmat & bebas promosi lawan
        const safeMoves = legalUcis.filter((u) => {
          if (allowsMate) {
            const c2 = new Chess(fen);
            try {
              if (!c2.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) return false;
              if (c2.moves({ verbose: true }).some((om: any) => om.san.includes("#"))) return false;
            } catch {
              return false;
            }
          }
          if (allowsPromo) {
            if (allowsUnsafeEnemyPromotion(fen, u)) return false;
          }
          return true;
        });
        if (safeMoves.length > 0) {
          const sfBest = await playStockfishMove(fen, 10);
          const chosenSafe = sfBest?.uci && safeMoves.includes(sfBest.uci) ? sfBest.uci : safeMoves[0];
          return {
            uci: chosenSafe,
            vetoed: true,
            reason: allowsMate ? "checkmate_in_1_prevented" : "enemy_queen_promotion_prevented",
          };
        }
      }
    }
  } catch (_) {}

  // 2. Motif-level Tactical Gate: Cek Absolute Pin (seperti Qf7) & King Weakening (seperti f7-f6)
  try {
    const chBefore = new Chess(fen);
    const pin = isMoveSteppingIntoAbsolutePin(chBefore, candidateUci);
    const isWeak = isKingWeakeningMove(chBefore, candidateUci);
    const isDangerousPin = pin.isPinned && (pin.piece === "q" || pin.piece === "r");

    if (isDangerousPin || isWeak) {
      const safeMoves = legalUcis.filter((u) => {
        const p = isMoveSteppingIntoAbsolutePin(chBefore, u);
        const w = isKingWeakeningMove(chBefore, u);
        return (!p.isPinned || (p.piece !== "q" && p.piece !== "r")) && !w;
      });

      if (safeMoves.length > 0) {
        const sfBest = await playStockfishMove(fen, 10);
        const chosenSafe = sfBest?.uci && safeMoves.includes(sfBest.uci) ? sfBest.uci : safeMoves[0];
        return {
          uci: chosenSafe,
          vetoed: true,
          reason: isDangerousPin
            ? `absolute_pin_vetoed (${pin.piece?.toUpperCase()} pinned to king)`
            : "king_weakening_vetoed (f-pawn shield collapse)",
        };
      }
    }
  } catch (_) {}

  // 3. Suicidal Piece Blunder Gate: Veto blunder mengorbankan Menteri/Benteng/Perwira demi pion kecil (seperti 37... Qxb4??)
  try {
    const chBefore = new Chess(fen);
    const suicidal = isMoveSuicidalPieceLoss(chBefore, candidateUci);
    if (suicidal.isSuicidal) {
      const safeMoves = legalUcis.filter((u) => !isMoveSuicidalPieceLoss(chBefore, u).isSuicidal);
      if (safeMoves.length > 0) {
        const sfBest = await playStockfishMove(fen, 10);
        const chosenSafe = sfBest?.uci && safeMoves.includes(sfBest.uci) ? sfBest.uci : safeMoves[0];
        return {
          uci: chosenSafe,
          vetoed: true,
          reason: `suicidal_piece_loss_vetoed (${suicidal.piece?.toUpperCase()} hung for -${suicidal.netLoss}cp)`,
        };
      }
    }
  } catch (_) {}

  // 4. Evaluasi Taktis Stockfish (depth 8): Deteksi Blunder Berat / Kehilangan Pion & Perwira
  try {
    const score = await evalSingleMove(fen, candidateUci, 8);
    if (score !== null && score <= -100) {
      const sfBest = await playStockfishMove(fen, 10);
      if (sfBest?.uci && sfBest.uci !== candidateUci) {
        const chB = new Chess(fen);
        const pin = isMoveSteppingIntoAbsolutePin(chB, sfBest.uci);
        const isDangerousPin = pin.isPinned && (pin.piece === "q" || pin.piece === "r");
        const allowsMate = doesAllowMate(fen, sfBest.uci);
        const allowsPromo = allowsUnsafeEnemyPromotion(fen, sfBest.uci);
        const isSuicide = isMoveSuicidalPieceLoss(chB, sfBest.uci).isSuicidal;

        if (!isDangerousPin && !allowsMate && !allowsPromo && !isSuicide) {
          return { uci: sfBest.uci, vetoed: true, reason: `tactical_blunder_vetoed (eval was ${score}cp)` };
        }
      }
    }
  } catch (_) {}

  return { uci: candidateUci, vetoed: false };
}

export class JevSuperflyHybridEngine implements IChessEngine {
  readonly id = "jev-fly" as const;
  readonly name = "Jev AI + Superfly Connectome Hybrid";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const key = req.apiKey || process.env.TYPESAFE_API_KEY;
    const sims = Math.max(12, req.simulations ?? 15);

    let hybridRaw: JevPlaySuccess | null = null;

    if (key) {
      // Jalankan Jev Priors (LLM) dan Superfly MCTS (Connectome) secara paralel agar responsif (<3s)
      const [jevData, superfly] = await Promise.all([
        queryJevPriors(req.fen, req.seed, req.history, key),
        Promise.resolve().then(() => playSuperflyMove(req.fen, sims)),
      ]);

      // 1. Nature 2024 MBON Recall: Eksekusi instan langkah Stockfish depth 14 jika sudah dipelajari
      const learned = getLearnedMove(req.fen);
      if (learned && !isBlunderMove(req.fen, learned.move)) {
        const legals = new Chess(req.fen).moves({ verbose: true }).map((m: any) => m.from + m.to + (m.promotion ?? ""));
        const safeCheck = await ensureTacticalSafety(req.fen, learned.move, legals);
        const finalUci = safeCheck.vetoed ? safeCheck.uci : learned.move;
        const chL = new Chess(req.fen);
        const applied = applyUci(chL, finalUci);
        const prediction = await getStockfishPrediction(chL.fen(), finalUci);
        return {
          engine: this.id,
          uci: finalUci,
          san: applied.san,
          fen: chL.fen(),
          probabilities: { [finalUci]: 0.99 },
          confidence: 0.99,
          droppedMoveCount: 0,
          outcome: describeOutcome(chL),
          scoreCp: learned.score,
          prediction,
          metadata: { source: safeCheck.vetoed ? "tactical-override" : "mbon-learned", model: "jev-fly-hybrid" },
        };
      }

      if (jevData) {
        const mctsProbs = superfly?.probabilities || {};

        const fusedProbs: Record<string, number> = {};
        const chValence = new Chess(req.fen);
        const weightJev = 0.6;
        const weightFly = 0.4;
        for (const uci of jevData.legalUcis) {
          const pJev = jevData.resolved.probabilities[uci] ?? 0;
          const pFly = mctsProbs[uci] ?? 0;
          let valence = calculateBiologicalValence(chValence, uci);

          // Kenyon Cell (KC) Motif-Level Associative Penalty & Learned Valence Recall:
          // 1. Absolute pins (like Qf7): stepping Queen or Rook into an absolute pin to the King
          const pinCheck = isMoveSteppingIntoAbsolutePin(chValence, uci);
          if (pinCheck.isPinned) {
            if (pinCheck.piece === "q") {
              valence -= 450; // Severe penalty for pinned Queen (like Qf7)
            } else if (pinCheck.piece === "r") {
              valence -= 250;
            } else {
              valence -= 150;
            }
          }

          // 2. King weakening moves (like f7-f6): unprovoked king pawn shield rupture
          if (isKingWeakeningMove(chValence, uci)) {
            valence -= 280; // Associative penalty for exposing king diagonals
          }

          // 3. Post-move motif-level learned valence recall (Nature 2024 MBON readouts)
          const testCh = new Chess(req.fen);
          if (testCh.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined })) {
            const motifValence = recallMotifValence(testCh);
            valence += motifValence * 0.5;
          }

          const valenceFactor = valence < 0 ? Math.max(0.01, 1 + valence / 500) : 1 + valence / 300;
          let prob = (weightJev * pJev + weightFly * pFly) * valenceFactor;

          // Hard probability squashing for critical motif blunders
          if (pinCheck.isPinned && pinCheck.piece === "q") {
            prob *= 0.02;
          }
          if (isKingWeakeningMove(chValence, uci)) {
            prob *= 0.05;
          }
          const suicidalMv = isMoveSuicidalPieceLoss(chValence, uci);
          if (suicidalMv.isSuicidal) {
            prob *= 0.001;
          }

          // Lonjakan Dopamin PAM jika cocok dengan database pembelajaran Stockfish
          if (learned?.move === uci) {
            prob *= 1 + Math.max(0.5, (learned.dopamine || 350) / 400);
          }
          if (isBlunderMove(req.fen, uci)) {
            prob *= 0.05;
          }
          fusedProbs[uci] = Number(prob.toFixed(4));
        }

        const sortedMoves = Object.entries(fusedProbs).sort((a, b) => b[1] - a[1]);
        const chosenUci = sortedMoves.length > 0 ? sortedMoves[0][0] : jevData.resolved.uci;

        const ch = new Chess(req.fen);
        const applied = applyUci(ch, chosenUci);

        hybridRaw = {
          uci: chosenUci,
          san: applied.san,
          fen: ch.fen(),
          probabilities: fusedProbs,
          confidence: fusedProbs[chosenUci] ?? jevData.resolved.confidence,
          droppedMoveCount: 0,
          outcome: describeOutcome(ch),
          request: jevData.request,
        };
      }
    }

    if (!hybridRaw) {
      const flyFallback = playSuperflyMove(req.fen, sims) || playFlyBrainMove(req.fen);
      if (!flyFallback) throw new Error("Hybrid engine failed to generate move.");
      hybridRaw = { ...flyFallback, request: {} as any };
    }

    const vncVetoed = applyVncDescendingVeto(req.fen, hybridRaw);

    // Grandmaster Anti-Blunder Tactical Gate (Proteksi Blunder Fatal, Kehilangan Perwira, & Skakmat)
    const chLegals = new Chess(req.fen).moves({ verbose: true }).map((m: any) => m.from + m.to + (m.promotion ?? ""));
    const safeCheck = await ensureTacticalSafety(req.fen, hybridRaw.uci, chLegals);
    if (safeCheck.vetoed && safeCheck.uci !== hybridRaw.uci) {
      const oldBlunder = hybridRaw.uci;
      const chNew = new Chess(req.fen);
      const appNew = applyUci(chNew, safeCheck.uci);
      hybridRaw.uci = safeCheck.uci;
      hybridRaw.san = appNew.san;
      hybridRaw.fen = chNew.fen();
      hybridRaw.outcome = describeOutcome(chNew);
      hybridRaw.probabilities = { [safeCheck.uci]: 1.0 };
      recordMatchExperience(req.fen, safeCheck.uci, 50, oldBlunder);
    }

    const prediction = await getStockfishPrediction(hybridRaw.fen, hybridRaw.uci);
    if (prediction?.uci) {
      recordMatchExperience(hybridRaw.fen, prediction.uci, prediction.scoreCp ?? 0);
    }

    if (hybridRaw.outcome?.over && (hybridRaw.outcome.winner === "white" || hybridRaw.outcome.winner === "black")) {
      reinforceMatchDopamine([...(req.history ?? []), hybridRaw.san], hybridRaw.outcome.winner);
    }

    return {
      engine: this.id,
      uci: hybridRaw.uci,
      san: hybridRaw.san,
      fen: hybridRaw.fen,
      probabilities: hybridRaw.probabilities,
      confidence: hybridRaw.confidence,
      droppedMoveCount: hybridRaw.droppedMoveCount,
      outcome: hybridRaw.outcome,
      scoreCp: (hybridRaw as any).scoreCp ?? undefined,
      prediction,
      metadata: {
        hybridType: key ? "rlcd_connectome_fusion" : "superfly_mcts_pure",
        simulations: sims,
        vncVetoed,
        weights: { jev: 0.6, flybrain: 0.4 },
        spatialInsights: (hybridRaw.request?.state as any)?.spatial_insights ?? null,
        connectomeNetwork: evaluateConnectomeNetwork(new Chess(req.fen), hybridRaw.uci),
      },
    };
  }
}

export const jevSuperflyHybridEngine = new JevSuperflyHybridEngine();
