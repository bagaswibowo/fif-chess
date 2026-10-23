# Sprint 5 — QA Report: Konsolidasi Menu (S5-T6 Exploratory QA)

**Tanggal:** 2026-10-23 · **QA:** exploratory via dev server terpisah (`node --experimental-strip-types server.ts`, port 4599, DATABASE_URL jev-postgres + JEV_DATA_DIR repo, session test user `s5qa_a` yang di-register + di-approve via API).
**Baseline yang diuji:** `a5c8f915` (S5-T2/T3) + `92c5ca84` (docs). Kode tidak diubah — laporan saja.

---

## 1. Ringkasan PASS/FAIL

| # | Item | Status | Catatan |
|---|---|---|---|
| 1a | Sidebar tanpa daily/rush/themes/spectator | **PASS** | Grup: Bermain (Main Online/Lawan Bot/Pelatih), Teka-Teki (Teka-Teki saja), Berlatih (Analisis/Scan/Materi Belajar/Permainan Akhir), Komunitas (Komunitas/Papan Peringkat/Teman/Arsip), Lainnya (accordion kosong utk non-admin = Admin only) |
| 1b | "Visi" → "Materi Belajar" | **PASS** | Label sidebar + more-sheet sudah "Materi Belajar"; hash `#/vision` tetap render LearningHub ("Trik & Quest Taktik") |
| 1c | Bottom-nav sesuai target | **PASS** | Home · Bermain · Teka-Teki · Analisis · Komunitas · Lainnya (label "Analisis", bukan "Berlatih") |
| 2a | PuzzleHub tab Harian/Gegas/Tema | **PASS** | Ketiga sub-tab render konten (kalender harian, aturan Gegas, progres tema); tidak blank |
| 2b | Coach sub-tab "Jev vs Stockfish" | **PASS** | Sub-tab switcher AI Coach/Jev vs Stockfish berfungsi; tab spectator render arena "AI vs Engine Catur" |
| 3 | Deep-link `#/daily` `#/rush` `#/themes` `#/spectator` | **PARTIAL** | Tidak blank & land di parent yang benar (puzzles/coach). TAPI tab awal TIDAK di-set: `#/daily|#/rush|#/themes` selalu buka tab "Teka-Teki" (unlimited), bukan Harian/Gegas/Tema — **BUG-2**. `#/spectator` benar (sub-tab "Jev vs Stockfish" aktif) |
| 4a | Login → home dashboard → klik card → view target | **PASS** | Task card "Jawab Teka-Teki" → `#/puzzles`; "Main Online" → `#/play` (engine board siap) |
| 4b | Challenge flow inline | **PASS** | Panel "Lawan Pemain" tampil (format waktu, sisi bidak); "Permainan Baru" membuat seek (board menunggu "Lawan Online 1500"); WS `/ws` connect OK. (Tidak diuji 2-user realtime end-to-end) |
| 4c | Paste PGN di review tetap di analisis | **FAIL (sebagian)** | Redirect ke play sudah hilang ✔ (S5-T3), tapi setelah "Permainan dimuat." **tidak ada board analisis maupun movelist yang dirender** di view review — **BUG-1** |
| 4d | Arsip → PGN download | **PASS (API)** | View arsip + tombol "Ulas Partai/Unduh PGN" ada; `GET /api/games/archive/pgn` live (400 tanpa ids = guard OK). Tidak diuji download dengan game nyata (user test baru, 0 game selesai) |
| 5 | Mobile more-sheet hanya item luar grup | **PASS** | Sheet 390px: Scan Papan, Materi Belajar, Permainan Akhir, Lawan Bot, Pelatih, Papan Peringkat, Teman, Arsip — tanpa duplikasi daily/rush/themes/spectator |
| 6 | a11y: skip-link, aria-current, focus | **PASS dengan 1 minor** | Skip-link "Lewati ke konten utama" → `#main-content` ✔; sidebar item aktif `aria-current="page"` ✔; focus tetap di tombol menu saat navigasi ✔. **Minor:** bottom-nav "Home" tetap `aria-current="page"` padahal view aktif Teman (aria-current ganda) — **BUG-3** |
| 7 | Console error check | **PASS dengan catatan** | Tidak ada error JS di console saat keliling 12 tab + 4 deep-link. Server log: `GET /api/pvp?user=s5qa_a` **500 berulang (15x)** — **BUG-4** |

**Total: 10 PASS, 1 PARTIAL, 1 FAIL, 2 bug minor/medium.**

---

## 2. Bug ditemukan

### BUG-1 — HIGH: Paste PGN di Analisis tidak merender board analisis
- **Repro:** Login → sidebar Analisis (`#/review`) → paste PGN di PasteBar ("Tempel PGN, FEN, atau tautan game internal…") → klik tombol "Analisis".
- **Hasil:** status `role=status` "Permainan dimuat." muncul, hash tetap `#/review` (redirect ke play sudah hilang sesuai S5-T3), tapi `document.querySelectorAll('[data-square]').length === 0` — tidak ada papan, tidak ada movelist. State `moves`/`fen` terisi di game.tsx tapi view review hanya merender PasteBar + panel riwayat ("Belum ada riwayat").
- **Lokasi:** `components/game.tsx` ~1215–1251 (`onLoadPgn` mengisi state tanpa render target) — view `navTab === "review"` tidak punya komponen papan/movelist analisis.
- **Severity:** HIGH — fast-path analisis (S2-T4) praktis tidak berfungsi secara user-visible.

### BUG-2 — MEDIUM: Deep-link `#/daily|#/rush|#/themes` tidak meng-set tab awal PuzzleHub
- **Repro:** Muat fresh `http://<host>/#/daily` (juga via hashchange).
- **Hasil:** Land di `#/puzzles` ✔ tapi tab aktif "Teka-Teki" (unlimited), bukan "Harian". `initialPuzzleTabRef.current` diset di `navTabFromHash()` (game.tsx:190–193) dan diteruskan sebagai `initialTab` ke `PuzzleHub` (game.tsx:1203), namun tab tetap default. Dugaan: `PuzzleHub` (puzzle-hub.tsx:27 `useState(initialTab)`) di-mount sebelum ref terisi pada siklus hashchange, atau mount di-reset. `#/spectator` → coach sub-tab spectator: benar.
- **Severity:** MEDIUM — bookmark lama tidak mati tapi mendarat di tab salah (misleading).

### BUG-3 — LOW: aria-current ganda di bottom-nav
- **Repro:** Klik sidebar "Teman" saat mobile/desktop nav tampil.
- **Hasil:** `<nav>` memuat dua tombol dengan `aria-current="page"` sekaligus ("Teman" drawer item + "Home" bottom-nav). Screen reader membaca dua halaman aktif.
- **Severity:** LOW (a11y).

### BUG-4 — MEDIUM: `GET /api/pvp` 500 berulang — kolom `g.updated_at` tidak ada
- **Repro:** Login user apa pun → view play (polling `/api/pvp?user=<id>`).
- **Hasil:** HTTP 500 tiap poll (15x dalam sesi QA). Log: `error: column g.updated_at does not exist` di `app/api/pvp/route.ts:97` (`ORDER BY g.updated_at DESC`, intro komit 6ab37e75). Skema `games` punya `started_at/ended_at/created_at`, tidak ada `updated_at` (hint PG: pakai `w.updated_at`/`b.updated_at`).
- **User-visible:** tidak ada pesan error di UI (silent fail), tapi daftar game aktif PvP gagal dimuat.
- **Severity:** MEDIUM (regresi bukan S5 — diwarisi sebelum konsolidasi, tapi layak naik ke TL).

### Catatan bukan-bug
- **Cookie login digabung dalam SATU header Set-Cookie** (`Set-Cookie: jev_gate=…; …; jev_session=…` di `app/api/auth/route.ts` handleLogin, dua cookie di-join dengan "; "). Sesuai RFC browsers hanya menerima cookie pertama → **`jev_session` tidak pernah tersimpan di browser**, sehingga home dashboard 401 ("Sesi berakhir") dan admin approve 403. QA melewatkannya dengan set cookie manual via CDP. **Ini perlu diverifikasi TL** — di environment produksi (HTTPS/tunnel) perilakunya kemungkinan sama. Severity kalau terkonfirmasi: **HIGH (auth/authz rusak di browser asli)**.
- Banyak `error` di log lainnya berasal dari Redis XREAD offline-queue (presence) — noise, bukan blocker.

---

## 3. Bukti eksekusi
- Dev server: `[jev-chess] ready on http://0.0.0.0:4599 (WS di /ws, dev=true)`.
- Register/approve/login test user via `POST /api/auth` (curl + CDP cookie workaround) — `{"ok":true,"message":"Login berhasil.",...s5qa_a...status approved}`.
- Keliling 12 navTab + 4 deep-link: semua `#main-content` non-blank (len 85–15293).
- Screenshot: `/opt/data/profiles/developer/home/.config/browser-harness/tmp/shot.png` (view Teka-Teki).

## 4. Rekomendasi (tanpa mengubah kode)
1. Perbaiki BUG-1: render board analisis + movelist di view review saat `moves.length > 0` (atau tampilkan panel analisis inline).
2. Perbaiki BUG-2: pastikan `initialTab` terbaca pada hashchange (mis. pass via prop re-render/key remount).
3. Pisahkan dua cookie menjadi dua header `Set-Cookie` (Next.js: pakai `res.cookies.set()` dua kali) — verifikasi dulu di browser nyata.
4. Bug-4 & BUG-3: buat ticket perbaikan; BUG-4 bukan scope S5 tapi blocking polling PvP.
