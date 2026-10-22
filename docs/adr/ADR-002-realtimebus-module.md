# ADR-002: Modul RealtimeBus — seam tunggal publish/subscribe

**Status:** Accepted · **Date:** 2026-10-22 · **Scope:** Sprint 1 (S1-T1), dipakai S1-T2..T4

## Konteks

S1-T1 membutuhkan satu seam realtime yang dipakai semua fitur Sprint 1–4. API routes
existing (`app/api/pvp/route.ts`, `app/api/match-result/route.ts`) harus bisa publish
event tanpa tahu detail transport. Tipe event harus shared antara server dan klien.

## Keputusan

### 1. Struktur file (`lib/realtime/`)

Sprint 1 ticket menyebut `lib/realtime-bus.ts` + `lib/realtime-events.ts`; kita letakkan
keduanya sebagai modul folder agar implementasi Redis tidak bocor ke consumer, minimal
diff terhadap struktur `lib/` yang flat-sudah-panjang:

```
lib/realtime/
  bus.ts            # interface RealtimeBus + getBus() singleton (seam satu-satunya)
  redis-bus.ts      # implementasi Redis-stream-backed (ioredis; XADD/XREAD + XTRIM)
  events.ts         # tipe event shared server & klien + topic builders (satu sumber)
  ws-gateway.ts     # attach ws ke HTTP server, handshake auth, framing subscribe/ack/data
  frame.ts          # tipe Frame {op, topic, offset?, payload?} — shared server & client
```

Klien (browser) hanya import `lib/realtime/events.ts` + `lib/realtime/frame.ts` —
`bus.ts`/`redis-bus.ts`/`ws-gateway.ts` tidak pernah di-import dari client component.

### 2. Interface (seam tunggal)

```ts
// lib/realtime/bus.ts
export interface RealtimeBus {
  publish(topic: string, event: RealtimeEvent): Promise<string /* offset */>;
  subscribe(topic: string, handler: (event: RealtimeEvent, offset: string) => void): () => void;
}
export function getBus(): RealtimeBus; // singleton RedisBus (single instance, YAGNI)
```

Satu-satunya cara masuk/keluar event realtime adalah `RealtimeBus`. WS gateway,
matcher (S1-T2), presence (S1-T3), dan challenge (S1-T4) semuanya lewat interface ini —
tukar implementasi (mis. in-memory untuk test) tanpa menyentuh consumer.

### 3. Tipe event shared (`lib/realtime/events.ts`)

Union `RealtimeEvent` dengan discriminator `type`, satu file untuk server & klien:

- `GameAdded` / `GameRemoved` → topik `matcher/<userId>` (S1-T2, S1-T4)
- `GameStarted` / `MoveMade` / `GameEnded` → `game/<id>/moves`
- `PresenceChanged` → `presence/<userId>` (S1-T3)
- `PlayingCountChanged` → badge nav "Bermain N" (S1-T3)
- `ChallengeReceived` / `ChallengeResolved` → `matcher/<userId>` (S1-T4)

Topic builder (`matcherTopic(userId)`, `gameTopic(gameId)`, …) di file yang sama agar
tidak ada string topic tersebar.

### 4. Cara API routes existing publish

Pola minimal-diff: import `getBus()`, publish setelah mutasi state sukses. Publish
fire-and-forget (log error, jangan gagalkan response HTTP):

- **`app/api/pvp/route.ts`** — di handler POST `create` / `join`: setelah game row
  dibuat/di-join, publish `GameStarted` ke `game/<id>/moves` untuk kedua pemain;
  di POST `move`: publish `MoveMade` (san, fen) ke topik game.
- **`app/api/match-result/route.ts`** — setelah result tersimpan: publish `GameEnded`
  ke `game/<id>/moves` + `PlayingCountChanged` untuk badge nav (S1-T3).

  **Amend (2026-10-22, revisi S1-T1 pasca TL review #2):** `PlayingCountChanged`
  dipublish dari `match-result` sejak S1-T1, bukan ditunda ke S1-T3. Topiknya
  `game/<id>/moves` (topik game yang sama) dengan `count` = jumlah game
  berstatus `active` hasil query DB saat result tersimpan. S1-T3 (badge nav)
  tinggal subscribe topik game terkait / agregat — tidak perlu publish ulang.

Ticket S1-T2/T4 (`api/seek`, `api/challenge`) — route baru — publish `GameAdded` /
`GameRemoved` / `ChallengeReceived` via `getBus()` yang sama.

### 5. YAGNI

- Tidak ada abstraction kedua (no `EventEmitter` wrapper, no RxJS).
- Tidak ada outbox/transaksi dual-write: publish setelah commit DB, at-most-once dari
  sudut pandang HTTP handler; durability justru dari Redis stream offset di sisi klien.
- Tidak ada backpressure/retry-publish — single instance, error di-log.

## Alternatif yang ditolak

- **API routes publish langsung via ioredis:** setiap route tahu detail Redis; sulit
  test & ganti transport — melanggar seam tunggal.
- **`lib/realtime-bus.ts` flat:** sesuai teks ticket tapi memaksa file implementasi
  Redis & WS ikut flat; folder memberi boundary client/server yang jelas.
- **Prisma model untuk event/presence:** event ephemeral, Redis stream cukup (S1-T2
  sudah memilih Redis-only untuk Seek dengan alasan sama).
