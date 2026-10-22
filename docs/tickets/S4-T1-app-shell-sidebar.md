# TICKET S4-T1 — App Shell: Sidebar Navigasi ala chess.com (P0)

**Sprint:** 4 · **Priority:** P0 · **Role:** Frontend · **Depends:** none (fondasi semua ticket S4 lain)

## Context
Keluhan utama user: app masih satu-halaman dengan tab switching horizontal (`navTab` di `components/game.tsx`, 9 tab: play/bots/puzzles/vision/scan/community/review/coach/admin) — TIDAK ada shell navigasi ala chess.com. Referensi: `rea/chess-web-ui-ux-analysis.md` §0 (Shell Global) + `rea/chess-web-menu-feature-map.md` §A (7 grup menu). Pattern yang ditiru adalah **struktur** (sidebar fixed + topbar search + badge realtime di nav), bukan visual identik — jev-chess tetap pakai tema charcoal + icons3d.

## Tugas
1. Komponen `components/shell/app-shell.tsx`: sidebar kiri fixed (collapsed ±72px di desktop, expandable on hover/click) dengan grup menu **hanya fitur yang SUDAH live** — jangan tampilkan menu mati:
   - **Bermain**: Main Online (play), Lawan Bot (bots), Pelatih (coach)
   - **Teka-Teki**: Teka-Teki (puzzle-hub), Harian (daily-puzzle), Gegas (rush), Tema (theme-mastery)
   - **Berlatih**: Analisis (review), Scan Papan (scan), Visi (vision/learning-hub)
   - **Komunitas**: Komunitas (community-view), Arsip (game archive dari S2-T2)
   - **Lainnya**: collapse/accordion (admin — hanya jika role admin; spectator)
2. Pindahkan state `navTab` dari `game.tsx` ke shell-level (URL hash atau state terangkat) — render view di `<main>`, sidebar tetap terlihat. Badge "Bermain N" (`components/playing-badge.tsx`, dari `use-realtime`) inline di item nav Bermain, realtime via pubsub `alert/alerts`.
3. Topbar: search bar (pemain/game, query → community/stats; implementasi minimal: debounce fetch ke endpoint stats/players yang sudah ada) + avatar/username kanan. Skip-link + `aria-label` semua item nav (a11y floor).
4. Responsive: ≤768px sidebar → **bottom nav** (5 item inti: Home, Bermain, Teka-Teki, Berlatih, Komunitas) + hamburger untuk Lainnya. Bottom-sheet pola Sprint 1 tetap berlaku.
5. Semua animasi via var `--move-animation-duration` yang sudah ada; ikon icons3d.

## Acceptance
- [ ] Sidebar terlihat di semua tab, `navTab` tidak lagi mengontrol bar horizontal lama (hapus/rapikan nav lama di game.tsx).
- [ ] Badge "Bermain N" update realtime di item nav (verifikasi dengan 2 browser + WS).
- [ ] Mobile ≤768px: bottom nav tampil, sidebar hilang, semua tab tetap dapat dijangkau.
- [ ] Keyboard nav: semua item sidebar fokus-able, skip-link berfungsi.
- [ ] Tidak ada menu item yang mengarah ke fitur belum ada (klik semua item = tidak ada dead end).

## Guardrail
- YAGNI: tidak buat router (Next app router page per fitur) — hash/state cukup; routing penuh ticket terpisah bila dibutuhkan.
- Jangan tiru warna/materi chess.com — pakai token `app/globals.css` existing (charcoal #312e2b, panel #262421, hijau #81b64c).
- Minimal diff pada `game.tsx`: pisah nav, jangan refactor logic game.
