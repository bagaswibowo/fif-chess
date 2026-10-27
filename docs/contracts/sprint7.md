# Sprint 7 Learn Layer — Shared API Contract (contract-first, backend + frontend)

**Status:** Accepted · **Date:** 2026-10-27 · **Sumber keputusan:** `docs/adr/ADR-010-sprint7-learn.md`
**Scope:** S7-T1..T5. Satu-satunya kontrak shared yang di-import kedua sisi (backend
implement route, frontend implement caller). Semua bentuk di bawah harus eksak —
tidak menambah field tanpa ADR.

Kunci konvensi (sama dengan `docs/contracts/sprint6.md`):
- **[REUSE]** = endpoint/field/op/event yang SUDAH ADA (grep `app/api/…`,
  `lib/realtime/events.ts`, `lib/realtime/bus.ts`, `docs/db/db-schema.sql`).
  Tidak berubah di S7.
- **[NEW]** = endpoint/op/field/event/file yang dibuat S7 (ADR-010). Tiap item
  [NEW] merujuk keputusan ADR-010 D1..D6.
- **[NO-NEW-TABLE]** = penanda eksplisit: tidak ada perubahan skema PostgreSQL
  di S7 (verifikasi psql 2026-10-27: 13 tabel, tidak ada
  `learning_progress`/`course_progress`/`user_bookmarks`). Satu-satunya store
  baru = file `DATA_DIR/learn-state.json` (pattern `lib/auth-store.ts`, ADR-010 D2).
- Error codes standar (`lib/puzzle-api.ts`, FIX-1): `401 unauthenticated`,
  `403 account_pending`, `403 account_rejected`, `403 account_missing`,
  `503 service_unavailable` (DB down, retryable), `429` (rate limit, retryable).
  Room ops in-memory (`api/pvp`) tidak bisa 503 (tidak menyentuh PG).
  Response error shape: `{ error, code?, retryable }` (pola `puzzle-api.ts`).

---

## 1. Endpoint — HTTP

### 1.1 Courses (S7-T1, ADR-010 D1)

`GET /api/courses` **[NEW — auth; filter opsional `?opening=<eco>`]** →
`{ courses: CourseSummary[] }`. 401/403-FIX-1/503. `?opening=` (dari CTA
"Materi" Explorer S6-T1 `?opening=<eco>`) = course yang min. 1 step
`opening` dengan `ref === eco`; respons = subset + flag `course.matched: true`.

`GET /api/courses/[id]` **[NEW — auth]** → `{ course: Course, progress: CourseProgress }`.
404 course tak dikenal. Progress = **riil, SQL-derived** (NO-NEW-TABLE):

```ts
// lib/courses.ts [NEW file, konten kurasi statis — shape eksak]
type CourseStepKind = "puzzleTheme" | "drillSet" | "opening" | "lesson";
interface CourseStep {
  id: string;              // "courseId-stepN" (unik global, dipakai progress)
  kind: CourseStepKind;
  ref: string;             // puzzleTheme→key lib/puzzle-themes.ts; drillSet→set id
                           // lib/endgame-drills.ts; opening→ECO; lesson→lesson id lib/lessons.ts
  title: string;           // label ID original (copy, bukan judul buku pihak ketiga)
}
interface Course { id: string; title: string; description: string; steps: CourseStep[] }
interface CourseStepProgress {
  stepId: string;
  kind: CourseStepKind;
  total: number;           // domain: jumlah puzzle/set/lesson (bukan "target" buatan)
  solved: number;          // riil: correct-unique di domain tsb
  progressPct: number;     // 0..100 bulat (pola api/endgames/drills)
  complete: boolean;       // progressPct === 100 (lesson: tercatat di learn-state.json)
}
interface CourseProgress {
  steps: CourseStepProgress[];
  progressPct: number;     // rata-rata step (0..100, bulat)
}
```

Sumber progress per kind (**semua dari sumber riil existing — no angka statis**):
- `puzzleTheme`/`opening` → pola `api/puzzles/themes` (correct-unique/total tema,
  `opening` = tema `opening` dari `THEME_LIST` [REUSE]).
- `drillSet` → pola `api/endgames/drills` (solved-unique/total set).
- `lesson` → `lessonsCompleted` di `learn-state.json` (D2.3); `total: 1, solved: 0|1`.

### 1.2 Lessons & Bookmarks (S7-T2, ADR-010 D2)

Katalog lesson [NEW] **hanya modul client** `lib/lessons.ts` (frontend import
langsung — TIDAK ada endpoint katalog, pola `lib/puzzle-data.ts`):

```ts
// lib/lessons.ts [NEW file]
type LessonExercise =
  | { kind: "dbPuzzle"; puzzleId: string }          // REUSE POST /api/puzzles/[id]/attempt
  | { kind: "bookMove"; fen: string }               // REUSE data lib/engines/opening-book.ts
  | { kind: "themeDrill"; theme: string; count: number }; // REUSE GET /api/puzzles/next?theme=
interface Lesson {
  id: string;              // stabil, dipakai bookmark + course step kind "lesson"
  module: "tactics" | "openings" | "endgames" | "rules";
  title: string;           // copy ID original (HONEST: materi tertulis, TIDAK video)
  body: string;            // teks lesson
  boardFen?: string;       // ilustrasi papan (render react-chessboard, posisi demo)
  exercises: LessonExercise[];
  openingEco?: string;     // hanya module "openings" — wrap data existing (D3)
}
```

`GET /api/learn/bookmarks` **[NEW — auth; baca file store, TIDAK menyentuh PG]** →
`{ bookmarks: string[]; lessonsCompleted: string[] }` (key = lesson id).
401 tanpa sesi; TIDAK bisa 503 (source of truth = `learn-state.json`).

`POST /api/learn/bookmarks` **[NEW — auth]** body `{ id: string; kind: "lesson";
on: boolean }` → `{ ok: true; bookmarks: string[]; lessonsCompleted: string[] }`.
Semantik: `on:true` + `kind:"lesson"` = tandai selesai (termasuk `lessonsCompleted`;
menyuplai progress course step D1.2); `on:false` = hapus dari array tsb. 400 bila
`id` bukan lesson id valid (validasi against `lib/lessons.ts`) atau
`kind` selain `"lesson"` (S7 hanya lesson — YAGNI, extension S8+).

`bookMove` exercise: verifikasi **client-side** terhadap kandidat
`OPENING_BOOK[fen]` (REUSE data); **tanpa pencatatan server** — UI wajib label
"tidak tercatat" (no-mock: jangan klaim progres yang tidak ada sumbernya).

### 1.3 Openings Lessons (S7-T2/T3, ADR-010 D3)

**TIDAK ada endpoint/field baru di D3** — seluruh data = wrap REUSE:

| Butuh | Sumber (semua REUSE) |
|---|---|
| Katalog openings lesson | `lib/lessons.ts` (`module:"openings"`, `openingEco`) + `lib/opening-book.ts` (nama/ECO/moves SAN existing) |
| Lookup nama/ECO posisi saat "jelaskan" | `POST /api/opening { fen }` → `FenLookupResponse` (kontrak S6 §1.1) |
| Cross-link Explorer→lesson | `/explorer` CTA "Materi" → `/learn?module=openings&eco=<eco>` (navigasi, bukan endpoint — S6 §1.1) |
| Tantangan riil per lesson | `GET /api/puzzles/next?theme=opening` + `POST /api/puzzles/[id]/attempt` (lihat §1.4) |
| Kemahiran riil | `GET /api/puzzles/themes?theme=opening` → `masteryPct` (see §1.4) |
| Kemahiran per-ECO | **TIDAK ADA** — tanpa sumber data riil; UI tidak menampilkan angka (no-mock) |

Mode belajar 3 step (`jelaskan → tantangan → kemahiran`) = state machine
client-side (`type OpeningMode = "jelaskan" | "tantangan" | "kemahiran"`),
transisi dikendalikan user; tidak ada state server, tidak ada event WS.

### 1.4 Practice hub (S7-T3, ADR-010 D4)

Thin router — sumber drill = **REUSE penuh**:

```ts
// /practice hanya memanggil:
// tactical motif: GET /api/puzzles/themes [REUSE] → theme pick
//                 GET /api/puzzles/next?theme=<key>&minRating?&maxRating? [REUSE]
//                 POST /api/puzzles/[id]/attempt { correct, time_spent_sec, moves? } [REUSE]
// endgame:        GET /api/endgames/drills [REUSE] + GET /api/endgames/drills/[setId]/next [REUSE]
// opening:        tema "opening" (pola D3.2)
```

`GET /api/practice/weekly` **[NEW — auth; target+riil, window 7 hari SQL-side
dari `puzzle_attempts` (indeks `idx_puzzle_attempts_user_time` REUSE)]:**
401/403-FIX-1/503. `target` = konstanta server `WEEKLY_TARGET = 20`
(puzzle benar unik per minggu — eksplisit di kontrak, TIDAK dihitung client):

```ts
interface WeeklyTargetResponse {
  windowDays: 7;
  target: number;            // 20 (konstanta route)
  attempted: number;         // count(attempt) window 7 hari
  correct: number;           // count(DISTINCT puzzle_id) attempt benar window 7 hari
  onTrack: boolean;          // correct >= target
}
```

### 1.5 Classroom (S7-T4, ADR-010 D5)

Semua op di route existing `POST /api/pvp` (body `{ action, code, playerToken, … }`
— pola `components/pvp-panel.tsx` + kontrak S6 §1.3):

- **Create room classroom:** `POST /api/pvp { action: "create", classroom: true,
  side?, invitedUser? }` **[REUSE op; field `classroom` [NEW]]** → respons
  REUSE `{ success: true, room: PvpRoom, yourSide, playerToken }` dengan
  `PvpRoom.classroom: boolean` ditambahkan ke `publicRoom()` (additive field —
  S6 response tanpa flag tetap valid, TL regression gate).
- **Join:** `POST /api/pvp { action: "join", code, playerToken? }` **[REUSE op]**;
  saat join sukses pada room `classroom:true` → publish **`ClassroomJoined` [NEW]**
  (§2.2).
- **Note:** `POST /api/pvp { action: "note", code, playerToken, text }`
  **[NEW op — D5.1]** → `{ success: true, notes: RoomNote[] }` + publish
  **`ClassroomNote` [NEW]**. Guard: 404 room tak ada; 400 room tak `active` /
  `text` kosong / >500 karakter; 403 token invalid / bukan peserta (pola
  `sideOf` existing); 401/403-FIX-1 guard creator/join (S6 D3.5). `room.notes`
  in-memory: cap 50 newest (FIFO), termakan `publicRoom()` additive
  (`notes: RoomNote[]`).
- **Move / resign / draw / leave:** op existing [REUSE] tanpa perubahan
  (room collab = board play biasa; sync lawan = response `move` existing +
  event existing `MoveMade` [REUSE] — classroom tidak mengubah semantics).
- **Tanpa AI matching & tanpa persistensi (D5.2/D5.3):** tidak ada seek/
  challenge flow; room hilang saat restart/30 menit idle (prune REUSE) —
  UI wajib menampilkan notice "sesi sementara" (tidak dijanjikan keputus
  hati). Tidak ada write DB apa pun di op classroom.

```ts
interface RoomNote {
  id: string;                // uuid
  author: string;            // username (store, pola whiteUser/blackUser)
  text: string;              // max 500 karakter, trim
  moveCount: number;         // room.moves.length saat dibuat (pin note ke posisi)
  createdAt: number;         // epoch ms
}
```

### 1.6 Endgames multi-filter + leaderboard (S7-T5, ADR-010 D6)

**Tabel sumber riil = `puzzle_attempts`** (verifikasi psql 2026-10-27, ADR-010 D6.1)
× `puzzles` × set id `lib/endgame-drills.ts` [REUSE]. **[NO-NEW-TABLE].**

`GET /api/endgames/drills` **[REUSE route; param [NEW] additive:**
`?theme=<endgameThemeKey>&minProgress=<0..100>`]
- `theme` ∈ `{ rookEndgame, pawnEndgame, bishopEndgame, knightEndgame,
  queenEndgame, queenRookEndgame }` (= field `DrillSet.theme` existing;
  nilai lain = 400). Filter SQL-side (`$3::text = ANY(p.themes)` pola existing).
- `minProgress` (integer 0..100, default 0): filter set oleh `progressPct`
  TERHITUNG SQL-SIDE (CTE set→progressPct, lalu `WHERE progressPct >= $4`)
  — **bukan filter client** (guardrail).
- Respons shape `{ sets }` TIDAK berubah (field per set:
  `id, title, description, total, solved, progressPct`). Tanpa param
  = behavior S4-T4 exact (TL regression gate).

`GET /api/endgames/drills/leaderboard` **[NEW — publik (pola
`api/leaderboard`: username + rating sudah publik, tanpa PII baru);
503 DB down; 404 set tak dikenal]:**
param `?set=<setId>` (opsional; default = gabungan seluruh set `DRILL_SETS`)
& `?limit=<n>` (default 20, cap 50; <1 atau >50 = 400). Agregasi SQL-side
(satu query, `count(DISTINCT a.puzzle_id)` attempt `correct=true` dalam
`puzzleIds` set; index `idx_puzzle_attempts_puzzle` +
`idx_puzzle_attempts_user_correct_time`):

```ts
interface EndgameLeaderboardEntry {
  username: string;
  rating: number;          // users.rating [REUSE kolom]
  solved: number;          // unique puzzle solved di set (riil)
}
interface EndgameLeaderboardResponse {
  set: { id: string; title: string } | { id: "all"; title: "Semua drill" };
  limit: number;
  entries: EndgameLeaderboardEntry[];   // order solved DESC, username ASC; [] = tak ada attempt benar
}
```

No-mock: **user yang tidak tercantum = tidak ada attempt benar di set tsb**
— jangan isi baris placeholder angka statis.

---

## 2. WebSocket — event names & payloads

Framing/transport: REUSE penuh ADR-001/002 (`lib/realtime/ws-gateway.ts`,
`frame.ts` `{op, topic, offset?, payload?}`, auth handshake `jev_session`).
Publish via `publishBusEvent` (`lib/realtime/bus.ts`) — tidak ada client
publish. Tipe NEW ditambahkan ke union `RealtimeEvent`
(`lib/realtime/events.ts`) — **topik REUSE `gameTopic` (tidak ada builder
topik baru, ADR-001 #4)**.

### 2.1 Event [REUSE] yang dipakai S7 (sebutkan untuk kelengkapan kontrak)

| Event | Payload | Topic | Dipakai S7 |
|---|---|---|---|
| `GameStarted` | `{ gameId, white, black }` | `game/<id>/moves` | D5 (create→join lifecycle room) |
| `MoveMade` | `{ gameId, san, fen, moveNumber }` | `game/<id>/moves` | D5 (sync papan collab) |
| `GameEnded` | `{ gameId, result }` | `game/<id>/moves` | D5 (resign/draw/mate room classroom) |
| `GameAborted` | `{ gameId, reason }` | `game/<id>/moves` | D5 (op `leave` S6 D3.1 REUSE) |
| `DrawOffered` / `DrawDeclined` | S6 §2.2 [REUSE] | `game/<id>/moves` | D5 (op draw-* S6 REUSE) |

### 2.2 Event [NEW] — ADR-010 (hanya 2, keduanya D5)

```ts
// D5 — classroom (topik gameTopic(code) REUSE; code = FIF-XXXXXX pola PvpRoom.code)
type ClassroomJoined = {
  type: "classroom_joined";
  gameId: string;          // = room code
  user: string;            // username joiner (store, pola whiteUser/blackUser)
  side: "white" | "black";
};
type ClassroomNote = {
  type: "classroom_note";
  gameId: string;          // = room code
  note: RoomNote;         // shape §1.5
};
```

Union: `RealtimeEvent = … | ClassroomJoined | ClassroomNote` (additive —
subscriber lama tetap render, TL regression gate). `gameId` = kode room
in-memory (`FIF-XXXXXX`) — konsisten S6 §2.2 (classroom tidak bisa jadi
game pg: tanpa write DB, D5.3).

---

## 3. Matriks NEW vs REUSE (referensi cepat)

| Item | Status | ADR |
|---|---|---|
| `GET /api/courses`, `GET /api/courses/[id]` | **NEW** (auth, progress SQL-derived) | D1 |
| `lib/courses.ts` (modul konten kurasi) | **NEW** | D1 |
| `lib/lessons.ts` (modul konten lesson) | **NEW** (frontend-only, tanpa endpoint) | D2 |
| `GET /api/learn/bookmarks`, `POST /api/learn/bookmarks` | **NEW** (file store, bukan pg) | D2 |
| `lib/learn-store.ts` + `DATA_DIR/learn-state.json` | **NEW** (pattern REUSE `lib/auth-store.ts`) | D2 |
| `POST /api/pvp` op `create`/`join`/`move`/`leave`/`resign`/`draw` | REUSE (op) | D5 |
| `POST /api/pvp` op `create` field `classroom` + `publicRoom().classroom` | **NEW field additive** | D5 |
| `POST /api/pvp` op `note` + `publicRoom().notes` + `RoomNote` | **NEW op di route existing** | D5 |
| Event `ClassroomJoined` / `ClassroomNote` (+ union, topik `gameTopic` REUSE) | **NEW** (additive) | D5 |
| `GET /api/practice/weekly` | **NEW** (SQL-side `puzzle_attempts` 7 hari) | D4 |
| `GET /api/endgames/drills` | REUSE (route + respons shape; param **NEW** `theme`/`minProgress`) | D6 |
| `GET /api/endgames/drills/leaderboard` | **NEW** (publik, SQL-side) | D6 |
| `GET /api/endgames/drills/[setId]/next` | REUSE (tanpa perubahan) | D4/D6 |
| `POST /api/opening`, `GET /api/opening/win-rate` | REUSE (S6; wrap D3 "jelaskan") | D3 |
| `GET /api/puzzles/themes` (`?theme=opening`) | REUSE (kemahiran D3 + source D1/D4) | D1/D3/D4 |
| `GET /api/puzzles/next` (`?theme=`) + `POST /api/puzzles/[id]/attempt` | REUSE (tantangan D3, drill D4) | D3/D4 |
| `lib/opening-book.ts` + `lib/engines/opening-book.ts` | REUSE (sumber data D3 — TIDAK engine/data baru) | D3 |
| `lib/endgame-drills.ts` `DRILL_SETS` | REUSE (kurasi statis sumber D1/D4/D6) | D1/D4/D6 |
| `POST /api/pvp` op `draw-offer`/`draw-decline` + event S6 | REUSE (S6; dipakai room classroom) | D5 |
| Tabel: `puzzle_attempts`, `puzzles`, `users`, `game_moves`, `games` | REUSE (0 perubahan skema) | D1/D4/D6 |

## 4. Aturan implementasi (untuk backend & frontend)

1. **[NO-NEW-TABLE]** — TIDAK ADA migrasi S7 (`docs/db/sprint7.md` =
   verifikasi 0 tabel baru; ADR-010 D1/D2 adalah rujukan penolakan tabel
   progress). Semua progress riil = read-only dari `puzzle_attempts` (indeks
   REUSE §1.4/§1.6).
2. Backend: route [NEW] yang menyentuh PG memakai `resolvePgUser` (FIX-1:
   401/403 `account_pending`/503 `service_unavailable`); route file store
   (`api/learn/bookmarks`) = 401/400 saja; publik = 503-only. Respons error
   shape `{ error, code?, retryable }` (pola `puzzle-api.ts`).
3. Frontend: import type dari satu tempat — bentuk §1/§2 ini adalah sumber;
   konten course/lesson hanya dari `lib/courses.ts` + `lib/lessons.ts`
   (bukan fetch; tidak boleh mock data / angka statis di UI).
4. A11y floor untuk semua view baru (courses/lessons/practice/classroom/
   endgames): skip-link, `aria-label` ber-ID stabil, focus-visible, kontras —
   gate TL. DHH: setiap angka di layar mengalir dari endpoint/file store
   di atas (tanpa input data manual).
5. Regression (TL): semua route/op/event [REUSE] di §3 + respons shape
   `api/endgames/drills` tanpa param harus tetap render/berjalan identik
   setelah perubahan additive (pola S6 §4.5).
6. Hard rule: TIDAK ada material berhak cipta chess.com — copy ID original
   di `lib/courses.ts`/`lib/lessons.ts` (nama pembukaan + kode ECO = fakta).
