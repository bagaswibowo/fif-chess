# TICKET S3-T1 — Puzzle Core API + Solve Mode (G8)

**Sprint:** 3 · **Priority:** P0 · **Role:** Fullstack · **Depends:** —
**Gap:** G8 — puzzle rating-based unlimited (`/puzzles`), streak, hint.

## Context
- Tabel `puzzles` + `puzzle_attempts` SUDAH ada di DB dan schema.prisma (Puzzle: fen, solution_moves jsonb, rating, theme; PuzzleAttempt: correct, time_spent_sec) — **keduanya kosong (0 baris)**.
- Bank puzzle statis existing (`resource/puzzles-all.json`, `lib/puzzle-data.ts`, `lib/puzzle-store.ts`) adalah jalur quest/kategori BPCaturPedia — JANGAN diganggu; Sprint 3 pakai DB baru.
- Analisis REA §5: hub `/puzzles` — rating-based unlimited, streak, hint, validasi move via chess.js.

## Tugas
1. **Import Lichess (YAGNI):** script `scripts/import-lichess-puzzles.ts` — stream `lichess.org/puzzle/dumps/lichess_db_puzzle.csv.csv.zst` (atau subset), filter rating 800–2200, ambil **maks 50.000** puzzle, map kolom: FEN → fen, Moves (UCI) → solution_moves, Rating → rating, Themes (ambil tema pertama) → theme, title = "Lichess <rating>". Idempoten (skip id yang sudah ada; gunakan lichess puzzle id sebagai `title` suffix unik atau kolom `external_id` bila perlu — pilih minimal diff). Jalankan sekali, catat count hasil di PR/commit message.
2. **API** `app/api/puzzles/` :
   - `GET next` — 1 puzzle dekat rating user (±150, fallback ±400), exclude yang sudah dikerjakan benar; param `?theme=` opsional.
   - `POST attempt` — body {puzzle_id, correct, time_spent_sec} → INSERT puzzle_attempts, return streak (streak berjalan sekarang) + rating delta ringkas.
   - `GET /hint` atau sertakan hint di `next`: hint = bidak pertama solusi (dari solution_moves[0]) tanpa membocorkan langkah.
3. **Solve UI** `components/puzzle-solver.tsx` + route `/puzzles`: papan existing (reuse komponen board repo), validasi langkah vs solution_moves (UCI→SAN via chess.js), feedback benar/salah, tombol Petunjuk, counter streak, lanjut otomatis setelah benar. A11y: status via aria-live.

## Acceptance
- [ ] DB berisi ≥50.000 puzzle hasil import (count terverifikasi via psql).
- [ ] `GET next` tidak mengulang puzzle yang sudah benar untuk user sama.
- [ ] Streak naik saat benar, reset saat salah.
- [ ] Hint menunjukkan bidak/arah tanpa membocorkan langkah penuh.
- [ ] Bank statis quest tidak berubah perilaku.

## Guardrail
- YAGNI: no PuzzleUserRating model (rating user diambil dari games.users.rating); no spaced repetition.
- Import terbatas 50k — bukan 4 juta.
- Tanpa mock data; minimal diff: 1 script + 2-3 API route + 1 komponen.
