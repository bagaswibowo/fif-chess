# PM Board & Training Plan — jev-chess

Tanggal: 2026-10-23 · Author: PM/investigasi (read-only investigation, plan only)
Repo: /home/sxz/projects/active/jev-chess · HEAD saat investigasi: a3ebe47b

## A. ROOT-CAUSE: bidak tak bisa digerakkan di menu Teka-teki

### Fakta
Semua view puzzle memakai komponen bersama 
(PuzzleView, RushView, EndgameDrillsView, DailyPuzzleView, ThemesMasteryView).
Di dalamnya,  v5 dirender HANYA dengan:

-  — puzzle-solver.tsx:192
- TIDAK ADA , TIDAK ADA , TIDAK ADA 
  (grep  di puzzle-solver.tsx → kosong).

Akibat: drag diizinkan tapi drop tidak pernah diproses — FEN tidak pernah
berubah,  tidak pernah dipanggil (bahkan  adalah dead
code: didefinisikan lalu  di puzzle-solver.tsx:138-155),
 tidak pernah keluar dari solving, /
tidak pernah terpanggil. Papan terasa mati.

Perbandingan dengan game.tsx yang berfungsi:
- game.tsx:1375-1389 — , ,
  ,  semuanya terpasang pada options Chessboard.
- game.tsx:820-834 —  memvalidasi & memajukan state;
   membatasi ke bidak sisi human.
- learning-hub.tsx:1018-1040 juga sudah benar (punya , , ) — jadi quest di Learning
  Hub bisa digerakkan; hanya PuzzleSolver yang rusak.

### Per view (file:line yang harus diubah)
1. components/puzzle-solver.tsx:186-206 — tambahkan  (handler
   validasi langkah vs solution_moves via validateSolutionStep), 
   (hanya bidak sisi ), dan  (click-to-move).
   Ini SATU perbaikan yang menyembuhkan kelima view sekaligus.
2. components/puzzle-solver.tsx:138-155 — hidupkan  (sekarang dead
   code, selalu return true tanpa efek) atau ganti dengan handler nyata;
   kontraknya sudah ada di lib/puzzle-solve.ts:32-57.
3. Mode user plays correct side: SUDAH benar secara orientasi —
   puzzle-solver.tsx:167  dan
   lib/puzzle-solve.ts:18-21. Yang kurang adalah canDragPiece agar bidak
   lawan tidak bisa digeser.
4. Validasi via endpoint attempt: wiring SUDAH ada di semua view
   (puzzle-view.tsx:139-158, rush-view.tsx:164+, endgame-drills-view.tsx:106+,
   daily-puzzle-view.tsx:93+ → POST /api/puzzles/[id]/attempt, route ada di
   app/api/puzzles/[id]/attempt/route.ts). Masalahnya hanya tidak pernah
   terpanggil karena langkah tidak bisa dibuat. Catatan: attempt hanya
   mencatat hasil validasi client (server tidak re-validate langkah) —
   risiko kejujian rendah, catat saja.
5. game-review.tsx:545 () — by design untuk review;
   review-analysis-board.tsx:70 sama. Bukan bug, tidak diubah.

### Verifikasi build
▲ Next.js 16.4.3 (Turbopack)
✓ Running next.config took 30ms
Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry


  Creating an optimized production build ... +  (env dari [])
untuk uji manual: drag bidak di menu Teka-teki, Harian, Gegas, Permainan
Akhir, Latihan Tema.

## B. KONSEP LATIHAN (spec tiket W1..Wn)

Pola acuan: alur lessons/puzzles generik — progression bertingkat, streak
harian, review kesalahan, statistik. Semua sudah punya fondasi API
(puzzle_attempts, streak, rating); yang hilang adalah lapisan UX.

Yang SUDAH ada:
- Puzzle hub 4 tab (unlimited/daily/rush/themes) + stats strip personal
  (puzzle-hub.tsx:20-130).
- Filter tema + preset rating (puzzle-view.tsx:160-213).
- Endgame drills 6 set + progress % (endgame-drills-view.tsx).
- Learning hub quest + XP lokal (localStorage, learning-hub.tsx:32).
- Streak server via currentStreak (attempt route).

Yang HILANG untuk alur latihan utuh:
1. Interaktivitas papan (root-cause di atas) — prasyarat semua.
2. Progression level bertingkat (rating ladder / level, bukan filter manual).
3. Review kesalahan (puzzles saya yang gagal) — data puzzle_attempts
   correct=false sudah ada di DB, tidak ada UI.
4. Statistik jangka panjang (akurasi, rating curve, per-tema).
5. Streak harian lintas-menu (daily quest yang menyatukan puzzle+lessons).
6. Sinkronisasi XP learning-hub (localStorage) ke server.

### Tiket

W1 — Perbaiki interaksi papan PuzzleSolver (P0, blocker)
  Komponen: components/puzzle-solver.tsx
  Kerja: tambah onPieceDrop + canDragPiece (sisi sideToMove saja) +
  onSquareClick (click-move) ke options Chessboard; hidupkan/migrasi
  handleMove; langkah benar → maju FEN + auto-reply lawan (applyUci), salah →
  shake + failCount, selesai → finishPuzzle (streak + submitAttempt).
  Acceptance: di build :3002, puzzle di 5 view bisa diselesaikan dengan drag
  DAN klik; bidak lawan tidak draggable; attempt tercatat (streak naik).

W2 — Halaman review kesalahan Koreksi (P1)
  Komponen/endpoint: view baru di puzzle-hub (tab ke-5), GET
  /api/puzzles/missed (puzzle_attempts correct=false, unik, 7-30 hari).
  Acceptance: daftar puzzle gagal, klik → solve mode PuzzleSolver; solved di
  sini menghapus dari daftar.

W3 — Progression level puzzle (P1)
  Komponen/endpoint: level = tier rating (800/1000/1200/.../2200) dengan
  unlock berbasis akurasi tier sebelumnya; UI pemilih level di puzzle-view;
  endpoint /api/puzzles/next sudah mendukung min/max.
  Acceptance: tier terkunci sampai akurasi tier sebelumnya ≥60% (≥10 puzzle);
  progress tier tampil di stats strip.

W4 — Statistik latihan (P2)
  Komponen/endpoint: GET /api/puzzles/stats (agregat puzzle_attempts: akurasi
  7/30 hari, rating delta, top tema lemah); tab statistik di puzzle-hub.
  Acceptance: angka akurasi & rating 30 hari tampil; fallback guest rapi.

W5 — Streak harian lintas-menu (P2)
  Komponen/endpoint: daily goal (mis. 3 puzzle + 1 lesson) dengan progress
  dari puzzle_attempts + quest progress; strip goal di home + puzzle hub.
  Acceptance: selesai goal menandai hari; strip sinkron antar-menu tanpa
  reload.

W6 — Sinkron XP learning-hub ke server (P3)
  Komponen/endpoint: POST /api/progress/xp (upsert), baca saat load;
  migrasi one-time dari localStorage.
  Acceptance: XP sama di 2 device; localStorage jadi cache saja.

Prioritas: W1 (blocker) → W2, W3 → W4 → W5 → W6.

