/**
 * app/api/pvp/route.ts
 * PvP Online game session management.
 * Mirrors chess.com multiplayer flow: invite via username → create room → join → play.
 *
 * GET  /api/pvp           list active games for current user
 * POST /api/pvp/create    { opponentUsername, color? } → create game room
 * POST /api/pvp/join      { gameId } → join as second player
 * POST /api/pvp/move      { gameId, san, fen } → record a move
 * GET  /api/pvp/[id]      get game state + moves
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser, loadUsers } from "@/lib/auth-store";
import { validateFen } from "chess.js";

export const runtime = "nodejs";

// Rate limiting (in-memory, single instance) — mirrors existing PvP route
const rate = new Map<string, { count: number; until: number }>();
function tooManyRequests(ip: string) {
  const now = Date.now();
  const rec = rate.get(ip);
  if (!rec || rec.until < now) {
    rate.set(ip, { count: 1, until: now + 60_000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 120;
}
function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

async function currentUserId(request: Request): Promise<string | null> {
  // Identity comes from the signed auth-store session (jev_session cookie),
  // the same source AdminPanel/community use. The jev_gate cookie carries no
  // userId and was previously trusted as one - letting clients impersonate
  // arbitrary user rows (bug F-4).
  try {
    const users = await loadUsers();
    const me = currentUser(request, users);
    return me ? me.id : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const ip = clientIp(request);
  if (tooManyRequests(ip)) {
    return NextResponse.json({ error: "Terlalu banyak request. Coba lagi nanti.", retryable: true }, { status: 429 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    // Single game detail
    const rows = await query(
      `SELECT g.id, g.white_user_id, g.black_user_id, g.status, g.result,
              g.started_at, g.ended_at, g.created_at,
              w.username AS white_username, w.rating AS white_rating,
              b.username AS black_username, b.rating AS black_rating
       FROM games g
       LEFT JOIN users w ON w.id = g.white_user_id
       LEFT JOIN users b ON b.id = g.black_user_id
       WHERE g.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Game not found.", retryable: false }, { status: 404 });
    }
    const game = rows[0];
    const moves = await query(
      `SELECT move_number, san, fen, played_at FROM game_moves
       WHERE game_id = $1 ORDER BY move_number ASC`,
      [id]
    );
    return NextResponse.json({ game, moves: moves as any[] });
  }

  // List active games
  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }

  const rows = await query(
    `SELECT g.id, g.white_user_id, g.black_user_id, g.status, g.result,
              g.started_at, g.ended_at, g.created_at,
              w.username AS white_username, w.rating AS white_rating,
              b.username AS black_username, b.rating AS black_rating
       FROM games g
       LEFT JOIN users w ON w.id = g.white_user_id
       LEFT JOIN users b ON b.id = g.black_user_id
       WHERE (g.white_user_id = $1 OR g.black_user_id = $1)
       ORDER BY g.updated_at DESC
       LIMIT 50`,
      [userId]
    );
  return NextResponse.json({ games: rows });
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (tooManyRequests(ip)) {
    return NextResponse.json({ error: "Terlalu banyak request. Coba lagi nanti.", retryable: true }, { status: 429 });
  }

  const url = new URL(request.url);
  const op = url.searchParams.get("op") || "create";

  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required. Login first.", retryable: false }, { status: 401 });
  }

  if (op === "create") {
    return handleCreate(request, userId);
  }
  if (op === "join") {
    return handleJoin(request, userId);
  }
  if (op === "move") {
    return handleMove(request, userId);
  }
  return NextResponse.json({ error: "Unknown op.", retryable: false }, { status: 400 });
}

async function handleCreate(request: Request, userId: string) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const opponentUsername = obj.opponentUsername;
  const color = obj.color === "b" ? "b" : "w"; // default white

  if (typeof opponentUsername !== "string" || opponentUsername.trim().length === 0) {
    return NextResponse.json({ error: "Missing 'opponentUsername'.", retryable: false }, { status: 400 });
  }

  // Look up opponent
  const oppRows = await query("SELECT id FROM users WHERE username = $1 LIMIT 1", [opponentUsername.trim()]);
  if (oppRows.length === 0) {
    return NextResponse.json({ error: "Pemain tidak ditemukan.", retryable: false }, { status: 404 });
  }
  const opponentId = (oppRows[0] as { id: string }).id;
  if (opponentId === userId) {
    return NextResponse.json({ error: "Tantang lawan lain (bukan diri sendiri).", retryable: false }, { status: 400 });
  }

  const whiteId = color === "w" ? userId : opponentId;
  const blackId = color === "w" ? opponentId : userId;
  const gameId = genUuid();

  await query(
    `INSERT INTO games (id, white_user_id, black_user_id, status, result, started_at, created_at)
     VALUES ($1, $2, $3, 'active', '*', NOW(), NOW())`,
    [gameId, whiteId, blackId]
  );

  // eslint-disable-next-line no-console
  console.info(`[jev-chess] PvP room created: ${gameId} ${userId} vs ${opponentId}`);

  return NextResponse.json({
    ok: true,
    gameId,
    white: whiteId === userId ? "Anda" : opponentUsername,
    black: blackId === userId ? "Anda" : opponentUsername,
    yourColor: color,
  }, { status: 201 });
}

async function handleJoin(request: Request, userId: string) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const gameId = obj.gameId;

  if (typeof gameId !== "string") {
    return NextResponse.json({ error: "Missing 'gameId'.", retryable: false }, { status: 400 });
  }

  const rows = await query(
    `SELECT id, white_user_id, black_user_id, status FROM games WHERE id = $1 LIMIT 1`,
    [gameId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Game tidak ditemukan.", retryable: false }, { status: 404 });
  }
  const game = rows[0] as { white_user_id: string; black_user_id: string; status: string };
  if (game.status !== "active") {
    return NextResponse.json({ error: "Game sudah selesai.", retryable: false }, { status: 400 });
  }
  if (game.white_user_id !== userId && game.black_user_id !== userId) {
    return NextResponse.json({ error: "Anda bukan peserta game ini.", retryable: false }, { status: 403 });
  }

  return NextResponse.json({ ok: true, gameId, yourColor: game.white_user_id === userId ? "w" : "b" });
}

async function handleMove(request: Request, userId: string) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const gameId = obj.gameId;
  const san = obj.san;
  const fen = obj.fen;

  if (typeof gameId !== "string" || typeof san !== "string" || typeof fen !== "string") {
    return NextResponse.json({ error: "Missing gameId/san/fen.", retryable: false }, { status: 400 });
  }
  const fenCheck = validateFen(fen);
  if (!fenCheck.ok) {
    return NextResponse.json({ error: "Invalid FEN.", retryable: false }, { status: 400 });
  }

  const rows = await query(
    `SELECT id, white_user_id, black_user_id, status FROM games WHERE id = $1 LIMIT 1`,
    [gameId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Game tidak ditemukan.", retryable: false }, { status: 404 });
  }
  const game = rows[0] as { white_user_id: string; black_user_id: string; status: string };
  if (game.status !== "active") {
    return NextResponse.json({ error: "Game sudah selesai.", retryable: false }, { status: 400 });
  }
// Server-authoritative move: rebuild position from the last stored FEN
  // (or the start position), apply the submitted SAN, and accept the client
  // FEN only when it matches the resulting position. Clients can no longer
  // submit arbitrary positions (QA critical finding).
  const { Chess } = await import("chess.js");
  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const prevMoves = await query(
    `SELECT fen FROM game_moves WHERE game_id = $1 ORDER BY move_number DESC LIMIT 1`,
    [gameId]
  );
  const baseFen = prevMoves.length > 0
    ? String((prevMoves[0] as { fen: string }).fen)
    : START_FEN;
  if (!validateFen(baseFen).ok) {
    return NextResponse.json({ error: "Posisi game korup.", retryable: true }, { status: 500 });
  }

  const base = new Chess(baseFen);
  const moverColor = base.turn() === "w" ? "w" : "b";
  const expectedUserId = moverColor === "w" ? game.white_user_id : game.black_user_id;
  if (expectedUserId !== userId) {
    return NextResponse.json({ error: "Bukan giliran Anda.", retryable: false }, { status: 403 });
  }

  let applied;
  try {
    applied = base.move(san);
  } catch {
    return NextResponse.json({ error: "Langkah tidak legal.", retryable: false }, { status: 400 });
  }
  if (!applied) {
    return NextResponse.json({ error: "Langkah tidak legal.", retryable: false }, { status: 400 });
  }
  const resultingFen = base.fen();
  if (fen && fen !== resultingFen) {
    return NextResponse.json({ error: "FEN tidak cocok dengan langkah yang disubmit.", retryable: false }, { status: 400 });
  }

  const moveNumber = base.history().length;
  await query(
    `INSERT INTO game_moves (id, game_id, move_number, san, fen, played_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
    [gameId, moveNumber, applied.san, resultingFen]
  );

  if (base.isGameOver()) {
    const result = base.isCheckmate() ? (moverColor === "w" ? "white" : "black") : "draw";
    await query(`UPDATE games SET status = 'finished', result = $1, ended_at = NOW() WHERE id = $2`, [result, gameId]);
  }

  return NextResponse.json({ ok: true, moveNumber, san: applied.san, fen: resultingFen, gameOver: base.isGameOver() });
}

function genUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
