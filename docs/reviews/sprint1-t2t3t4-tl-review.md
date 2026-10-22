# TL Review — Sprint 1 T2/T3/T4 (ee2ad3e4, e7b33164, 66b3acce)

**Reviewer:** Tech Lead · **Date:** 2026-10-22 · **Lokal, belum di-push** (jangan push sebelum CHANGES_REQUIRED selesai)
**Verifikasi build:** `npm run build` PASS di sxz-server (semua route ter-commit: /api/seek, /api/seek/user-seeks, /api/presence/count).

---

## ee2ad3e4 — S1-T2 seek pool + matcher — **CHANGES_REQUIRED**

### C1. CRITICAL — race double-match (matcher.ts + seek-pool.ts)
Lua MATCH_LUA hanya atomic pop **lawan**. Seek **pemanggil** dihapus SETELAH Lua return, via `zrem`+`del` round-trip terpisah (seek-pool.ts tryMatch, setelah `r.eval`).

Skenario: A dan B POST seek hampir bersamaan, keduanya masuk pool sebelum keduanya tryMatch:
1. tryMatch(A): Lua pop seek B, return pair. (seek A masih di pool)
2. tryMatch(B): Lua pop seek A, return pair.
-> Dua row `games` dibuat untuk pasangan yang sama; `GameAdded` ganda; keduanya bisa match lagi dengan C. `matcherState` (Set in-process) hanya guard seekId yang sama, tidak menutup race ini; dua request bisa jadi dua proses/route instance berbeda.

**Fix arah:** pindahkan penghapusan seek pemanggil KE DALAM Lua (ZREM pool + DEL hash seek sendiri di script yang sama), atau DEL seek self di awal script lalu pop lawan. Setelah fix, race butuh test: dua POST seek paralel harus menghasilkan tepat 1 row games.

### C2. HIGH — removeUserSeek tidak atomic + `KEYS` blocking (seek-pool.ts)
`keys("seek:pool:*")` + loop `zrange`/`hget` per member: (a) non-atomic vs tryMatch — cancel bisa kalah balapan dengan match; (b) `KEYS` blocking O(N) di production Redis. Fix bareng C1: simpan `seek:user:{userId}` -> seekId, atau SCAN + Lua. Cancel-setelah-match juga harus idempoten (saat ini return false, frontend kira gagal).

### C3. MEDIUM — FK bridging auth-store -> pg uuid (route.ts)
`SELECT id FROM users WHERE username=$1` memetakan store id (u-...) -> pg uuid via username. Aman untuk sprint IF username immutable & unique (cek constraint). Risiko produksi: kalau username bisa diganti/ada duplikat, row games menunjuk user salah. **Rekomendasi:** jangan konsolidasi sekarang (YAGNI), tapi (1) pastikan UNIQUE(username) di pg, (2) catat di docs/db/sprint1.md bahwa username adalah join key antara auth-store dan pg sampai konsolidasi identitas — jangan biarkan implisit.

### C4. MINOR
- `genUuid()` hand-rolled Math.random di matcher.ts — pakai `randomUUID()` dari crypto (sudah dipakai di route.ts).
- Re-seek: `removeUserSeek` lalu `addSeek` non-atomic; dua tab re-seek bersamaan bisa sisakan dua seek untuk user yang sama (low, fix bersama C2).

---

## e7b33164 — S1-T3 presence + badge — **CHANGES_REQUIRED**

### C5. HIGH — `jev:playing` tidak pernah dikosongkan saat game selesai (playing-count.ts + matcher.ts)
`setPlaying(true)` dipanggil matcher saat match; TIDAK ADA pemanggil `setPlaying(false)` di mana pun (tidak ada hook di GameEnded/match-result). Badge "Bermain N" monoton naik sampai restart Redis -> acceptance "Mulai/selesai game mengubah angka" GAGAL untuk "selesai". **Fix:** wire `setPlaying(userId,false)` di jalur game-end (api/match-result / publish GameEnded).

### C6. MEDIUM — race presence offline saat reconnect cepat (ws-gateway.ts)
Conn lama close dan conn baru open beririsan (network flap) -> `publishPresence(false)` dari conn lama bisa tiba SETELAH `publishPresence(true)` conn baru (keduanya fire-and-forget tanpa ordering) -> user tercatat offline padahal WS hidup; event `presence_changed online=false` palsu disebar. **Fix:** sebelum publish offline, cek masih ada conn lain dengan userId sama di `conns`; atau refcount per userId.

### C7. Handshake fix — APPROVED, tapi refactor
Fix `headers.get` benar: sebelumnya cast `req as unknown as Request` membuat `tokenFromRequest` selalu throw -> handshake 401 permanen. Parsing cookie manual aman (multi-cookie, decodeURIComponent). Regresi: tidak — jalur lama 100% mati. Catatan: duplikasi logika cookie dengan `tokenFromRequest`; refactor kecil: beri `tokenFromRequest` overload IncomingMessage agar satu sumber.

### C8. MINOR
- `jev:online` tidak di-clean saat server restart -> anggota stale. Tambah TTL/refresh heartbeat, atau dokumentasikan sebagai known limitation.
- `setPlaying` non-atomic (scard/sadd/scard) — count bisa salah di event ganda; low.

---

## 66b3acce — S1-T4 frontend — **CHANGES_REQUIRED**

### C9. BLOCKER — `/api/challenge` tidak ada
`components/game.tsx` `resolveChallenge` fetch POST `/api/challenge` — route tidak ada di repo (`app/api/challenge/` missing; build juga tidak menampakkan route). Accept/decline selalu 404 -> challenge tidak pernah resolve di server, pengirim tidak pernah tahu. Selain itu docs/db/sprint1.md memutuskan challenge **persist di Postgres (model `Challenge`)** — belum ada migration/model sama sekali. Implement endpoint + model sesuai docs/db/sprint1.md, atau amend doc dengan justifikasi (Redis-only) — jangan code diam-diam menyimpang.

### C10. HIGH — `game_added` tidak ditangani frontend (game.tsx)
use-realtime di game.tsx hanya menangani `challenge_received` + `playing_count_changed`. Acceptance S1-T2 "keduanya diarahkan ke game yang sama" dan design doc "navigasi ke /game/live/<id>" tidak terjadi: GameAdded datang ke matcherTopic tapi diabaikan -> user match tapi tidak pindah papan. **Fix:** handle `game_added` -> navigate ke halaman game.

### C11. use-realtime reconnect — APPROVED
- Tidak dobel subscribe: effect keyed `[topicsKey, enabled]`, cleanup `closed=true` + `ws.close()`; server `onMessage` unsub topik sama sebelum re-subscribe (idempoten). Resume via offset Map benar; backoff capped 15s; guard `closed` di onclose mencegah zombie timer. Nit: `onEventRef.current = onEvent` di body render (bukan effect) — pindahkan ke `useEffect` agar aman terhadap concurrent rendering.
- Sinkron kecil: `toastsTopic` ada di backend events.ts, TIDAK di frontend lib/realtime/events.ts (copy frontend tertinggal satu builder). Sinkronkan — kontrak harus identik dua sisi (sisa union type sudah identik, diverifikasi diff).

### C12. ChallengeCard a11y & design doc — mostly sesuai, dua catatan
- Sesuai: dual-button inline tanpa modal, bottom-sheet mobile yang tidak menutup board, focus-visible ring, aria-live="polite", ikon aria-hidden, semua durasi via `--move-animation-duration` 180ms, Tolak ghost/outline. View switching tidak disentuh (diff game.tsx minimal, additive) — aman.
- (a) `CardBody` dirender dua kali (desktop `hidden md:block` + mobile `md:hidden`): keduanya di DOM; `role="status"` + aria-live aktif di keduanya -> screen reader bisa mengumumkan dua kali. Render kondisional via matchMedia / satu instance dengan CSS layout, atau aria-hidden pada instance yang tidak tampak.
- (b) `controlLabel` hardcode "Cepat · 10 menit" di game.tsx — harus dari data challenge (`ChallengeReceived` tidak membawa tc -> tambahkan field tc ke kontrak event, ubah dua sisi sekaligus).

---

## Code vs ADR-002
- Deviasi kecil: `RealtimeBus.subscribe` kini punya parameter `fromOffset?` — tidak ada di ADR (interface §2). Sah untuk resume reconnect; **amend ADR-002** (tambahkan parameter + alasan) daripada biarkan ADR stale.
- Prinsip lain terpenuhi: consumer hanya lewat seam `publishBusEvent`, tipe event satu file shared, topic builder tunggal, fire-and-forget publish (#4).

## Ringkasan verdict
| Commit | Verdict |
|---|---|
| ee2ad3e4 (S1-T2) | CHANGES_REQUIRED — C1 double-match race (critical), C2, C3 dokumentasi, C4 |
| e7b33164 (S1-T3) | CHANGES_REQUIRED — C5 jev:playing leak, C6 presence race; handshake fix (C7) bagus |
| 66b3acce (S1-T4) | CHANGES_REQUIRED — C9 /api/challenge hilang (blocker), C10 game_added tidak ditangani; C11 & C12 bagus dengan nit |

Urutan perbaikan yang disarankan: C9 -> C1 -> C5 -> C10 -> C6 -> sisanya. Tidak ada yang di-push sampai C1 & C9 selesai.
