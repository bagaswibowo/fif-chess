# ADR-009: Sprint 6 Game-Flow — Opening Explorer, Clock Presets, Abort/Rematch/Draw, Insights, Tournaments

**Status:** Accepted · **Date:** 2026-10-27 · **Scope:** S6 batch-1 (S6-T1..T5, `docs/tickets/S6-sprint-plan.md`)
**Contract:** keputusan ini dikonektifkan satu file kontrak shared backend+frontend di `docs/contracts/sprint6.md` (contract-first — implementasi S6-T1..T5 membaca shape tsb, tidak menafsirkan ulang).

## Konteks

S6 batch-1 menambah lima permukaan game-flow: (T1) view Opening Explorer `/explorer`, (T2) clock presets di
pairing (gap G2.1), (T3) abort/rematch/offer-draw di game-over (gap G2.2), (T4) Insights
(`/insights` + deep-link publik `/insights/<user>`), (T5) Tournaments arena
(`/play/online/tournaments`). Basis yang sudah ada dan WAJIB dipakai ulang (prinsip global
`S6-sprint-plan.md`: "JANGAN double-implement"): `api/opening` + `lib/opening-book.ts`,
`api/challenge` + `api/challenge/[id]/respond`, `api/seek` + `api/seek/user-seeks`,
`api/pvp` (room lifecycle in-memory + ops db-*), `api/stats/summary`, `api/leaderboard`,
`api/auth/lookupByUsername`, realtime WS (ADR-001/002: `RealtimeEvent` union di
`lib/realtime/events.ts`, topics `game/<id>/moves`, `matcher/<userId>`, `presence`, `toasts/<userId>`).

Konvensi ADR house (ADR-001..002): keputusan numerik, konteks, implikasi, alternatif ditolak.
Hati-hati: aset/teks/icon HANYA pola dari chess.com — tidak ada material berhak cipta yang disalin
(token CSS + copy ID original, sesuai prinsip global).

---

## D1 — Opening Explorer: REUSE `api/opening` per-posisi, TIDAK ada endpoint tree baru

**Keputusan:**

1. **`POST /api/opening` (REUSE, tanpa perubahan) menjadi satu-satunya sumber data
   explorer.** View `/explorer` membangun move-tree di client: dari posisi FEN (mulai
   `START_FEN` atau FEN yang di-paste), untuk tiap kandidat reply (list UCI)
   `lib/engines/opening-book.ts` → panggil `POST /api/opening { fen: childFen }` per node
   yang diekspansi. Respons existing `FenLookupResponse` (`lib/opening-book.ts`:
   `fen, valid, sideToMove, fullmoveNumber, halfmoveClock, opening?`) sudah membawa
   `opening.name/eco/moves` — cukup untuk label node.
2. **Win-rate per posisi: SQL-side dari `games` + `game_moves`, via `NEW GET
   /api/opening/win-rate?fen=` (1 endpoint, bukan "stats di response opening").**
   `lib/engines/opening-book.ts` hanya berisi move UCI acak (tanpa win-rate);
   win-rate tidak ada di mana pun saat ini. Endpoint baru menghitung dari
   `game_moves.fen` (index `idx_game_moves_game`) dengan filter `g.status='finished'`
   dan agregasi `result` terhadap `white_user_id`/`black_user_id` pemain yang
   menjangkau FEN tsb — hitungan 100% riil (no-mock rule). Endpoint ini satu-satunya
   NEW di D1; caching di route handler (memo Map FEN→row, TTL pendek) karena
   volume query dari tree expansion bisa berulang — detail implementasi, bukan kontrak.
3. **Cross-link kursus = navigasi internal** ke `/courses` (S7-T1, queued) — link
   statis dengan query `?opening=<eco>`; tidak ada endpoint baru, tidak ada data
   kursus di S6.
4. **TIDAK:** endpoint tree baru (`api/opening/tree`), tabel baru `openings_stats`,
   engine evaluasi per node (eval-bar `lib/jev.ts` sudah ada terpisah untuk analisis).

**Alternatif yang ditolak**

- `GET /api/opening/tree?depth=`: server men-build pohon penuh = biaya eksponensial +
  win-rate per node tidak ada sumber datanya (butuh agregasi ribuan game) — tidak
  YAGNI; tree client-side depth-3..4 sudah memenuhi tiket.
- Tambah field `stats` ke respons `FenLookupResponse`: membebani path engine (lookup
  dipanggil per langkah di flow analysis/puzzle) dengan agregasi SQL yang hanya
  diperlukan di view explorer.

---

## D2 — Clock presets: data tetap `time_control '<menit>+<inkremen>'` (string), preset = validasi+UI chip

**Keputusan:**

1. **Tidak ada kolom/tabel baru.** Format time control sudah baku di 3 tempat:
   `games.time_control varchar(10)` (check di `docs/db/db-schema.sql`),
   `challenges.time_control text`, `SeekTicket.tc` di `lib/realtime/seek-pool.ts`
   (`seek:pool:{tc}:{mode}` ZSET — tc adalah kunci pool). Satu representasi
   string `"\d+\+\d+"` sudah cukup.
2. **Preset 1+0 / 3+0 / 3+2 / 5+0 / 10+0 / 15+10 / custom = konstanta UI (client)**
   di `components/pvp-panel.tsx` + flow pairing challenge: array chip
   `{ label, tc, category }` di mana `category` **diturunkan dari `tc`, bukan
   dikirim**: aturan kategori waktu dari `app/api/leaderboard/route.ts`
   (bullet <3, blitz 3..<10, rapid ≥10 menit atas `split_part(time_control,'+',1)::int`).
   Custom: input 2 field (base+increment) di-validasi regex `\d+\+\d+` yang sama
   dengan yang sudah dipakai `api/challenge`, `api/seek`, `api/pvp` (handleCreate).
3. **Wiring pairing (REUSE, tanpa perubahan payload):**
   - **Challenge flow:** `POST /api/challenge { toUserId, timeControl, rated }`
     (route existing sudah menerima `timeControl` string + `rated` boolean) →
     respond `POST /api/challenge/[id]/respond { action }` (existing) → INSERT `games`
     dengan `time_control` snapshot challenge (existing, pola `handleCreate`).
   - **Quick-pairing flow:** `POST /api/seek { tc, mode }` (existing) — chip preset
     mengisi `tc`; rated/casual mengisi `mode`. Matcher (`lib/realtime/matcher.ts`)
     sudah membuat `games` row dengan tc seek; tidak berubah.
   - **Pilihan warna** (white/black/random) pada pairing: untuk seek, `SeekTicket`
     **tidak punya field warna** — warna tetap acak (pola existing
     `whiteId = Math.random() < 0.5 ? a : b`); **warna di challenge flow** =
     side yang dipilih pengirim saat `POST /api/pvp { action:"create", side }`
     (existing ops create di `api/pvp` sudah membaca `side: "white"|"black"|"random"`).
     Keputusan: warna acak di seek (tidak ditambah field ke ticket — minimal diff);
     warna eksplisit hanya tersedia lewat invitation (`api/pvp create`) dan
     challenge→game dengan warna diacak (existing behavior respond, tidak diubah).
4. **NEW = tidak ada di D2.** Seluruh preset adalah frontend; backend sudah
   menerima semua bentuknya. Satu-satunya perubahan backend S6-T2: validasi
   preset-chip terjadi client-side (server regex sudah ada di 3 route).

**Alternatif yang ditolak**

- Tabel `clock_presets`: data statik murni UI; menambah migrasi tanpa manfaat.
- Kirim `category` (bullet/blitz/rapid) dari client: kategori diturunkan dari `tc`
  di sisi SQL (`api/leaderboard` sudah lakukan) — dua sumber kebenaran = drift.
- Field warna di `SeekTicket`: mengubah kunci pool (`seek:pool:{tc}:{mode}`) dan
  matcher = diff besar untuk satu chip UI.

---

## D3 — Abort / Rematch / Offer-Draw: hook `api/pvp` + `api/challenge`, 4 event WS NEW

**Keputusan:**

1. **Abort (awal game):** REUSE `POST /api/pvp { action: "leave" }` — op existing
   sudah menghapus room in-memory; ditambah perilaku: jika room sudah `active`
   dan belum ada move masuk (`moves.length === 0`), set `status:'finished',
   outcomeKind:'aborted', winner: null` sebelum delete; publish **NEW
   `GameAborted`** ke `gameTopic(room.code)` — agar lawan tidak terjebak di
   board. Untuk room dari `db-*` flow (games row): abort = `roomOutcome` op
   resign dengan `outcomeKind` khusus tidak ada; keputusan: abort DB game =
   `POST /api/match-result { gameId, history:[], winner:'draw' }` **tidak** —
   flow DB (challenge/seek) di S6 batch-1 memakai room in-memory; DB games
   abort didefer (YAGNI) karena quick-pairing via seek sudah menghasilkan room
   aktif in-memory lewat `api/pvp create`. Kontrak: abort hanya dioprasikan
   pada room in-memory; games row dari challenge yang belum dimainkan ditutup
   lewat `DELETE /api/challenge?id=` existing (status 'cancelled') — sudah ada.
2. **Rematch:** REUSE penuh `POST /api/challenge { toUserId, timeControl, rated: true }`
   — pola exact yang sudah dipakai `components/views/archive-view.tsx`
   (`sendRematch`: lookup `GET /api/auth/lookupByUsername` → POST challenge
   dengan `time_control` dari game). `components/game-over-modal.tsx` (T3)
   memakai callback `onRematch?` yang memanggil util yang sama (extract
   `sendRematch` dari archive-view ke `lib/rematch.ts` — refactor frontend
   lokal, bukan endpoint baru). Respons 201 `{ ok, challengeId }` + event
   WS existing `ChallengeReceived` sudah ada di matcher lawan.
3. **Offer-draw:** REUSE `POST /api/pvp { action: "draw", code, playerToken }`
   (op `roomOutcome` existing, `winner:'draw'`) untuk game in-memory berjalan.
   Semantik offer-accept (bukan direct-draw): draw offer dioprasikan sebagai
   **event NEW `DrawOffered`** yang dipublish route kecil
   **NEW `POST /api/pvp` op `action:"draw-offer"`** (body `{ code, playerToken }`)
   → publish `DrawOffered { gameId:code, fromUser }` ke topik room; lawan
   merespons via op existing `action:"draw"` (accept = outcome draw) atau
   **NEW event `DrawDeclined`** via op `action:"draw-decline"` — 2 op baru
   di route existing (diff: ~30 baris, tidak ada file route baru). Modal
   game-over (T3) menampilkan offer lewat event tsb; tombol Rematch/Absorbed
   mengikuti D3.2.
4. **Event WS NEW (ditambah ke union `RealtimeEvent` di `lib/realtime/events.ts`,
   topic builder tetap `gameTopic`/`matcherTopic`):**
   - `GameAborted { type:"game_aborted"; gameId: string; reason: "aborted" }`
     → topic `game/<id>/moves` (kedua pemain) — D3.1.
   - `DrawOffered { type:"draw_offered"; gameId: string; fromUser: string }`
     → topic `game/<id>/moves` — D3.3.
   - `DrawDeclined { type:"draw_declined"; gameId: string }`
     → topic `game/<id>/moves` — D3.3.
   - `RematchRequested { type:"rematch_requested"; gameId: string; challengeId: string; fromUser: string }`
     → topic `matcher/<userId>` target (menambah konteks di atas event
     `ChallengeReceived` existing; UI game-over menampilkan "rematch dari
     partai X" tanpa fetch terpisah).
   **Tidak ada event `GameResigned` baru:** resign = `op resign` existing +
   event existing `GameEnded { result }` yang sudah dipublish
   `api/match-result` (`lib/realtime/events.ts` L10) — REUSE.
5. **Auth/error codes:** semua op `api/pvp` tetap 401 tanpa session (pola
   existing); `account_pending` 403 mengikuti `resolvePgUser` (FIX-1) untuk
   path DB; room in-memory memakai guard session-store existing
   (`me.status !== "approved"` → room op menolak, pola `roomCreate` yang
   sudah cek `status approved` pada invitedUser — diperluas ke creator:
   user pending tidak boleh membuat room; +1 baris, tercatat di kontrak).
   503 `service_unavailable` hanya untuk path yang menyentuh PG (`match-result`,
   `challenge`) — room ops in-memory tidak bisa 503.

**Alternatif yang ditolak**

- Endpoint terpisah `api/pvp/[id]/rematch`: rematch = challenge biasa (flow
  async accept/decline + WS ChallengeReceived sudah jalan); endpoint baru
  menggandakan state machine.
- WS `RematchAccepted` dkk.: lifecycle rematch = lifecycle challenge existing
  (`ChallengeReceived`/`ChallengeResolved`/`GameStarted`); satu event
  `RematchRequested` cukup untuk UX modal.
- Menambah status baru `challenges.status`: tidak perlu — rematches selalu
  lewat row pending existing.

---

## D4 — Insights: SQL-side agregasi dari `games` (mirip `api/stats/summary`), deep-link publik tanpa auth

**Keputusan:**

1. **`NEW GET /api/insights` (auth, windowed, per-pemain)** — agregasi
   "tren pemain" dari `games` (+rating before/after), pola
   query-per-pemain yang sama persis dengan `app/api/stats/summary/route.ts`
   (filter `g.status='finished'`, `split_part` kategori waktu dari
   `api/leaderboard`, `byType` breakdown, rating graph per game).
   Param: `?user=<username>&window=30|90|365|all&game_type=bullet|blitz|rapid&color=w|b`
   — semua filter di **SQL** (guardrail no-client-side-filter, aturan
   global no-mock: angka selalu dari query). Response `InsightsResponse`
   (bentuk di kontrak) = `totals` + `byType` + `ratingGraph` + `recentGames`
   (≤10, shape reuse `recentGames` dari `GET /api/home/dashboard`).
2. **Deep-link publik `/insights/<user>` = `GET /api/insights?user=<username>`
   dengan `user` ≠ session → publik, tanpa guard auth** (data yang
   di-expose = rating + ringkas hasil, konsisten dengan `api/leaderboard`
   yang sudah mempublikan rating semua user; tidak ada PII baru — username
   + rating sudah tampil di leaderboard). 404 kalau username tak ada.
   **403 `account_pending` tetap berlaku untuk pemilik sesi** yang status
   pending membuka `/insights` miliknya (guard `resolvePgUser` di query
   user=me) — publik tidak di-guard.
3. **Tampilan tab `[Semua|Warna|Buah|Pemain|Performa Lampau]`** = murni
   client-side atas `InsightsResponse`: Semua (totals+graph), Warna
   (`color=`), Buah (tidak ada data buah — tab disabled di S6, ditandai
   kontrak `buah: null` placeholder), Pemain (recentGames), Performa
   Lampau (ratingGraph + delta).
4. **TIDAK:** tabel `insights_cache` / view materialized — agregasi langsung
   dari `games` (indeks existing `idx_games_white_ended`/`_black_ended`,
   `idx_games_live_tc_minutes`) sudah cukup untuk ≤200k baris (db-audit).
   Menunda cache sampai benchmark nyata (YAGNI; `stats/summary` berjalan
   tanpa cache).

**Alternatif yang ditolak**

- Reuse `GET /api/stats/summary?user=`: endpoint existing hard-scoped ke
  session user (guardrail archive "tidak ada leak game user lain") —
  membuka `user` param di route existing memperluas attack surface route
  yang sudah QA-lock; endpoint baru yang eksplisit publik adalah diff
  yang bisa di-review satu arah.

---

## D5 — Tournaments Arena: list + join + scheduled start, matching = seek pool existing (YAGNI)

**Keputusan:**

1. **`NEW` 3 endpoint (satu modul, file `app/api/tournament/route.ts` +
   `[id].ts`, pola `api/challenge`):**
   - `GET /api/tournament` — daftar arena: `{ arenas: TournamentArenas[] }`;
     arena = objek in-memory (mirip `PvpRoom` pattern `api/pvp`)
     `{ id, name, timeControl, rated, status:"registration|live|finished",
     startAt (epoch), entrants, capacity, currentPlayers? }`. In-memory
     **dan** persist minimal: `NEW` tabel `tournaments` di migrasi S6
     (id, name, time_control, rated, start_at, capacity, status, created_at)
     + `tournament_players` (tournament_id, user_id, status joined) —
     2 tabel kecil, karena scheduled start harus bertahan restart process
     (room in-memory tidak bisa; deviasi in-memory ditolak).
   - `POST /api/tournament { name?, timeControl?, rated?, startAt?, capacity? }`
     (creator) / `POST /api/tournament/[id]` (join, body `{ user }`
     opsional → join sesi) — join = insert `tournament_players` +
     publish **NEW `TournamentUpdated`** ke topic NEW
       `tournament/<id>` (builder NEW di `lib/realtime/events.ts`) +
       salinan `toastsTopic(creator)` (builder existing) agar creator
       dapat notifikasi di tab lain.
   - `GET /api/tournament/[id]` — detail arena + entrants (bootstrap).
2. **Matching = REUSE seek pool, TANPA matching di dalam tournament.**
   Saat `startAt` tiba (trigger: cron ringan `setInterval` 30s in-process
   + sweep startup — pola `lib/realtime/matcher.ts` yang dipicu event,
   bukan timer terpisah), runner hanya: ambil entrants arena, **pair
   entrants lalu `onSeekCreated`-setara** — implementasi konkret: untuk
   tiap arena live, runner membuat seek ticket sementara
   `lib/realtime/seek-pool.ts` per entrant dengan `tc` = time_control
   arena dan `mode` = rated?arena, membiarkan matcher existing
   (`lib/realtime/matcher.ts`) yang sudah atomic-Lua yang pairing &
   membuat `games` row + publish `GameAdded`/`GameStarted` (event
   existing, REUSE). **Tidak ada pairing algorithm baru, tidak ada
   bracket, tidak ada live ranking in-arena** — entrants yang
   belum ter-pair masuk ronde 2 dengan seek berikutnya (sweeper
   30s). YAGNI tegas: scope S6 = list + join + scheduled start
   (sesuai tiket S6-T5); bracket/Swiss/king-of-the-hill didefer ke
   S8+ / post-S6 ticket terpisah.
3. **Auth:** `GET /api/tournament` publik (list arena tidak sensitif);
   join/creat → guard session (401 tanpa session, 403 `account_pending`
   per FIX-1 untuk user pending — pola `roomCreate` pvp yang sudah
   menolak pending). DB down → 503 `service_unavailable` (pola
   `resolvePgUser`).
4. **Event WS NEW:** `TournamentUpdated { type:"tournament_updated"; tournamentId: string; status: "registration"|"live"|"finished"; entrants: number }`
   → topic `tournament/<id>` (builder baru) — dipakai tab list untuk
   update live tanpa polling; lifecycle match/game lawan = event
   existing `GameAdded`/`GameStarted`/`GameEnded` (REUSE, masing-masing
   player subscribe via topic existing).
   **Alternatif ditolak:** polling 5s untuk list (sudah ada WS,
   ADR-001 menolak polling), Redis-only tanpa tabel (scheduled start
   setelah deploy/restart akan hilang — deviasi ke in-memory
   ditolak), bracket engine (out of scope YAGNI).

---

## Implikasi deploy / migration

- **Migrasi S6** (`docs/db/sprint6-migration.sql`, idempoten, pola
  sprint4-migration): `tournaments` + `tournament_players` (D5). Tidak
  ada perubahan `games`/`challenges`/`users` (D1–D4 reuse skema existing).
- **Redis:** seek pool & event stream tidak berubah (D2, D3); D5
  memakai seek pool existing (tidak ada kunci pool baru — tc string
  yang sama dengan pairing manual).
- **WS gateway (`server.ts`/`lib/realtime/ws-gateway.ts`):** tidak
  berubah — hanya union event di `events.ts` yang tumbuh (7 type NEW
  total: `GameAborted`, `DrawOffered`, `DrawDeclined`,
  `RematchRequested`, `TournamentUpdated` + builder `tournamentTopic`)
  — semua lewat `RealtimeBus` existing (ADR-002 seam tunggal, tetap
  terpelihara).
- **Auth:** tanpa perubahan mekanisme (session cookie + `/api/gate`);
  FIX-1 codes (`401 unauthenticated`, `403 account_pending`,
  `503 service_unavailable`) diadopsi route-route baru D4/D5.

## Alternatif yang ditolak (lintas D)

- Satu endpoint "gameflow" megabuster: melanggar pola route per-domain
  existing (`challenge`, `seek`, `pvp`); dipecah per D di atas.
- Event WS biner/opsi chess.com REA: ditolak di ADR-001 (JSON framing
  saja); S6 menambah 5 event JSON pada union yang sama.
