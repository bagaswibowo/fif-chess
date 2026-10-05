const ENDGAME_PROMO_BOOST = 0.95;
const MIDGAME_PROMO_BOOST = 0.65;
const ENDGAME_PAWN_ADVANCE_FACTOR = 0.40;
const MIDGAME_PAWN_ADVANCE_FACTOR = 0.25;

import { describeOutcome } from "../chess.ts";
import fs from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";
// @ts-ignore
import { parseArrays } from "./loader.js";
// @ts-ignore
import { FlyBrain } from "./flybrain.js";
// @ts-ignore
import { encodeBoard, legalMoveIndices, indexToMove } from "./encoding.js";
// @ts-ignore
import { runMCTS } from "./mcts.js";
// @ts-ignore
import * as enc from "./encoding.js";
import { getLearnedMove, isBlunderMove, recordMatchExperience } from "../experience.ts";
import { evaluateConnectomeNetwork } from "./connectome-network.ts";

let cachedBrain: any = null;

export function getFlyBrain(): any {
  if (cachedBrain) return cachedBrain;
  const modelsDir = path.join(process.cwd(), "models");
  const headerPath = path.join(modelsDir, "brain.json");
  const bufferPath = path.join(modelsDir, "brain.flyb");

  if (!fs.existsSync(headerPath) || !fs.existsSync(bufferPath)) {
    return null;
  }

  const header = JSON.parse(fs.readFileSync(headerPath, "utf8"));
  const buffer = fs.readFileSync(bufferPath);
  const arrays = parseArrays(
    header,
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );

  cachedBrain = new FlyBrain({ header, arrays });
  return cachedBrain;
}

export type FlyMoveScore = {
  uci: string;
  san: string;
  prob: number;
  logit: number;
  value: number;
};

/**
 * Evaluates board using FlyBrain Connectome with 1-ply lookahead value search
 * and active pawn-push / promotion tactical incentives.
 */
export function evaluateWithFlyBrain(fen: string, isEndgame: boolean = false): {
  moves: FlyMoveScore[];
  value: number;
  diagnostics?: any;
} | null {
  try {
    const brain = getFlyBrain();
    if (!brain) return null;

    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;

    const turn = chess.turn();
    const isWhite = turn === "w";
    const planes = encodeBoard(chess);
    const fwd = (brain as any).forward(planes);
    const policy = fwd.policy;
    const currentPosValue = fwd.value;
    const activity = fwd.activity;
    const retinaDrive = fwd.retinaDrive;

    const legal = legalMoveIndices(chess);
    if (!legal || legal.length === 0) return null;

    // Softmax policy distribution
    const logits = legal.map((idx: number) => policy[idx]);
    const maxLogit = Math.max(...logits);
    const exps = logits.map((l: number) => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a: number, b: number) => a + b, 0);

    // LOOKAHEAD PRUNING: 1-ply lookahead (forward lawan) hanya untuk top-K
    // kandidat policy + semua langkah taktis (promosi/pion lanjut jauh).
    // Dgn 40+ langkah legal, forward 134k neuron per langkah membuat evaluasi
    // melambat ke 4-7 detik. Top-12 policy mencakup hampir semua langkah yang
    // realistis dipilih tanpa mengorbankan kualitas keputusan.
    const LOOKAHEAD_TOP_K = 12;
    const order = Array.from({ length: legal.length }, (_, i) => i).sort(
      (a, b) => logits[b] - logits[a]
    );
    const doLookahead = new Set(order.slice(0, LOOKAHEAD_TOP_K));

    const scored: FlyMoveScore[] = [];

    for (let i = 0; i < legal.length; i++) {
      const idx = legal[i];
      const m = indexToMove(idx, chess) as any;
      const uci = m.from + m.to + (m.promotion || "");
      let san = uci;
      let moveValue = 0;
      let isPromotion = Boolean(m.promotion || uci.length > 4);
      let isPawnPush = false;
      let pawnAdvancedRank = 0;

      const piece = chess.get(m.from as any);
      if (piece && piece.type === "p") {
        isPawnPush = true;
        const targetRank = parseInt(m.to[1], 10);
        pawnAdvancedRank = isWhite ? targetRank : 9 - targetRank;
      }

      try {
        const mv = chess.move({ from: m.from, to: m.to, promotion: m.promotion || (isPromotion ? "q" : undefined) });
        if (mv) {
          san = mv.san;
          if (chess.isCheckmate()) {
            moveValue = 1.0; // Immediate checkmate!
          } else if (chess.isDraw()) {
            moveValue = 0.0;
          } else if (doLookahead.has(i) || isPromotion || (isPawnPush && pawnAdvancedRank >= 5)) {
            const oppPlanes = encodeBoard(chess);
            const oppFwd = brain.forward(oppPlanes, { activity: false });
            moveValue = -oppFwd.value; // Negated opponent value
          } else {
            // Kandidat di luar top-K: nilai netral — cukup policy prior.
            moveValue = 0;

            // Pawn promotion & advance bonus (aggressive promotion behavior)
            if (mv.promotion || san.includes("=")) {
              moveValue = isEndgame ? Math.min(0.99, moveValue + ENDGAME_PROMO_BOOST) : Math.min(0.98, moveValue + MIDGAME_PROMO_BOOST);
            } else if (isPawnPush && pawnAdvancedRank >= 6) {
              moveValue = isEndgame
                ? Math.min(0.95, moveValue + ENDGAME_PAWN_ADVANCE_FACTOR * (pawnAdvancedRank - 5))
                : Math.min(0.92, moveValue + MIDGAME_PAWN_ADVANCE_FACTOR * (pawnAdvancedRank - 5));
            }

            // Material capture bonus
            if (mv.captured) {
              const valMap: Record<string, number> = { q: 0.5, r: 0.35, b: 0.2, n: 0.2, p: 0.1 };
              moveValue = Math.min(0.95, moveValue + (valMap[mv.captured] || 0.1));
            }
          }
          chess.undo();
        }
      } catch {}

      const policyProb = sumExps > 0 ? exps[i] / sumExps : 0;
      // Combined Lookahead Score: 40% Policy Prior + 60% Lookahead Value
      const normalizedVal = (moveValue + 1) / 2; // Map [-1, 1] -> [0, 1]
      const combinedProb = Number((0.4 * policyProb + 0.6 * normalizedVal).toFixed(4));

      scored.push({
        uci,
        san,
        prob: combinedProb,
        logit: policy[idx],
        value: moveValue,
      });
    }

    scored.sort((a, b) => b.prob - a.prob);

    // Extract Connectome Diagnostics (Biomimetic Visualizer)
    const CLASS_NAMES: Record<number, string> = {
      0: "Optic Lobe (Sistem Visual)",
      1: "Sensory / Ascending (Sensorik)",
      2: "Central Brain (Memori & Keputusan)",
      3: "Descending / Motor (Keluaran Gerak)",
    };

    const regionalSums = { optic: 0, sensory: 0, central: 0, motor: 0 };
    const regionalCounts = { optic: 0, sensory: 0, central: 0, motor: 0 };
    const topActive: { id: number; region: string; activity: number; codexUrl: string }[] = [];

    if (activity && brain.superClass) {
      const sc = brain.superClass;
      const step = Math.max(1, Math.floor(activity.length / 5000));
      for (let i = 0; i < activity.length; i += step) {
        const act = activity[i];
        const cls = sc[i] ?? 2;
        if (cls === 0) { regionalSums.optic += act; regionalCounts.optic++; }
        else if (cls === 1) { regionalSums.sensory += act; regionalCounts.sensory++; }
        else if (cls === 3) { regionalSums.motor += act; regionalCounts.motor++; }
        else { regionalSums.central += act; regionalCounts.central++; }

        if (act > 0.3) {
          topActive.push({
            id: i,
            region: CLASS_NAMES[cls] || "Central Brain",
            activity: Number(act.toFixed(3)),
            codexUrl: `https://codex.flywire.ai`,
          });
        }
      }
    }

    topActive.sort((a, b) => b.activity - a.activity);
    const topNeurons = topActive.slice(0, 5);

    // Compound eye heatmap (64 squares)
    const eyeMap = new Array(64).fill(0);
    if (retinaDrive && brain.retinaSquare) {
      const sq = brain.retinaSquare;
      const count = new Array(64).fill(0);
      for (let k = 0; k < retinaDrive.length; k++) {
        const s = sq[k];
        if (s >= 0 && s < 64) {
          eyeMap[s] += Math.max(0, retinaDrive[k]);
          count[s]++;
        }
      }
      for (let s = 0; s < 64; s++) {
        if (count[s] > 0) eyeMap[s] = Number((eyeMap[s] / count[s]).toFixed(3));
      }
    }

    const regionalActivity = {
      optic: Number((regionalCounts.optic ? regionalSums.optic / regionalCounts.optic : 0).toFixed(3)),
      sensory: Number((regionalCounts.sensory ? regionalSums.sensory / regionalCounts.sensory : 0).toFixed(3)),
      central: Number((regionalCounts.central ? regionalSums.central / regionalCounts.central : 0).toFixed(3)),
      motor: Number((regionalCounts.motor ? regionalSums.motor / regionalCounts.motor : 0).toFixed(3)),
    };

    const scoreCp = Math.round(currentPosValue * 100);
    const mood: "smug" | "thinking" | "panic" = scoreCp > 60 ? "smug" : scoreCp < -60 ? "panic" : "thinking";

    return {
      moves: scored,
      value: currentPosValue,
      diagnostics: {
        scoreCp,
        mood,
        regionalActivity,
        eyeMap,
        topNeurons,
      },
    };
  } catch (err) {
    console.error("FlyBrain evaluation error:", err);
    return null;
  }
}

export function playFlyBrainMove(fen: string) {
  const result = evaluateWithFlyBrain(fen);
  if (!result || result.moves.length === 0) return null;

  const best = result.moves[0];
  const chess = new Chess(fen);
  const applied = chess.move({
    from: best.uci.slice(0, 2),
    to: best.uci.slice(2, 4),
    promotion: best.uci[4] || undefined,
  });

  const probs: Record<string, number> = {};
  for (const m of result.moves) {
    probs[m.uci] = m.prob;
  }

  return {
    uci: best.uci,
    san: applied ? applied.san : best.san,
    fen: chess.fen(),
    probabilities: probs,
    confidence: best.prob,
    droppedMoveCount: 0,
    scoreCp: Math.round(result.value * 100),
    outcome: describeOutcome(chess),
    diagnostics: result.diagnostics,
  };
}

const PIECE_VALS: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function getSquareThreat(chess: Chess, sq: any, myColor: any, oppColor: any) {
  const attackers = chess.attackers(sq, oppColor);
  if (!attackers || attackers.length === 0) return null;

  let minOppVal = 10000;
  for (const a of attackers) {
    const p = chess.get(a);
    if (p) minOppVal = Math.min(minOppVal, PIECE_VALS[p.type] ?? 100);
  }
  const defenders = chess.attackers(sq, myColor);
  return { minOppVal, hasDefender: defenders && defenders.length > 0 };
}

function calculateBoardPunishment(chess: Chess, myColor: any, oppColor: any): number {
  let punishment = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = chess.board()[r][c];
      if (!piece || piece.color !== myColor) continue;

      const val = PIECE_VALS[piece.type] ?? 100;
      const threat = getSquareThreat(chess, piece.square, myColor, oppColor);
      if (!threat) continue;

      if (threat.minOppVal < val) {
        punishment += val - threat.minOppVal;
      } else if (!threat.hasDefender) {
        const isWingPawn = piece.type === "p" && (piece.square === "g7" || piece.square === "b7" || piece.square === "g2" || piece.square === "b2");
        punishment += isWingPawn ? 300 : val;
      }
    }
  }
  return punishment;
}

/**
 * Nature 2024 (FlyWire connectome - Descending Neurons Premotor Veto):
 * Detects if a move creates catastrophic immediate material loss (attacked by pawn or undefended piece >= 3 pts).
 */
export function isPredationTrap(fen: string, uci: string): boolean {
  try {
    const chess = new Chess(fen);
    if (!chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })) return false;
    if (chess.isGameOver()) return false;

    // 1. FATAL CHECKMATE CHECK: Jika langkah ini membiarkan lawan skakmat di giliran berikutnya, WAJIB VETO!
    const oppMoves = chess.moves({ verbose: true });
    for (const oppM of oppMoves) {
      if (oppM.san.includes("#")) {
        return true;
      }
    }

    const opp = chess.turn();
    const mine = opp === "w" ? "b" : "w";
    return calculateBoardPunishment(chess, mine, opp) >= 200;
  } catch {
    return false;
  }
}

/**
 * Nature 2026 / Google Research Cerebellum-like Forward Sensory Prediction:
 * Predicts the opponent's strongest immediate replies (efference copy) to detect 2-ply traps.
 */
export function predictOpponentHarm(chess: Chess, uci?: string): number {
  try {
    let moved: any = null;
    if (uci) {
      moved = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] || undefined,
      });
      if (!moved) return 10000;
    }

    if (chess.isGameOver()) {
      if (uci) chess.undo();
      return chess.isCheckmate() ? -10000 : 0;
    }

    // Fast O(M) sensory scan: evaluate direct opponent forcing moves from verbose list
    const oppMoves = chess.moves({ verbose: true });
    let maxHarm = 0;

    for (const oppM of oppMoves) {
      let harm = 0;
      if (oppM.captured) {
        harm += PIECE_VALS[oppM.captured] ?? 100;
      }

      // Pion musuh maju mendekati petak promosi (ancaman menteri baru)
      if (oppM.piece === "p") {
        const destRank = parseInt(oppM.to[1], 10);
        if ((oppM.color === "b" && destRank === 2) || (oppM.color === "w" && destRank === 7)) {
          harm += 800;
        }
      }

      if (oppM.san.includes("#")) {
        harm += 10000;
      } else if (oppM.san.includes("+")) {
        harm += 300;
      }

      if (harm > maxHarm) {
        maxHarm = harm;
        if (maxHarm >= 1000) break;
      }
    }

    if (uci) chess.undo();
    return maxHarm;
  } catch {
    return 10000;
  }
}

/**
 * Nature 2024 Biological Reward & Punishment System:
 * - MBON Reward: Material capture (+100 to +900), Threat evasion (+150), Defending under threat (+120), Check (+80).
 * - DAN/APL Punishment: Hanging pieces (-100 to -900), Neglecting active threats (-300 to -500), Unbalanced trades.
 * - Nature 2026 / Google Research Cerebellum Forward Prediction: Suppresses 2-ply opponent traps.
 * - snedea/flybrain Drives: Pawn promotion hunger in endgame.
 */
export function calculateBiologicalValence(chess: Chess, uci: string): number {
  try {
    const preFen = chess.fen();
    const moved = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || undefined,
    });
    if (!moved) return -1000;

    const moverColor = moved.color;
    const oppColor = chess.turn();

    let reward = 0;
    if (moved.captured) {
      const capVal = PIECE_VALS[moved.captured] ?? 100;
      reward += capVal;
      // Memakan lawan dengan pion kecil: efisien, membuka ruang, dan minim risiko rugi material
      if (moved.piece === "p") {
        reward += 160;
      }
    }
    if (chess.inCheck()) reward += 80;

    const fromSquare = uci.slice(0, 2) as any;
    const toSquare = uci.slice(2, 4) as any;
    chess.undo();
    const wasAttacked = chess.isAttacked(fromSquare, oppColor);
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });

    if (wasAttacked && !chess.isAttacked(toSquare, oppColor)) {
      reward += 150;
    }

    // Deteksi pelindung petak tujuan (terutama pelindung berupa pion kawan)
    const defenders = chess.attackers(toSquare, moverColor);
    let isProtectedByPawn = false;
    if (defenders && defenders.length > 0) {
      for (const d of defenders) {
        const p = chess.get(d as any);
        if (p && p.type === "p") {
          isProtectedByPawn = true;
          break;
        }
      }
    }
    // Perwira yang melangkah ke petak bertumpu/terlindungi pion (outpost solid)
    if (moved.piece !== "p" && isProtectedByPawn) {
      reward += 120;
    }

    const totalHalfMoves = chess.history().length;
    const totalPieces = chess.board().flat().filter(Boolean).length;
    let punishment = 0;

    // FASE 1: OPENING / FIRST GAME (Langkah <= 16 half-moves)
    // - Mainkan pion kecil dulu di awal untuk mengaktifkan perwira
    // - Aktifkan perwira minor (kuda & gajah ke petak aktif)
    // - Awasi serangan lawan jangan sampai dimakan cuma-cuma
    if (totalHalfMoves <= 16) {
      const homeRank = moverColor === "w" ? "1" : "8";
      const fromRank = uci[1];

      // 1. Dorongan pion sentral membuka jalur gajah dan menteri
      if (moved.piece === "p") {
        const centerFiles = ["c", "d", "e"];
        if (centerFiles.includes(uci[2])) {
          reward += 180;
        }
      }

      // 2. Kembangkan perwira minor BARU dari baris asal (kuda & gajah)
      if ((moved.piece === "n" || moved.piece === "b") && fromRank === homeRank) {
        reward += 180; // Prioritaskan perwira yang belum pernah jalan!
      }

      // 3. Larang knight dancing: jangan gerakkan perwira yang sama berulang kali di pembukaan
      if ((moved.piece === "n" || moved.piece === "b") && fromRank !== homeRank && !wasAttacked) {
        punishment += 180;
      }

      // 4. Larang memajukan Menteri terlalu cepat di pembukaan (Queen out early)
      if (moved.piece === "q") {
        punishment += 250;
      }

      // 5. Anti-rim knight
      if (moved.piece === "n" && (toSquare.startsWith("a") || toSquare.startsWith("h"))) {
        punishment += 180;
      }

      // 6. Jangan jalankan raja di awal kecuali rokade
      if (moved.piece === "k" && moved.san !== "O-O" && moved.san !== "O-O-O") {
        punishment += 400;
      }

      // 7. Jangan buka diagonal raja di pembukaan
      if (moved.piece === "p" && (uci.startsWith("f2") || uci.startsWith("f7"))) {
        punishment += 180;
      }

      // 8. Jangan halangi pion sentral (e/d) sendiri dengan gajah sebelum pion itu maju! (misal Be6 memblokir e7)
      if (moved.piece === "b") {
        if (moverColor === "b" && toSquare === "e6" && chess.get("e7" as any)?.type === "p") punishment += 300;
        if (moverColor === "b" && toSquare === "d6" && chess.get("d7" as any)?.type === "p") punishment += 300;
        if (moverColor === "w" && toSquare === "e3" && chess.get("e2" as any)?.type === "p") punishment += 300;
        if (moverColor === "w" && toSquare === "d3" && chess.get("d2" as any)?.type === "p") punishment += 300;
      }
    }

    // FASE 2: MIDDLE GAME (Langkah > 16 dan total perwira > 12)
    // - Mengamankan raja dengan rokade
    // - Cegah raja keluyuran ke tengah
    if (totalHalfMoves > 16 && totalPieces > 12) {
      if (moved.san === "O-O" || moved.san === "O-O-O") {
        reward += 250; // Amankan raja dengan rokade
      }
      if (moved.piece === "k" && moved.san !== "O-O" && moved.san !== "O-O-O") {
        const destRank = parseInt(uci[3], 10);
        if (moverColor === "w" && destRank >= 2) punishment += 350;
        if (moverColor === "b" && destRank <= 7) punishment += 350;
      }
    }

    // FASE 3: END GAME (Total perwira <= 12)
    // - Menyerang sambil memperhitungkan skak raja
    // - Dorongan makan & promosi pion bebas
    if (totalPieces <= 12) {
      if (chess.inCheck()) {
        reward += 200; // Skak raja lawan di babak akhir
      }
      if (moved.piece === "p") {
        const targetRank = parseInt(uci[3], 10);
        const promoDist = moverColor === "w" ? 8 - targetRank : targetRank - 1;
        reward += (7 - promoDist) * 50;
      }
    }

    // Proteksi perwira & evaluasi pertukaran (Static Exchange Parity)
    const isDestAttacked = chess.isAttacked(toSquare, oppColor);
    const isDestDefended = defenders && defenders.length > 0;
    const myVal = PIECE_VALS[moved.piece] ?? 100;

    if (isDestAttacked) {
      if (!isDestDefended) {
        // Melangkah ke petak gantung tanpa pelindung: hukuman keras!
        punishment += myVal * 1.5;
      } else {
        // Ada pelindung: cek apakah diserang oleh bidak bernilai lebih murah (misal kuda diserang pion)
        const oppAttackers = chess.attackers(toSquare, oppColor);
        let minOppVal = 10000;
        for (const a of oppAttackers) {
          const p = chess.get(a as any);
          if (p) minOppVal = Math.min(minOppVal, PIECE_VALS[p.type] ?? 100);
        }
        const capVal = moved.captured ? (PIECE_VALS[moved.captured] ?? 100) : 0;
        if (minOppVal < myVal && capVal < myVal) {
          // Pertukaran timpang: perwira mahal ditukar perwira murah lawan
          punishment += (myVal - minOppVal) * 1.2;
        } else if (isProtectedByPawn) {
          // Dilindungi pion dan pertukaran setara: struktur solid!
          reward += 80;
        }
      }
    }

    let punishmentBoard = calculateBoardPunishment(chess, moverColor, oppColor);
    punishment += punishmentBoard;

    // Google Research / Nature 2026 Cerebellum Forward Prediction (2-ply threat)
    const oppHarm = predictOpponentHarm(chess);
    if (oppHarm >= 200) {
      punishment += oppHarm;
    }

    // Lin, Yang et al. bioRxiv / Nature 2024 Connectome Network Statistics (Reciprocity, Triads, NSRNs, Rich-Club)
    const connectomeStats = evaluateConnectomeNetwork(new Chess(preFen), uci);
    if (connectomeStats.netScore > 0) {
      reward += connectomeStats.netScore;
    } else if (connectomeStats.netScore < 0) {
      punishment += Math.abs(connectomeStats.netScore);
    }

    chess.undo();
    return reward - punishment;
  } catch {
    return -1000;
  }
}

/**
 * Superfly: FlyBrain with PUCT Monte Carlo Tree Search
 * As featured on https://fly.eyed.to/ (Drosophila connectome + MCTS simulations)
 */
export function playSuperflyMove(fen: string, sims = 15) {
  try {
    // 1. Nature 2024 (MBON Valence Recall): Jika posisi sudah dikuasai dari Stockfish, langsung eksekusi
    const learned = getLearnedMove(fen);
    if (learned && learned.move) {
      try {
        const chessL = new Chess(fen);
        const applied = chessL.move({
          from: learned.move.slice(0, 2),
          to: learned.move.slice(2, 4),
          promotion: learned.move[4] || undefined,
        });
        if (applied) {
          return {
            uci: learned.move,
            san: applied.san,
            fen: chessL.fen(),
            probabilities: { [learned.move]: 0.99 },
            confidence: 0.99,
            droppedMoveCount: 0,
            scoreCp: learned.score,
            outcome: describeOutcome(chessL),
            diagnostics: { source: "mbon-learned", score: learned.score },
          };
        }
      } catch {}
    }

    const brain = getFlyBrain();
    if (!brain) return playFlyBrainMove(fen);

    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;

    const mctsRes = runMCTS(brain, chess, enc, { sims, cPuct: 1.5 });
    if (!mctsRes || !mctsRes.move) return playFlyBrainMove(fen);

    // 2. Nature 2024 (MBON Valence Reward + DAN/APL Depression Integration)
    const chEval = new Chess(fen);
    const learnedPos = getLearnedMove(fen);
    const scoredVisits = (mctsRes.visits || []).map((v: any) => {
      const valence = calculateBiologicalValence(chEval, v.uci);
      const isBlunder = isBlunderMove(fen, v.uci);
      const penalty = isBlunder ? -1000 : 0;
      const dopamineBonus = (learnedPos && learnedPos.move === v.uci) ? (learnedPos.dopamine ?? 0) / 20 : 0;
      const bioScore = v.n + (valence / 40) + dopamineBonus + penalty;
      return { ...v, valence, bioScore, dopamineBonus };
    });
    scoredVisits.sort((a: any, b: any) => b.bioScore - a.bioScore);

    let chosenMove = scoredVisits.length > 0 ? scoredVisits[0].uci : mctsRes.move;
    if (scoredVisits.length > 0 && scoredVisits[0].valence <= -250) {
      recordMatchExperience(fen, undefined, undefined, scoredVisits[0].uci);
    }

    const chessApply = new Chess(fen);
    const applied = chessApply.move({
      from: chosenMove.slice(0, 2),
      to: chosenMove.slice(2, 4),
      promotion: chosenMove[4] || undefined,
    });

    const probs: Record<string, number> = {};
    for (const v of mctsRes.visits || []) {
      probs[v.uci] = v.n / Math.max(1, mctsRes.sims);
    }

    return {
      uci: chosenMove,
      san: applied ? applied.san : chosenMove,
      fen: chessApply.fen(),
      probabilities: probs,
      confidence: probs[chosenMove] ?? 0.8,
      droppedMoveCount: 0,
      scoreCp: Math.round(mctsRes.rootValue * 100),
      outcome: describeOutcome(chessApply),
      diagnostics: {
        sims: mctsRes.sims,
        rootValue: mctsRes.rootValue,
        topVisits: scoredVisits.slice(0, 5),
      },
    };
  } catch (e) {
    console.warn("Superfly MCTS fallback to standard FlyBrain:", e);
    return playFlyBrainMove(fen);
  }
}
