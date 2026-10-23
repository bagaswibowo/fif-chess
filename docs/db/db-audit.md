# db-audit.md — Audit Database jev-chess (2026-10-23)

Scope: `jev_chess` (PostgreSQL 15.19, docker `jev-postgres`). Dump skema aktual via `pg_dump --schema-only`. DDL kanonis + migrasi idempotent: `db-schema.sql` (satu direktori dengan dokumen ini). Head audit: `4c28371d`.

## Ringkasan inventaris

- **10 tabel**: users, games, game_moves, puzzles, puzzle_attempts, challenges, friends, analysis_results, extra_security_sessions, rate_limits. Semua punya PRIMARY KEY.
- **22 indeks** aktif (btree/GIN/partial unique) + 14 FK constraints. FK coverage baik: hanya `rate_limits` (by design) yang tidak mereferensikan apa pun.
- Ukuran: `games` 33 MB (~200.588 baris), `puzzles` 21 MB (50.000), tabel lain < 16 kB (7 attempts, 1 challenge, 18 moves, 38 users).

## Temuan per tabel (risk rank)

### 🔴 HIGH — games (200k baris)
1. **Tidak ada indeks composite (user, ended_at)** — hanya `idx_games_white`/`idx_games_black` pada user_id tunggal. EXPLAIN ANALYZE leaderboard global (`SELECT count(*) ... WHERE white_user_id = u.id OR black_user_id = u.id`) → **Seq Scan games × 38 user, 101.650 buffers, 633 ms** (subplan per user). Dengan traffic nyata ini O(users × full-scan).
2. **Tidak ada indeks `ended_at`** — agregat window (`ended_at > NOW() - interval '7 days'`) → Parallel Seq Scan 37 ms.
3. **winRate per game_type** menghitung `split_part(time_control,'+',1)::int` runtime → tidak SARGable; agregat kategori (bullet/blitz/rapid) selalu full scan.
- Rekomendasi (di `db-schema.sql` B3): `idx_games_white_ended (white_user_id, ended_at DESC)`, `idx_games_black_ended`, partial `idx_games_ended_at WHERE ended_at IS NOT NULL`, expression partial `idx_games_live_tc_minutes_{white,black} ON (user, split_part(time_control,'+',1)::int) WHERE game_type='live'`. Juga rekomendasi jangka menengah: rewrite leaderboard scalar-subquery-per-user → satu `GROUP BY user` LATERAL/CTE agar 1 scan games bukan 38.

### 🟠 MEDIUM — puzzle_attempts
- Sudah ada `idx_puzzle_attempts_user` dan `idx_puzzle_attempts_puzzle`, tapi query stats/missed/streak selalu filter `user_id + attempted_at (window/sort DESC)` dan missed juga `correct=false` → composite lebih tepat. Tabel masih 7 baris sehingga EXPLAIN cepat (0,13 ms), tapi pola akan memburuk linearly.
- Rekomendasi (B4): `idx_puzzle_attempts_user_time (user_id, attempted_at DESC)` dan `idx_puzzle_attempts_user_correct_time (user_id, correct, attempted_at DESC)`. Buang idx tunggal `user` setelah composite terbukti (idx tunggal redundant).

### 🟠 MEDIUM — challenges
- Indeks ada untuk `(from_user_id, status)` / `(to_user_id, status)`, tapi **tidak ada indeks global `status`** untuk scan `WHERE status='pending'` (lobby/matcher). Saat ini 1 baris (Seq Scan), akan jadi bottleneck polling saat tumbuh.
- Type inconsistency: `created_at`/`decided_at` memakai `timestamp(3) WITHOUT time zone` sementara seluruh DB lain `timestamptz` — risiko salah interpretasi timezone. Migrasi tipe disiapkan sebagai blok komentar (B8, butuh maintenance window).

### 🟠 MEDIUM — DUAL-IDENTITY users.json ↔ PG (arsitektur, bukan single table)
- Sumber kebenaran identity terpecah: `lib/auth-store.ts` authentikasi penuh dari file store (`data/users.json`, id `u-xxxxxxxx`, password, status, W/L), sedangkan semua data domain (games, puzzles, rating) di PG dengan `users.id` uuid. `resolvePgUser` (lib/puzzle-api.ts) menjembatani via **username lookup per request** → satu query ekstra per request + drift R4 (user ada di file tapi tidak di PG → 403 `account_missing`).
- Duplikasi state: rating di PG `users.rating` vs `elo`, wins/losses/draws di file vs agregat `games` — dua sumber bisa berbeda.
- Sessions juga file (`sessions.json`, hash HMAC token) — tidak ada tabel sessions di PG.
- **Rekomendasi migrasi konsolidasi (B1/B2 + phase plan)**:
  1. `ALTER TABLE users ADD COLUMN legacy_store_id varchar(64)` + partial UNIQUE (idempotent, aman sekarang).
  2. Backfill `legacy_store_id` dari users.json (mapping username→legacy id), UPDATE guarded `WHERE legacy_store_id IS NULL`.
  3. Tambah kolom file-only yang masih dibutuhkan: `full_name`, `role`, `status`, `is_admin` (atau tabel `user_profiles`), pindahkan password_hash file → PG (`users.password_hash` sudah ada, format scrypt salt+hash perlu kolom `password_salt`).
  4. Pindahkan sessions ke tabel `sessions` (B9, disiapkan) → auth jadi full PG.
  5. Setelah semua route membaca PG, users.json jadi read-only legacy → arsip. `resolvePgUser` jadi 1 query (atau cache) dengan `id` PG tunggal; drift R4 hilang.
  6. Sedang dieksekusi: FIX-1 semantics (401/403/503 + `account_missing`) adalah jembatan yang benar ke arah ini.

### 🟡 LOW — puzzles
- 50k baris, indeks rating + GIN themes + partial unique external_id sudah tepat. `solution_moves` jsonb wajar (array langkah bervariasi — bukan kandidat relasional). `themes text[]` + GIN sudah relasional-cukup; kolom legacy `theme varchar(50)` tunggal redundan dengan `themes[]` — pertahankan untuk back-compat, catat sebagai deprecated.

### 🟡 LOW — game_moves
- UNIQUE (game_id, move_number) sudah berfungsi sebagai indeks lookup per game; `idx_game_moves_game` sebenarnya redundant (prefix kiri unique index). Hanya 18 baris — biaya nol, biarkan.
- Catatan: 200k games tapi hanya 18 moves → move history belum ditulis per move (disimpan di game state lain). Bukan masalah skema.

### 🟢 OK — users, friends, analysis_results, extra_security_sessions, rate_limits
- Constraint & indeks lengkap dan tepat (`friends_unique_pair`, CHECK different-users, partial unique email, unique (identifier, endpoint)). `analysis_results` UNIQUE(game_id) berarti satu analisis per game — verifikasi apakah by-design (re-analisis overwrite?) — perilaku app-side.
- users: tanpa indeks `rating DESC` untuk leaderboard global (`ORDER BY rating DESC LIMIT 50` → sort scan; 38 user sekarang, murah, tapi siapkan `idx_users_rating_desc`) dan `rush_best` (rush leaderboard `ORDER BY rush_best DESC` → sort scan; siapkan partial index B6).

## Kolom JSON / relasionalisasi
- `puzzles.solution_moves` (jsonb): wajar tetap jsonb (array panjang variabel, dibaca utuh). ✅
- `puzzles.themes` (text[]): ok dengan GIN. ✅
- Tidak ada kolom JSON yang menyimpan relasi (id/foreign key) — bersih.

## Konsistensi tipe
- games.status/result `varchar(20)` tanpa CHECK enum; challenges.status/friends.status `text` DENGAN CHECK (friends saja). games.game_type punya CHECK. Rekomendasi: tambahkan CHECK `result IN ('white','black','draw',...)` setelah inventaris nilai aktual, atau ubah ke enum/lookup saat konsolidasi.
- challenges timestamp(3) no-tz (lihat di atas).

## SQL migrasi
Lihat `db-schema.sql`: Bagian A = DDL kanonis target; Bagian B = migrasi idempotent B1–B9 (B1/B2 identity consolidation, B3–B7 indeks, B8 tipe timestamp, B9 tabel sessions — B8/B9 dikomentari karena butuh koordinasi app).

## Urutan eksekusi yang disarankan
1. Sekarang (aman, online): B1, B3, B4, B5, B6, B7 (`CREATE INDEX CONVERSION` → gunakan `CREATE INDEX CONCURRENTLY IF NOT EXISTS` untuk games/puzzles di production).
2. Sprint berikut: backfill legacy_store_id (B2) + kolom profile di PG.
3. Phase konsolidasi: sessions table (B9), pindahkan auth ke PG, arsip users.json, timestamp fix (B8) di maintenance window.
