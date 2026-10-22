# Sprint 1 — TL Review

**Reviewer:** Tech Lead (review artefak) · **Tanggal:** 2026-10-22
**Artefak:** commit f1b500ec (S1-T1), ADR-001/ADR-002, docs/db/sprint1.md, docs/design/sprint1.md, tickets S1-T1..T4

---

## 1. Commit f1b500ec — S1-T1 WS Gateway + RealtimeBus — **CHANGES_REQUIRED**

Yang sudah benar: auth handshake (401 sebelum upgrade, via `jev_session` + `userForToken` yang mengecek status approved — tidak ada bypass), seam `RealtimeBus` tunggal sesuai ADR-002, offset resume per-subscriber dipatuhi (poller overlap re-read + filter `lastOffset` per-sub — desain benar), cleanup subscriber di `ws.on("close")` lengkap, XTRIM MAXLEN mencegah stream tumbuh, ioredis `enableOfflineQueue:false` supaya publish gagal cepat (konsisten fire-and-forget ADR-002 §5). events.ts/frame.ts bersih dan shared server/klien sesuai ADR-002 §1.

Catatan wajib (blokir push):

1. **`app/api/pvp/route.ts` — `GameStarted` tidak dipublish saat `join`.** ADR-002 §4: "setelah game row dibuat/di-join, publish `GameStarted`". Saat ini hanya `handleCreate`. Lawan yang join tidak menerima event apapun. Arah: publish `GameStarted` (dengan white/black sesuai warna hasil join) di handler join setelah update DB.
2. **`app/api/match-result/route.ts` — `PlayingCountChanged` tidak dipublish.** ADR-002 §4 eksplisit: "publish `GameEnded` + `PlayingCountChanged` untuk badge nav (S1-T3)". Kalau memang sengaja ditunda ke S1-T3, update ADR-002 §4 — jangan biarkan ADR dan kode berbeda. Arah: publish atau amend ADR (pilih satu, tulis alasannya).
3. **`lib/realtime/redis-bus.ts` — race dua poller per topik.** `poll()` keluar loop saat `polling` kosong, tapi XREAD lama masih BLOCK 5s. Subscribe baru dalam window itu menandai `polling` lagi → poller kedua start → dua poller konkuren membagi `readId` yang sama. Interleaving bisa membuat XREAD baru di-issue dari ID yang lebih tinggi → event di antara bisa terlewat (pelanggaran acceptance "tanpa event hilang"). Arah: generation token per poller (`const myGen = ++this.gen; while (this.gen === myGen && ...)`) atau simpan in-flight flag; jangan andalkan set `polling` saja.
4. **`server.ts`/`ws-gateway.ts` — upgrade non-`/ws` di-destroy tanpa pandang bulu.** Di dev, HMR Next.js butuh upgrade `/_next/webpack-hmr`; `socket.destroy()` mematikannya. Production Next 16 custom-server juga bisa punya kebutuhan upgrade internal. Arah: delegate upgrade non-`/ws` ke `app.getUpgradeHandler()` (Next menyediakan) sebelum di-destroy.

Catatan harus-dikerjakan tapi tidak blokir Sprint 1 (masukkan ke S1-T3/backlog):

5. **`ws-gateway.ts` — tidak ada batas jumlah subscribe per koneksi** dan tidak ada `maxPayload` pada `WebSocketServer`. Klien jahat bisa buka ribuan topik → poller per topik = mem penghabisan. Arah: cap mis. 32 topik/koneksi + `maxPayload: 4 * 1024` (frame hanya subscribe kecil), balas `error` saat melebihi.
6. **Tidak ada WS heartbeat (ping/pong).** Koneksi setengah-mati (mobile) tidak memicu `close` → conn + subscription bocor sampai TCP timeout. S1-T3 butuh ini untuk presence juga — kerjakan di S1-T3, jangan lupa.
7. **`redis-bus.ts` — XTRIM per publish** menambah satu RTT di hot path. Pipeline `xadd`+`xtrim` atau trim probabilistik (1/N). Minor.
8. **`events.ts` — `GameEnded.result: string`** terlalu lemah; pakai union `"white" | "black" | "draw"`. Minor, sekalian di S1-T2+.

Smoke test `scripts/smoke-realtime.mjs` mencakup roundtrip + resume — bagus; tambahkan kasus dua-poller race (subscribe-ulang cepat setelah unsubscribe) saat memperbaiki #3.

---

## 2. docs/adr/ADR-001 — **APPROVED**

Keputusan konsisten dengan implementasi: `ws`+`ioredis` minimal, framing JSON, topic naming, Redis stream offset, auth handshake, YAGNI single-instance. Bagian "Implikasi deploy" sudah menyadari sticky-session/1-dyno dan trimming. Tidak ada catatan.

## 3. docs/adr/ADR-002 — **APPROVED**

Seam tunggal, struktur folder, fire-and-forget, anti-outbox semuanya beralasan dan diikuti kode. Satu ketidakkonsistenan minor ditangani di catatan commit #2 (§4 menyebut `PlayingCountChanged` dari match-result yang belum ada di kode) — selaraskan salah satu sisi.

## 4. docs/db/sprint1.md — **APPROVED**

Normalisasi benar: `game_id` FK saja tanpa snapshot hasil match, `to_user_id` NOT NULL dengan YAGNI lobby, dua index `(to_user_id,status)` dan `(from_user_id,status)` tepat untuk inbox/cancel. Redis ZSET untuk seek dengan alasan ephemeral + atomic pop benar. Migration snippet konsisten dengan model. Catatan non-blokir: pertimbangkan partial index `WHERE status = 'pending'` saat volume naik; `status` String konsisten dengan konvensi existing — ok, dokumentasikan nilai valid di satu tempat saat implementasi S1-T4.

## 5. docs/design/sprint1.md — **APPROVED**

Flow, edge cases, copy, dan checklist a11y spesifik dan bisa dieksekusi langsung; semua token mengacu globals.css tanpa palet baru. Kelayakan implementasi ok. Catatan kecil: state `B sedang dalam game → auto-decline server-side` butuh query presence/active-game — pastikan S1-T3 presence tersedia dulu (dependency terbalik dari urutan ticket T4 sebelum T3 selesai); cukup dicatat di ticket.

## 6. Tickets S1-T1..T4 — **APPROVED**

Acceptance jelas, anti-slop eksplisit (S1-T2), dependency T2←T1 benar. Catatan: S1-T2 acceptance "tidak ada polling baru" — saat migrasi konsumen, hapus endpoint polling lama (S1-T3 sudah menyebutnya untuk badge; pastikan sama untuk pvp list). S1-T1 acceptance terpenuhi oleh commit setelah catatan #1–#4 di atas.

---

## Kesimpulan

- **Commit f1b500ec: CHANGES_REQUIRED** — perbaiki catatan #1–#4 sebelum push+deploy.
- Semua artefak dokumen: APPROVED (dengan catatan minor non-blokir di atas).
- Setelah commit direvisi dan 4 catatan itu ditutup, silakan lanjut push + deploy tanpa review ulang penuh (cukup sebutkan di commit message revisi).
