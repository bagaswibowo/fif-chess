/**
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
import { loadUsers, tokenFromRequest, userForToken } from "../auth-store.ts";
import { getBus } from "./bus.ts";
import type { Frame } from "./frame.ts";
import type { RealtimeEvent } from "./events.ts";

type Conn = {
  ws: WebSocket;
  userId: string;
  /** topic -> unsubscribe */
  unsubs: Map<string, () => void>;
};

const conns = new Set<Conn>();

/** Validasi session cookie di handshake. Return userId atau null (= tolak). */
async function handshakeUser(req: IncomingMessage): Promise<string | null> {
  try {
    const users = await loadUsers();
    const me = userForToken(tokenFromRequest(req as unknown as Request), users);
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
      const conn: Conn = { ws, userId, unsubs: new Map() };
      conns.add(conn);
      ws.on("close", () => {
        for (const unsub of conn.unsubs.values()) unsub();
        conn.unsubs.clear();
        conns.delete(conn);
      });
      ws.on("message", (raw) => onMessage(conn, raw.toString()));
      ws.on("error", (err) => console.error("[realtime] ws error:", err));
    });
  });
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
