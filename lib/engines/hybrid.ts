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

function applyVncDescendingVeto(fen: string, hybridRaw: JevPlaySuccess): boolean {
  const isBadMove = (m: string) => isBlunderMove(fen, m) || isPredationTrap(fen, m);
  if (!isBadMove(hybridRaw.uci)) return false;

  recordMatchExperience(fen, undefined, undefined, hybridRaw.uci);
  const sorted = Object.entries(hybridRaw.probabilities || {}).sort((a, b) => b[1] - a[1]);
  const safeAlt = sorted.find(([move]) => !isBadMove(move));
  if (safeAlt) {
    const ch = new Chess(fen);
    const app = applyUci(ch, safeAlt[0]);
    hybridRaw.uci = safeAlt[0];
    hybridRaw.san = app.san;
    hybridRaw.fen = ch.fen();
    hybridRaw.outcome = describeOutcome(ch);
    return true;
  }
  return false;
}

export class JevSuperflyHybridEngine implements IChessEngine {
  readonly id = "jev-fly" as const;
  readonly name = "Jev AI + Superfly Connectome Hybrid";

  async play(req: EngineMoveRequest): Promise<EngineMoveResponse> {
    const key = req.apiKey || process.env.TYPESAFE_API_KEY;
    const sims = Math.max(25, req.simulations ?? 40);

    let hybridRaw: JevPlaySuccess | null = null;

    if (key) {
      const jevData = await queryJevPriors(req.fen, req.seed, req.history, key);
      if (jevData) {
        const superfly = playSuperflyMove(req.fen, sims);
        const mctsProbs = superfly?.probabilities || {};

        const fusedProbs: Record<string, number> = {};
        for (const uci of jevData.legalUcis) {
          const pJev = jevData.resolved.probabilities[uci] ?? 0;
          const pFly = mctsProbs[uci] ?? 0;
          fusedProbs[uci] = Number((0.5 * pJev + 0.5 * pFly).toFixed(4));
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

    const prediction = await getStockfishPrediction(hybridRaw.fen);
    if (prediction?.uci) {
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
        vncVetoed,
      },
    };
  }
}

export const jevSuperflyHybridEngine = new JevSuperflyHybridEngine();
