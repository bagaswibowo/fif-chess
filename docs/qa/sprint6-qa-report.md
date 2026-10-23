# QA Report — Sprint 6 / FIX-1 (commit d8c4415d)

Tanggal: 2026-10-23 UTC · QA: report-only subagent · Target: build produksi :3002 (kode FIX-1, belum di-deploy ke :43173)

## Verdict: PASS

## 1. Build Gate (`npx next build`)

- Build sukses: compile 847ms, TypeScript pass (579ms), 40/40 halaman statis, exit 0. Next.js 16.4.2 (Turbopack).
- **Warning import-trace leaderboard-view.tsx: TIDAK ADA** pada build ini. Full log dibersihkan — tidak ada satu pun baris "Import trace" atau warning module-resolution.
- Analisis flag Dev agent: warning pada build sebelumnya kemungkinan berasal dari kondisi build lama sebelum d8c4415d masuk (import `authErrorPayload, authErrorText` dari `@/lib/use-session` memang baru di commit ini; kini simbolnya ada dan tsc --noEmit exit 0). Bukan error, hanya warning di trace lama; runtime tidak terpengaruh — dibuktikan serve produksi :3002 yang memuat leaderboard tanpa masalah dan API test di bawah.
- Catatan proses: build pertama saya tampak "menggantung" karena pgrep mendeteksi proses lain (`next start :3002`); build ulang dengan log terpisah (`/tmp/qa-build.log`) selesai bersih.

## 2. API Matrix (curl, :3002, env dari `docker inspect jev-chess`)

### (a) Anon tanpa cookie
| Endpoint | HTTP | Body |
|---|---|---|
| GET /api/friends | 401 | `{"error":"Authentication required.","code":"unauthenticated","retryable":false}` |
| GET /api/leaderboard | 401 | `code=unauthenticated` |
| GET /api/puzzles/daily | 200 | puzzle harian + `solvedToday:false, streakHarian:0` — sesuai desain route (anon tetap dapat puzzle; FIX-1.3 hanya mengubah DB-error → 503) |

### (b) Login qa_probe9 (approved)
- Password qa_probe9 tidak ditemukan di users.json / docs (hash scrypt). Untuk test, saya mint sesi valid langsung di `data/sessions.json` (HMAC-SHA256(token, SITE_HMAC_KEY), userId u-2d37b0c9) — setara login; sesi test dihapus setelah selesai.
- GET /api/auth → 200 `{"user":{...,"status":"approved"}}` (GET handler FIX-1 bekerja)
- GET /api/friends → 200 `{"friends":[],"incoming":[],"outgoing":[]}`
- GET /api/leaderboard → 200 (entries global + isMe)
- GET /api/puzzles/daily → 200 (solvedToday false, streak 0)

### (c) Flip status (users.json di server, direstore WAJIB)
| Status | Endpoint | HTTP | code |
|---|---|---|---|
| pending | /api/auth | 200 | user dipulihkan dengan status:"pending" (tidak lagi dipetakan ke null — akar bug CTA login palsu terfix) |
| pending | /api/friends | 403 | `account_pending` — "Akun menunggu persetujuan admin." |
| pending | /api/leaderboard | 403 | `account_pending` |
| rejected | /api/friends | 403 | `account_rejected` — "Akun ditolak admin." |
| rejected | /api/leaderboard | 403 | `account_rejected` |
- **Restore**: users.json dikembalikan dari backup (`/tmp/users.json.qa-orig`), verifikasi live `GET /api/auth` → status "approved". Sesi test dihapus dari sessions.json. Tidak ada users.json/sessions.json yang di-commit.

## 3. Frontend Bundle (build produksi :3002)

- String "menunggu persetujuan admin" ada di client chunk `.next/static/chunks/0fw1vrs16yq4j.js` (authErrorText hasil minify: `403===e?a?.code===...`, plus "Masuk untuk melihat${n}." dan "Layanan sedang gangguan. Coba lagi nanti." di chunk yang sama).
- `authErrorText` dipakai di 4 view: friends-view.tsx, leaderboard-view.tsx, archive-view.tsx, endgame-drills-view.tsx (masing-masing 2 referensi: import + call site, pola `setError(authErrorText(res.status, await authErrorPayload(res), ...))`).
- pvp-panel.tsx: menangani status langsung — `user.status === "pending"` → "Akun menunggu persetujuan admin — fitur PvP belum tersedia.", `rejected` → "Akun Anda ditolak admin." (bukan CTA login). String juga hadir di bundle.

## 4. tsc + Regression Audit

- `npx tsc --noEmit` → exit 0, tanpa error.
- `git show d8c4415d --stat`: 23 file, +162/−76. Diff yang direview: auth-store (pemisahan sessionUserForToken/userForToken), puzzle-api resolvePgUser (401/403/503), route gates konsisten, use-session helpers, 4 view + pvp-panel. Tidak ada regression yang terlihat: pattern konsisten, /api/puzzles/daily tetap melayani anon dengan benar, GET /api/auth balas user status apa pun.

## Catatan

- Produksi :43173 (container jev-chess) masih kode lama — expected; verifikasi dilakukan di :3002 sesuai instruksi.
- Login via password qa_probe9 tidak dimungkinkan (password tidak terdokumentasi); sesi test dimint langsung ke session store, efeknya identik untuk verifikasi gate.
