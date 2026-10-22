/**
 * lib/realtime/ws-gateway.ts
 * WS gateway: attach `ws` ke HTTP server Next.js (ADR-001 #1), handshake auth
 * via session `jev_session` yang sudah ada (ADR-001 #7 — tolak 401 sebelum
 * upgrade), framing JSON subscribe/ack/data/error (ADR-001 #3).
 *
 * Upgrade non-`/ws` TIDAK di-destroy (TL review S1-T1 #4): di-delegate ke
 * upgrade handler Next.js (`app.getUpgradeHandler()`) agar HMR dev
 * (`/_next/webpack-hmr`) dan kebutuhan upgrade internal Next production tetap hidup.
 */
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { loadUsers, userForToken } from "../auth-store.ts";
import { getBus, publishBusEvent } from "./bus.ts";
import { playingRedis } from "./playing-count.ts";
import type { Frame } from "./frame.ts";
import type { RealtimeEvent } from "./events.ts";

type Conn = {
  ws: WebSocket;
  userId: string;
  /** Naik setiap koneksi baru user yang sama (TL C6: race offline saat reconnect cepat). */
  generation: number;
  /** topic -> unsubscribe */
  unsubs: Map<string, () => void>;
};

const conns = new Set<Conn>();
/** userId -> generation koneksi terakhir yang terdaftar. */
const connGenerations = new Map<string, number>();

/** Validasi session cookie di handshake. Return userId atau null (= tolak). */
async function handshakeUser(req: IncomingMessage): Promise<string | null> {
  try {
    const users = await loadUsers();
    // req adalah IncomingMessage: headers-nya objek polos (tanpa .get()),
    // jadi baca cookie langsung — cast ke Request membuat tokenFromRequest
    // selalu throw (req.headers.get is not a function) dan handshake selalu 401.
    const raw = req.headers.cookie ?? "";
    let token: string | undefined;
    for (const part of raw.split(";")) {
      const t = part.trim();
      if (t.startsWith("jev_session=")) token = decodeURIComponent(t.slice("jev_session=".length));
    }
    const me = userForToken(token, users);
    return me ? me.id : null;
  } catch {
    return null;
  }
}

export function attachWsGateway(
  server: { on(event: "upgrade", cb: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void },
  /** Upgrade handler Next.js — menerima semua upgrade non-`/ws` (HMR dev, dst). */
  nextUpgradeHandler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") {
      nextUpgradeHandler(req, socket, head);
      return;
    }
    const userId = await handshakeUser(req);
    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      // Generation counter per user (TL review C6): conn lama yang close
      // setelah conn baru open tidak boleh menimpa presence online milik
      // conn baru — hanya publish offline jika generation-nya masih terbaru.
      const generation = (connGenerations.get(userId) ?? 0) + 1;
      connGenerations.set(userId, generation);
      const conn: Conn = { ws, userId, generation, unsubs: new Map() };
      conns.add(conn);
      publishPresence(conn.userId, true);
      ws.on("close", () => {
        conns.delete(conn);
        // Refcount: masih ada conn lain (generation lebih baru) = masih online.
        let newer = false;
        for (const c of conns) {
          if (c.userId === userId && c.generation > generation) {
            newer = true;
            break;
          }
        }
        if (!newer) publishPresence(userId, false);
        for (const unsub of conn.unsubs.values()) unsub();
        conn.unsubs.clear();
      });
      ws.on("message", (raw) => onMessage(conn, raw.toString()));
      ws.on("error", (err) => console.error("[realtime] ws error:", err));
    });
  });
}

/** Presence (ticket S1-T3): koneksi WS aktif = online. Publish event + set Redis. */
function publishPresence(userId: string, online: boolean): void {
  const key = "jev:online";
  const op = online ? "sadd" : "srem";
  void playingRedis()[op](key, userId)
    .then(() => publishBusEvent(`presence/${userId}`, { type: "presence_changed", userId, online }))
    .catch((err: unknown) => console.error("[presence] publish gagal:", err));
}

function send(conn: Conn, frame: Frame): void {
  if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(frame));
}

function onMessage(conn: Conn, raw: string): void {
  let frame: Frame;
  try {
    frame = JSON.parse(raw) as Frame;
  } catch {
    send(conn, { op: "error", topic: "", payload: "Frame bukan JSON." });
    return;
  }
  if (frame.op !== "subscribe" || typeof frame.topic !== "string" || !frame.topic) {
    send(conn, { op: "error", topic: frame.topic ?? "", payload: "Hanya op subscribe yang didukung." });
    return;
  }

  // Idempoten: subscribe ulang topik yang sama ganti offset resume.
  conn.unsubs.get(frame.topic)?.();

  const unsub = getBus().subscribe(
    frame.topic,
    (event: RealtimeEvent, offset: string) => {
      send(conn, { op: "data", topic: frame.topic, offset, payload: event });
    },
    frame.offset,
  );
  conn.unsubs.set(frame.topic, unsub);
  send(conn, { op: "ack", topic: frame.topic, offset: frame.offset });
}
