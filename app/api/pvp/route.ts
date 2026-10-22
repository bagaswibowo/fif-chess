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
import { randomBytes, randomUUID } from "crypto";
import { query } from "@/lib/db";
import { currentUser, loadUsers } from "@/lib/auth-store";
import { publishBusEvent } from "@/lib/realtime/bus.ts";
import { gameTopic, type GameStarted, type MoveMade } from "@/lib/realtime/events.ts";
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
  let bodyAction = "";
  try {
    const peek = (await request.clone().json()) as Record<string, unknown>;
    if (typeof peek.action === "string") bodyAction = peek.action;
  } catch { /* not JSON */ }
  const op = bodyAction || url.searchParams.get("op") || "create";

  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required. Login first.", retryable: false }, { status: 401 });
  }

  // Live room lifecycle first (matches PvpPanel client actions)
  if (op === "create") return roomCreate(request, userId);
  if (op === "join") return roomJoin(request, userId);
  if (op === "move") return roomMove(request, userId);
  if (op === "leave") return roomLeave(request, userId);
  if (op === "resign" || op === "draw") return roomOutcome(request, userId, op);
  // Legacy DB-backed game records (opt-in via op=db-*)
  if (op === "db-create") return handleCreate(request, userId);
  if (op === "db-join") return handleJoin(request, userId);
  if (op === "db-move") return handleMove(request, userId);
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
  const tc = typeof obj.timeControl === "string" && /^\d+\+\d+$/.test(obj.timeControl.trim())
    ? obj.timeControl.trim().slice(0, 10)
    : null;

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
    // S2-T2: game_type/time_control wajib (docs/db/sprint2.md) — pvp = live.
    // time_control "db-create" legacy tidak dikirim client → default "10+0".
    `INSERT INTO games (id, white_user_id, black_user_id, status, result, started_at, created_at, time_control, game_type)
     VALUES ($1, $2, $3, 'active', '*', NOW(), NOW(), $4, 'live')`,
    [gameId, whiteId, blackId, tc ?? "10+0"]
  );

  // eslint-disable-next-line no-console
  console.info(`[jev-chess] PvP room created: ${gameId} ${userId} vs ${opponentId}`);

  const gameStarted: GameStarted = { type: "game_started", gameId, white: whiteId, black: blackId };
  publishBusEvent(gameTopic(gameId), gameStarted);

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

  // ADR-002 §4: setelah game row di-join, publish GameStarted agar lawan
  // (dan seluruh subscriber topik game) menerima event game mulai.
  const gameStarted: GameStarted = {
    type: "game_started",
    gameId,
    white: game.white_user_id,
    black: game.black_user_id,
  };
  publishBusEvent(gameTopic(gameId), gameStarted);

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

  const moveMade: MoveMade = { type: "move_made", gameId, san: applied.san, fen: resultingFen, moveNumber };
  publishBusEvent(gameTopic(gameId), moveMade);

  return NextResponse.json({ ok: true, moveNumber, san: applied.san, fen: resultingFen, gameOver: base.isGameOver() });
}

function genUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ── In-memory room lifecycle (restored from 95c4c1ea) ─────────────────
   Kamar hilang saat restart & setelah 30 menit idle — cukup untuk
   sparring komunitas. Kalau butuh lintas instance, pindahkan ke Redis. */
type PvpRoom = {
  code: string;
  createdAt: number;
  lastActive: number;
  whiteUser: string | null;
  whiteToken: string | null;
  blackUser: string | null;
  blackToken: string | null;
  creatorUser: string;
  creatorSide: "white" | "black";
  invitedUser: string | null;
  fen: string;
  moves: string[];
  turn: "w" | "b";
  status: "waiting" | "active" | "finished";
  winner?: "white" | "black" | "draw" | null;
  outcomeKind?: string;
};
const rooms = new Map<string, PvpRoom>();
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function prune() {
  const now = Date.now();
  for (const [code, r] of rooms) if (now - r.lastActive > 30 * 60_000) rooms.delete(code);
}

function publicRoom(r: PvpRoom) {
  return {
    code: r.code, status: r.status, fen: r.fen, moves: r.moves, turn: r.turn,
    whiteUser: r.whiteUser, blackUser: r.blackUser, invitedUser: r.invitedUser,
    winner: r.winner ?? null, outcomeKind: r.outcomeKind ?? null,
  };
}

function sideOf(r: PvpRoom, token: string, username: string): "white" | "black" | null {
  if (r.whiteToken && r.whiteToken === token && r.whiteUser === username) return "white";
  if (r.blackToken && r.blackToken === token && r.blackUser === username) return "black";
  return null;
}

async function roomCreate(request: Request, userId: string) {
  const users = await loadUsers();
  const me = users.find((u) => u.id === userId);
  if (!me) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }

  // Undangan by username: hanya akun approved yang boleh diundang.
  let invitedUser: string | null = null;
  const raw = String(body.invitedUser || "").trim().toLowerCase();
  if (raw) {
    const target = users.find((u) => u.username === raw);
    if (!target) return NextResponse.json({ error: `Username @${raw} tidak terdaftar.` }, { status: 404 });
    if (target.status !== "approved") {
      return NextResponse.json({ error: `@${target.username} belum disetujui admin.` }, { status: 403 });
    }
    if (target.username === me.username) {
      return NextResponse.json({ error: "Tidak bisa mengundang diri sendiri." }, { status: 400 });
    }
    invitedUser = target.username;
  }

  let side: "white" | "black" = body.side === "black" ? "black" : "white";
  if (body.side === "random") side = Math.random() < 0.5 ? "white" : "black";

  const token = randomUUID();
  const room: PvpRoom = {
    code: "FIF-" + randomBytes(3).toString("hex").toUpperCase(),
    createdAt: Date.now(),
    lastActive: Date.now(),
    whiteUser: side === "white" ? me.username : null,
    whiteToken: side === "white" ? token : null,
    blackUser: side === "black" ? me.username : null,
    blackToken: side === "black" ? token : null,
    creatorUser: me.username,
    creatorSide: side,
    invitedUser,
    fen: START_FEN,
    moves: [],
    turn: "w",
    status: "waiting",
  };
  rooms.set(room.code, room);
  return NextResponse.json({ success: true, room: publicRoom(room), yourSide: side, playerToken: token });
}

async function roomJoin(request: Request, userId: string) {
  const users = await loadUsers();
  const me = users.find((u) => u.id === userId);
  if (!me) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  prune();
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  const code = String(body.code || "").toUpperCase().trim();

  const room = rooms.get(code);
  if (!room) return NextResponse.json({ error: "Kode kamar tidak ditemukan." }, { status: 404 });
  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Kamar sudah terisi atau pertandingan berjalan." }, { status: 400 });
  }
  if (room.invitedUser && room.invitedUser !== me.username) {
    return NextResponse.json({ error: `Undangan ini khusus untuk @${room.invitedUser}.` }, { status: 403 });
  }
  if (room.creatorUser === me.username) {
    return NextResponse.json({ error: "Kamu yang membuat kamar ini." }, { status: 400 });
  }

  const token = randomUUID();
  if (room.creatorSide === "white") {
    room.blackUser = me.username;
    room.blackToken = token;
  } else {
    room.whiteUser = me.username;
    room.whiteToken = token;
  }
  room.status = "active";
  room.lastActive = Date.now();
  return NextResponse.json({ success: true, room: publicRoom(room), yourSide: room.creatorSide === "white" ? "black" : "white", playerToken: token });
}

async function roomMove(request: Request, userId: string) {
  const users = await loadUsers();
  const me = users.find((u) => u.id === userId);
  if (!me) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  prune();
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  const code = String(body.code || "").toUpperCase().trim();
  const playerToken = String(body.playerToken || "");

  const room = rooms.get(code);
  if (!room) return NextResponse.json({ error: "Kamar tidak ditemukan." }, { status: 404 });
  if (room.status !== "active") return NextResponse.json({ error: "Pertandingan tidak aktif." }, { status: 400 });

  const side = sideOf(room, playerToken, me.username);
  if (!side) return NextResponse.json({ error: "Token pemain tidak valid." }, { status: 403 });
  if (room.turn !== (side === "white" ? "w" : "b")) {
    return NextResponse.json({ error: "Bukan giliranmu." }, { status: 409 });
  }

  const { Chess } = await import("chess.js");
  const chess = new Chess(room.fen);
  let res = null;
  try {
    res = chess.move({
      from: String(body.from),
      to: String(body.to),
      promotion: body.promotion ? String(body.promotion).toLowerCase() : undefined,
    });
  } catch {
    res = null;
  }
  if (!res) return NextResponse.json({ error: "Langkah ilegal." }, { status: 400 });

  room.fen = chess.fen();
  room.moves.push(res.san);
  room.turn = room.turn === "w" ? "b" : "w";
  room.lastActive = Date.now();

  if (chess.isGameOver()) {
    room.status = "finished";
    room.winner = chess.isCheckmate() ? (side === "white" ? "white" : "black") : "draw";
    room.outcomeKind = chess.isCheckmate() ? "checkmate" : chess.isDraw() ? "draw" : "resign";
  }

  return NextResponse.json({ success: true, room: publicRoom(room) });
}

async function roomLeave(request: Request, userId: string) {
  const users = await loadUsers();
  const me = users.find((u) => u.id === userId);
  if (!me) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  const code = String(body.code || "").toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) return NextResponse.json({ error: "Kamar tidak ditemukan." }, { status: 404 });
  if (room.creatorUser === me.username || room.whiteUser === me.username || room.blackUser === me.username) {
    rooms.delete(code);
  }
  return NextResponse.json({ success: true });
}

async function roomOutcome(request: Request, userId: string, op: "resign" | "draw") {
  const users = await loadUsers();
  const me = users.find((u) => u.id === userId);
  if (!me) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  const code = String(body.code || "").toUpperCase().trim();
  const playerToken = String(body.playerToken || "");

  const room = rooms.get(code);
  if (!room || room.status !== "active") {
    return NextResponse.json({ error: "Pertandingan tidak aktif." }, { status: 400 });
  }
  const side = sideOf(room, playerToken, me.username);
  if (!side) return NextResponse.json({ error: "Token pemain tidak valid." }, { status: 403 });

  room.status = "finished";
  room.outcomeKind = op;
  room.winner = op === "resign" ? (side === "white" ? "black" : "white") : "draw";
  return NextResponse.json({ success: true, room: publicRoom(room) });
}
