# TICKET S3-T2 — Daily Puzzle (G10)

**Sprint:** 3 · **Priority:** P1 · **Role:** Fullstack · **Depends:** S3-T1 (DB terisi)
**Gap:** G10 — Teka-Teki Harian `/daily`: rotasi date-keyed, navigasi ±hari, attempts per date.

## Context
- Menu map §Teka-Teki: `/daily` — navigasi **[← Hari Sebelumnya | 22 Okt 2026 | Hari Berikutnya →]** + Petunjuk.
- REA §5: daily puzzle = 1 puzzle per tanggal UTC, semua user dapat posisi sama.

## Tugas
1. **Rotasi deterministic (YAGNI, tanpa tabel daily_puzzles):** API `app/api/puzzles/daily/route.ts` (GET, param `?date=YYYY-MM-DD` default hari ini UTC): seed = hash(date) → pilih puzzle dari `puzzles` band rating 1200–1800 via `OFFSET floor(seed * count)` atau `id` modulo — deterministic dan sama untuk semua user. Hari Berikutnya > hari ini ditolak (400) — masa depan tidak boleh dilihat.
2. **Attempts per date:** simpan `attempted_at` existing di puzzle_attempts sudah cukup untuk "sudah dikerjakan hari X" — API return {solvedToday: bool, streakHarian} (hitung hari berurutan user menjaw benar; derive dari attempts, tanpa tabel baru).
3. **UI** route `/daily` + komponen (reuse `puzzle-solver` dari S3-T1, mode single-puzzle): header tanggal + tombol ←/→, Petunjuk, pesan "Sudah selesai hari ini" bila solved. A11y: aria-live status.
4. **Bagikan:** tombol salin hasil (bentuk "Jev Chess Daily 22 Okt 2026: ✅ 1/1" via navigator.clipboard).

## Acceptance
- [ ] Dua fetch `?date=` sama (tanpa user berbeda) mengembalikan puzzle yang sama; tanggal berbeda mengembalikan puzzle berbeda (verifikasi 3 tanggal).
- [ ] Navigasi ke tanggal masa depan ditolak.
- [ ] Streak harian benar: benar hari ini + kemarin = 2; bolong reset.
- [ ] Tanpa tabel baru (keputusan YAGNI tercatat).

## Guardrail
- Rotasi di SQL/seed, bukan hardcode daftar tanggal.
- Timezone UTC untuk semua key tanggal (dokumentasikan di code comment).
- Minimal diff: 1 API route + 1 komponen.
