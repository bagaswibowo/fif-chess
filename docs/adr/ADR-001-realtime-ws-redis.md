# ADR-001: Realtime — WS Gateway (lib `ws`) + Redis Stream offset, bukan polling

**Status:** Accepted · **Date:** 2026-10-22 · **Scope:** Sprint 1 (G1–G4), tickets S1-T1..T4

## Konteks

Semua fitur realtime jev-chess saat ini berjalan via HTTP polling (api/pvp, badge nav,
challenge). Chess-web blueprint (REA) menunjukkan chess.com memakai WebSocket pubsub
dengan framing `subscribe/ack/data` per topik dan Redis-stream-style offset `<ms>-<seq>`
sehingga klien reconnect tidak kehilangan event. Kita butuh satu realtime layer untuk
matching (S1-T2), presence + badge (S1-T3), dan challenge inline (S1-T4).

## Keputusan

1. **WebSocket gateway, bukan SSE/polling.** Custom server Next.js (`server.ts`, entry
   Procfile) meng-attach `ws` ke HTTP server Next.js yang sama. Polling tidak bisa
   memenuhi acceptance "event < 2s tanpa event hilang" dengan biaya request yang wajar.
2. **Dep tambahan: `ws` + `ioredis` + `@types/ws` saja.** Stdlib Node tidak punya WS
   server yang usable di custom-server Next.js; ini minimal. Tanpa socket.io (bawa
   protocol + state yang tidak kita pakai), tanpa uWS (native addon, build Heroku ribet).
3. **JSON framing meniru semantics pubsub chess.com, bukan opcode biner:**
   `{op: "subscribe"|"ack"|"data"|"error", topic, offset?, payload?}`.
   Opcode biner REA (`41/45/47`) tidak ditiru — hanya semantics-nya. YAGNI kompresi.
4. **Topic naming mengikuti pola chess.com,** resource-per-user/route style:
   `game/<id>/moves`, `matcher/<userId>`, `presence/<userId>`, `toasts/<userId>`.
5. **Redis single instance + Stream offset per topik.** Publish = `XADD` ke stream
   topik → stream ID Redis (`<ms>-<seq>`) dipakai langsung sebagai offset, sama
   semantics-nya dengan format `<ms>-<seq>` chess.com. Subscribe = `XREAD` dari offset
   terakhir klien. Klien kirim offset terakhirnya saat subscribe → reconnect resume
   tanpa kehilangan event (acceptance S1-T1).
6. **YAGNI / single instance:** tanpa Redis cluster, tanpa Redis Pub/Sub fanout antar
   node, tanpa sticky-session-aware router. Satu proses Node melayani semua WS.
7. **Auth di handshake:** upgrade WS divalidasi dengan session existing
   (`lib/user-auth.ts` / `lib/hmac.ts` — session cookie `jev_session`, sama sumber
   identity dengan api/pvp). Koneksi tanpa session valid ditolak (HTTP 401 sebelum
   upgrade).

## Implikasi deploy

- **Heroku:** satu dyno `web` (Procfile → `node server.ts`). Routing Heroku menolak
  upgrade WS hanya jika beberapa dyno tanpa session affinity — dengan satu dyno tidak
  jadi masalah; kalau scale-out, wajib `heroku ps:scale web=1` atau router dengan
  sticky session. Healthcheck tetap HTTP GET `/api/status` (tanpa WS).
- **Dokploy/Docker:** expose satu port (HTTP + WS sama-sama via server.ts).
- **RAM:** Stockfish NNUE (30–64MB) + WS + Redis client di 1 dyno/process — monitor;
  tidak memblok Sprint 1.
- **Redis:** satu instance managed (Heroku Key-Value / Redis container di Dokploy).
  Stream per topik di-trim (`XTRIM MAXLEN`) supaya tidak tumbuh tanpa batas.

## Alternatif yang ditolak

- **Polling penuh (status quo):** latency dan load tidak memenuhi acceptance < 2s;
  duplikasi logika "apa yang berubah".
- **SSE:** one-way, tidak cocok untuk ack/subscribe dua arah matcher; tetap butuh
  channel POST terpisah.
- **Opcode biner + preserialized frames (tiran penuh REA):** biaya implementasi besar,
  manfaat kecil pada skala ini — JSON cukup.
- **socket.io:** menambah protocol layer yang tidak dibutuhkan; `ws` saja cukup.
