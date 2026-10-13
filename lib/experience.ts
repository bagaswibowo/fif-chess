import fs from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";

interface ExperienceEntry {
  bestMove?: string;
  score?: number;
  dopamine?: number;
  blunders?: string[];
  timesEncountered?: number;
}

export interface PinnedPieceDetail {
  square: string;
  piece: string;
  pinnedTo: "k" | "q";
  isAbsolute: boolean;
}

export interface PositionMotifs {
  kingSafetyVulnerability: number;
  enemyPassedPawnRank: number;
  pinnedPieces: PinnedPieceDetail[];
  motifKeys: string[];
}

const DEFAULT_KC_VALENCE: Record<string, number> = {
  "kc:king_in_check": -150,
  "kc:king_f_weakness": -120,
  "kc:king_diagonal_threat": -100,
  "kc:king_zone_under_siege": -80,
  "kc:king_vuln_high": -150,
  "kc:king_vuln_med": -60,
  "kc:enemy_passed_pawn_rank_7": -350,
  "kc:enemy_passed_pawn_rank_6": -180,
  "kc:enemy_passed_pawn_rank_5": -90,
  "kc:enemy_passed_pawn_rank_4": -40,
  "kc:pin_absolute:q": -350,
  "kc:pin_absolute:r": -200,
  "kc:pin_absolute:b": -150,
  "kc:pin_absolute:n": -150,
  "kc:pin_absolute:p": -80,
  "kc:pin_relative:q": -180,
  "kc:pin_relative:r": -100,
  "kc:pin_relative:b": -60,
  "kc:pin_relative:n": -60,
  "kc:pin_relative:p": -30,
};

const learnedMotifWeights: Record<string, number> = {};

function findKingSquare(chess: Chess, side: "w" | "b"): string | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === side) return p.square;
    }
  }
  return null;
}

function detectKingSafetyVulnerability(chess: Chess, turn: "w" | "b"): { score: number; keys: string[] } {
  let score = 0;
  const keys: string[] = [];
  const opp = turn === "w" ? "b" : "w";

  if (chess.inCheck()) {
    score += 150;
    keys.push("kc:king_in_check");
  }

  const board = chess.board();
  let kingSq: string | null = null;
  let kr = -1;
  let kf = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === turn) {
        kingSq = p.square;
        kr = r;
        kf = c;
        break;
      }
    }
    if (kingSq) break;
  }
  if (!kingSq) return { score, keys };

  if (turn === "w") {
    const f2Piece = chess.get("f2" as any);
    const isKingNearHome = kr >= 6;
    if (isKingNearHome && (!f2Piece || f2Piece.type !== "p" || f2Piece.color !== "w")) {
      score += 80;
      keys.push("kc:king_f_weakness");
      if (chess.isAttacked("e1" as any, opp) || chess.isAttacked("f2" as any, opp) || chess.isAttacked("g3" as any, opp)) {
        score += 80;
        keys.push("kc:king_diagonal_threat");
      }
    }
  } else {
    const f7Piece = chess.get("f7" as any);
    const isKingNearHome = kr <= 1;
    if (isKingNearHome && (!f7Piece || f7Piece.type !== "p" || f7Piece.color !== "b")) {
      score += 80;
      keys.push("kc:king_f_weakness");
      if (chess.isAttacked("e8" as any, opp) || chess.isAttacked("f7" as any, opp) || chess.isAttacked("g6" as any, opp)) {
        score += 80;
        keys.push("kc:king_diagonal_threat");
      }
    }
  }

  let attackedZoneSquares = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = kr + dr;
      const nc = kf + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const sq = (String.fromCharCode(97 + nc) + (8 - nr)) as any;
        if (chess.isAttacked(sq, opp)) {
          attackedZoneSquares++;
          score += 25;
          if (!chess.isAttacked(sq, turn)) score += 20;
        }
      }
    }
  }

  if (attackedZoneSquares >= 2) keys.push("kc:king_zone_under_siege");
  if (score >= 120) keys.push("kc:king_vuln_high");
  else if (score >= 50) keys.push("kc:king_vuln_med");

  return { score, keys };
}

function detectEnemyPassedPawnRank(chess: Chess, turn: "w" | "b"): { maxRank: number; keys: string[] } {
  const opp = turn === "w" ? "b" : "w";
  const board = chess.board();
  let maxRank = 0;
  const keys: string[] = [];

  const friendlyPawns: { file: number; rank: number }[] = [];
  const enemyPawns: { file: number; rank: number }[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.type !== "p") continue;
      const rank = 8 - r;
      if (p.color === turn) friendlyPawns.push({ file: c, rank });
      else enemyPawns.push({ file: c, rank });
    }
  }

  for (const ep of enemyPawns) {
    let isPassed = true;
    if (opp === "w") {
      for (const fp of friendlyPawns) {
        if (Math.abs(fp.file - ep.file) <= 1 && fp.rank > ep.rank) {
          isPassed = false;
          break;
        }
      }
      if (isPassed && ep.rank > maxRank) maxRank = ep.rank;
    } else {
      for (const fp of friendlyPawns) {
        if (Math.abs(fp.file - ep.file) <= 1 && fp.rank < ep.rank) {
          isPassed = false;
          break;
        }
      }
      if (isPassed) {
        const advancement = 9 - ep.rank;
        if (advancement > maxRank) maxRank = advancement;
      }
    }
  }

  if (maxRank >= 4) keys.push(`kc:enemy_passed_pawn_rank_${maxRank}`);
  return { maxRank, keys };
}

function detectPinnedPieces(chess: Chess, turn: "w" | "b"): { pinned: PinnedPieceDetail[]; keys: string[] } {
  const board = chess.board();
  const pinned: PinnedPieceDetail[] = [];
  const keys: string[] = [];

  let kingPos: { r: number; c: number; sq: string } | null = null;
  let queenPos: { r: number; c: number; sq: string } | null = null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === turn) {
        if (p.type === "k") kingPos = { r, c, sq: p.square };
        else if (p.type === "q" && !queenPos) queenPos = { r, c, sq: p.square };
      }
    }
  }

  const checkPinToTarget = (target: { r: number; c: number; sq: string }, pinnedTo: "k" | "q") => {
    const dirs = [
      { dr: -1, dc: -1, diag: true },
      { dr: -1, dc: 1, diag: true },
      { dr: 1, dc: -1, diag: true },
      { dr: 1, dc: 1, diag: true },
      { dr: -1, dc: 0, diag: false },
      { dr: 1, dc: 0, diag: false },
      { dr: 0, dc: -1, diag: false },
      { dr: 0, dc: 1, diag: false },
    ];

    for (const d of dirs) {
      let r = target.r + d.dr;
      let c = target.c + d.dc;
      let friendlyShield: { r: number; c: number; piece: string; sq: string } | null = null;

      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const p = board[r][c];
        if (p) {
          if (p.color === turn) {
            if (!friendlyShield) friendlyShield = { r, c, piece: p.type, sq: p.square };
            else break;
          } else {
            if (friendlyShield) {
              const isSlider = d.diag
                ? p.type === "b" || p.type === "q"
                : p.type === "r" || p.type === "q";
              if (isSlider) {
                pinned.push({
                  square: friendlyShield.sq,
                  piece: friendlyShield.piece,
                  pinnedTo,
                  isAbsolute: pinnedTo === "k",
                });
                keys.push(`kc:pin_${pinnedTo === "k" ? "absolute" : "relative"}:${friendlyShield.piece}`);
              }
            }
            break;
          }
        }
        r += d.dr;
        c += d.dc;
      }
    }
  };

  if (kingPos) checkPinToTarget(kingPos, "k");
  if (queenPos) checkPinToTarget(queenPos, "q");

  return { pinned, keys };
}

export function extractPositionMotifs(pos: string | Chess): PositionMotifs {
  const chess = typeof pos === "string" ? new Chess(pos) : pos;
  const turn = chess.turn();

  const king = detectKingSafetyVulnerability(chess, turn);
  const passed = detectEnemyPassedPawnRank(chess, turn);
  const pin = detectPinnedPieces(chess, turn);

  const motifKeys = Array.from(new Set([...king.keys, ...passed.keys, ...pin.keys]));

  return {
    kingSafetyVulnerability: king.score,
    enemyPassedPawnRank: passed.maxRank,
    pinnedPieces: pin.pinned,
    motifKeys,
  };
}

export function getMotifValence(motifs: PositionMotifs): number {
  let totalValence = 0;
  for (const key of motifs.motifKeys) {
    const base = DEFAULT_KC_VALENCE[key] ?? 0;
    const learned = learnedMotifWeights[key] ?? 0;
    totalValence += base + learned;
  }
  return totalValence;
}

export function recallMotifValence(pos: string | Chess): number {
  const motifs = extractPositionMotifs(pos);
  return getMotifValence(motifs);
}

export function isMoveSteppingIntoAbsolutePin(
  chess: Chess,
  uci: string,
): { isPinned: boolean; piece?: string; pinnedTo?: string } {
  try {
    const ch = new Chess(chess.fen());
    const mover = ch.turn();
    const app = ch.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || undefined,
    });
    if (!app) return { isPinned: false };

    const board = ch.board();
    let kingSq: string | null = null;
    let kr = -1;
    let kc = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === "k" && p.color === mover) {
          kingSq = p.square;
          kr = r;
          kc = c;
          break;
        }
      }
      if (kingSq) break;
    }
    if (!kingSq) return { isPinned: false };

    const toCol = uci.charCodeAt(2) - 97;
    const toRow = 8 - parseInt(uci[3], 10);

    const dc = Math.sign(kc - toCol);
    const dr = Math.sign(kr - toRow);

    const isSameRank = dr === 0 && dc !== 0;
    const isSameFile = dc === 0 && dr !== 0;
    const isSameDiag = Math.abs(kc - toCol) === Math.abs(kr - toRow) && dc !== 0 && dr !== 0;

    if (!isSameRank && !isSameFile && !isSameDiag) return { isPinned: false };

    let r = toRow + dr;
    let c = toCol + dc;
    while (r !== kr || c !== kc) {
      if (board[r]?.[c]) return { isPinned: false };
      r += dr;
      c += dc;
    }

    const oppColor = mover === "w" ? "b" : "w";
    let ar = toRow - dr;
    let ac = toCol - dc;
    while (ar >= 0 && ar < 8 && ac >= 0 && ac < 8) {
      const p = board[ar][ac];
      if (p) {
        if (p.color === oppColor) {
          const isSlider = isSameDiag
            ? p.type === "b" || p.type === "q"
            : p.type === "r" || p.type === "q";
          if (isSlider) {
            return { isPinned: true, piece: app.piece, pinnedTo: "k" };
          }
        }
        break;
      }
      ar -= dr;
      ac -= dc;
    }

    return { isPinned: false };
  } catch {
    return { isPinned: false };
  }
}

export function isKingWeakeningMove(chess: Chess, uci: string): boolean {
  try {
    const mover = chess.turn();
    const ch = new Chess(chess.fen());
    const app = ch.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || undefined,
    });
    if (!app) return false;
    if (app.captured || app.san.includes("+") || app.san.includes("#")) return false;

    const totalPieces = chess.board().flat().filter(Boolean).length;
    if (totalPieces <= 10) return false;

    if (app.piece === "p") {
      if (mover === "b" && (uci.startsWith("f7") || uci === "f7f6" || uci === "f7f5")) {
        const kingSq = findKingSquare(ch, "b");
        if (kingSq && (kingSq.endsWith("8") || kingSq.endsWith("7"))) return true;
      }
      if (mover === "w" && (uci.startsWith("f2") || uci === "f2f3" || uci === "f2f4")) {
        const kingSq = findKingSquare(ch, "w");
        if (kingSq && (kingSq.endsWith("1") || kingSq.endsWith("2"))) return true;
      }
    }

    const preVuln = detectKingSafetyVulnerability(chess, mover).score;
    const postVuln = detectKingSafetyVulnerability(ch, mover).score;
    if (postVuln >= preVuln + 60 && postVuln >= 100) return true;

    return false;
  } catch {
    return false;
  }
}

export function isMoveSuicidalPieceLoss(
  chess: Chess,
  uci: string,
): { isSuicidal: boolean; piece?: string; netLoss?: number } {
  try {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const piece = chess.get(from as any);
    if (!piece) return { isSuicidal: false };

    const values: Record<string, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 20000 };
    const pieceVal = values[piece.type] || 0;
    const targetPiece = chess.get(to as any);
    const capturedVal = targetPiece ? values[targetPiece.type] || 0 : 0;

    const clone = new Chess(chess.fen());
    const m = clone.move({ from, to, promotion: uci[4] || undefined });
    if (!m) return { isSuicidal: false };
    if (clone.isCheckmate()) return { isSuicidal: false };

    const oppMoves = clone.moves({ verbose: true });
    const capturesOfTarget = oppMoves.filter((om: any) => om.to === to);
    if (capturesOfTarget.length > 0) {
      const netLoss = pieceVal - capturedVal;
      if (
        (piece.type === "q" && netLoss >= 300) ||
        (piece.type === "r" && netLoss >= 250) ||
        (piece.type === "b" && netLoss >= 150) ||
        (piece.type === "n" && netLoss >= 150)
      ) {
        return { isSuicidal: true, piece: piece.type, netLoss };
      }
    }
  } catch (_) {}
  return { isSuicidal: false };
}

export function doesMoveLeaveAttackedPieceHanging(
  chess: Chess,
  uci: string,
): { leavesHanging: boolean; piece?: string; lostValue?: number } {
  try {
    const values: Record<string, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 20000 };
    const clone = new Chess(chess.fen());
    const m = clone.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    if (!m) return { leavesHanging: false };
    if (clone.isCheckmate()) return { leavesHanging: false };

    const oppMoves = clone.moves({ verbose: true });
    for (const om of oppMoves) {
      if (om.captured && om.captured !== "p") {
        const victimVal = values[om.captured] || 0;
        // Kasus 1: Perwira kita dipukul pion lawan (seperti b4xa5 makan Benteng)
        if (om.piece === "p" && victimVal >= 300) {
          return { leavesHanging: true, piece: om.captured, lostValue: victimVal - 100 };
        }
        // Kasus 2: Perwira kita dipukul gratis tanpa ada balasan (seperti Qxb7 makan Gajah gratis)
        const testCap = new Chess(clone.fen());
        testCap.move(om);
        const recaptures = testCap.moves({ verbose: true }).filter((rec: any) => rec.to === om.to);
        if (recaptures.length === 0 && victimVal >= 300) {
          return { leavesHanging: true, piece: om.captured, lostValue: victimVal };
        }
      }
    }
  } catch (_) {}
  return { leavesHanging: false };
}

const DB_PATH = path.join(process.env.JEV_DATA_DIR || path.join(process.cwd(), "data"), "experience.json");
let memCache: Record<string, ExperienceEntry> | null = null;
let lastDbMtime: number = 0;

function loadDb(): Record<string, ExperienceEntry> {
  try {
    if (fs.existsSync(DB_PATH)) {
      const stat = fs.statSync(DB_PATH);
      if (memCache && stat.mtimeMs === lastDbMtime) {
        return memCache;
      }
      memCache = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      lastDbMtime = stat.mtimeMs;
      return memCache!;
    }
  } catch {}
  if (!memCache) memCache = {};
  return memCache;
}

function saveDb(): void {
  if (!memCache) return;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(memCache, null, 2), "utf-8");
    try {
      lastDbMtime = fs.statSync(DB_PATH).mtimeMs;
    } catch {}
  } catch {}
}

/** Simplify FEN to board + turn + castling rights for transposition matching */
export function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return parts.slice(0, 4).join(" ");
}

export function getLearnedMove(fen: string): { move: string; score: number; dopamine: number } | null {
  const db = loadDb();
  const entry = db[normalizeFen(fen)];
  if (entry?.bestMove && (entry.dopamine ?? 0) >= 0) {
    return { move: entry.bestMove, score: entry.score ?? 0, dopamine: entry.dopamine ?? 0 };
  }
  return null;
}

const START_FEN_NORMALIZED = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

export function isBlunderMove(fen: string, move: string): boolean {
  // Posisi awal catur tidak pernah memiliki blunder pada langkah ke-1
  if (normalizeFen(fen) === START_FEN_NORMALIZED) {
    return false;
  }

  const db = loadDb();
  const entry = db[normalizeFen(fen)];
  return Array.isArray(entry?.blunders) && entry.blunders.includes(move);
}

export function recordMatchExperience(
  fen: string,
  provenMove?: string,
  score?: number,
  blunderedMove?: string,
): void {
  try {
    const ch = new Chess(fen);
    const legal = new Set(ch.moves({ verbose: true }).map((m: any) => m.from + m.to + (m.promotion || "")));

    const db = loadDb();
    const key = normalizeFen(fen);
    const entry = db[key] || { timesEncountered: 0 };

    entry.timesEncountered = (entry.timesEncountered || 0) + 1;

    // Pastikan langkah yang disimpan memang legal untuk FEN ini
    if (provenMove && legal.has(provenMove)) {
      entry.bestMove = provenMove;
      if (typeof score === "number") entry.score = score;
    }

    if (blunderedMove && legal.has(blunderedMove) && blunderedMove !== entry.bestMove) {
      entry.blunders = Array.from(new Set([...(entry.blunders || []), blunderedMove]));
    }

    db[key] = entry;
    saveDb();
  } catch {
    // Ignore invalid FEN
  }
}

/**
 * PAM-DAN Mushroom Body Dopamine Reinforcement:
 * Ketika pertandingan selesai dengan kemenangan, lonjakan dopamin (+400 PAM) diberikan
 * ke seluruh rangkaian langkah yang membawa kemenangan, memperkuat plastisitas sinaptik.
 * Langkah pihak yang kalah dipotong dopaminnya (-300 PPL1) dan langkah terakhir dicatat sebagai blunder.
 */
export function reinforceMatchDopamine(history: string[], winningColor: "white" | "black"): void {
  if (!Array.isArray(history) || history.length === 0) return;
  try {
    const ch = new Chess();
    const winningMoves: { fen: string; uci: string }[] = [];
    const losingMoves: { fen: string; uci: string }[] = [];

    for (const moveStr of history) {
      const fenBefore = ch.fen();
      const turn = ch.turn() === "w" ? "white" : "black";
      let applied = null;
      try {
        applied = ch.move(moveStr);
      } catch {
        try {
          applied = ch.move({
            from: moveStr.slice(0, 2),
            to: moveStr.slice(2, 4),
            promotion: moveStr[4] || undefined,
          });
        } catch {}
      }
      if (!applied) break;

      const uci = applied.from + applied.to + (applied.promotion || "");
      if (turn === winningColor) {
        winningMoves.push({ fen: fenBefore, uci });
      } else {
        losingMoves.push({ fen: fenBefore, uci });
      }
    }

    const db = loadDb();

    // 1. Dopamine Surge (+400 PAM) untuk langkah pemenang
    for (const item of winningMoves) {
      const key = normalizeFen(item.fen);
      const entry = db[key] || { timesEncountered: 0 };
      entry.timesEncountered = (entry.timesEncountered || 0) + 1;
      entry.dopamine = Math.min(1000, (entry.dopamine || 0) + 400);
      entry.bestMove = item.uci;
      entry.score = Math.max(entry.score ?? 50, 100);
      db[key] = entry;

      try {
        const m = extractPositionMotifs(item.fen);
        for (const k of m.motifKeys) {
          learnedMotifWeights[k] = (learnedMotifWeights[k] ?? 0) + 10;
        }
      } catch {}
    }

    // 2. Aversive Depression (-300 PPL1) untuk rangkaian langkah kritis pihak yang kalah
    if (losingMoves.length > 0) {
      // Rekam hingga 6 langkah terakhir pihak yang kalah sebagai zona blunder kritis
      const recentLosing = losingMoves.slice(-6);
      for (const fatalMove of recentLosing) {
        const key = normalizeFen(fatalMove.fen);
        const entry = db[key] || { timesEncountered: 0 };
        entry.timesEncountered = (entry.timesEncountered || 0) + 1;
        entry.dopamine = Math.max(-1000, (entry.dopamine || 0) - 300);
        entry.blunders = Array.from(new Set([...(entry.blunders || []), fatalMove.uci]));
        db[key] = entry;

        try {
          const m = extractPositionMotifs(fatalMove.fen);
          for (const k of m.motifKeys) {
            learnedMotifWeights[k] = (learnedMotifWeights[k] ?? 0) - 20;
          }
        } catch {}
      }
    }

    saveDb();
  } catch {}
}
