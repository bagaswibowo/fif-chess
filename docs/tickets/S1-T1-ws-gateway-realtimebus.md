# TICKET S1-T1 — WS Gateway + RealtimeBus (G1)

**Sprint:** 1 · **Priority:** P0 (blocker S1-T2/S1-T3) · **Role:** Backend/fullstack
**Gap:** G1 — realtime pubsub server (chess.com: opcode subscribe/ack/data + Redis stream offset; jev-chess: polling via API routes)

## Tujuan
Satu WS gateway + satu seam `RealtimeBus` (publish/subscribe) yang dipakai semua fitur realtime Sprint 1–4.

## Desensi (dari REA, keputusan arsitektur #1)
- Protokol meniru pubsub REA: **framing semantics** subscribe/ack/data per topik, **JSON biasa** (bukan opcode biner).
- Topik: `game/<id>/moves`, `matcher/<userId>`, `presence/<userId>`, `toasts/<userId>`.
- Redis single instance + stream offset per topik (peserta reconnect tidak kehilangan event antara disconnect).
- YAGNI: tanpa Redis cluster, tanpa kompresi biner, satu instance saja.

## Tugas
1. Tambah dep `ws` + `ioredis` (stdlib-first tidak memungkinkan untuk WS server di Next.js custom-server — ini minimal).
2. `lib/realtime-bus.ts`: interface `RealtimeBus { publish(topic, event); subscribe(topic, handler): unsubscribe }` — implementasi Redis-stream-backed. Tipe event shared server & klien (`lib/realtime-events.ts`, schema dari REA frame).
3. Custom server (`server.ts` / Procfile entry): attach `ws` ke HTTP server Next.js; handshake auth pakai session yang sudah ada (`user-auth.ts` / `hmac.ts`) — tolak koneksi tanpa session valid.
4. Frame: `{op: "subscribe"|"ack"|"data"|"error", topic, offset?, payload?}`.
5. Smoke test script: publish → subscribe roundtrip + reconnect resume dari offset.

## Acceptance
- [ ] Klien WS connect+auth, subscribe topik, terima event dengan ack & offset.
- [ ] Reconnect melanjutkan dari offset terakhir (tanpa event hilang).
- [ ] Semua tipe event didefinisikan di satu file shared (server & client import sama).
- [ ] Tanpa fitur lain diubah — polling existing tetap jalan sampai konsumen dimigrasi.

## Risiko
Deploy Heroku/Dokploy butuh sticky session / satu dyno. Stockfish NNUE + WS di 1 dyno: monitor RAM (engine 30–64MB).
