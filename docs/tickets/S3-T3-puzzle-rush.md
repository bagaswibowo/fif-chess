# TICKET S3-T3 — Puzzle Rush (G9)

**Sprint:** 3 · **Priority:** P1 · **Role:** Fullstack · **Depends:** S3-T1 (core API + solver)
**Gap:** G9 — Teka-Teki Gegas `/puzzles/rush`: survival 3/5 mnt/endless, 3 strike, kesulitan adaptif, skor + leaderboard.

## Context
- REA §6: flow Bermain → timer mulai → puzzle beruntun, kesulitan naik adaptif → 3 strike = game over → skor + leaderboard. Timer 3 menit / 5 menit / endless.
- Realtime infra (S1-T1) tersedia tapi leaderboard rush cukup HTTP — YAGNI.

## Tugas
1. **API** `app/api/puzzles/rush/` :
   - `POST start` — buat sesi rush di memori/server-side state ringan (atau derive ulang dari attempts dengan `session_id` timestamp — pilih minimal diff): return mode.
   - `GET next` — puzzle berikutnya dengan **difficulty adaptif**: mulai rating 1000, tiap benar +75, tiap salah −50 (clamp 800–2200), exclude yang sudah muncul di sesi ini.
   - `POST attempt` — {puzzle_id, correct, time_spent_sec}; hitung strike & skor server-side (skor = jumlah benar, bonus waktu opsional — YAGNI: skor = benar saja). Return {strikes, score, gameOver}. 3 strike atau timer habis → game over; INSERT attempts ke puzzle_attempts (correct/salah) agar ikut rekap user.
   - `GET leaderboard` — top 20 skor harian/7-hari (derive dari attempts per sesi? YAGNI: simpan skor rush terbaik di `users` kolom baru `rush_best INT DEFAULT 0` + `rush_best_at` — atau tabel kecil `rush_scores`; pilih minimal diff: 2 kolom di users, update hanya jika beat).
2. **UI** route `/puzzles/rush`: pilih mode [3 mnt|5 mnt|Endless] → timer countdown, strike indicator (3 hati), feedback instan, game-over screen dengan skor + best pribadi + leaderboard. Reuse papan & solver components dari S3-T1.

## Acceptance
- [ ] Kesalahan ke-3 mengakhiri sesi; skor tersimpan dan muncul di leaderboard.
- [ ] Difficulty naik setelah benar beruntun (rating puzzle berikutnya > sebelumnya — verifikasi).
- [ ] Timer habis = game over di ketiga mode; endless tidak punya timer.
- [ ] Attempts rush terekam di puzzle_attempts (ikut stats user).

## Guardrail
- Strike/skor dihitung server-side (bukan dipercaya dari client).
- Tidak ada model rush session persisten penuh; state sesi in-memory/TTL atau derive — dokumentasikan trade-off.
- Leaderboard hanya agregat waktu window, dihitung SQL-side.
- Minimal diff: 3-4 API route + 1 komponen + (maksimal) 2 kolom/tabel kecil.
