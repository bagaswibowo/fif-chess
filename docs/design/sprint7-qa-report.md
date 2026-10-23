# Sprint 7 QA Report — W1–W4 + Polish V1/V3/V4/V6/V7/V8

Tanggal QA: 23 Okt 2026 (UTC) · Commit HEAD: 63a22a3b · Target uji: build produksi :3002
(next start dengan DATABASE_URL dari docker inspect jev-chess; :43173 produksi masih kode lama — tidak diuji)

## Build
- npx next build: bersih (exit 0, semua route ter-generate).
- tsc --noEmit: exit 0.

## Verdict per tiket
| Tiket | Verdict | Bukti |
|---|---|---|
| W1 interaksi papan PuzzleSolver (12b1202e) | PASS | canDragPiece terikat phase=="solving" + isOwnPiece (turn FEN aktif); onPieceDrop & onSquareClick (pilih asal→tujuan, ganti asal bila klik bidak sendiri) keduanya memanggil handleMove; handleMove → validateSolutionStep: unit-test node (chess.js asli) benar→ok+nextFen maju, legal-salah→"not-solution", ilegal→"illegal" (ditolak), promosi 5-char ok; auto-reply applyUci mengubah FEN, UCI invalid→null; finishPuzzle (guarded finishRef) memanggil submitAttempt; solution di-fetch GET /api/puzzles/[id]/solution (auth wajib). |
| W2 tab Koreksi (287bcd0e) | PASS | /api/puzzles/missed authed 200 {missed,streak}, anon 401; tab ke-5 terdaftar di puzzle-hub. |
| W3 tier ladder (3788ab6e) | PASS | /api/puzzles/tiers authed 200 dengan 8 tier 800..2200; unlock logic (accuracy+minSolved, tier pertama selalu open) direview benar. |
| W4 statistik (b2d8939c) | PASS | /api/puzzles/stats authed 200 (days7/days30), anon 401; tab ke-6 terdaftar. |
| V1 board chrome (72a1a048) | PASS (dengan catatan) | BoardChrome dipakai via PuzzleSolver yang di-share 5 view (unlimited/daily/rush/themes/endgame) — cakupan "4 view" terpenuhi lewat komponen bersama; gear/settings + koordinat ada di board-chrome.tsx. |
| V3 move list feedback | PASS | moveList di-update per langkah benar + auto-reply SAN/UCI di handleMove. |
| V4 flash hijau/merah + shake + last-move amber | PASS | setFlash correct/wrong, shake 300ms, reducedMotion → 0ms, terikat pada pasangan visual. |
| V6 sidebar 6 grup + aria-current guard (248ab6ac) | PASS | aria-current hanya dirender saat mounted && active && isDesktop && item visible (accordion "Lainnya" dikecualikan); DOM smoke: tepat 1 aria-current="page" di 5 tab × 2 breakpoint. |
| V7 Web Audio cue (3ab5532d) | PASS | playCue hanya di 4 call site, semuanya {visual:true} bersama highlight/banner/shake frame sama; AudioContext lazy (tak ada autoplay sebelum gesture); mute persist "jev_sound_muted". |
| V8 PWA-lite (63a22a3b) | PASS | /manifest.webmanifest 200, /sw.js 200, /icons/app-icon.svg + maskable 200; sw.js: /api/ di-skip (return, tidak di-cache), network-first + shell fallback; offline banner di app/layout.tsx (#offline-banner-root, event "offline"). |

## API matrix (:3002, akun test qasprint7 lalu DIHAPUS)
- Anon: missed/tiers/stats 401, themes 401, friends 401, solution 401, hint 401.
- Authed (approved): missed 200, tiers 200, stats 200, themes 200, friends 200, solution 200 (solutionMoves UCI), hint 200 (stage 1).
- Authed (pending): 403 code=account_pending — semantics FIX-1 utuh (401 unauthenticated / 403 pending / 503 service, kode direview di lib/puzzle-api.ts).

## Regresi FIX-1
- GET /api/auth: 200 (user null saat anon, user objek saat authed) — refresh path utuh.
- 503 service_unavailable tak bisa dipicu langsung (butuh DB down); diverifikasi sebagai code-review: semua query dibungkus try→503.

## Keterbatasan verifikasi
- :43173 produksi masih kode lama; semua pengujian terhadap build produksi :3002.
- Interaksi drag nyata (pointer event) tidak disimulasikan; divalidasi via unit logic (chess.js asli di node) + review handler + DOM smoke headless chromium (dump-dom), bukan interaksi penuh.
- Akun test dihapus dari PG + mirror users.json/sessions.json di-restore; tidak ada file test yang di-commit.
