# ADR-010: Sprint 7 Learn Layer — Courses, Lessons & Openings, Practice, Classroom, Endgames

**Status:** Accepted · **Date:** 2026-10-27 · **Scope:** S7 batch (S7-T1..T5, `docs/tickets/S7-learn-layer.md`)
**Contract:** keputusan ini dikonektifkan satu file kontrak shared backend+frontend di `docs/contracts/sprint7.md` (contract-first — implementasi S7 membaca shape tsb, tidak menafsirkan ulang).

## Konteks

S7 menambah lapisan belajar: (T1) Courses `/courses` + deep-link course id, (T2) Lessons & Openings
Lessons (upgrade `/learn`), (T3) Practice hub `/practice`, (T4) Classroom `/classroom`
(collab 2-pemain), (T5) Endgames multi-filter + leaderboard `/endgames`. Basis yang sudah ada
dan WAJIB dipakai ulang (prinsip global S7: anti-slop, no-mock — progres/angka selalu dari data
riil, YAGNI/minimal-diff, a11y floor, aset/teks/icon HANYA pola dari chess.com — tidak ada
material berhak cipta yang disalin; semua copy ID original):

- `components/views/learning-hub.tsx` + konten tutorial 13 bab (Bain) — pattern konten statis
  terkurasi sudah terbukti; quest progress guest = localStorage (tanpa server).
- `lib/endgame-drills.ts` + `app/api/endgames/drills` (S4-T4): 6 set kurasi statis + progress
  **solved-unique/total di-derive SQL-side dari `puzzle_attempts`** — tanpa tabel baru (keputusan
  #1 docs/db/sprint4.md).
- `app/api/puzzles/themes` (S3-T4): agregasi per tema SQL-side dari `puzzles.themes` (GIN
  `idx_puzzles_themes_gin`) × `puzzle_attempts` — mastery riil.
- `lib/opening-book.ts` (ECO map, 15 entri, nama/moves SAN) + `lib/engines/opening-book.ts`
  (FEN→kandidat UCI, ~180 entri) + `POST /api/opening` (S6 REUSE) + `GET /api/opening/win-rate`
  (S6 NEW, kini REUSE).
- `POST /api/pvp` (PvpRoom in-memory, kode `FIF-XXXXXX`, prune 30 menit) + WS bus ADR-001/002
  (`RealtimeEvent` union, topic builder tunggal, `publishBusEvent`).

**Verifikasi skema (psql `sxz-server` → `jev-postgres`, 2026-10-27):** 13 tabel —
`analysis_results, challenges, extra_security_sessions, friends, game_moves, games,
puzzle_attempts, puzzles, rate_limits, tournament_players, tournaments, users`. **Tidak ada**
`learning_progress`, `course_progress`, `user_bookmarks`. Tabel sumber progres tunggal =
`puzzle_attempts` (kolom riil: `user_id, puzzle_id, correct, time_spent_sec, attempted_at`;
indeks `idx_puzzle_attempts_user_time`, `idx_puzzle_attempts_user_correct_time`,
`idx_puzzle_attempts_puzzle`).

Koordinasi paralel: DB engineer menulis `docs/db/sprint7.md` — ADR ini memutuskan
**NO-NEW-TABLE**, jadi dokumen S7-DB = verifikasi + pencatatan keputusan (bukan desain tabel).

---

## D1 — Courses: konten = kurasi statis `lib/courses.ts`, progress = REUSE `puzzle_attempts` (NO-NEW-TABLE)

**Keputusan:**

1. **Konten course = modul statis `lib/courses.ts` (file baru, konten terkurasi, no-mock):**
   `COURSES: Course[]` dengan `Course { id, title, description, steps: CourseStep[] }` dan
   `CourseStep { id, kind, ref, title }`. Step **hanya mereferensikan konten yang JUALAH
   ada** (pola S7-T1: tidak bikin konten baru dari nol):
   - `kind: "puzzleTheme"` → `ref` = key tema `lib/puzzle-themes.ts` (mis. `fork`, `endgame`).
   - `kind: "drillSet"` → `ref` = set id `lib/endgame-drills.ts` (mis. `rook-endgame`).
   - `kind: "opening"` → `ref` = ECO code (mis. `C60`); step = latihan tema puzzle `opening`.
   - `kind: "lesson"` → `ref` = lesson id `lib/lessons.ts` (D2).
2. **Progress tracking = REUSE `puzzle_attempts`, TANPA tabel baru (YAGNI):** semua progres
   riil di learn-layer sudah hidup di `puzzle_attempts` (drill set S4 + tema S3). Step course
   menunjuk domain itu, jadi completion step **di-derive SQL-side read-only** — persis query
   existing: `puzzleTheme`/`opening` = pola `api/puzzles/themes` (correct-unique/total per
   tema); `drillSet` = pola `api/endgames/drills` (solved-unique/total per set); `lesson` =
   completion tercatat di file store `learn-state.json` (D2 — satu-satunya sumber step
   non-SQL, eksplisit didokumentasikan di kontrak). `progressPct` course = rata-rata step
   (0..100, bulat). **Tidak ada write path baru**: tidak ada INSERT course-progress dari
   mana pun — progres tercatat lewat `POST /api/puzzles/[id]/attempt` REUSE.
3. **Endpoint (NEW, 2, 1 modul):** `GET /api/courses` (+filter opsional `?opening=<eco>` —
   CTA cross-link Explorer S6-T1 `/courses?opening=<eco>` sudah me-prepare flag
   `hasLessons`) dan `GET /api/courses/[id]` (404 course tak dikenal). Shape di kontrak.

**Alternatif yang ditolak**

- **Tabel baru `course_progress`/`learning_progress`** (opsi DB engineer di tiket): step
  course = kurasi atas domain yang progresnya SUDAH terukur di `puzzle_attempts`; tabel baru
  = duplikasi data + write path sendiri + sinkronisasi dua sumber = diff tanpa manfaat.
  YAGNI: sama alasan S4-T4 ("tanpa tabel baru").
- **Konten course di DB (admin CRUD course)**: out of scope S7; kurasi statis matches
  pattern learning-hub yang terbukti (konten berubah via code review, bukan runtime admin).

---

## D2 — Lessons: konten teks statis `lib/lessons.ts` + latihan interaktif FEN; bookmark = REUSE pattern file store `users.json` (bukan pg, bukan localStorage)

**Keputusan:**

1. **Konten lesson = modul statis `lib/lessons.ts` (file baru, 100% copy original — HONEST:
   video placeholder TIDAK ada aset video, view menampilkan materi tertulis + ilustrasi
   papan/posisi, sesuai tiket).** Frontend mengimport katalog langsung dari modul (pola
   `lib/puzzle-data.ts` di learning-hub) — **tidak ada endpoint katalog lesson**.
2. **Latihan interaktif per lesson = react-chessboard FEN, dua jenis (kontrak D2.2):**
   - `dbPuzzle`: `ref` = id puzzle existing di DB; verifikasi + pencatatan **REUSE
     `POST /api/puzzles/[id]/attempt`** → progres riil (masuk semua agregasi S3/S4/D1/D4/D6).
   - `bookMove`: posisi FEN + "cari book move" — kandidat langkah dari
     `lib/engines/opening-book.ts` `OPENING_BOOK` (client-side, REUSE data, TIDAK engine
     baru). **Tanpa pencatatan server** — UI label jujur "tidak tercatat" (no-mock: jangan
     inventarisasi progres yang tidak ada sumbernya).
3. **Bookmark + lesson completion = REUSE pattern store file `users.json` legacy
   (`lib/auth-store.ts`: `DATA_DIR/users.json`, load-modify-save) → store saudara
   `lib/learn-store.ts` (`DATA_DIR/learn-state.json`), keyed by username:**
   `{ [username]: { bookmarks: string[]; lessonsCompleted: string[] } }`. Dua endpoint baru
   (kontrak D2.2): `GET /api/learn/bookmarks` (bootstrap: bookmarks + lessonsCompleted) dan
   `POST /api/learn/bookmarks { id, kind, on }` (toggle; `kind:"lesson"` + `on:true` =
   tandai lesson selesai → juga tercatat di course step `lesson` D1). **TIDAK pg**:
   bookmark = data kosmetik, low-volume, user-scoped; tabel pg butuh migrasi + write route
   + guard auth hanya untuk dua array string — YAGNI menolak. **TIDAK localStorage**:
   localStorage learning-hub adalah pattern guest-only; akun login harus ikut antar-device.
   Durability multi-instance = sama dengan users.json (single-instance, house style
   terdokumentasi) — cukup untuk S7.

**Alternatif yang ditolak**

- **`user_bookmarks` di pg**: migrasi + endpoint ber-guard + dua sumber kebenaran progress
  (pg + file) untuk fitur kosmetik — diff lebih besar dari manfaat (D1 sudah menolak tabel
  baru; konsisten).
- **localStorage untuk bookmark**: hilang antar-device untuk user login; melanggar
  konsistensi "progres akun = server-side" (S3/S4 semua di pg).

---

## D3 — Openings Lessons: WRAP data engine yang JUALAH ada, 3 mode belajar = state machine client-side (TIDAK ada endpoint/data baru)

**Keputusan:**

1. **Katalog openings lesson = WRAP data riil existing — TIDAK engine data baru:**
   nama/ECO/moves SAN dari `lib/opening-book.ts` (ECO map existing) + kandidat move dari
   `lib/engines/opening-book.ts` (`OPENING_BOOK` FEN→UCI, `getOpeningBookMove`). Lesson
   openings = entry `lib/lessons.ts` ber-`openingEco` (D2.1) — konten teks 100% original
   (hard rule: tidak ada material berhak cipta chess.com; ECO code + nama pembukaan =
   fakta, bukan ekspresi berhak cipta).
2. **Tiga mode belajar `jelaskan → tantangan → kemahiran` = state machine CLIENT-SIDE di
   atas data yang sama (tanpa state server, tanpa event WS, tanpa endpoint baru):**
   - **Jelaskan**: teks lesson + ilustrasi papan (FEN dibangun client dari moves ECO via
     chess.js) + lookup riil `POST /api/opening { fen }` [REUSE] (cross-link dari
     Explorer S6-T1: CTA "Materi" → `/learn?module=openings&eco=<eco>`).
   - **Tantangan**: drill riil = puzzle DB tema `opening` — `GET
     /api/puzzles/next?theme=opening` [REUSE] → `POST /api/puzzles/[id]/attempt` [REUSE]
     (progres tercatat, ikut agregasi mingguan D4 + mastery D3.2 + course step D1);
     opsional mini-eksperimen `bookMove` (tanpa pencatatan — label jujur).
   - **Kemahiran**: mastery riil = `GET /api/puzzles/themes?theme=opening` [REUSE]
     (`masteryPct` dari `puzzle_attempts`). **Kemahiran per-ECO TIDAK tersedia**
     (tidak ada sumber data riil per-ECO) → jangan tampil angka palsu (no-mock rule).
3. **Cross-link dua arah:** Explorer `/explorer` → CTA "Materi" (flag `hasLessons`
   S6-T1 sudah siapkan) → lesson; lesson `openingEco` → back-link `/explorer?opening=<eco>`.
   Navigasi internal, bukan endpoint.

**Alternatif yang ditolak**

- **Tabel win-rate/mastery per-ECO baru**: tidak ada sumber data riil (S6 D1.2 sudah
  memutuskan win-rate hanya per-FEN dari `games`×`game_moves`) — tabel per-ECO = angka
  kosong yang melanggar no-mock.
- **Endpoint "opening lesson" pembungkus engine**: data sudah ada di dua modul lib +
  endpoint `api/opening` existing; wrapper endpoint = permukaan baru tanpa data baru.

---

## D4 — Practice hub: THIN ROUTER ke data drill existing + weekly target dihitung SQL-side dari `puzzle_attempts`

**Keputusan:**

1. **`/practice` = thin router (1 pintu masuk, 0 data drill baru):** pilihan kategori
   (tactical motif / endgame / opening) memetakan ke sumber existing —
   - **Tactical motif:** `GET /api/puzzles/themes` [REUSE] + `GET /api/puzzles/next?theme=`
     [REUSE] + `POST /api/puzzles/[id]/attempt` [REUSE].
   - **Endgame:** `GET /api/endgames/drills` [REUSE] + `GET /api/endgames/drills/[setId]/next`
     [REUSE].
   - **Opening:** tema `opening` dari sumber yang sama (pola D3.2).
   Tidak ada drill engine / pool puzzle baru (YAGNI — D4 = peralatan, bukan konten).
2. **Target mingguan = NEW `GET /api/practice/weekly` (1 endpoint), dihitung SQL-side
   dari `puzzle_attempts` (window 7 hari, indeks `idx_puzzle_attempts_user_time`):**
   `target` = konstanta route `WEEKLY_TARGET = 20` (puzzle benar unik/minggu —
   didokumentasikan di kontrak, TIDAK dihitung client — no-mock); `correct`/`attempted`
   = `count(DISTINCT puzzle_id)` window 7 hari. Respons `WeeklyTargetResponse`
   (kontrak D4.2). Guard `resolvePgUser` (FIX-1: 401 / 403 `account_pending` / 503).

**Alternatif yang ditolak**

- **Target mingguan per-user disimpan (tabel setting user)**: konstanta global cukup
  (YAGNI); personalisasi target = S8+ setelah ada adopsi nyata.
- **Agregasi mingguan client-side** (fetch attempts mentah, hitung di browser): melanggar
  guardrail no-client-side-filter + no-mock; SQL-side 1 query (pola `api/puzzles/stats`).

---

## D5 — Classroom: REUSE PvpRoom + WS bus untuk mode collab 2-pemain (room code, TIDAK ada AI matching, TIDAK ada persistensi)

**Keputusan:**

1. **Room = REUSE `POST /api/pvp` op `create`/`join`/`move`/`leave`/`resign`/`draw`
   (PvpRoom in-memory, kode `FIF-XXXXXX`, prune idle 30 menit REUSE)** dengan dua
   ekstensi additive minimal:
   - **flag body create baru:** `classroom?: boolean` [NEW field opsional] — menandai
     room classroom untuk copy UI; response shape REUSE
     (`{ success, room, yourSide, playerToken }`), `room` kini membawa
     `classroom: boolean` secara additive (`publicRoom`).
   - **op baru `note`:** `POST /api/pvp { action:"note", code, playerToken, text }`
     [NEW op di route existing] → catatan teks (annotate board bersama, max 500 karak-
     ter, trim; `room.notes` in-memory cap 50 newest) + publish event NEW
     `ClassroomNote` (topik `gameTopic(code)` — builder REUSE, tidak ada topik baru).
   - **notifikasi lawan join:** event NEW `ClassroomJoined` (topik `gameTopic(code)`)
     — dipublish saat op `join` sukses pada room ber-flag classroom.
2. **Tanpa AI matching:** tidak ada flow seek/challenge untuk classroom (YAGNI —
   tiket eksplisit "join by room ID"); lawan datang via kode room (share manual/undang
   via op `create` `invitedUser` REUSE).
3. **Tanpa persistensi:** room hidup di `Map` in-memory + prune existing (deviasi
   eksplisit tercatat: collaboration ephemeral; hilang saat restart/30 menit idle —
   didokumentasikan di kontrak); **tidak ada write DB sama sekali** di op classroom.
   Sync langkah = response op `move` REUSE (behavior pvp existing, tidak diubah di S7 —
   move-push event = S8+ jika TL mau); push baru S7 hanya `ClassroomJoined` +
   `ClassroomNote`.
4. **Error codes (REUSE pola `api/pvp`):** 401 tanpa sesi, 403 `account_pending`/
   `account_rejected` (guard creator FIX-1 S6 D3.5 REUSE, op `note`/`join` ikut),
   404 kode tak ditemukan, 400 room tak aktif / `note` kosong / >500 karakter, 409
   bukan giliran (op `move` REUSE), 429 rate limit in-memory REUSE. **Tidak bisa 503**
   (room ops in-memory — pola S6 §kontrak).

**Alternatif yang ditolak**

- **Tabel `classrooms`/rekaman persisten**: tiket eksplisit "tanpa persistent rekaman";
  room in-memory sudah punya prune + kode share — tabel = diff tanpa fitur.
- **Topik WS baru `classroom/<code>`**: kode room sudah berperan sebagai id topik via
  `gameTopic` (ADR-001: topic builder tunggal — jangan tambah string topic tersebar).
- **Matching AI / seek pool untuk classroom**: keluar scope YAGNI (D5 = collab, bukan
  matchmaking).

---

## D6 — Endgames multi-filter + leaderboard: SQL-side dari sumber riil `puzzle_attempts` (nama tabel terverifikasi psql)

**Keputusan:**

1. **Sumber progress drill endgame = TABEL RIIL `puzzle_attempts`** (verifikasi psql
   2026-10-27, §Konteks) — pola S4-T4: `puzzle_attempts` × `puzzles` + set id dari
   `lib/endgame-drills.ts` `DRILL_SETS`. **Tidak ada tabel drill / endgame-progress di
   DB** (pola kurasi statis `lib/endgame-drills.ts` = keputusan #1 S4-T4, tetap).
2. **Multi-filter = REUSE route + param NEW (additive):** `GET /api/endgames/drills`
   kini menerima `?theme=<endgameThemeKey>` (key = tema set di `DRILL_SETS`:
   `rookEndgame | pawnEndgame | bishopEndgame | knightEndgame | queenEndgame |
   queenRookEndgame`; SQL-side `themes` filter, pola GIN) dan `?minProgress=<0..100>`
   (filter set oleh `progressPct` yang TERHITUNG SQL-SIDE — bukan filter client;
   guardrail no-client-side-filter). Shape respons `{ sets: [...] }` TIDAK berubah
   (additive-only, TL regression: panggil tanpa param = behavior S4 exact).
3. **Leaderboard = NEW `GET /api/endgames/drills/leaderboard` (publik, pola
   `api/leaderboard` — username+rating sudah publik, tidak ada PII baru):**
   `?set=<setId>` (opsional; default = gabungan 6 set) + `?limit=` (default 20, cap 50);
   404 set tak dikenal; 503 DB down. Agregasi SQL-side (kontrak D6.2): top-N user
   per `count(DISTINCT puzzle_id)` attempt benar di dalam `puzzleIds` set (index
   `idx_puzzle_attempts_puzzle` + `idx_puzzle_attempts_user_correct_time`).
   **No-mock: user yang tidak tercantum = tidak ada attempt benar di set tsb** —
   jangan isi baris placeholder.

**Alternatif yang ditolak**

- **Tabel materialized leaderboard / cache**: volume riil rendah (db-audit ≤200k baris,
  `stats/summary` + `insights` S6 berjalan tanpa cache) — YAGNI; benchmark dulu.
- **Filter client-side di view `/endgames`**: melanggar guardrail global; semua filter
  SQL-side (D6.2).

---

## Implikasi deploy / migration

- **DB: TIDAK ADA migrasi S7 (NO-NEW-TABLE, penanda eksplisit di kontrak §4).**
  Dokumen `docs/db/sprint7.md` (DB engineer, paralel) = verifikasi ini: 0 tabel baru,
  0 perubahan skema; jika TL memaksa opsi tabel di masa depan, ADR-010 D1/D2 adalah
  rujukan penolakannya.
- **Redis:** tidak berubah — tidak ada kunci pool baru (D5 menolak matching; D1–D4/D6
  = HTTP + file store).
- **WS gateway (`server.ts`/`lib/realtime/ws-gateway.ts`):** tidak berubah — hanya
  union `RealtimeEvent` (`lib/realtime/events.ts`) tumbuh 2 type additive
  (`ClassroomJoined`, `ClassroomNote`); topik REUSE `gameTopic` — TL regression gate
  sama pola S6.
- **File store baru (runtime, bukan migrasi):** `DATA_DIR/learn-state.json` dibuat
  on-demand oleh `lib/learn-store.ts` (pattern load-modify-save `lib/auth-store.ts`).
- **Auth:** tanpa perubahan mekanisme; kode FIX-1 (`401 unauthenticated`,
  `403 account_pending`, `503 service_unavailable`) diadopsi route yang menyentuh PG
  (`/api/courses*`, `/api/practice/weekly`, leaderboard 503-only). Route file store
  (`/api/learn/bookmarks`) = 401/400 saja (tidak menyentuh PG).
- **A11y floor + DHH di semua view baru** (courses, lessons, practice, classroom,
  endgames): skip-link, `aria-label` ber-ID stabil, focus-visible, kontras — gate TL;
  DHH = semua angka di layar mengalir dari sumber existing (tanpa input data manual,
  tanpa angka statis) — gate TL, bukan kontrak API.

## Alternatif yang ditolak (lintas D)

- **Megabuster `api/learn` satu endpoint semua domain**: melanggar pola route
  per-domain existing (`puzzles`, `endgames`, `pvp`); dipecah per D di atas.
- **Tabel progress belajar (`learning_progress`) satu untuk course+lesson+bookmark**:
  progres riil sudah ada di `puzzle_attempts` (D1) + kosmetik low-volume di file store
  (D2) — tabel universal = duplikasi + write path kedua.
- **Rekam classroom / matching AI / bracket endgame**: out of scope tiket S7; YAGNI
  (catatan S8+).
