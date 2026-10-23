# QA Report — Sprint 6 / WS-2.5 4 Menu (T7 regression) — commits b62613d8 + af6bda93

Tanggal: 2026-10-23 UTC · QA: report-only subagent · Target: build produksi :3002 (head origin/main af6bda93). Produksi :43173 masih kode lama — sesuai instruksi, tidak diuji.

## Verdict: PASS-WITH-NOTES

## 1. API matrix (curl, :3002, sesi valid via session store)

Sesi test dimint langsung ke `data/sessions.json` (token HMAC, setara login) untuk e2e_white (approved), s2backend_smoke (approved, sementara di-flip isAdmin utk peran admin), t1pendingx (pending), andymaulanayusuf (approved, user baru tanpa game). Sesi & flip admin dipulihkan setelah test; `data/users.json` diverifikasi identik dgn kondisi awal.

| Endpoint | Guest | Pending | Approved | Admin | User baru |
|---|---|---|---|---|---|
| GET /api/home/dashboard | 401 `unauthenticated` | 403 `account_pending` | 200 | 200 | 200, `recentGames: []` |
| GET /api/games/archive | 401 | 403 `account_pending` | 200 | 200 | 200 `games: [], total: 0` |
| GET /api/leaderboard | 401 `unauthenticated` | 403 `account_pending` | 200 | 200 | 200 |
| GET /api/leaderboard?game_type=bullet/blitz/rapid | 401 | 403 | 200 `gameType` echo | 200 | 200 |
| GET /api/leaderboard?game_type=foo | 401 | 403 | 400 "game_type harus bullet, blitz, atau rapid." | 400 | 400 |
| GET /api/puzzles/themes | 401 | 403 | **500** (lihat temuan) | **500** | **500** |
| GET /api/puzzles/next | 401 | 403 | 200 | 200 | 200 |
| GET /api/puzzles/next?theme=&minRating=&maxRating | 401 | 403 | 200 (filter efektif) / 404 "Tidak ada teka-teki di rentang ini." utk kombinasi kosong | 200 | 200 |
| GET /api/auth (FIX-1.4) | 200 `user:null` | 200 status "pending" | 200 | 200 | 200 |
| GET /api/friends | 401 | 403 `account_pending` | 200 | 200 | 200 |

### T1 — dashboard recentGames
- e2e_white: `recentGames` 3 item ≤5, terurut `endedAt` desc, shape `{id, myResult, opponent{username,rating}, timeControl, gameType, endedAt}` ✓.
- `myResult` benar dari perspektif user: e2e_white = win/loss/draw vs s2backend_smoke = loss/win/draw utk game yang sama ✓ (dicek vs PG: result 'white', white_user=e2e_white).
- andymaulanayusuf (tanpa game): `recentGames: []` ✓ (bukan null).

### T2 — archive opening_name + duration_sec
- Row e2e_white game d482f097: `opening_name: "Queen's Gambit Declined"`, `duration_sec: 0`, rating delta −14 ✓; row null-safe pada game pendek (moves < 4 ply → null, terverifikasi di kode + row lain).
- Waktu respons: ~6ms (baseline, tidak ada penambahan >300ms) ✓.
- PGN `/api/games/[id]/pgn` matches (1-0, e2e_white putih).

### T3 — leaderboard filter + winRate
- `winRate` ada di tiap entry, nilai 0–1 dgn 2 desimal ✓ (0, 0.17, 0.5).
- game_type=blitz → winRate e2e_white 0.5 (menang game 3+2); rapid → 0; tanpa filter → 0.17. Konsisten dgn DB ✓.
- Catatan: kolom `games` tetap total semua game (6) di semua kategori — implementasi memakai `games_gt` untuk winRate namun menampilkan `games` global (desain backward-compat, bukan regresi; lihat temuan #2).
- scope=friends → `me` entry dgn rank/winRate ✓.

## 2. Frontend bundle (:3002 build produksi, chunk 32rfstfn_9l55.js)
- Tab + chips leaderboard: `role="tablist"` ×2 ("Cakupan papan peringkat", "Kategori waktu"), `role="tab"` + `aria-selected`, roving tabindex (`tabIndex:i===a.id?0:-1`) ✓.
- Kolom win-rate + baris sendiri: teks "(Anda) — Peringkat kamu: N" (sr-only) + `border-l-[3px]` / `w-[3px]` (highlight non-warna-saja) ✓.
- Archive: badge ikon+teks ✓/✕/½ × Menang/Kalah/Remis, aksi Analisis/Rematch/Menunggu, pagination "Halaman N dari M" ✓.
- Puzzle hub: stats (streak), filter chips Semua/Bullet/Blitz/Rapid; rush: `visibilitychange` listener pause-on-hidden + resume ✓.
- aria-live: 2 occurrence di chunk view ✓; sr-only 18× ✓.
- Empty state leaderboard "Papan masih kosong…" ada di bundle ✓.

## 3. UX sanity (data nyata)
- SPA single-page: / 200; nav Dashboard/Arsip/Papan Peringkat hadir di HTML. Tidak ada teks mock/TODO/lorem (hanya attribute `placeholder=` input, bukan konten).
- Angka match DB: archive total 3 & counts (all 3, live 2, daily 1, favorited 1) = PG ✓; leaderboard isMe rank 11 / games 6 / winRate 0.17 konsisten dgn query PG manual ✓.
- Rematch aksi: POST /api/challenge (toUserId + timeControl 3+2 dari game) → 201 + row `challenges` `pending` di PG (row test dihapus setelah verifikasi) ✓.
- Filter puzzle efektif: 4× next?theme=advantage → semua puzzle memuat theme "advantage" (rating 1122–1299) ✓.

## 4. Regression & build gate
- FIX-1 endpoint lama utuh: /api/friends 401/403/200 sesuai role; /api/auth GET 200 user status apa pun ✓.
- `npx tsc --noEmit` → exit 0 ✓.
- `npx next build` → ✓ Compiled successfully 1671ms, 40/40 halaman statis, tanpa warning import-trace, exit 0 ✓.
- 503 path (PG down): tidak diuji destruktif; diverifikasi via kode `resolvePgUser` catch → 503 `service_unavailable` (tidak berubah oleh T1–T3, semua route baru memakai helper yang sama).

## Temuan / tiket follow-up
1. **BUG (open, pre-existing, bukan dari T1–T6): GET /api/puzzles/themes → 500** untuk SEMUA role authed (guest 401 benar). Log server: PG `42P18 could not determine data type of parameter $1` — query themes memakai param `?theme=` yang saat null menghasilkan `$1` tanpa type inference di LEFT JOIN `a.user_id = $2::uuid` branching. Route terakhir diubah di d8c4415d (bukan af6bda93). Dampak: dropdown tema di puzzle-view (T6) beropelasan ke endpoint ini — filter tema akan gagal load list tema. Saran tiket: cast eksplisit `$1::text` / pindahkan param agar selalu terikat.
2. **NOTE (by design?): leaderboard kolom `games` tidak terfilter per game_type** — winRate terfilter, `games` tidak. Spec T3 hanya mensyaratkan agregat per kategori utk winRate; UI yang menampilkan "Game" per kategori akan membingungkan. Konfirmasi ke desainer.
3. **NOTE: produksi :43173 masih kode lama** — deploy diperlukan setelah laporan ini.
4. **NOTE: /api/challenge wajib cookie `jev_gate` + `jev_session`** — tidak berubah, tapi tombol Rematch T5 bergantung pada keduanya (browser user punya keduanya setelah login; OK).

## Kebersihan test
- users.json: restore penuh (diverifikasi identik vs backup, 18 user, isAdmin false).
- 4 sesi test dihapus dari data/sessions.json.
- 1 row challenges test dihapus dari PG.
- Tidak ada file app yang diubah; tidak ada commit QA.
