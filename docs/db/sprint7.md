# Sprint 7 — DB Notes (Learn Layer)

Tanggal: 2026-10-27 · DB Engineer · scope: S7-T1 (Courses), S7-T2 (Lessons/Openings),
S7-T3 (Practice + weekly target), S7-T5 (Endgames multi-filter + leaderboard).
Gaya mengikuti `docs/db/sprint6.md` (verified snapshot + DDL + EXPLAIN). Semua angka
di bawah **diverifikasi psql live** pada 2026-10-27:
`ssh sxz-server 'docker exec -i jev-postgres psql -U jev -d jev_chess' < q.sql`
(NetBird: salin via stdin, tidak boleh scp) — **BUKAN** dari doc lama.
Peran DB di sini: **design only — TIDAK ada DDL yang dijalankan ke live DB**;
script migrasi di §5 untuk dev agent (backup `pg_dump` dulu, pola sprint4/6).

Konteks: dua agent paralel (architect → `docs/contracts/sprint7.md`,
designer → `sprint7-flows.md`). File ini hanya milik DB; koordinasi via git,
jangan edit file mereka.

## 1. Snapshot schema VERIFIED (psql live, 2026-10-27)

### 1.1 Daftar tabel penuh (`\dt`) — 12 tabel, TIDAK ADA tabel progress

| Tabel | `n_live_tup` (pg_stat) | `count(*)` riil |
|---|---|---|
| analysis_results | 0 | 0 |
| challenges | 1 | 1 |
| extra_security_sessions | 0 | 0 |
| friends | 0 | 0 |
| game_moves | 18 | 18 |
| games | 200588 | 200.588 |
| puzzle_attempts | 23 | 23 |
| puzzles | 50000 | 50.000 |
| rate_limits | 0 | 0 |
| tournament_players | 0 | 0 |
| tournaments | 0 | 0 |
| users | 39 | 39 |

**Kesimpulan penting:** tidak ada tabel bernama `*progress*` / `*bookmark*` /
`*completion*` / `*quest*` / `*learn*` / `*course*` / `*lesson*`. Artinya progres
drill/quest **bukan tabel dedicated** — di-derive dari `puzzle_attempts` (bukti
§4). `pg_version = 15.19`.

### 1.2 `puzzle_attempts` (23 baris) — tabel progress riil utama

Kolom (tepat dari `\d puzzle_attempts`):

| Kolom | Tipe | Nullable | Default |
|---|---|---|---|
| id | uuid | not null | gen_random_uuid() |
| user_id | uuid | not null | — |
| puzzle_id | uuid | not null | — |
| correct | boolean | not null | — |
| time_spent_sec | integer | not null | — |
| attempted_at | timestamptz | not null | now() |

- PK: `puzzle_attempts_pkey (id)`.
- Index: `idx_puzzle_attempts_puzzle (puzzle_id)`, `idx_puzzle_attempts_user (user_id)`
  (index **tunggal** user_id).
- FK keluar: `users(id)` CASCADE, `puzzles(id)` CASCADE.
- ⚠️ Composite `idx_puzzle_attempts_user_time (user_id, attempted_at DESC)` dan
  `idx_puzzle_attempts_user_correct_time` (audit B4, ada di `db-schema.sql`)
  **BELUM ada di live** — verifikasi via `\di` hanya `..._puzzle` + `..._user`
  tunggal. Konsisten dengan catatan `sprint6.md §1` (B4 belum dieksekusi).
- Distribusi: 5 user; user `ec7452eb…` memegang 16/23 baris. Range
  `attempted_at` 2026-10-22 .. 2026-10-27 (last-7-day window terisi).

### 1.3 `puzzles` (50.000 baris) — sumber membership drill-set via `themes`

Kolom (tepat dari `\d puzzles`): id uuid PK, title varchar(100) not null,
fen text not null, solution_moves jsonb not null, rating int not null default 1200,
theme varchar(50), created_at timestamptz, **themes text[]**, external_id text.

- PK: `puzzles_pkey (id)`.
- Index: `idx_puzzles_rating (rating)`, `idx_puzzles_themes_gin USING gin (themes)`,
  `uq_puzzles_external_id` (partial unique WHERE external_id NOT NULL).
- **Tema drill S4-T4 (`lib/endgame-drills.ts`) terverifikasi benar-benar ada di live**
  (`SELECT count(*) WHERE '<theme>' = ANY(themes)`):

| Drill theme | Jumlah puzzle |
|---|---|
| rookEndgame | 2626 |
| pawnEndgame | 1607 |
| bishopEndgame | 697 |
| queenEndgame | 626 |
| knightEndgame | 376 |
| queenRookEndgame | 322 |

  6/6 id drill di `DRILL_SETS` (lib/endgame-drills.ts) → `to_regclass`/count = 6/6 ada.
  → membership set drill di-hitung **SQL-side dari `puzzles.themes` (GIN index)**,
  bukan dari tabel kurasi (YAGNI S4-T4, konsisten).

### 1.4 Scan kolom reuse — **TIDAK ADA** kolom progress/bookmark/completion yang bisa dipakai

`information_schema.columns` filter `ILIKE progress/bookmark/completion/completed/
quest/learn/course/lesson` → **hanya 1 hasil: `rate_limits.request_count`**
(satu-satunya kolom berisi angka "count", dan itu counter rate-limit, bukan progres).
Kesimpulan: **tidak ada kolom existing yang bisa REUSE** untuk course-step /
lesson-bookmark / weekly-target → butuh objek baru (keputusan §2).

### 1.5 Divergensi live vs doc (catatan, out-of-scope S7)

Live `tournaments`/`tournament_players` (S6-T5) **berbeda** dari DDL
`db-schema.sql`/`sprint6.md`: live `tournaments(id,name,time_control,rated,status,
start_at,capacity,created_at)` + `idx_tournaments_status(status,start_at)`; live
`tournament_players(tournament_id,user_id,status,joined_at)` PK composite
`(tournament_id,user_id)` + `idx_tournament_players_t(tournament_id,status)`.
Doc menarget `slug`/`max_users`. S7 tidak menyentuh tournaments — biarkan dev
S6 yang menyetelkan; hanya dicatat di sini sebagai bukti snapshot riil.

## 2. Keputusan DDL per fitur S7 (REUSE-COLUMN vs NEW-TABLE)

> **REKONSILIASI (decided by orchestrator, 2026-10-27) — WAJIB DIBACA DULU.**
> Kontrak arsitek `docs/contracts/sprint7.md` (single source yang di-import dev)
> menetapkan **[NO-NEW-TABLE]**: S7 **TIDAK** menambah tabel PostgreSQL.
> - Course-step / lesson / bookmark → **file store `DATA_DIR/learn-state.json`**
>   (pattern REUSE `lib/auth-store.ts`, `users.json`) — low-volume, kosmetik,
>   tanpa migrasi (ADR-010 D2).
> - Progress course/drill → **riil, di-derive SQL-side dari `puzzle_attempts`**
>   (ADR-010 D1) — bukan disimpan di tabel baru.
> - Weekly target (S7-T3) → **konstanta server `WEEKLY_TARGET=20`**; actuals
>   di-derive dari `puzzle_attempts` window 7 hari (bukan kolom
>   `users.weekly_puzzle_target`).
>
> Proposal §2 di bawah (tabel shared `learn_progress` + kolom
> `users.weekly_puzzle_target`) **dicatat sebagai PERTIMBANGAN YANG DITOLAK
> (rejected for YAGNI)** agar tidak ada dev yang membangun di atas skema yang
> bertentangan dengan kontrak. Bila deploy menjadi multi-instance / butuh
> durability cross-instance, proposal `learn_progress` di §5 bisa diangkat ulang.
> **Sumber kebenaran persistensi S7 = `docs/contracts/sprint7.md` [NO-NEW-TABLE].**

Prinsip (sebelum rekonsiliasi): **YAGNI — jika beberapa fitur S7 sama-sama
"progress riil per user × per resource", gabungkan ke SATU tabel shared
`learn_progress`**, bukan satu tabel per fitur. Target mingguan & drill adalah
**data riil yang sudah ada** (reuse).

### 2.a Course step completion (S7-T1) → **NEW (masuk tabel shared `learn_progress`)**

Rasional: tidak ada kolom existing (§1.4). Bentuknya "user X menyelesaikan
course C step N" = `(user_id, resource_type='course_step', resource_key, completed_at)`.
Tidak standalone tabel `course_progress` karena bentuknya identik dengan
lesson-bookmark di bawah → gabung ke shared table.

### 2.b Lesson bookmark (S7-T2) → **NEW (masuk tabel shared `learn_progress`)**

Rasional: tidak ada kolom existing. Bookmark sedikit beda dengan "completed"
(bisa bookmark tanpa selesai) → ditangani dengan flag `bookmarked boolean`
di **baris yang sama** (satu row per (user,resource), bukan satu tabel per
fitur). Gabung ke `learn_progress` karena bentuk (user × resource) identik
course-step.

### 2.c Practice weekly target (S7-T3) → **NEW-KOLOM pada `users` (reuse existing table)**

Rasional: weekly target = **setting/preferensi numerik per user**, BUKAN data
progress (progress = baris `learn_progress`; aktual = agregat `puzzle_attempts`).
Menyimpannya sebagai satu kolom nullable `users.weekly_puzzle_target int`
lebih YAGNI daripada membuka tabel `user_preferences`. **Aktual** "solves
last-7-day vs target" di-derive dari `puzzle_attempts` (§3) — TIDAK menyimpan
aktual, hanya target-nya.
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_puzzle_target int;
```

### 2.d Endgame drill progress + leaderboard (S7-T5) → **REUSE-EXISTING-TABLE**

Sudah jalan S4-T4 dari `puzzle_attempts` + `puzzles.themes` (bukti §4). S7-T5
hanya menambah filter tema + leaderboard — **semua derivatif, tidak butuh
tabel/kolom baru** (kecuali target mingguan yang ditangani 2.c sebagai pref).

### 2.e DDL shared tabel `learn_progress` (idempoten, minimal)

Satu tabel untuk course-step + lesson completion + bookmark:

```sql
CREATE TABLE IF NOT EXISTS learn_progress (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type  varchar(32) NOT NULL,        -- 'course_step' | 'lesson'
  resource_key   text        NOT NULL,        -- course_step: '<courseId>/<stepN>'; lesson: lessonId
  completed_at   timestamptz,                -- selesai (NULL = baru bookmark / in-progress)
  bookmarked     boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learn_progress_pkey PRIMARY KEY (id),
  CONSTRAINT learn_progress_type_check
    CHECK (resource_type IN ('course_step','lesson'))
);
-- SATU index: UNIQUE(user,resource) — user_id adalah leading column, jadi index
-- ini sekaligus melayani "ambil semua progres user X" (prefix user_id).
-- => tidak perlu index terpisah (user_id). YAGNI.
CREATE UNIQUE INDEX IF NOT EXISTS uq_learn_progress
  ON learn_progress (user_id, resource_type, resource_key);
```

Insert idempoten (dev S7):
`INSERT INTO learn_progress(user_id,resource_type,resource_key,completed_at,bookmarked)
VALUES ($1,$2,$3,now(),$4)
ON CONFLICT (user_id,resource_type,resource_key) DO UPDATE
SET bookmarked = learn_progress.bookmarked OR excluded.bookmarked,
    completed_at = COALESCE(learn_progress.completed_at, excluded.completed_at);`

Progress bar course = `count(completed_at NOT NULL) / total_steps` per course
(dari resource_key prefix `courseId/`). Lesson bookmark = `WHERE bookmarked=true`.

## 3. Query design weekly-target (S7-T3) + bukti EXPLAIN ANALYZE

Aktual = jumlah solve benar last-7-day per user dari `puzzle_attempts`;
target = `users.weekly_puzzle_target`.

```sql
SELECT count(*) FILTER (WHERE a.correct) AS solves_last_7d
FROM puzzle_attempts a
WHERE a.user_id = $1::uuid
  AND a.attempted_at >= now() - interval '7 days';
-- target: SELECT weekly_puzzle_target FROM users WHERE id = $1::uuid;
-- progress = solves_last_7d / target (guard target NULL/0 → UI "belum atur target").
```

**EXPLAIN ANALYZE live (user `ec7452eb…`, 23 baris total):**
`Seq Scan on puzzle_attempts` (filter user_id + attempted_at) →
**0.091 ms, shared hit=1 buffer, 16 baris cocok / 7 discar** (Planning 0.911 ms).
Planner memilih Seq Scan karena tabel kecil.

**Verdict index:** **TIDAK perlu index baru di `puzzle_attempts` untuk S7.**
- `idx_puzzle_attempts_user` (user_id tunggal, live) sudah menjangkau per-user.
- Composite `idx_puzzle_attempts_user_time` (audit B4) **belum ada di live**
  (§1.2) — dan **tidak dibutuhkan sekarang**: bukti 0.091 ms/1-buffer di 23 baris.
- Kapan baru perlu: saat `puzzle_attempts` tumbuh > ~100k baris DAN query
  per-user window menjadi hot path → saat itu jalankan B4
  (`idx_puzzle_attempts_user_time`, `(user_id, attempted_at DESC)`),
  `CONCURRENTLY` di prod. Tandai **optional, follow-up**, bukan S7 mandatory.

## 4. Leaderboard endgame drills (S7-T5) — sumber, query, tie-break, top-N

**Sumber riil (konfirmasi via `\dt`):** BUKAN tabel dedicated. Progress drill =
`puzzle_attempts` (JOIN `puzzles` untuk filter tema drill). Ini konsisten dengan
`app/api/endgames/drills/route.ts` (S4-T4) yang menghitung
`count(DISTINCT a.puzzle_id) WHERE a.correct` per set, di-filter
`p.id = ANY(set.puzzleIds) AND set.theme = ANY(p.themes)` — alias filter
set-id/tema terhadap `puzzle_attempts`, persis pola leaderboard.

**Query leaderboard (global top-N, solved-unique drill per user):**
```sql
SELECT a.user_id,
       count(DISTINCT a.puzzle_id) AS solved_unique
FROM puzzle_attempts a
JOIN puzzles p ON p.id = a.puzzle_id
WHERE a.correct = true
  AND string_to_array($1, ',') && p.themes      -- $1 = 6 drill theme S4-T4
GROUP BY a.user_id
ORDER BY solved_unique DESC, a.user_id ASC       -- tie-break: user_id ASC (deterministik)
LIMIT 20;                                        -- top-N = 20
```

- **Tie-break:** urutan sekunder `a.user_id ASC` (PK, stabil & deterministik) —
  leaderboard yang tied pada `solved_unique` tetap render urutan yang sama tiap
  refresh (anti-flicker, bisa di-cache).
- **Top-N:** `LIMIT 20`. Per-user "how far am I" memakai variasi `WHERE a.user_id=$1`.
- **Multi-filter tema (S7-T5):** filter `&& themes` memakai GIN
  `idx_puzzles_themes_gin` yang SUDAH ada — tidak menambah index.

**EXPLAIN ANALYZE live (0.931 ms, 34 buffer):** `Seq Scan puzzle_attempts
(filter correct, 12 baris) → Memoize(puzzle_id) → Index Scan puzzles_pkey +
filter && themes`. Saat 23 baris planner memakai Seq/Memoize — sehat. Kapan index
baru relevan: hanya jika `puzzle_attempts` jadi besar; filter
per-(user,correct,time) di-cover `idx_puzzle_attempts_user_correct_time`
(audit B4, optional). **Tidak ada index S7-mandatory pada puzzle_attempts.**

## 5. Migration idempoten — **DITOLAK (rejected for YAGNI, 2026-10-27)**

> Sesuai rekonsiliasi §2: kontrak arsitek `docs/contracts/sprint7.md`
> menetapkan **[NO-NEW-TABLE]**. Script di bawah **TIDAK DIEKSEKUSI** —
> dipertahankan hanya sebagai arsip keputusan bila S7 migrasi ke
> multi-instance / durability cross-instance. **Dev agent S7: LUPUTKAN
> seluruh DDL di bawah — jalankan 0 migration.** Persistensi S7 = file store
> `DATA_DIR/learn-state.json` (pattern `lib/auth-store.ts`).

```sql
-- Sprint 7 migration — jev_chess (Learn Layer)
-- Idempotent. Safe to re-run. Verified against live schema 2026-10-27
-- (snapshot §1: psql live, docker jev-postgres, PG 15.19).
BEGIN;

-- 1. Tabel shared learn_progress: course-step + lesson completion + bookmark
--    (gabungan; satu index UNIQUE leading user_id = cukup, YAGNI).
CREATE TABLE IF NOT EXISTS learn_progress (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type  varchar(32) NOT NULL,
  resource_key   text        NOT NULL,
  completed_at   timestamptz,
  bookmarked     boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learn_progress_pkey PRIMARY KEY (id),
  CONSTRAINT learn_progress_type_check
    CHECK (resource_type IN ('course_step','lesson'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_learn_progress
  ON learn_progress (user_id, resource_type, resource_key);

-- 2. Weekly practice target (setting per user; aktual dari puzzle_attempts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_puzzle_target int;

COMMIT;
```

Tidak ada DDL untuk drill/leaderboard (reuse `puzzle_attempts`+`puzzles.themes`).
Tidak ada `CREATE INDEX` baru di `puzzle_attempts` (bukti §3/§4: Seq/Memoize sehat;
composite B4 = optional follow-up, BUKAN S7 mandatory).

## 6. Catatan collision untuk Architect/Designer (S7-T1/T2/T3)

- **localStorage learning-hub:** `components/views/learning-hub.tsx` menyimpan
  progres quest di **localStorage key `jev_chess_quest_progress`**
  (`{completed:[], xp}`) — client-only, per-browser, **TIDAK** synced ke PG.
  → Jika S7 mem-merilis course/lesson completion ke `learn_progress` (PG),
  ada **dua source of truth**  (localStorage guest quest vs file-store authenticated course/lesson) — dua
  source of truth per browser, bukan per DB. Rekomendasi DB: biarkan quest
  learning-hub tetap **localStorage** (guest); course/lesson (user login) lewat
  **`learn-state.json`** (kontrak [NO-NEW-TABLE], bukan `learn_progress`).
- `lib/learning-hub.ts` yang disebut tiket S7 **tidak ada** di repo
  (hanya `components/views/learning-hub.tsx` + `components/learning-hub.tsx`);
  PM/Architect perbaiki referensi tiket agar satu sumber.

## 7. Rekap keputusan & index MANDATORY

| Fitur S7 | Keputusan | Objek |
|---|---|---|
| Course step completion | **FILE STORE** (bukan PG — [NO-NEW-TABLE] kontrak) | `learn-state.json` via `lib/learn-store.ts` |
| Lesson bookmark + completion | **FILE STORE** (flag di baris user) | `learn-state.json` |
| Practice weekly target | **KONSTANTA server `WEEKLY_TARGET=20`** + aktual dari PG | `puzzle_attempts` (7-hari window) |
| Endgame drill progress + leaderboard + multi-filter | REUSE-existing | `puzzle_attempts` + `puzzles.themes` |

> Catatan §7: baris "NEW (shared) `learn_progress`" pada tabel rekap awal
> dokumen ini sudah digantikan keputusan di atas — proposal DDL §5 DITOLAK
> (YAGNI, kontrak [NO-NEW-TABLE]); arsip DDL tetap di §5 sebagai fallback
> multi-instance.

- **Index MANDATORY: TIDAK ADA** untuk S7 (0 migrasi; `learn_progress` tidak
  dibuat, jadi `uq_learn_progress` tidak relevan). Tidak ada index baru di
  `puzzle_attempts`/`puzzles` (composite B4 = optional follow-up; GIN
  `idx_puzzles_themes_gin` sudah ada dan dipakai filter tema §4).
- Tabel progress yang SUDAH ADA (reuse, tidak bikin baru):
  **`puzzle_attempts`** (progress riil drill/weekly/leaderboard) +
  **`puzzles`** (membership set via `themes`, GIN index).
