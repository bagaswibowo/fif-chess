/**
 * Custom server Next.js (ADR-001 #1, entry Procfile): start Next di HTTP server
 * Node sendiri lalu attach WS gateway ke server yang sama (HTTP + WS satu port).
 * Upgrade non-`/ws` di-delegate ke Next (`app.getUpgradeHandler()`) — TL review
 * S1-T1 #4 — supaya HMR dev tidak mati.
 */
import { createServer } from "node:http";
import next from "next";
import { attachWsGateway } from "./lib/realtime/ws-gateway.ts";

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev });
const handle = app.getRequestHandler();
const upgradeHandler = app.getUpgradeHandler();

await app.prepare();

const server = createServer((req, res) => handle(req, res));
attachWsGateway(server, upgradeHandler);
server.listen(port, "0.0.0.0", () => {
  console.log(`[jev-chess] ready on http://0.0.0.0:${port} (WS di /ws, dev=${dev})`);
});
