# Spec S10: Chess.com Interface Parity & JEV-Chess Scientific Innovation

> Disusun oleh Sub-Agent PM & Designer  
> Tanggal: 2026-11-03  
> Target: fif-chess (jev-chess)  
> Referensi: 21 Tangkapan Screen Chess.com (repo: bagaswibowo/design-jev-chess)

## Problem Statement

Aplikasi catur jev-chess saat ini memiliki fungsionalitas engine yang luar biasa (Stockfish 19 NNUE + TypeSafe Jev System One + YOLO11 vision), namun tata letak antarmuka (UI/UX) masih memiliki beberapa inkonsistensi:
1. Shell navigasi dan tata letak beranda (Dashboard) belum sepenuhnya mengadopsi struktur 3-kolom taktil standar Chess.com yang terbukti memiliki retensi pengguna tertinggi.
2. Penanganan state autentikasi (401 guest vs 403 pending vs 503 error) tersebar di berbagai API route dan komponen visual tanpa standarisasi.
3. Fitur unggulan ilmiah (Scanner OTB kamera fisik, visualisasi neural connectome FlyBrain) belum terintegrasi secara mulus ke dalam siklus pertandingan sehari-hari.

## Solution

Mengadopsi hierarki visual, flow, dan token desain dari 21 layar Chess.com yang telah diekstrak, dipadukan secara harmonis dengan inovasi unik JEV-Chess:
1. **Home & Lobby Redesign**: Widget streak persisten, time control grid (Bullet/Blitz/Rapid), dan quick tactical puzzle preview.
2. **Deep Module `routeAuth`**: Menyatukan seluruh otentikasi API route ke satu seam teruji tanpa duplikasi 401/403/503.
3. **Seamless OTB Scanner to Analysis Pipeline**: Hasil deteksi kamera/foto papan fisik langsung memuat Stockfish analysis board dalam 1 klik.
4. **DHH Audio-Visual Parity**: Aksesibilitas visual menyeluruh untuk semua cue permainan tanpa ketergantungan audio semata.

## User Stories

1. As a competitive player, I want to see my daily puzzle streak and Elo rating prominently on the header, so that I stay motivated to maintain my daily practice.
2. As a mobile player, I want a time-control picker grid (1+0, 3+0, 5+0, 10+0) with tactile feedback, so that I can start a game in under two clicks.
3. As a physical tournament player, I want to take a photo of my real chessboard and have the app convert it to FEN in <500ms, so that I can immediately review my OTB games with Stockfish.
4. As an academic/student, I want to see the neural connectome activation (FlyBrain) during AI move computation, so that I can understand neurosymbolic chess reasoning.
5. As a DHH (Deaf/Hard-of-Hearing) user, I want clear visual flashes and visual countdown meters on time trouble, so that I never lose on time due to missing clock ticks.
6. As a guest user, I want to try tactics and play vs bots without a login wall, with a non-intrusive CTA only appearing upon completing a milestone.
7. As a student with a pending account approval, I want to see a clear pending badge with clock icon, rather than broken login buttons or generic error states.

## Implementation Decisions

1. **Token Visual Anti-Slop**:
   - Background Canvas: Charcoal `#312e2b`
   - Card/Panel Surface: `#262421` dengan border `#3d3a34`
   - Taktil Action Green: `#81b64c` dengan bevel shadow `0 4px 0 #45753c`
   - Board Wood Classic: `#f0d9b5` (light) dan `#b58863` (dark)
2. **Deep Module `routeAuth`**:
   - Diekspor dari `lib/route-auth.ts`.
   - Menggantikan 24+ inline check 401/403 di `app/api/`.
3. **State Components**:
   - Menggunakan `components/ui/loading-state.tsx`, `error-state.tsx`, dan `empty-state.tsx` secara seragam.
4. **OTB Scanner Bridge**:
   - `scan-view.tsx` menambahkan callback tombol `Analisis dengan Stockfish 19` yang mem-push FEN ke state board analysis (`game-review.tsx`).

## Testing Decisions

- Typecheck ketat via `npx tsc --noEmit`.
- Unit & integration testing via `npx vitest run`.
- Curl E2E untuk memvalidasi auth matrix:
  * Guest: 401 dengan JSON standard
  * Pending: 403 `account_pending`
  * Approved: 200 OK dengan user context
  * DB Down: 503 Service Unavailable

## Out of Scope

- Pembayaran / subscription berbayar (JEV-Chess sepenuhnya gratis untuk civitas akademika).
- Modul catur varian non-standar (Bughouse/Crazyhouse ditunda).
