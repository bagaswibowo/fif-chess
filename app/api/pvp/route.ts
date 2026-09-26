import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { randomBytes, randomUUID } from "crypto";
import { currentUser, findUser, loadUsers } from "@/lib/auth-store";

export const runtime = "nodejs";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

// ponytail: in-memory map, single instance. Kamar hilang saat restart dan
// setelah 30 menit idle — cukup untuk sparring, tidak perlu Redis.
// Kalau nanti butuh lintas instance, pindahkan ke Redis dengan interface sama.
const rooms = new Map<string, PvpRoom>();

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

function prune() {
  const now = Date.now();
  for (const [code, r] of rooms) if (now - r.lastActive > 30 * 60_000) rooms.delete(code);
  for (const [ip, rec] of rate) if (rec.until < now) rate.delete(ip);
}

function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

function publicRoom(r: PvpRoom) {
  return {
    code: r.code,
    createdAt: r.createdAt,
    lastActive: r.lastActive,
    whiteUser: r.whiteUser,
    blackUser: r.blackUser,
    creatorUser: r.creatorUser,
    creatorSide: r.creatorSide,
    invitedUser: r.invitedUser,
    fen: r.fen,
    moves: r.moves,
    turn: r.turn,
    status: r.status,
    winner: r.winner ?? null,
    outcomeKind: r.outcomeKind,
  };
}

// Token pemain WAJIB cocok dengan(session user, sisi). Kalau hanya token yang
// dicek, siapa pun yang mencuri token bisa melangkah — dan review menemukan
// skenario itu nyata di smoke test.
function sideOf(r: PvpRoom, token: string, username: string): "white" | "black" | null {
  if (!token) return null;
  if (r.whiteToken === token && r.whiteUser === username) return "white";
  if (r.blackToken === token && r.blackUser === username) return "black";
  return null;
}

export async function GET(req: Request) {
  const ip = clientIp(req);
  if (tooManyRequests(ip)) return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  prune();

  const url = new URL(req.url);
  const users = loadUsers();
  const me = currentUser(req, users);
  if (!me) return NextResponse.json({ error: "Login dulu untuk memakai PvP." }, { status: 401 });

  // Undangan yang menunggu: addressees by username, plus lobby terbuka.
  if (url.searchParams.has("user")) {
    const target = String(url.searchParams.get("user") || "").trim().toLowerCase();
    const invites = [];
    for (const r of rooms.values()) {
      if (r.status !== "waiting" || r.whiteToken === me.username) continue;
      if (r.creatorUser === me.username) continue;
      if (r.invitedUser && r.invitedUser !== target && r.invitedUser !== me.username) continue;
      invites.push({
        code: r.code,
        creatorUser: r.creatorUser,
        creatorSide: r.creatorSide,
        invitedUser: r.invitedUser,
        createdAt: r.createdAt,
        targeted: r.invitedUser === me.username,
      });
    }
    return NextResponse.json({ success: true, invites, online: onlineUsernames(users) });
  }

  // Direktori lawan: hanya user approved.
  if (url.searchParams.has("directory")) {
    return NextResponse.json({ success: true, players: onlineUsernames(users) });
  }

  const code = String(url.searchParams.get("room") || "").toUpperCase();
  // Token pemain lewat header, bukan query string: query masuk access log, proxy
  // log, dan Referer. Header tidak.
  const token = req.headers.get("x-player-token") || undefined;
  const room = rooms.get(code);
  if (!room) return NextResponse.json({ error: "Kamar tidak ditemukan." }, { status: 404 });

  room.lastActive = Date.now();
  return NextResponse.json({
    success: true,
    room: publicRoom(room),
    // Only the side this browser owns may be moved by the client.
    yourSide: sideOf(room, token ?? "", me.username),
  });
}

function onlineUsernames(users: ReturnType<typeof loadUsers>) {
  const now = Date.now();
  const live = new Set<string>();
  for (const r of rooms.values()) {
    if (r.status === "waiting" && now - r.lastActive < 2 * 60_000) live.add(r.creatorUser);
  }
  return users
    .filter((u) => u.status === "approved")
    .map((u) => ({
      username: u.username,
      fullName: u.fullName,
      elo: u.elo,
      online: live.has(u.username),
    }))
    .sort((a, b) => Number(b.online) - Number(a.online) || b.elo - a.elo);
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (tooManyRequests(ip)) return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  prune();

  const users = loadUsers();
  const me = currentUser(req, users);
  if (!me) return NextResponse.json({ error: "Login dulu untuk memakai PvP." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
  }
  const action = String(body.action || "");
  const code = String(body.code || "").toUpperCase().trim();
  const playerToken = String(body.playerToken || "");

  if (action === "create") {
    // Undangan by username: hanya akun approved yang boleh diundang.
    let invitedUser: string | null = null;
    const raw = String(body.invitedUser || "").trim().toLowerCase();
    if (raw) {
      const target = findUser(users, raw);
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

  if (action === "join") {
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
    return NextResponse.json({
      success: true,
      room: publicRoom(room),
      yourSide: room.creatorSide === "white" ? "black" : "white",
      playerToken: token,
    });
  }

  if (action === "move") {
    const room = rooms.get(code);
    if (!room) return NextResponse.json({ error: "Kamar tidak ditemukan." }, { status: 404 });
    if (room.status !== "active") return NextResponse.json({ error: "Pertandingan tidak aktif." }, { status: 400 });

    const side = sideOf(room, playerToken, me.username);
    if (!side) return NextResponse.json({ error: "Token pemain tidak valid." }, { status: 403 });
    if (room.turn !== (side === "white" ? "w" : "b")) {
      return NextResponse.json({ error: "Bukan giliranmu." }, { status: 409 });
    }

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
    room.turn = chess.turn() as "w" | "b";
    room.lastActive = Date.now();

    if (chess.isGameOver()) {
      room.status = "finished";
      if (chess.isCheckmate()) {
        room.winner = room.turn === "w" ? "black" : "white";
        room.outcomeKind = "checkmate";
      } else {
        room.winner = "draw";
        room.outcomeKind = "draw";
      }
    }
    return NextResponse.json({ success: true, room: publicRoom(room), yourSide: side });
  }

  if (action === "leave") {
    const room = rooms.get(code);
    if (!room) return NextResponse.json({ success: true });
    // Hanya pemilik sisi boleh melepasslot-nya; room yang masih kosong
    // dibersihkan supaya tidak jadi kamar hantu.
    if (sideOf(room, playerToken, me.username) || room.status === "waiting") {
      rooms.delete(room.code);
    }
    return NextResponse.json({ success: true });
  }

  if (action === "resign" || action === "draw") {
    const room = rooms.get(code);
    if (!room) return NextResponse.json({ error: "Kamar tidak ditemukan." }, { status: 404 });
    if (room.status !== "active") return NextResponse.json({ error: "Pertandingan tidak aktif." }, { status: 400 });
    const side = sideOf(room, playerToken, me.username);
    if (!side) return NextResponse.json({ error: "Token pemain tidak valid." }, { status: 403 });

    room.status = "finished";
    room.lastActive = Date.now();
    if (action === "draw") {
      room.winner = "draw";
      room.outcomeKind = "draw";
    } else {
      room.winner = side === "white" ? "black" : "white";
      room.outcomeKind = "resigned";
    }
    return NextResponse.json({ success: true, room: publicRoom(room), yourSide: side });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
