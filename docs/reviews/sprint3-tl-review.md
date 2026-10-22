# Sprint 3 — Final TL Review (10 commit)

Reviewer: Tech Lead (TL) · Tanggal: 2026-10-22 · Mode: review-only (tanpa push/ubah kode)
Commit direview: backend 4f5b5155 (S3-T1 import+core), 14efc8db (S3-T2 daily), d1311a37 (S3-T3 rush), da49127b (S3-T4 themes), 273c1f15 (fix next); frontend 4aa34416, c8da258a, 446986a2, 838b6dc2, 0a00c183.

## 1. Import verifikasi (DB nyata)
- `SELECT count(*), min(rating), max(rating) FROM puzzles` → **50000 / 800 / 2200** ✅
- `external_id IS NULL` → 0 baris (semua baris punya external_id) ✅
- Index: PK, btree rating (`idx_puzzles_rating`), GIN themes (`idx_puzzles_themes_gin`), partial UNIQUE `uq_puzzles_external_id WHERE external_id IS NOT NULL` ✅
- Import idempoten: `ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING` + pre-load existing external_ids ke Set ✅
- Streaming curl|zstdcat|readline, batch 500, parser CSV quote-safe, cap 50k, filter RD≤100 / rating 800–2200 / popularity≥90 — sesuai ticket & guardrail YAGNI (bukan 4jt).
- Verdict import: PASS.

## 2. Security
### Auth scoping
- Semua route puzzle (next/attempt/hint/daily/themes/rush start|next|attempt|leaderboard-except) memanggil `currentPgUser()` → 401 bila anonim ✅
- attempt: puzzle_id validasi UUID via `$2::uuid` cast; body strict-validated (time_spent_sec 0..3600, moves UCI regex) ✅
- rush attempt/next: session ownership dicek (`s.userId !== me.pgId` → 403) — user TIDAK bisa submit attempt ke sesi user lain ✅
- rush skor: strike/skor dihitung server-side dari Redis session (client hanya kirim correct/time) — sesuai guardrail ticket S3-T3 ✅; rush_best diupdate server-side `WHERE $2 > rush_best` (race-safe-ish, single UPDATE atomik) ✅

### Temuan / catatan
1. **[MEDIUM] `correct` client-trusted di puzzle_attempts (S3-T1 attempt & rush attempt).** Server menerima `correct === true` mentah. Untuk rush skor leaderboard ini bisa dimanipulasi (bot spam POST correct=true → rush_best tinggi). Mitigasi ada (server memegang puzzle & solution_moves di sesi), tapi server TIDAK memverifikasi langkah. Acceptance ticket hanya mensyaratkan "strike/skor dihitung server-side" (terpenuhi secara teknis — agregasi di server), namun verifikasi langkah vs `solution_moves` seharusnya jadi tindak lanjut Sprint 4 (mis. kirim move list, server validasi dengan chess.js). TIDAK blocker sprint ini.
2. **[LOW] Tidak ada rate limit** pada attempt/rush/start — spam POST bisa inflasi streak/rush. Token bucket sederhana di middleware disarankan sprint berikut.
3. **[LOW] `POST attempt` tidak mengecek puzzle_id milik sesi user** — user bisa POST attempt untuk puzzle apa pun (attempt statnya tercatat walau puzzle tidak pernah diberikan server). Impact rendah (hanya stats/leaderboard tema mastery), bukan escalation.
4. **Redis TTL**: sesi rush `EX 15*60` — TTL di-refresh tiap saveSession setelah attempt, dan didelet saat gameOver → tidak ada leak permanen ✅. `enableOfflineQueue:false, maxRetriesPerRequest:1` mencegah hang. ✅
5. **Daily rotation bypass**: rotasi deterministik `sha256("jev-daily:"+date) % count` di band 1200–1800, `OFFSET $1` parameterized, future date ditolak (400) — tanggal lampau bisa diakses (by design, navigator ±hari). `solvedToday` dicek per (user, puzzle_id, date UTC) — tidak bisa spoof karena user_id dari session. ✅

## 3. SQL
- Semua query parameterized (`$1..$n`); theme filter via `$4::text = ANY(p.themes)` — **inject-safe** ✅
- 273c1f15 memperbaiki bug nyata: `BETWEEN ${lo2} AND ${hi2}` (string interpolasi angka — bukan injectable karena Number-coerced, tapi menyebabkan 08P01 param mismatch). Fix ke `$2/$3` benar ✅
- Themes query (da49127b): `CROSS JOIN LATERAL unnest(p.themes)` + `LEFT JOIN puzzle_attempts` dengan `AND a.user_id = $N` di ON-clause — **benar** (join-scoped per user, tidak cross-product salah). Parameter binding varian (dengan/tanpa theme & user) konsisten ✅
- Leaderboard: `ORDER BY rush_best DESC, rush_best_at ASC NULLS LAST LIMIT 20` — statis, parameterless ✅
- GIN: EXPLAIN ANALYZE `(fork = ANY(themes))` + rating band → Bitmap Index Scan `idx_puzzles_rating` (planner memilih rating btree karena lebih selektif-ndistinct; GIN tersedia bila filter tema tanpa rating). Execution 5ms ✅
- Catatan [LOW]: `ORDER BY random()` di 50k baris per request next/next-rush — 5–8ms sekarang, acceptable; pertimbangkan `TABLESAMPLE` bila DB tumbuh.

## 4. Performance (EXPLAIN ANALYZE nyata)
- `next` (rating band + anti-join attempts): Bitmap Index Scan idx_puzzles_rating, 13k rows, **7.7ms** ✅
- next + theme: **5.0ms** ✅
- Streak: `ORDER BY attempted_at DESC LIMIT 100/200` per attempt — index on (user_id, attempted_at DESC) belum ada; [LOW] tambahkan di Sprint 4 bila attempts besar.

## 5. Frontend
- **XSS**: grep `dangerouslySetInnerHTML|innerHTML` di semua file S3 → 0 hit. FEN/PGN/move dirender via React text & chess.js — aman ✅
- Kontrak API dipatuhi (PuzzleView fetch next/attempt/hint; RushView POST rush/attempt; skor dari respons server, tidak dihitung client) ✅
- A11y: sesuai design sprint3 — aria-live (timer, feedback), aria-disabled + aria-describedby (navigator daily), progressbar role + aria-valuenow + teks % (themes), prefers-reduced-motion, fokus ke Main Lagi di end screen ✅
- **View switching (0a00c183)**: diff `components/game.tsx` hanya **14 baris (+76/-4 total)** — navTab "puzzles" baru, render PuzzleHub, mobile bottom nav. Minimal diff sesuai requirement ✅
- vitest.config.ts alias `@` memperbaiki resolusi test — netral terhadap engine tests.
- puzzle-solve.test.ts: **13/13 PASS** (dijalankan sendiri) ✅

## 6. Build & test (dijalankan sendiri di sxz-server)
- `npx tsc --noEmit` → **0 error** ✅
- `npm run build` → **sukses** ✅
- `npx vitest run` → 38 passed / **7 failed** / 1 error — **baseline identik di commit 0c88c863 (pre-S3)** via worktree: 7 failed / 25 passed / 1 error (coach.test.ts engine timing — pre-existing, BUKAN regresi Sprint 3) ✅
- Net test Sprint 3: +13 passed (puzzle-solve), 0 regresi.

## 7. Konsistensi code vs ADR/ticket/dev-doc
- S3-T1 ✅ (import cap 50k, external_id, next ±150/±400, hint 2-stage, streak; bank statis quest tidak disentuh)
- S3-T2 ✅ (rotasi deterministic, future 400, streak harian derive tanpa tabel baru — YAGNI dipatuhi)
- S3-T3 ✅ (Redis TTL 15min = "in-memory/TTL" sesuai guardrail; skor/strike server-side; rush_best 2 kolom users; leaderboard SQL-side top 20)
- S3-T4 ✅ (unnest SQL-side, GIN, THEME_LIST 26 tema label Indonesia, mastery %)
- S3-T5 battle deferred — tidak ada kode battle, sesuai rencana ✅
- Design sprint3.md §1–§4 diimplement sesuai spec frontend.

## 8. Cleanup user smoke
- data/users.json (instance prod): ditemukan `s3smoke` — **dihapus** (12 users tersisa). `s3smoke2/3`, `s3rush/2` tidak ada di users.json. Backup: /tmp/users.json.bak-s3review (sxz-server).
- DB: users `s3smoke, s3smoke2, s3smoke3, s3rush, s3rush2` masih ada di postgres `users` (sisa smoke test) + puzzle_attempts terkait. TIDAK dihapus otomatis (data DB, di luar mandat file cleanup) — sarankan: `DELETE FROM puzzle_attempts WHERE user_id IN (SELECT id FROM users WHERE username LIKE s3%); DELETE FROM users WHERE username LIKE s3%;`

## Verdict per commit
| Commit | Scope | Verdict |
|---|---|---|
| 4f5b5155 | S3-T1 import + puzzle core API | APPROVED (catatan: verifikasi server-side `correct` Sprint 4; no rate limit) |
| 14efc8db | S3-T2 daily API | APPROVED |
| d1311a37 | S3-T3 rush API | APPROVED (catatan: correct client-trusted untuk leaderboard — mitigasi Sprint 4) |
| da49127b | S3-T4 themes API | APPROVED |
| 273c1f15 | fix param binding next | APPROVED (bug nyata, fix benar) |
| 4aa34416 | frontend solve mode + tests | APPROVED (13/13 test pass) |
| c8da258a | frontend daily | APPROVED |
| 446986a2 | frontend rush | APPROVED |
| 838b6dc2 | frontend themes | APPROVED |
| 0a00c183 | view switching + vitest alias | APPROVED (game.tsx diff 14 baris — minimal) |

## Kesimpulan
**PUSH READY** — semua 10 commit APPROVED. Semua acceptance inti terverifikasi (DB 50k/800–2200, security scoping benar, SQL inject-safe, EXPLAIN 5–8ms, tsc+build bersih, test netral-minus-baseline). Tindak lanjut Sprint 4: (1) verifikasi server-side langkah puzzle (bukan `correct` client-trusted); (2) rate limit attempt/rush; (3) index (user_id, attempted_at DESC) untuk streak; (4) bersihkan users s3% dari postgres.
