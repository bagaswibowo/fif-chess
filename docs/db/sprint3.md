# Sprint 3 — DB Notes (puzzles)

Tanggal: 2026-10-22 · DB Engineer · target: S3-T1..T4

## Keputusan

1. **`themes TEXT[]` di `puzzles`** (bukan junction table). S3-T4 butuh multi-tema; agregasi mastery per tema cukup dengan `unnest(themes)` + GIN index untuk filter `?theme=`. YAGNI: tabel `puzzle_themes` join tidak dibuat.
2. **`puzzles.external_id TEXT` (unique, nullable)** — Lichess `PuzzleId` sebagai kunci idempoten import. Memilih kolom daripada menaruh id di `title` suffix: import script jadi `INSERT ... ON CONFLICT (external_id) DO NOTHING` tanpa parsing string. Nullable agar puzzle non-Lichess tetap boleh.
3. **`users.rush_best INT NOT NULL DEFAULT 0` + `users.rush_best_at TIMESTAMPTZ`** — S3-T3 leaderboard, sesuai guardrail ticket (2 kolom, update hanya bila skor baru beat).
4. **`solution_moves` tetap jsonb** — cukup untuk array move UCI Lichess.
5. **`attempted_at` di `puzzle_attempts` sudah cukup untuk S3-T2** (daily streak harian) — tidak ada tabel/kolom baru untuk daily puzzle (keputusan YAGNI tercatat di S3-T2).
6. Rating user puzzle **tidak dibuat** (guardrail S3-T1: pakai `games.users.rating`).

## Migration

File: `docs/db/sprint3-migration.sql` (idempoten, sudah dijalankan via psql di jev-postgres setelah backup pg_dump). Isi:

- `puzzles.themes TEXT[]` + backfill dari `theme` lama + GIN index `idx_puzzles_themes_gin`
- `puzzles.external_id TEXT` + partial unique index `uq_puzzles_external_id`
- `idx_puzzles_rating` btree (lookup band rating ±150/±400, daily, rush)
- `users.rush_best`, `users.rush_best_at`

Kolom lama `theme` (varchar(50)) **tidak dihapus** pada migration ini — dev S3-T1 bisa memindahkan pembacaannya ke `themes[1]`, lalu kolom lama dihapus di migration susulan Sprint 4. (Minimal diff / aman untuk kode existing yang masih baca `theme`.)

## Source Lichess dump

- URL: `https://database.lichess.org/lichess_db_puzzle.csv.zst` (kolom, sesuai dok lichess.org/puzzle database):
  `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl`
- `Themes` pipe-separated (`|`) → dipecah ke `TEXT[]` untuk `themes` (S3-T4 butuh SEMUA tema, bukan hanya pertama).
- Filter: `RatingDeviation <= 100` (kualitas rating), rating **800–2200** (sesuai S3-T1), popularity >= 90, ambil maks **50.000**.
- Mapping: `PuzzleId → external_id`, `FEN → fen`, `Moves (UCI) → solution_moves` (jsonb array), `Rating → rating`, `Themes → themes`, `title = 'Lichess ' || rating || ' ' || PuzzleId` (varchar 100 aman).

## Import script (rekomendasi — dev S3-T1 yang menjalankan)

`scripts/import-lichess-puzzles.ts` — Node streaming:

- Baca `.csv.zst` via `child_process` spawn `zstdcat` piped ke `csv-parse` streaming (jangan load whole file; dump ~4M baris).
- Per baris: filter (rating range, RD, popularity, cap 50k), build row, batch insert 500 rows/INSERT dengan parameterized `ON CONFLICT (external_id) DO NOTHING` — idempoten, aman re-run.
- `NOTIFY` progress tiap 5000 baris; log count final.
- Sesudah selesai: verifikasi `SELECT count(*) FROM puzzles;` ≥ 50000 dan `SELECT count(*) FROM puzzles WHERE array_length(themes,1) > 1;` > 0 (acceptance S3-T4).

## Backup

Dibuat sebelum migration: `/home/deploy/backups/jev_chess_pre_sprint3.sql.gz` (pg_dump -Fc) — lihat log deployment; restore: `gunzip -c <f> | psql` atau `pg_restore`.
