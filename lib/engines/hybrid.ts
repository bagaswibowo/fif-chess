import { Chess, type Square } from "chess.js";
import { applyUci, describeOutcome } from "@/lib/chess";
import {
  buildJevRequest,
  resolveJevChoice,
  TYPESAFE_ENDPOINT,
  type JevPlaySuccess,
} from "@/lib/jev";
import { playSuperflyMove, playFlyBrainMove, calculateBiologicalValence } from "@/lib/flybrain/service";
import { evaluateConnectomeNetwork } from "@/lib/flybrain/connectome-network";
import {
  getLearnedMove,
  isBlunderMove,
  recordMatchExperience,
  reinforceMatchDopamine,
  normalizeFen,
} from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
import { tacticalGatekeeper } from "./tactical-gatekeeper";
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
): Promise<{ probabilities: Record<string, number>; request: any } | null> {
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
      signal: AbortSignal.timeout(1800), // REA improvement: fast fail, don't stall MCTS
    });

    if (!res.ok) return null;
    const payload = await res.json();
    const resolved = resolveJevChoice(new Set(built.legalUcis), payload?.answers?.move);
    if (!resolved.ok) return null;

    return { probabilities: resolved.probabilities, request: built.request };
  } catch {
    return null;
  }
}

export class JevSuperflyHybridEngine implements IChessEngine {
  readonly id = "jev-fly" as const;
  readonly name = "Jev AI + Superfly Connectome Hybrid";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const cached = fenEngineCache.get(this.id + ":" + req.fen);
    if (cached) return cached;

    const chStart = new Chess(req.fen);

    // 0. Killer Instinct (Insting Pembunuh - Eksekusi Skakmat Mutlak):
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
    const baseSims = Math.max(15, req.simulations ?? 25);
    const sims = mctsConcurrencyGate.getAdaptiveSimulations(baseSims);

    // 1. Nature 2024 MBON Recall: Eksekusi instan langkah terbukti jika sudah dipelajari & aman
    const learned = getLearnedMove(req.fen);
    const isStartPos = normalizeFen(req.fen) === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
    if (learned && !isBlunderMove(req.fen, learned.move) && (learned.dopamine ?? 0) > 0 && (learned.score ?? 0) >= 0 && !isStartPos) {
      const legals = legalMoves.map((m: any) => m.from + m.to + (m.promotion ?? ""));
      const safeCheck = await tacticalGatekeeper(req.fen, learned.move, {
        legalUcis: legals,
        history: req.history,
      });
      const finalUci = safeCheck.vetoed ? safeCheck.uci : learned.move;
      const chL = new Chess(req.fen);
      const applied = applyUci(chL, finalUci);
      if (applied) {
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
        fenEngineCache.set(this.id + ":" + req.fen, mbonResp);
        return mbonResp;
      }
    }

    // 2. REA Dual-Network Fusion:
    // Blend Jev strategic priors (jika tersedia) dengan Drosophila connectome valence
    let rootPriors: Record<string, number> | undefined;
    let jevRequestState: any = null;

    if (key) {
      const jevData = await queryJevPriors(req.fen, req.seed, req.history, key);
      if (jevData?.probabilities) {
        rootPriors = jevData.probabilities;
        jevRequestState = jevData.request;
      }
    }

    // Hitung valensi biologis Drosophila untuk setiap langkah legal sebagai prior tambahan
    const legalUcis = legalMoves.map((m: any) => m.from + m.to + (m.promotion ?? ""));
    const flyPriors: Record<string, number> = {};
    let totalFlyValence = 0;

    for (const u of legalUcis) {
      const v = Math.max(1, calculateBiologicalValence(new Chess(req.fen), u) + 500);
      flyPriors[u] = v;
      totalFlyValence += v;
    }

    // Normalisasi valensi Drosophila
    for (const u of legalUcis) {
      flyPriors[u] = flyPriors[u] / (totalFlyValence || 1);
    }

    // Gabungkan Jev + Fly priors jika Jev ada, jika tidak gunakan Fly priors langsung
    const blendedPriors: Record<string, number> = {};
    for (const u of legalUcis) {
      const jWeight = rootPriors ? (rootPriors[u] ?? 0.01) : 0;
      const fWeight = flyPriors[u] ?? (1 / legalUcis.length);
      blendedPriors[u] = rootPriors ? (jWeight * 0.55 + fWeight * 0.45) : fWeight;
    }

    // 3. Superfly MCTS Rollout dengan Blended Priors
    const superfly = await mctsConcurrencyGate.run(async () => {
      return playSuperflyMove(
        req.fen,
        sims,
        { rootPriors: blendedPriors, rootPriorWeight: 0.35 }
      );
    }) || playFlyBrainMove(req.fen);

    let chosenUci = superfly?.uci || legalUcis[0];
    let chosenSan = superfly?.san || "";
    let chosenFen = superfly?.fen || req.fen;
    let chosenOutcome = superfly?.outcome || describeOutcome(new Chess(req.fen));

    // 4. Tactical Gatekeeper dengan Viridithas & Stockfish heuristics
    const gateResult = await tacticalGatekeeper(req.fen, chosenUci, {
      legalUcis,
      probabilities: blendedPriors,
      history: req.history,
    });

    let wasVetoed = false;
    if (gateResult.vetoed && gateResult.uci !== chosenUci) {
      const oldBlunder = chosenUci;
      chosenUci = gateResult.uci;
      const chNew = new Chess(req.fen);
      const appNew = applyUci(chNew, chosenUci);
      if (appNew) {
        chosenSan = appNew.san;
        chosenFen = chNew.fen();
        chosenOutcome = describeOutcome(chNew);
        wasVetoed = true;
        recordMatchExperience(req.fen, chosenUci, 50, oldBlunder);
      }
    }

    // 5. Online background learning dari Stockfish
    const prediction = await getStockfishPrediction(chosenFen, chosenUci);
    if (prediction?.uci) {
      recordMatchExperience(chosenFen, prediction.uci, prediction.scoreCp ?? 0);
    }

    if (chosenOutcome?.over && (chosenOutcome.winner === "white" || chosenOutcome.winner === "black")) {
      reinforceMatchDopamine([...(req.history ?? []), chosenSan], chosenOutcome.winner);
    }

    const finalResp: EngineMoveResponse = {
      engine: this.id,
      uci: chosenUci,
      san: chosenSan,
      fen: chosenFen,
      probabilities: wasVetoed ? { [chosenUci]: 1.0 } : blendedPriors,
      confidence: wasVetoed ? 0.95 : (superfly?.confidence ?? 0.85),
      droppedMoveCount: 0,
      outcome: chosenOutcome,
      scoreCp: superfly?.scoreCp ?? undefined,
      prediction,
      metadata: {
        hybridType: rootPriors ? "jev_prior_superfly_mcts" : "connectome_valence_superfly_mcts",
        simulations: sims,
        tacticalGateVetoed: wasVetoed,
        gateReason: gateResult.reason,
        quiescenceScore: gateResult.quiescenceScore,
        weights: { jev: rootPriors ? 0.55 : 0.0, flybrain: rootPriors ? 0.45 : 1.0 },
        connectomeNetwork: evaluateConnectomeNetwork(new Chess(req.fen), chosenUci),
      },
    };

    fenEngineCache.set(this.id + ":" + req.fen, finalResp);
    return finalResp;
  }
}

export const jevSuperflyHybridEngine = new JevSuperflyHybridEngine();
