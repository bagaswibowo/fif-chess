# Sprint 6 — DB Notes

Tanggal: 2026-10-27 · DB Engineer · target: S6-T4 (Insights), S6-T5 (Tournaments Arena)
Gaya mengikuti `docs/db/sprint4.md`. Semua angka di bawah diverifikasi `psql` live
(`docker exec jev-postgres psql -U jev -d jev_chess`) pada 2026-10-27 — BUKAN dari doc lama.
Peran DB di sini: **design only, tidak ada DDL yang dijalankan ke live DB**;
script migrasi di bagian 3 untuk dev agent (jalankan dengan backup pg_dump dulu,
pola sprint4). Catatan: `ANALYZE games` (metadata-only, tanpa DDL)
karena `pg_stat_user_tables` menunjukkan `last_autovacuum/last_analyze` NULL setelah
import 200k baris seed.

## 1. Snapshot schema VERIFIED (psql live, 2026-10-27)

### games (200.588 baris)

Kolom (tepat dari `\d games`):

| Kolom | Tipe | Nullable | Default |
|---|---|---|---|
| id | uuid | not null | gen_random_uuid() |
| white_user_id | uuid | not null | — |
| black_user_id | uuid | not null | — |
| status | varchar(20) | not null | 'active' |
| result | varchar(20) | yes | — |
| started_at | timestamptz | not null | now() |
| ended_at | timestamptz | yes | — |
| created_at | timestamptz | not null | now() |
| favorited | boolean | not null | false |
| time_control | varchar(10) | yes | — |
| game_type | varchar(10) | yes | — |
| white_rating_before | integer | yes | — |
| white_rating_after | integer | yes | — |
| black_rating_before | integer | yes | — |
| black_rating_after | integer | yes | — |

- Check: `games_different_players` (white_user_id <> black_user_id);
  `games_game_type_check` CHECK game_type IN ('live','daily','bot','coach').
- Index live: `games_pkey` (id), `idx_games_white` (**hanya** white_user_id),
  `idx_games_black` (**hanya** black_user_id).
- FK keluar: users(id) ×2; FK masuk: analysis_results, challenges, game_moves.
- Distribusi data seed: **200.584 baris `game_type=NULL, time_control=NULL, status='active'`
  (99,998%)**; hanya 3 baris `finished` (result 'white'/'draw'). Range started_at
  2026-10-19..2026-10-22. Satu pasangan user menguasai ~200.582 baris.
- ⚠️ **Divergensi live vs `db-schema.sql`**: indeks B3–B7 hasil audit
  (`idx_games_white_ended`, `idx_games_black_ended`, `idx_games_ended_at`,
  `idx_games_live_tc_minutes_{white,black}`, `idx_users_rating_desc`,
  `idx_users_rush_best`, `idx_puzzle_attempts_user_time`,
  `idx_puzzle_attempts_user_correct_time`, `idx_challenges_status`) **BELUM ada di live**
  (verifikasi via `pg_indexes` + `to_regclass`). Live hanya punya
  `idx_games_white/black` tunggal + index sprint-4 `friends`. Snapshot di atas =
  state nyata, bukan target kanonis.

### users (39 baris)

Kolom: id (uuid pk, gen_random_uuid), username varchar(50) not null **unique**,
email varchar(255) unique-partial (WHERE email IS NOT NULL),
password_hash varchar(255) not null, rating integer not null default 1200,
created_at/updated_at timestamptz, rush_best integer not null default 0,
rush_best_at timestamptz.

- **Tidak ada** kolom `legacy_store_id` di live (verifikasi `information_schema`, count=0)
  → audit B1 belum dieksekusi.
- Index: `users_pkey`, `users_username_key` (unique constraint), `users_email_key`
  (partial unique). **Tidak ada** `idx_users_rating_desc`/`idx_users_rush_best`.

### challenges (1 baris)

Kolom: id uuid pk, from_user_id uuid not null FK users, to_user_id uuid not null FK users,
time_control text not null, rated boolean not null default false, status text not null
default 'pending', game_id uuid FK games, created_at **timestamp(3) without tz** not null
default CURRENT_TIMESTAMP, decided_at timestamp(3) without tz.

- Index: `challenges_from_user_id_status_idx` (from_user_id, status),
  `challenges_to_user_id_status_idx` (to_user_id, status).
  **Tidak ada** partial `idx_challenges_status` (audit B5 belum jalan).
- ⚠️ Inconsistensi tipe lama: `created_at/decided_at` `timestamp(3)` tanpa tz
  vs seluruh tabel lain `timestamptz` (audit B8, perlu maintenance window — out of scope S6).

### puzzle_attempts (23 baris)

Kolom: id uuid pk, user_id uuid not null FK users CASCADE, puzzle_id uuid not null FK
puzzles CASCADE, correct boolean not null, time_spent_sec integer not null,
attempted_at timestamptz not null default now().

- Index: `idx_puzzle_attempts_puzzle` (puzzle_id), `idx_puzzle_attempts_user` (user_id tunggal).
- **Tidak ada** composite `idx_puzzle_attempts_user_time` /
  `idx_puzzle_attempts_user_correct_time` (audit B4 belum jalan).

### tournaments

`to_regclass('tournaments')` / `to_regclass('tournament_players')` → **NULL, belum ada**
(ekspektasi; dibuat S6, desain di bagian 2).
**Catatan (2026-10-27, backend S6-T5):** nama tabel join diselaraskan ke
`tournament_players` sesuai `docs/contracts/sprint6.md` (otoritas);
`tournament_players` di bawah = draft awal, sudah digantikan (naming aligns
to contracts/sprint6.md).

## 2. Keputusan & desain S6

### 2.1 Tabel `tournaments` (S6-T5 Arena — YAGNI)

```sql
CREATE TABLE IF NOT EXISTS tournaments (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        NOT NULL,
  time_control text,
  starts_at   timestamptz,
  status      text        NOT NULL DEFAULT 'upcoming',
  max_users   int,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_slug_key UNIQUE (slug),
  CONSTRAINT tournaments_status_check CHECK (status IN ('upcoming','active','finished'))
);
```

Rasional:
- `slug unique` → URL publik `/play/online/tournaments/<slug>` stabil (deep-link S6).
- `status` CHECK mengikuti pola `challenges`/`friends` (text + CHECK, bukan enum).
  `max_users` nullable = arena tanpa cap. `time_control` nullable (sesuai scope;
  arena yang pakai clock preset S6-T2 mengisi).
- Tanpa kolom fee/entry/bot-seed/schedule berulang — YAGNI; tambahkan jika S8
  (Events/Ajang) memang menuntut.

### 2.2 `tournament_players` — keputusan standalone (DECIDED)

`docs/contracts/sprint6.md` **TIDAK ADA** (direktori `docs/contracts/` sendiri
belum ada) → keputusan diambil DB Engineer secara mandiri dan tercatat di sini.

S6-T5 = "list arena live + **register**". Register adalah **write + idempoten +
hitung kursi** terhadap `max_users` — view read-only tidak bisa memenuhi. Maka:
**table `tournament_players` (bukan view)**, pola persis `friends`
(sprint4): satu row per (tournament, user), UNIQUE pair → `ON CONFLICT DO NOTHING`
idempoten, COUNT(*) per row = seats used.

```sql
CREATE TABLE IF NOT EXISTS tournament_players (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_players_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_players_unique_pair UNIQUE (tournament_id, user_id)
);
-- "User ini daftar di arena mana?" (bukan prefix unik UNIQUE pair → perlu eksplisit)
CREATE INDEX IF NOT EXISTS idx_tournament_players_user
  ON tournament_players (user_id);
```

Query register (untuk dev S6-T5): `INSERT ... ON CONFLICT (tournament_id, user_id)
DO NOTHING` + guard `current_count < max_users` (jika max_users tidak null)
di `lib/db.ts` `transaction()`; list arena live = `SELECT t.*, count(j.id)::int
AS seats_used FROM tournaments t LEFT JOIN tournament_players j USING (tournament_id)
WHERE t.status = 'active' GROUP BY t.id` (join kecil; tidak perlu index tambahan
selain UNIQUE pair yang sudah jadi prefix index untuk `tournament_id`).

## 3. Migration idempoten (termasuk di dokumen ini — tidak dijalankan di live DB)

Untuk dev agent: jalankan dengan backup `pg_dump` dulu (pola sprint4),
lalu verifikasi idempoten re-run.
Konten script:

```sql
-- Sprint 6 migration — jev_chess
-- Idempotent. Safe to re-run. Verified against live schema 2026-10-27
-- (snapshot di §1: psql live, docker jev-postgres).
-- Context: tickets S6-T4 (Insights), S6-T5 (Tournaments Arena).
-- Catatan prod: dua CREATE INDEX games (200k+ baris) sebaiknya
-- `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` di luar transaksi.
-- Jalankan setelah backup pg_dump.

BEGIN;

-- 1. tournaments: arena S6-T5 (YAGNI — tanpa fee/schedule berulang).
--    slug unique → deep-link stabil; status CHECK mengikuti pola
--    challenges/friends (text + CHECK).
CREATE TABLE IF NOT EXISTS tournaments (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  slug         text        NOT NULL,
  time_control text,
  starts_at    timestamptz,
  status       text        NOT NULL DEFAULT 'upcoming',
  max_users    int,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_slug_key UNIQUE (slug),
  CONSTRAINT tournaments_status_check
    CHECK (status IN ('upcoming','active','finished'))
);

-- 2. tournament_players: register idempoten + hitung kursi (pola friends S4).
--    View read-only tidak bisa mendukung register, jadi table (keputusan
--    standalone — docs/contracts/sprint6.md tidak ada; lihat §2.2).
CREATE TABLE IF NOT EXISTS tournament_players (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_players_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_players_unique_pair UNIQUE (tournament_id, user_id)
);

-- 3. "User ini daftar di arena mana?" — UNIQUE pair hanya prefix
--    tournament_id, arah user_id perlu index eksplisit.
CREATE INDEX IF NOT EXISTS idx_tournament_players_user
  ON tournament_players (user_id);

-- 4. MANDATORY for S6-T4 Insights (bukti EXPLAIN ANALYZE: §4.1).
CREATE INDEX IF NOT EXISTS idx_games_white_ended
  ON games (white_user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_black_ended
  ON games (black_user_id, ended_at DESC);

COMMIT;
```

## 4. Query design Insights (S6-T4) + bukti EXPLAIN ANALYZE

Semua query per-user di atas `games` (kolom rating snapshot
`white_rating_before/after`, `black_rating_before/after` sudah verified ada).
Kunci: **selalu bentuk `UNION ALL` (satu branch per warna), JANGAN `OR` +
`ORDER BY`** — bukti di bawah.

### 4.1 Last-N games per user (filter time_control & game_type opsional)

```sql
SELECT id, result, started_at, ended_at, status,
       time_control, game_type,
       white_rating_after - white_rating_before AS rating_delta
FROM games WHERE white_user_id = $1
UNION ALL
SELECT id, result, started_at, ended_at, status,
       time_control, game_type,
       black_rating_after - black_rating_before AS rating_delta
FROM games WHERE black_user_id = $1
ORDER BY ended_at DESC NULLS LAST LIMIT $2;   -- $2 = N, mis. 30
```

**EXPLAIN ANALYZE live (user e2e_white, N=20)**:
- Bentuk `OR ... ORDER BY ended_at DESC LIMIT 20` →
  `Parallel Seq Scan on games` (2.675 shared buffers, **43,2–46,8 ms**;
  `started_at` variant 50–53 ms, 53,8 ms). Tidak bisa pakai index tunggal
  karena top-N sort global.
- Bentuk `UNION ALL` di atas → `Index Scan using idx_games_white` +
  `Index Scan using idx_games_black` → **0,222 ms, 11 buffers**
  (100x lebih cepat). Masih sort top-N kecil (6 row), tetapi:
  dengan **`idx_games_white_ended (white_user_id, ended_at DESC)`** (mandatory,
  bagian 3), per-branch sudah terurut dari index → tanpa sort global,
  LIMIT berhenti setelah N tuple — O(limit) bahkan saat seed satu user
  menguasai 200k baris (kondisi live sekarang, pair tunggal 200.582 baris).
- Filter opsional `AND game_type = $3` / `AND time_control = $4` tinggal
  ditambahkan di tiap branch; saat banyak baris `game_type` NULL,
  **jangan** paksa filter — branch tetap benar dengan `NULL` (tampilkan
  kategori "(unknown)" di UI).

### 4.2 Rating trend per game_type (per user)

```sql
SELECT game_type,
       date_trunc('week', ended_at)  AS bucket,
       first_value(rating_delta) OVER w AS rating_start,
       last_value(rating_delta)  OVER w AS rating_end,
       count(*)                   AS games,
       avg(rating_delta)::int    AS avg_delta
FROM (
  SELECT white_user_id AS uid, game_type, ended_at,
         white_rating_after - white_rating_before AS rating_delta
  FROM games WHERE white_user_id = $1 AND ended_at IS NOT NULL
  UNION ALL
  SELECT black_user_id, game_type, ended_at,
         black_rating_after - black_rating_before
  FROM games WHERE black_user_id = $1 AND ended_at IS NOT NULL
) p
WHERE p.game_type = $2                     -- 'live' | 'daily' | 'bot' | 'coach'
WINDOW w AS (PARTITION BY p.game_type
             ORDER BY p.ended_at
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
GROUP BY p.game_type, date_trunc('week', p.ended_at)
ORDER BY p.game_type, bucket;
```

Dengan index mandatory `idx_games_{white,black}_ended`, branch ini =
index scan + filter; agregat berjalan di ≤ (per-user finished rows).
Saat data real penuh `game_type='live'` mulai dominan, index expression
audit `idx_games_live_tc_minutes_{white,black}`
(`(user, (split_part(time_control,'+',1)::int)) WHERE game_type='live'`)
menjadi **optional speedup** untuk drill kategori waktu — **tidak masuk
migration S6** (YAGNI; seed saat ini 200.584 baris NULL game_type,
index expression tak terpakai).

### 4.3 Performance by color

```sql
SELECT color, count(*) AS games,
       avg(delta)::int AS avg_delta,
       count(*) FILTER (WHERE delta > 0)  AS wins_delta,
       count(*) FILTER (WHERE delta < 0)  AS losses_delta,
       count(*) FILTER (WHERE delta = 0)  AS draws_delta
FROM (
  SELECT 'W' AS color, white_rating_after - white_rating_before AS delta
  FROM games WHERE white_user_id = $1 AND ended_at IS NOT NULL
  UNION ALL
  SELECT 'B', black_rating_after - black_rating_before
  FROM games WHERE black_user_id = $1 AND ended_at IS NOT NULL
) p
GROUP BY 1;
```

**EXPLAIN ANALYZE live**: **0,239 ms, 11 buffers** (Append → dua Index Scan
tunggal + filter ended_at). Cukup tanpa index baru — composite
(user, ended_at DESC) hanya menambah kecepatan saat baris per user besar.

Peringatan desain: **jangan** tulis win-rate sebagai satu query
`OR + nested subquery win color` — bentuk itu di live ter-measure
`Parallel Seq Scan`, 16 ms, 2.715 buffers (bandingkan 0,24 ms UNION ALL).
Tetap di satu scan per warna, hitung kemenangan dari `result` vs
posisi: `result='white' AND white_user_id=$1 → W`,
`result='black' AND black_user_id=$1 → W`, `result='draw' → D`.

### 4.4 Rekap indeks: MANDATORY vs OPsional

| Index | Status | Alasan |
|---|---|---|
| `idx_games_white_ended (white_user_id, ended_at DESC)` | **MANDATORY (masuk migration S6)** | Bukti 4.1: OR-shape Seq Scan 43–54 ms / 2.675 buffers vs UNION-ALL 0,22 ms; composite membuat per-user last-N O(limit) saat user punya ratusan ribu baris (seed live sekarang). |
| `idx_games_black_ended (black_user_id, ended_at DESC)` | **MANDATORY (masuk migration S6)** | Simetris; dibutuhkan branch warna hitam. |
| `idx_games_ended_at` partial (WHERE ended_at NOT NULL) | Optional | Agregat window global (trend arena-wide) — belum ada query S6 yang membutuhkannya. |
| `idx_games_live_tc_minutes_{white,black}` (expression) | Optional | Hanya berguna setelah data `game_type='live'` riil banyak; seed 99,99% NULL. |
| `idx_users_rating_desc`, `idx_users_rush_best` | Optional | Leaderboard global sudah jalan via sort scan (39 user; 1 buffer Seq Scan). Bukan S6. |
| composite puzzle_attempts, partial challenges status | Optional | Follow-up audit B4/B5; tidak disentuh S6. |

Tidak ada query Insights yang **memaksa** index di luar dua composite di atas.

## 5. Kebutuhan API (untuk dev S6-T4/T5)

- `GET /api/insights/<user>` → 3 endpoint/1 endpoint multi-section: last-N
  (4.1), rating trend per game_type (4.2), performa by color (4.3).
  Semua parameter: `$1` user_id (resolve via `resolvePgUser`), `$2` limit,
  `$3` game_type (opsional), `$4` kategori waktu (opsional, filter
  `split_part(time_control,'+',1)::int` antara bound). Response pakai
  `lib/db.ts` `query()`; tidak ada mutation.
- `GET /api/tournaments?status=active` → list arena + `seats_used`
  (JOIN `tournament_players`, bagian 2.2).
- `POST /api/tournaments/<slug>/register` → INSERT joiner idempoten
  + guard `max_users` di transaction; `DELETE` untuk un-register
  (YAGNI: tanpa refund/riwayat).
- Auth: keduanya di belakang guard 401/403 yang sudah ada (FIX-1).

## 6. Backup & risiko

- Migration S6 menambah objek baru (2 tabel + 2 index games) — non-destruktif;
  backup `pg_dump` tetap wajib sebelum eksekusi (pola sprint4,
  `~/backup-jev-pre-sprint6-*.sql` di sxz-server).
- Dua `CREATE INDEX` di games (200k baris, 33 MB): build singkat (~detik);
  di production pakai `CONCURRENTLY`.
- Seed data 99,99% NULL `game_type/time_control`: query 4.1/4.2/4.3
  tetap benar (kategori "(unknown)"); UI Insights wajib toleran NULL,
  jangan asumsikan filter.
- `ANALYZE games` sudah berjalan (stats sempat stale: `n_live_tup`=6 vs
  aktual 200.588) — plan di bagian 4 memakai stats segar.
