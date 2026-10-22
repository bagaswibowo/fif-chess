# TICKET S3-T4 — Progress per Tema / Puzzle Kustom (G8b)

**Sprint:** 3 · **Priority:** P2 · **Role:** Fullstack · **Depends:** S3-T1 (attempts terekam per puzzle)
**Gap:** Teka-Teki Kustom `/puzzles/learning`: 26 tema dengan progress % per tema (mis. Back Rank Mate 100%, Garpu 50%), filter select + number inputs.

## Context
- Lichess dump punya kolom Themes (bisa banyak tema per puzzle, dipisah spasi) — S3-T1 hanya menyimpan tema pertama. Untuk mastery per tema, tema penuh dibutuhkan.
- Keputusan desain: **ubah `theme String?` → `themes String[]` (atau jsonb array) di Puzzle** di S3-T1 scope bila murah; ticket ini mengonsumsinya. Konfirmasi dengan DB Engineer: satu perubahan kolom di S3-T1 lebih murah daripada tabel join YAGNI.

## Tugas
1. Pastikan S3-T1 import menyimpan **semua** tema Lichess (26 tema resmi: mate, mateIn1..4, fork, pin, skewer, discoveredAttack, backRankMate, endgame, opening, middlegame, sacrifice, hangingPiece, trapping, deflection, quietMove, xRayAttack, interference, advantage, defensiveMove, promotion, long, veryShort, oneMove, master, crushing, attackingF2F7 — ambil daftar persis dari dump; buat konstanta `THEME_LIST` di `lib/puzzle-themes.ts` dengan label ID).
2. **API** `app/api/puzzles/themes/route.ts` (GET): agregasi per tema — {theme, attempted, correct, masteryPct} dihitung SQL-side dari puzzle_attempts JOIN puzzles (mastery = benar/attempted, atau benar / (total puzzle tema, capped) — pilih: mastery = % puzzle tema yang sudah dijaw benar, capped 100). Param filter `?theme=` untuk drill.
3. **UI** route `/puzzles/learning`: daftar/grid 26 tema dengan progress bar %, filter select tema, input number (min rating / max rating) untuk filter latihan; klik tema → latihan tema itu via `GET next?theme=` dari S3-T1. A11y: progress bar punya teks % untuk screen reader.
4. Sinkronisasi label: tema Lichess adalah key English, tampil label Indonesia dari THEME_LIST (mis. fork → Garpu).

## Acceptance
- [ ] Kolom themes berisi array multi-tema (verifikasi psql: puzzle dengan >1 tema ada).
- [ ] Mastery % benar untuk user dengan attempts campuran (verifikasi manual 1 tema).
- [ ] Filter rating di SQL (WHERE), bukan client.
- [ ] 26 tema tampil dengan label Indonesia.

## Guardrail
- YAGNI: no tabel puzzle_themes join; array kolom + SQL unnest cukup.
- Agregasi di SQL, bukan JS loop over ribuan baris.
- Minimal diff: 1 API route + 1 komponen + konstanta tema.
