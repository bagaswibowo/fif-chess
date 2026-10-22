# TICKET S4-T2 — Home Dashboard: Task Cards Harian + Bermain Online

**Sprint:** 4 · **Priority:** P1 · **Role:** Fullstack · **Depends:** S4-T1 (shell), S3-T2 (daily/streak), S2-T2 (archive)

## Context
Referensi: analysis §1 (Home `/home`). Struktur chess.com: greeting + username → 3 kartu task harian (puzzle/pelajaran/ulas partai) → section "Bermain Online" (game aktif user, klik row → 2 tujuan: main vs review). Semua data yang dibutuhkan sudah ada: streak harian (S3-T2), game aktif via realtime presence, arsip/review (S2-T1/S2-T2), stats (S2-T3).

## Tugas
1. `components/views/home-view.tsx` + shell item "Home" (default landing setelah login).
2. **Greeting**: "Selamat datang, <username>" + ringkas streak harian (data S3-T2).
3. **3 kartu task harian** (engagement loop):
   - Jawab Teka-Teki → puzzle-hub (CTA disable + label "Selesai ✓" bila solvedToday true)
   - Teka-Teki Harian → daily-puzzle-view
   - Ulas Partai → arsip partai terakhir yang belum di-review (query arsip S2-T2)
4. **Section "Bermain Online"**: daftar game aktif user (dari use-realtime/presence + endpoint game user existing). Tiap row: [waktu control] [lawan + rating] [status]; **dua aksi eksplisit** per row: "Main" (→ game) dan "Review" (→ game-review) — pemisahan play/analysis diekspos sejak home (signature UX #1/#2). Empty state: CTA "Main Online".
5. A11y: kartu = button dengan aria-label deskriptif; row game accessible.

## Acceptance
- [ ] Home jadi default tab; 3 task cards tampil dan masing-masing 1 klik langsung ke aktivitas.
- [ solvedToday benar mendebug kartu puzzle (verifikasi setelah solve).
- [ ] Game aktif tampil realtime; row punya aksi Main & Review terpisah, keduanya berfungsi.
- [ ] Empty state tiap section tidak menampilkan placeholder palsu (no-mock).

## Guardrail
- YAGNI: tidak ada feed komunitas di home (belum ada fiturnya); tidak ada upsell/premium.
- Data nyata saja — tidak ada angka dummy saat data kosong.
