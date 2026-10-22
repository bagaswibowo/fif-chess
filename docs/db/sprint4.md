# Sprint 4 — DB Notes

Tanggal: 2026-10-22 · DB Engineer · target: S4-T1..T5 (fokus DB: S4-T3 friends)

## Verifikasi schema (psql \d)

- **users**: `rating INT NOT NULL DEFAULT 1200`, `rush_best`, `rush_best_at` ada. → **Leaderboard global cukup dari `users.rating`** (ORDER BY rating DESC LIMIT 50, posisi user sendiri via window/count); tidak perlu kolom/tabel baru.
- **games**: kolom `white_rating_before/after`, `black_rating_before/after` ada → **snapshot rating per game sudah cukup** untuk historis leaderboard/rating chart. `status='active'` → game aktif untuk home dashboard.
- **puzzle_attempts**: `attempted_at`, `correct` ada → **solvedToday** = query `WHERE user_id=$1 AND correct AND attempted_at::date = today`; tidak perlu kolom baru.
- **challenges** (referensi gaya S1-T4): FK dua arah ke users, `status text + check`, index `(from_user_id, status)` dan `(to_user_id, status)`.

## Keputusan

1. **Tabel `friends` baru (S4-T3)** — satu-satunya objek DB baru Sprint 4. Pola mengikuti `challenges`:
   - `user_id`, `friend_user_id` uuid FK → users(id) ON DELETE CASCADE dua arah.
   - `status text CHECK (status IN ('pending','accepted'))` — default 'pending'. Request masuk = row (friend_user_id=Saya, user_id=Pengirim) pending; accept = UPDATE kedua arah jadi 'accepted'.
   - **UNIQUE (user_id, friend_user_id)** — add ganda idempoten (ON CONFLICT DO NOTHING); self-friend diblokir CHECK `user_id <> friend_user_id`.
   - Index lookup: `idx_friends_user (user_id, status)`, `idx_friends_friend_user (friend_user_id, status)` — list teman & incoming requests.
   - YAGNI: tanpa kolom message/nickname, tanpa blokir/unfriend-history.
2. **S4-T2 (home dashboard): TIDAK ada kolom baru** — solvedToday dari `puzzle_attempts`, game aktif dari `games WHERE status='active'`, rating dari `users.rating`.
3. **Leaderboard: TIDAK ada kolom baru** — ranking global dari `users.rating`; `games` sudah punya snapshot rating per pemain.

## Migration

File: `docs/db/sprint4-migration.sql` (idempoten, sudah dijalankan nyata via `docker exec -i jev-postgres psql -U jev -d jev_chess` setelah backup pg_dump; re-run terverifikasi aman).

Isi: `CREATE TABLE friends (...)` + `friends_different_users` CHECK + `friends_status_check` CHECK + UNIQUE pair + 2 index lookup.

Verifikasi pasca-run: `\d friends` menampilkan tabel dengan constraint/index sesuai desain (lihat di atas).

## Backup

`~/backup-jev-pre-sprint4-1792697171.sql` di sxz-server (pg_dump full, 51 MB) sebelum migration.

## Kebutuhan API (untuk dev S4-T3)

- `GET /api/friends` → dua list: teman (rows `status='accepted'` via `idx_friends_user`) dan **incoming requests** (rows `status='pending' WHERE friend_user_id = me` via `idx_friends_friend_user`), join `users` untuk username.
- `POST /api/friends` — body username: INSERT row pending (arah pengirim→penerima), `ON CONFLICT (user_id, friend_user_id) DO NOTHING` untuk idempoten; unfriend = DELETE kedua arah.
- Accept/decline request: UPDATE status 'accepted' pada kedua row arah, atau DELETE.
- **Presence**: status online teman diambil dari Redis set **`jev:online`** — set ini **sudah ada sejak S1-T3** (presence heartbeat), tinggal `SISMEMBER jev:online <userId>` per teman di list; tidak perlu tabel/kolom DB untuk presence.
