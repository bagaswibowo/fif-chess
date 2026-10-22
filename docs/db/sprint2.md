# Sprint 2 — DB keputusan & migration

## Keputusan (dari PM)

1. `games.favorited BOOLEAN NOT NULL DEFAULT false` — untuk fitur archive/favorite (G11).
2. `games.time_control VARCHAR(10)` + `games.game_type VARCHAR(10)` dengan
   CHECK `game_type IN ('live','daily','bot','coach')` — untuk filter stats (G15).
3. Rating snapshot (nullable): `games.white_rating_before/after INTEGER`,
   `games.black_rating_before/after INTEGER`.
4. `UNIQUE(analysis_results.game_id)` — **sudah ada** di schema aktual
   (constraint `analysis_results_game_id_key`), jadi tidak perlu ditambah.
   Auto-review idempoten secara DB-level aman.

## Migration

File: `docs/db/sprint2-migration.sql` (idempoten — `ADD COLUMN IF NOT EXISTS` + DO block untuk CHECK constraint).

Backup sebelum dijalankan: `docker exec jev-postgres pg_dump -U jev jev_chess > ~/backup-jev-<epoch>.sql` (di sxz home).

Dijalankan via:
```
docker exec -i jev-postgres psql -U jev -d jev_chess < docs/db/sprint2-migration.sql
```

## ⚠️ Wajib bagi dev: INSERT INTO games harus isi time_control + game_type

Semua jalur pembuatan game WAJIB mengisi `time_control` dan `game_type`
(kolom nullable sekarang, tapi stats/filter G15 bergantung padanya).
Lokasi INSERT yang harus disentuh (hasil grep `INSERT INTO games`, exclude .next/build):

| File | Lokasi | game_type |
|---|---|---|
| `app/api/pvp/route.ts` | ~line 175, INSERT INTO games | `'live'` (pvp) |
| `app/api/challenge/[id]/respond/route.ts` | ~line 100, INSERT saat accept challenge | `'live'` (pvp) |
| `lib/realtime/matcher.ts` | ~line 38, INSERT saat match ditemukan | `'live'` (pvp) |
| `scripts/migrate-json-to-pg.ts` | migrasi data lama | set `'live'` + time_control dari data JSON, atau biarkan NULL |
| Jalur bot (G?) — belum ada INSERT games untuk bot saat ini | — | `'bot'` saat dibuat |

Catatan: kolom dibuat nullable agar migration tidak merusak jalur existing;
API path yang tidak mengisi kolom ini tetap jalan, tapi akan gagal filter stats G15.
