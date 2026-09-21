import { NextResponse } from "next/server";
import { Chess } from "chess.js";

type PvpRoom = {
  code: string;
  createdAt: number;
  lastActive: number;
  whiteUser: string;
  blackUser: string | null;
  fen: string;
  moves: string[];
  turn: "w" | "b";
  status: "waiting" | "active" | "finished";
  winner?: "white" | "black" | "draw";
  outcomeKind?: string;
};

// Global in-memory storage for active PvP matches
// Note: Survives between client requests in Next.js Node.js server process
const rooms = new Map<string, PvpRoom>();

function pruneStaleRooms() {
  const now = Date.now();
  if (rooms.size > 200) {
    for (const [code, room] of rooms.entries()) {
      if (now - room.lastActive > 2 * 3600 * 1000) {
        rooms.delete(code);
      }
    }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("room")?.toUpperCase().trim();

  if (!code) {
    return NextResponse.json({ error: "Room code required" }, { status: 400 });
  }

  const room = rooms.get(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action;
    pruneStaleRooms();

    if (action === "create") {
      const username = (body.username || "Pemain 1").trim().slice(0, 30);
      const code = "FIF" + Math.floor(100 + Math.random() * 900);
      const newRoom: PvpRoom = {
        code,
        createdAt: Date.now(),
        lastActive: Date.now(),
        whiteUser: username,
        blackUser: null,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves: [],
        turn: "w",
        status: "waiting",
      };
      rooms.set(code, newRoom);
      return NextResponse.json({ success: true, room: newRoom, side: "white" });
    }

    if (action === "join") {
      const code = (body.code || "").toUpperCase().trim();
      const username = (body.username || "Pemain 2").trim().slice(0, 30);
      const room = rooms.get(code);

      if (!room) {
        return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
      }

      if (room.blackUser && room.blackUser !== username) {
        return NextResponse.json({ error: "Kamar sudah penuh" }, { status: 400 });
      }

      room.blackUser = username;
      room.status = "active";
      room.lastActive = Date.now();
      return NextResponse.json({ success: true, room, side: "black" });
    }

    if (action === "move") {
      const code = (body.code || "").toUpperCase().trim();
      const { from, to, promotion, side } = body;
      const room = rooms.get(code);

      if (!room) {
        return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
      }

      if (room.status !== "active") {
        return NextResponse.json({ error: "Pertandingan belum aktif" }, { status: 400 });
      }

      // Check turn
      if ((room.turn === "w" && side !== "white") || (room.turn === "b" && side !== "black")) {
        return NextResponse.json({ error: "Bukan giliran Anda melangkah" }, { status: 400 });
      }

      // Validate move with chess.js
      const game = new Chess(room.fen);
      const moveResult = game.move({ from, to, promotion: promotion || "q" });

      if (!moveResult) {
        return NextResponse.json({ error: "Langkah tidak legal" }, { status: 400 });
      }

      room.fen = game.fen();
      room.moves.push(moveResult.san);
      room.turn = game.turn() as "w" | "b";
      room.lastActive = Date.now();

      if (game.isGameOver()) {
        room.status = "finished";
        if (game.isCheckmate()) {
          room.winner = game.turn() === "w" ? "black" : "white";
          room.outcomeKind = "checkmate";
        } else {
          room.winner = "draw";
          room.outcomeKind = "draw";
        }
      }

      return NextResponse.json({ success: true, room });
    }

    if (action === "resign") {
      const code = (body.code || "").toUpperCase().trim();
      const { side } = body;
      const room = rooms.get(code);

      if (!room) {
        return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
      }

      room.status = "finished";
      room.winner = side === "white" ? "black" : "white";
      room.outcomeKind = "resigned";
      room.lastActive = Date.now();
      return NextResponse.json({ success: true, room });
    }

    return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Server error", details: String(err) }, { status: 500 });
  }
}
