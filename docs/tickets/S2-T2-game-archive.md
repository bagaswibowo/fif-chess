# TICKET S2-T2 — Game Archive Page + Favorit + PGN (G11)

**Sprint:** 2 · **Priority:** P1 · **Role:** Fullstack · **Depends:** S2-T1 (opsional, bisa paralel)
**Gap:** G11 — arsip game dengan filter tab + delta rating + download PGN.

## Context
- Skema `games` saat ini (verifikasi psql jev-postgres): id, white_user_id, black_user_id, status, result, started_at, ended_at, created_at. **TIDAK ADA**: kolom favorit, time_control, tipe game (rated/casual/bot/coach), PGN/rating snapshot.
- Pola UX chess.com terverifikasi (analisis §11): filter tabs [Semua|Favorit|Live|Harian|Bot|Coach], counter total per tab, delta rating ± per row, aksi per row: Favorit / Analisis / Unduh.
- `lib/game-history.ts` + `lib/game-record.ts` existing — pakai, jangan tulis ulang.

## Tugas
1. API `app/api/games/route.ts` (GET): list games milik user login (white/black), param `filter` + pagination (cursor `ended_at`); join `game_moves` untuk PGN saat diunduh.
2. API `app/api/games/[id]/pgn/route.ts`: render PGN dari `game_moves` (header + movelist), satu game.
3. Frontend `/games/archive`: tab filter, counter total, row = lawan (+rating), delta rating ±, hasil 0/½/1, tanggal; aksi Favorit (optimistic toggle), Analisis (link S2-T1), Unduh PGN; a11y (tabs pakai role=tablist/aria-selected, row bisa difocus).
4. Bulk download: checkbox pilih semua di tab aktif → satu file PGN multi-game (Gabungkan client-side, bukan zip).

## Acceptance
- [ ] Semua 6 tab filter berfungsi dan menampilkan counter yang benar.
- [ ] Favorit persist lintas reload; toggle < 200ms perceived (optimistic).
- [ ] Unduh PGN valid (terbaca di lichess/chess.com import) untuk 1 game dan bulk.
- [ ] Delta rating tampil dengan tanda ± benar.
- [ ] Keyboard navigable penuh.

## Guardrail
- Query selalu scoped ke user session — tidak ada leak game user lain.
- PGN dihasilkan dari game_moves di server, bukan disimpan duplikat.
- Tanpa mock data.

## DB (keputusan dibutuhkan — input untuk DB Engineer)
1. `games.favorited BOOLEAN NOT NULL DEFAULT false` (atau tabel favorit terpisah?) — **rekomendasi: kolom di games**, satu boolean cukup, YAGNI.
2. `games.time_control VARCHAR(10)` snapshot (mis. "10+0") dan `games.game_type VARCHAR(10)` ('live'|'daily'|'bot'|'coach') — kolom filter tidak bisa di-derive dari kolom existing. Set saat INSERT game (match-result / seek / challenge / bot creation path).
3. Delta rating: **snapshots `games.white_rating_before/after`, `black_rating_before/after` INTEGER** (atau derive dari tabel rating terpisah — lihat S2-T3). Rekomendasi: simpan snapshot di games saat match-result, supaya arsip & stats dua-duanya query games saja.
