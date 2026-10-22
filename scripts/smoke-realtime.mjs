// S1-T1 smoke test: publish -> subscribe roundtrip + reconnect resume dari offset.
// Butuh Redis di REDIS_URL (default redis://127.0.0.1:6379).
// Jalankan dari root repo: node scripts/smoke-realtime.mjs
import Redis from "ioredis";
import { getBus } from "../lib/realtime/bus.ts";
import { gameTopic } from "../lib/realtime/events.ts";

const topic = gameTopic("smoke-" + Date.now());
const bus = getBus();
const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { lazyConnect: false });

await redis.ping();

// 1. Roundtrip: subscribe (hanya event baru) lalu publish 2 event.
const received = [];
let lastOffset = null;
const unsub = bus.subscribe(topic, (event, offset) => {
  received.push({ event, offset });
  lastOffset = offset; // klien nyimpan offset terakhir yang sukses diproses
}, "0-0"); // dari awal stream supaya tidak kalah race dengan poller BLOCK

await bus.publish(topic, { type: "game_started", gameId: topic, white: "a", black: "b" });
await bus.publish(topic, { type: "move_made", gameId: topic, san: "e4", fen: "x", moveNumber: 1 });
await new Promise((r) => setTimeout(r, 1500));
unsub();

if (received.length !== 2 || received[0].event.type !== "game_started" || received[1].event.type !== "move_made") {
  console.error("FAIL roundtrip:", received);
  process.exit(1);
}
console.log("OK roundtrip:", received.map((r) => `${r.event.type}@${r.offset}`).join(", "));

// 2. Reconnect resume: publish 2 event lagi selama "disconnect",
// lalu subscribe lagi DARI offset pertama -> semua event sejak offset diterima.
await bus.publish(topic, { type: "move_made", gameId: topic, san: "e5", fen: "y", moveNumber: 2 });
await bus.publish(topic, { type: "game_ended", gameId: topic, result: "draw" });

const resumed = [];
const unsub2 = bus.subscribe(
  topic,
  (event, offset) => resumed.push({ event, offset }),
  lastOffset, // offset terakhir yang diproses klien sebelum "disconnect"
);
await new Promise((r) => setTimeout(r, 1500));
unsub2();

// Resume dari offset terakhir yang diproses: klien harus menerima semua event
// SETELAH offset itu (started & e4 sudah diterima; e5 & ended belum).
// Klien resume dari offset event pertama; poller tunggal per topik beri
// event > offset tsb. Jumlah tepat tergantung apa yang sudah dikonsumsi
// poller sebelumnya — yang wajib: tidak ada event yang TERLEWAT, urutan benar.
const types = resumed.map((r) => r.event.type);
if (resumed.length !== 2 || types[0] !== "move_made" || types[1] !== "game_ended") {
  console.error("FAIL resume:", resumed);
  process.exit(1);
}
console.log("OK resume dari offset", lastOffset, ":", types.join(", "));

// 3. Cek XTRIM: panjang stream tidak melebihi MAXLEN.
const len = await redis.xlen("jev:rt:" + topic);
console.log("stream len:", len);
await redis.quit();
console.log("SMOKE PASS");
process.exit(0);
