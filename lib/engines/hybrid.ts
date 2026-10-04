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
import { playSuperflyMove, playFlyBrainMove, isPredationTrap } from "@/lib/flybrain/service";
import { getLearnedMove, isBlunderMove, recordMatchExperience } from "@/lib/experience";
import { getStockfishPrediction } from "./stockfish";
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

export class JevSuperflyHybridEngine implements IChessEngine {
  readonly id = "jev-fly" as const;
  readonly name = "Jev AI + Superfly Connectome Hybrid";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const key = req.apiKey || process.env.TYPESAFE_API_KEY;
    const depth = Math.max(14, req.depth ?? 14);
    const sims = Math.max(25, req.simulations ?? 40);

    let hybridRaw: JevPlaySuccess | null = null;

    if (key) {
      try {
        const built = buildJevRequest(req.fen, req.seed, req.history ?? []);
        const { piecesDescription } = scanBoardMatrix(new Chess(req.fen));
        (built.request.state as any).pieces_on_board = piecesDescription;

        const response = await fetch(TYPESAFE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(built.request),
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const payload = await response.json();
          const answers = payload?.answers;
          const resolved = resolveJevChoice(new Set(built.legalUcis), answers?.move);

          if (resolved.ok) {
            // Superfly PUCT MCTS for Connectome Exploration
            const superfly = playSuperflyMove(req.fen, sims);
            const mctsProbs = superfly?.probabilities || {};

            // Hybrid RLCD + Connectome Policy Fusion (70% Jev Epistemic, 30% Connectome Tree Search)
            const fusedProbs: Record<string, number> = {};
            for (const uci of built.legalUcis) {
              const pJev = resolved.probabilities[uci] ?? 0;
              const pFly = mctsProbs[uci] ?? 0;
              fusedProbs[uci] = Number((0.5 * pJev + 0.5 * pFly).toFixed(4));
            }

            const sortedMoves = Object.entries(fusedProbs).sort((a, b) => b[1] - a[1]);
            const chosenUci = sortedMoves.length > 0 ? sortedMoves[0][0] : resolved.uci;

            const ch = new Chess(req.fen);
            const applied = applyUci(ch, chosenUci);

            hybridRaw = {
              uci: chosenUci,
              san: applied.san,
              fen: ch.fen(),
              probabilities: fusedProbs,
              confidence: fusedProbs[chosenUci] ?? resolved.confidence,
              droppedMoveCount: built.droppedUcis.length,
              outcome: describeOutcome(ch),
              request: built.request,
            };
          }
        }
      } catch (err) {
        console.warn("Jev API call skipped/failed, falling back to Superfly MCTS:", err);
      }
    }

    // Fallback: If Jev API is unavailable or failed, use Superfly PUCT MCTS
    if (!hybridRaw) {
      const flyFallback = playSuperflyMove(req.fen, sims) || playFlyBrainMove(req.fen);
      if (!flyFallback) {
        throw new Error("Hybrid engine failed to generate move.");
      }
      hybridRaw = {
        ...flyFallback,
        request: {} as any,
      };
    }

    // 2. Nature 2024 VNC Descending Premotor Veto (Zero Stockfish Intervention)
    let finalUci = hybridRaw.uci;
    const isBadMove = (m: string) => isBlunderMove(req.fen, m) || isPredationTrap(req.fen, m);

    if (isBadMove(finalUci)) {
      recordMatchExperience(req.fen, undefined, undefined, finalUci);
      const sorted = Object.entries(hybridRaw.probabilities || {}).sort((a, b) => b[1] - a[1]);
      const safeAlt = sorted.find(([move]) => !isBadMove(move));
      if (safeAlt) {
        finalUci = safeAlt[0];
        const chApplied = new Chess(req.fen);
        const app = applyUci(chApplied, finalUci);
        hybridRaw.uci = finalUci;
        hybridRaw.san = app.san;
        hybridRaw.fen = chApplied.fen();
        hybridRaw.outcome = describeOutcome(chApplied);
      }
    }

    // 3. Online Learning from Stockfish (Background Teacher / Continuous Learning)
    const prediction = await getStockfishPrediction(hybridRaw.fen);
    if (prediction && prediction.uci) {
      recordMatchExperience(req.fen, prediction.uci, prediction.scoreCp ?? 0);
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
        vncVetoed: finalUci !== hybridRaw.uci,
      },
    };
  }
}

export const jevSuperflyHybridEngine = new JevSuperflyHybridEngine();
