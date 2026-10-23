# QA Report — Sprint 5 Fix Verification (jev-chess)

Tanggal: 2026-10-23 (UTC)
QA: subagent QA murni (tanpa perubahan kode repo)
Target: verifikasi runtime 4 bug fix Sprint 5 + Set-Cookie

## Environment
- Dev server: `node --experimental-strip-types server.ts` di port 3000 — di-restart fresh (PID baru). Log: `/tmp/jev-dev.log`. Server ready (`[jev-chess] ready on http://0.0.0.0:3000`).
- Catatan dev: akses via `100.127.103.9` memicu `Blocked cross-origin request ... /_next/hmr` (Next dev memblokir origin non-localhost); UI dev via IP tidak ter-hydrate penuh (tombol login & hash-router tidak merespon, tanpa error console). Ini PRE-EXISTING issue dev-server origin, bukan regresi diff. Verifikasi UI runtime dilanjutkan via build produksi sesuai instruksi.
- Prod server: `npx next start -p 3002` (port 3001 sudah dipakai aplikasi lain milik proses berbeda). Log: `/tmp/jev-prod.log`.

## Hasil

### 1. Register + Login + Set-Cookie — PASS
- Register `qa_sprint5_fix` via POST /api/auth → `{"ok":true,...}`. Status di-approve di `users.json` (backup: `users.json.bak-qa`).
- Login curl (dev :3000): **HTTP 200** dengan **DUA header `set-cookie` terpisah**:
  - `set-cookie: jev_gate=1792993941.07a598af...; Path=/; HttpOnly; SameSite=Lax; Max-Age=259200`
  - `set-cookie: jev_session=8f7f5ca9-ae63-4af5-a239-462b1fd84c0b; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`

### 2. GET /api/pvp dengan session cookie — PASS
- curl `-b cookiejar http://localhost:3000/api/pvp` → **200**, body `{"games":[]}`. Juga 200 via prod :3002.

### 3. BUG-1: Paste PGN di #/review → board analisis + movelist — PASS
- Login via UI prod, buka `#/review`, paste `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6` di textarea "Tempel PGN, FEN, atau tautan game internal…", klik **Analisis**.
- Hasil: "Permainan dimuat." + **Papan Analisis** (6/6) tampil + movelist lengkap `1. e4 / e5 / 2. Nf3 / Nc6 / 3. Bb5 / a6` + kontrol navigasi (Mundur/Awal/Maju/Akhir).
- Bukti: `docs/qa/evidence/bug1-review-pgn.png`

### 4. BUG-2: Fresh load #/daily, #/rush, #/themes → tab PuzzleHub benar — PASS
Cold load (about:blank → URL, tanpa state sebelumnya):
- `#/daily`  → tab **Harian** aktif; konten kalender harian ("Jumat, 23 Okt 2026").
- `#/rush`   → tab **Gegas** aktif; konten "Teka-Teki Gegas".
- `#/themes` → tab **Latihan Tema** aktif; konten daftar tema (Skemat, Garpu, Pin, dst.).
- Hashchange tanpa reload: `#/daily` → set `location.hash='#/rush'` → konten berganti ke Gegas tanpa reload. PASS.
- Catatan: identifikasi tab aktif via computed style (background hijau `rgb(129,182,76)`), karena tab tidak memakai `aria-selected`.

### 5. BUG-3: aria-current='page' maksimal 1 — **FAIL**
Jumlah elemen `[aria-current='page']` per view (DOM count):

| View | Desktop (1280px) | Mobile (390px) |
|---|---|---|
| #/ | 1 (Home, hidden bottom-nav) | 1 (Home) |
| #/review | 2 (Analisis + hidden Analisis) | 2 (Analisis ×2) |
| #/daily | 2 (Harian + hidden Home) | 3 (Teka-Teki, Harian, Teka-Teki) |
| #/rush | 2 (Gegas + hidden Home) | 2 |
| #/themes | 2 (Latihan Tema + hidden Home) | 2 |
| #/puzzles | 3 (Teka-Teki, Latihan Tema, Teka-Teki hidden) | 2 |
| #/play | 2 | — |
| #/community | 2 (Komunitas + hidden Komunitas) | — |
| #/materi, #/endgame | 1 | — |

Pola: setiap navigasi menambah/mengganda aria-current — elemen view sebelumnya tidak dibersihkan atributnya, plus bottom-nav mobile (hidden di desktop) tetap membawa `aria-current='page'`. Di mobile viewport `#/daily` mencapai **3** elemen. Ekspektasi fix: maksimal 1.
Bukti: `docs/qa/evidence/bug3-aria-current-puzzles.png` (cold load `#/puzzles`: Teka-Teki + Latihan Tema keduanya aria-current), `docs/qa/evidence/bug3-mobile-moresheet.png`.

### 6. Keliling 8 navTab + mobile more-sheet — PASS dengan catatan
- 8 tab (Home, Play, Puzzles, Review/Analisis, Scan, Materi, Endgame, Community) semuanya merender konten tanpa crash; not-Found hanya untuk endpoint API eksperimen.
- Mobile more-sheet: tombol "Lainnya" di bottom-nav membuka sheet "MENU LAINNYA" berisi Scan Papan, Materi Belajar, Permainan Akhir, Lawan Bot, Pelatih, Papan Peringkat, Teman, Arsip. PASS.

### 7. Console error check — PASS
- Hook console.error + window.error selama seluruh sweep: **0 error** (dev via localhost-origin dan prod).
- Server-side observasi (prod log): 13× `error: could not determine data type of parameter $1` (pg 42P18) dari server chunk. Tidak menimbulkan 500 pada endpoint yang diuji (pvp/community/leaderboard/stats → 200). Perlu investigasi dev, ditandatangani di luar scope QA ini.

## Ringkasan
| Item | Status |
|---|---|
| Set-Cookie ganda (jev_gate + jev_session) | PASS |
| GET /api/pvp + cookie → 200 | PASS |
| BUG-1 PGN review board + movelist | PASS |
| BUG-2 PuzzleHub tab fresh-load + hashchange | PASS |
| BUG-3 aria-current ≤ 1 | **FAIL** |
| 8 navTab + more-sheet | PASS |
| Console error 0 | PASS |

## Artefak
- Laporan: `docs/qa/sprint5-fix-qa-report.md` (baru)
- Screenshot: `docs/qa/evidence/bug1-review-pgn.png`, `bug2-themes-tab.png`, `bug3-aria-current-puzzles.png`, `bug3-mobile-moresheet.png`
- users.json backup: `users.json.bak-qa`; user test `qa_sprint5_fix` (approved)
- Server log: `/tmp/jev-dev.log`, `/tmp/jev-prod.log` (server dibiarkan berjalan)
