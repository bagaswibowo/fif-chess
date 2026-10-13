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
  doesMoveLeaveAttackedPieceHanging,
  normalizeFen,
} from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
import { tacticalGatekeeper } from "./tactical-gatekeeper";
import { evalSingleMove, playStockfishMove } from "../stockfish";
import type { IChessEngine, EngineMoveRequest, EngineMoveResponse } from "./types";
import { fenEngineCache } from "./lru-cache";
import { mctsConcurrencyGate } from "./concurrency-gate";

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

export class JevSuperflyHybridEngine implements IChessEngine {
  readonly id = "jev-fly" as const;
  readonly name = "Jev AI + Superfly Connectome Hybrid";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const cached = fenEngineCache.get(req.fen);
    if (cached) {
      return cached;
    }
    const chStart = new Chess(req.fen);

    // 0. Killer Instinct (Insting Pembunuh - Eksekusi Skakmat Mutlak):
    // Jika ada langkah legal yang langsung SKAKMAT lawan di giliran ini, EKSEKUSI SEGERA 100%!
    const legalMoves = chStart.moves({ verbose: true });
    for (const lm of legalMoves) {
      const cMate = new Chess(req.fen);
      const appMate = cMate.move(lm);
      if (appMate && cMate.isCheckmate()) {
        const mateUci = lm.from + lm.to + (lm.promotion || "");
        return {
          engine: this.id,
          uci: mateUci,
          san: appMate.san,
          fen: cMate.fen(),
          probabilities: { [mateUci]: 1.0 },
          confidence: 1.0,
          droppedMoveCount: 0,
          outcome: describeOutcome(cMate),
          scoreCp: 30000,
          metadata: { source: "instant-checkmate", model: "jev-fly-hybrid" },
        };
      }
    }

    const key = req.apiKey || process.env.TYPESAFE_API_KEY;
    const baseSims = Math.max(10, req.simulations ?? 15);
    const sims = mctsConcurrencyGate.getAdaptiveSimulations(baseSims);

    let hybridRaw: JevPlaySuccess | null = null;

    if (key) {
      // 1. Nature 2024 MBON Recall: Eksekusi instan langkah terbukti jika sudah dipelajari & bernilai dopamin positif
      const learned = getLearnedMove(req.fen);
      const isStartPos = normalizeFen(req.fen) === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
      if (learned && !isBlunderMove(req.fen, learned.move) && (learned.dopamine ?? 0) > 0 && (learned.score ?? 0) >= 0 && !isStartPos) {
        const legals = new Chess(req.fen).moves({ verbose: true }).map((m: any) => m.from + m.to + (m.promotion ?? ""));
        const safeCheck = await tacticalGatekeeper(req.fen, learned.move, { legalUcis: legals });
        const finalUci = safeCheck.vetoed ? safeCheck.uci : learned.move;
        const chL = new Chess(req.fen);
        const applied = applyUci(chL, finalUci);
        const prediction = await getStockfishPrediction(chL.fen(), finalUci);
        const mbonResp: EngineMoveResponse = {
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
        fenEngineCache.set(req.fen, mbonResp);
        return mbonResp;
      }

      // Jev memberi bobot awal (prior) -> MCTS rollout dibatasi Concurrency Gate -> Move terbaik MCTS dieksekusi
      const jevData = await queryJevPriors(req.fen, req.seed, req.history, key);
      const jevPriors = jevData?.resolved?.probabilities;

      const superfly = await mctsConcurrencyGate.run(async () => {
        return playSuperflyMove(
          req.fen,
          sims,
          jevPriors ? { rootPriors: jevPriors, rootPriorWeight: 0.15 } : {}
        );
      });

      if (superfly) {
        hybridRaw = {
          uci: superfly.uci,
          san: superfly.san,
          fen: superfly.fen,
          probabilities: superfly.probabilities,
          confidence: superfly.confidence,
          droppedMoveCount: 0,
          outcome: superfly.outcome,
          request: jevData?.request ?? ({} as any),
        };
      }
    }

    if (!hybridRaw) {
      const flyFallback = playSuperflyMove(req.fen, sims) || playFlyBrainMove(req.fen);
      if (!flyFallback) {
        const sfEmergency = await playStockfishMove(req.fen, 10);
        const chEm = new Chess(req.fen);
        const fallbackMoves = chEm.moves({ verbose: true });
        const defaultUci = fallbackMoves[0] ? fallbackMoves[0].from + fallbackMoves[0].to + (fallbackMoves[0].promotion || "") : "";
        const chosenUci = sfEmergency?.uci || defaultUci;
        const appEm = applyUci(chEm, chosenUci);
        hybridRaw = {
          uci: chosenUci,
          san: appEm.san,
          fen: chEm.fen(),
          probabilities: { [chosenUci]: 1.0 },
          confidence: 0.5,
          droppedMoveCount: 0,
          outcome: describeOutcome(chEm),
          request: {} as any,
        };
      } else {
        hybridRaw = { ...flyFallback, request: {} as any };
      }
    }

    const vncVetoed = applyVncDescendingVeto(req.fen, hybridRaw);

    // Grandmaster Anti-Blunder Tactical Gate (Proteksi Blunder Fatal, Kehilangan Perwira, & Skakmat)
    const chLegals = new Chess(req.fen).moves({ verbose: true }).map((m: any) => m.from + m.to + (m.promotion ?? ""));
    const safeCheck = await tacticalGatekeeper(req.fen, hybridRaw.uci, { legalUcis: chLegals, probabilities: hybridRaw.probabilities });
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

    const finalResp: EngineMoveResponse = {
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
    fenEngineCache.set(req.fen, finalResp);
    return finalResp;
  }
}

export const jevSuperflyHybridEngine = new JevSuperflyHybridEngine();
