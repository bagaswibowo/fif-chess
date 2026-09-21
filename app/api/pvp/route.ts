import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { randomBytes, randomUUID } from "crypto";

type PvpRoom = {
  code: string;
  createdAt: number;
  lastActive: number;
  whiteUser: string;
  whiteToken: string;
  blackUser: string | null;
  blackToken: string | null;
  fen: string;
  moves: string[];
  turn: "w" | "b";
  status: "waiting" | "active" | "finished";
  winner?: "white" | "black" | "draw" | null;
  outcomeKind?: string;
};

// Global in-memory rooms map for single-instance Docker monolith on sxz-server
const rooms = new Map<string, PvpRoom>();

// IP Rate Limiting (60 requests per minute max)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

function isLoopback(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost"
  );
}

function checkRateLimit(ip: string): boolean {
  // Always permit loopback traffic for Docker healthchecks and container testing
  if (isLoopback(ip)) {
    return true;
  }
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || now > entry.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (entry.count >= 60) {
    return false;
  }
  entry.count++;
  return true;
}

// Stochastic TTL cleanup (runs ~5% of requests to avoid hot-path latency)
function maybePruneStaleRooms() {
  if (Math.random() > 0.05) return;
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;
  for (const [code, r] of rooms.entries()) {
    if (now - r.lastActive > maxAge) {
      rooms.delete(code);
    }
  }
  for (const [ip, entry] of ipRequestCounts.entries()) {
    if (now > entry.resetTime) {
      ipRequestCounts.delete(ip);
    }
  }
}

// Normalized IP resolution: prioritize Cloudflare header, fallback to proxy headers or loopback
function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  maybePruneStaleRooms();
  const url = new URL(req.url);
  const code = url.searchParams.get("room")?.toUpperCase();

  if (!code || !rooms.has(code)) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const room = rooms.get(code)!;
  return NextResponse.json({
    room: {
      code: room.code,
      createdAt: room.createdAt,
      lastActive: room.lastActive,
      whiteUser: room.whiteUser,
      blackUser: room.blackUser,
      fen: room.fen,
      moves: room.moves,
      turn: room.turn,
      status: room.status,
      winner: room.winner,
      outcomeKind: room.outcomeKind,
    },
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  maybePruneStaleRooms();

  try {
    const body = await req.json();
    const { action } = body;

    // 1. CREATE ROOM
    if (action === "create") {
      const username = String(body.username || "Pemain 1").slice(0, 30);
      const hexCode = randomBytes(3).toString("hex").toUpperCase();
      const code = `FIF-${hexCode}`;
      const whiteToken = randomUUID();

      const newRoom: PvpRoom = {
        code,
        createdAt: Date.now(),
        lastActive: Date.now(),
        whiteUser: username,
        whiteToken,
        blackUser: null,
        blackToken: null,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves: [],
        turn: "w",
        status: "waiting",
      };

      rooms.set(code, newRoom);
      return NextResponse.json({
        success: true,
        room: {
          code: newRoom.code,
          createdAt: newRoom.createdAt,
          lastActive: newRoom.lastActive,
          whiteUser: newRoom.whiteUser,
          blackUser: null,
          fen: newRoom.fen,
          moves: [],
          turn: "w",
          status: "waiting",
        },
        side: "white",
        playerToken: whiteToken,
      });
    }

    // 2. JOIN ROOM
    if (action === "join") {
      const code = String(body.code || "").toUpperCase().trim();
      const username = String(body.username || "Pemain 2").slice(0, 30);

      const room = rooms.get(code);
      if (!room) {
        return NextResponse.json({ error: "Kode kamar tidak ditemukan" }, { status: 404 });
      }

      if (room.status !== "waiting") {
        return NextResponse.json({ error: "Kamar sudah penuh atau sedang bermain" }, { status: 400 });
      }

      const blackToken = randomUUID();
      room.blackUser = username;
      room.blackToken = blackToken;
      room.status = "active";
      room.lastActive = Date.now();

      return NextResponse.json({
        success: true,
        room: {
          code: room.code,
          createdAt: room.createdAt,
          lastActive: room.lastActive,
          whiteUser: room.whiteUser,
          blackUser: room.blackUser,
          fen: room.fen,
          moves: room.moves,
          turn: room.turn,
          status: room.status,
        },
        side: "black",
        playerToken: blackToken,
      });
    }

    // 3. PLAY MOVE
    if (action === "move") {
      const code = String(body.code || "").toUpperCase().trim();
      const { from, to, promotion, side, playerToken } = body;

      const room = rooms.get(code);
      if (!room) {
        return NextResponse.json({ error: "Kamar tidak ditemukan" }, { status: 404 });
      }

      if (room.status !== "active") {
        return NextResponse.json({ error: "Pertandingan belum aktif atau sudah selesai" }, { status: 400 });
      }

      // Security check: verify player token and turn
      if (side === "white") {
        if (!playerToken || playerToken !== room.whiteToken) {
          return NextResponse.json({ error: "Akses ditolak: Token pemain putih tidak valid" }, { status: 403 });
        }
        if (room.turn !== "w") {
          return NextResponse.json({ error: "Bukan giliran Putih" }, { status: 400 });
        }
      } else if (side === "black") {
        if (!playerToken || playerToken !== room.blackToken) {
          return NextResponse.json({ error: "Akses ditolak: Token pemain hitam tidak valid" }, { status: 403 });
        }
        if (room.turn !== "b") {
          return NextResponse.json({ error: "Bukan giliran Hitam" }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: "Sisi tidak valid" }, { status: 400 });
      }

      const chess = new Chess(room.fen);
      const moveRes = chess.move({
        from: String(from),
        to: String(to),
        promotion: promotion ? String(promotion).toLowerCase() : undefined,
      });

      if (!moveRes) {
        return NextResponse.json({ error: "Langkah ilegal" }, { status: 400 });
      }

      room.fen = chess.fen();
      room.moves.push(moveRes.san);
      room.turn = chess.turn();
      room.lastActive = Date.now();

      if (chess.isGameOver()) {
        room.status = "finished";
        if (chess.isCheckmate()) {
          room.winner = room.turn === "w" ? "black" : "white";
          room.outcomeKind = "checkmate";
        } else if (chess.isDraw()) {
          room.winner = "draw";
          room.outcomeKind = "draw";
        }
      }

      return NextResponse.json({
        success: true,
        room: {
          code: room.code,
          createdAt: room.createdAt,
          lastActive: room.lastActive,
          whiteUser: room.whiteUser,
          blackUser: room.blackUser,
          fen: room.fen,
          moves: room.moves,
          turn: room.turn,
          status: room.status,
          winner: room.winner,
          outcomeKind: room.outcomeKind,
        },
      });
    }

    // 4. RESIGN MATCH
    if (action === "resign") {
      const code = String(body.code || "").toUpperCase().trim();
      const { side, playerToken } = body;

      const room = rooms.get(code);
      if (!room) {
        return NextResponse.json({ error: "Kamar tidak ditemukan" }, { status: 404 });
      }

      if (room.status !== "active") {
        return NextResponse.json({ error: "Pertandingan belum aktif atau sudah selesai" }, { status: 400 });
      }

      if (side === "white") {
        if (!playerToken || playerToken !== room.whiteToken) {
          return NextResponse.json({ error: "Akses ditolak: Token pemain tidak valid" }, { status: 403 });
        }
        room.winner = "black";
      } else if (side === "black") {
        if (!playerToken || playerToken !== room.blackToken) {
          return NextResponse.json({ error: "Akses ditolak: Token pemain tidak valid" }, { status: 403 });
        }
        room.winner = "white";
      } else {
        return NextResponse.json({ error: "Sisi tidak valid" }, { status: 400 });
      }

      room.status = "finished";
      room.outcomeKind = "resigned";
      room.lastActive = Date.now();

      return NextResponse.json({
        success: true,
        room: {
          code: room.code,
          createdAt: room.createdAt,
          lastActive: room.lastActive,
          whiteUser: room.whiteUser,
          blackUser: room.blackUser,
          fen: room.fen,
          moves: room.moves,
          turn: room.turn,
          status: room.status,
          winner: room.winner,
          outcomeKind: room.outcomeKind,
        },
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan internal server" }, { status: 500 });
  }
}
