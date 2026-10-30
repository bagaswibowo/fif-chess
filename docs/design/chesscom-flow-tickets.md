# Chess.com Flow Parity — Tiket Eksekusi (Designer docs-only)

Tanggal: 2026-10-30. Sumber acuan: `chesscom-flow-alignment.md` +
`chesscom-parity-audit.md` (gap G0–G7) + `ui-flow-spec.md`. Tiket bernomor T1…
untuk eksekusi Dev per tiket + QA per AC. **Tidak ada edit kode di dokumen ini.**

## Fakta terverifikasi terhadap repo (2026-10-30)
- `lib/use-session.ts:113` `authErrorText(status, data, ctx)` SUDAH benar:
  `401 → "Masuk untuk melihat{ctx}."`, `403+code=account_pending → "Akun menunggu
  persetujuan admin."` (ikon jam, bukan gembok), `503 → pesan generik + Coba lagi`.
- String LITERAL yang bocorkan G0 (harus jadi pemanggilan authErrorText):
  - `components/pvp-panel.tsx:220` "Masuk dulu untuk bermain PvP…"
  - `components/views/endgame-drills-view.tsx:465` "Masuk untuk melihat peringkat."
  - `components/views/courses-view.tsx:197` "Masuk untuk melihat progresmu"
  - `components/shell/app-shell.tsx:558` "Masuk untuk rating" (user-chip)
  - `components/game-over-modal.tsx` & `puzzle-stats-view.tsx`,
    `missed-puzzles-view.tsx` memuat string serupa (verifikasi per AC).
- `/api/home/dashboard` **sudah** return `{ username, rating, solvedToday,
  streakHarian, gamesAktif, tasksState }` (Sprint 4, tanpa tabel baru).
- `components/ui/` SUDAH punya `empty-state.tsx`, `error-state.tsx`,
  `loading-state.tsx` → tiket merujuk komponen ini, JANGAN bikin StateMessage
  ke-2 (gap G6: cukup konsistenkan pemakaian).
- Hook `useAuthedFetch(url)` BELUM ada → T6.

## Prioritas & sequencing
P0 (bug + retensi): T1, T2, T3 → P1 (core play): T4, T5 → P2 (community/stats/
a11y): T6–T8. T1 blocker: dieksekusi commit terpisah duluan sebelum T2/T3.

---

## T1 [P0 · blocker] — Hapus CTA-login palsu utk user pending (gap G0.1/G0.3)
Tujuan: user `pending` TIDAK melihat tombol "Masuk". Semantik: 401=guest (CTA),
403 account_pending (status, tanpa CTA), 503 (Coba lagi).
Ubah (Dev):
- `components/pvp-panel.tsx`, `views/endgame-drills-view.tsx`,
  `views/courses-view.tsx`, `game-over-modal.tsx`, `views/puzzle-stats-view.tsx`,
  `views/missed-puzzles-view.tsx`: ganti string literal dgn
  `authErrorText(status, await json)` + state `loading|guest|pending|error`.
- `shell/app-shell.tsx:558` user-chip: pending → tampilkan **AuthStatusBadge**
  (lihat T2), bukan teks "Masuk untuk rating".
- Standardisasi: tiap view pakai `loading-state` (skeleton/role=status),
  `error-state` (503+retry), `empty-state` (riil).
AC (QA):
1. akun test `pending` → endgame/courses/pvp menampilkan "Akun menunggu
   persetujuan admin" + ikon jam, TANPA tombol Masuk.
2. akun test `approved` → konten normal.
3. tanpa session → 401 → "Masuk…" + tombol Masuk (benar).
4. matikan PG (503) → "Server sibuk, coba lagi" + tombol retry (`aria-busy`).
5. `grep -rn "Masuk untuk melihat\|Masuk dulu" components/` → 0 sisa literal
   di view (app-shell user-chip excepted, sudah di-T2).

## T2 [P0] — Streak + rating di user-chip shell (retensi pola chess.com)
Tujuan: elemen retensi paling kuat chess.com = streak+rating di header. Data
sudah ada di `/api/home/dashboard` (`streakHarian`, `rating`).
Ubah: `shell/app-shell.tsx` user-chip (desktop+mobile): fetch dashboard
(hydration-gated, 1x mount) → tampilkan `🔥 {streakHarian} hari` + rating.
Pending → AuthStatusBadge (amber pill, sudah ada UserStatusPill pattern).
AC:
1. approved user: chip menampilkan streak hari ini + rating (angka teks, bukan
   hanya ikon).
2. pending: chip = AuthStatusBadge "Menunggu" (amber, teks+ikon).
3. guest: chip "?" + "Masuk untuk rating" (guest boleh, ini benar 401).
4. reduced-motion: tanpa animasi pop; focus ring visible.

## T3 [P0] — Gate nav guest dilewati untuk fitur lokal (gap G1.1/G1.2)
Tujuan: chess.com = fitur lokal terbuka utk guest; CTA hanya di momen relevan.
Fitur lokal tanpa login: `versus-bots`, `scan`, `learning-hub`,
`coach-mode`, `spectator`, paste-PGN `game-review`, `puzzle` umum.
Ubah: `game.tsx handleNavClick` — hapus blokir guest 2,8s utk daftar di atas;
notice guest = inline `role=alert` PERSISTEN sampai didismiss (bukan auto-hide).
AC:
1. guest buka Bots/Scan/Learn/Coach/Spectator → konten tampil (tidak di-blokir).
2. notice guest persisten (bukan 2,8s), `role=alert`, fokus ke dismiss.
3. guest tetap tidak bisa buka rated/archive/leaderboard (stays gated + CTA).

## T4 [P1] — TimeControlPicker + Game-over modal (gap G2)
Tujuan: quick-pairing ala chess.com (time preset + rated + warna) + alur
rematch/draw/abort.
Ubah:
- BARU `components/ui/time-control-picker.tsx`: preset chip
  1+0/3+0/3+2/5+0/10+0/15+10 + Kustom (2 spinner); `role=radiogroup` +
  arrow-key; toggle Rated (switch label+ikon); warna radiogroup Putih/Hitam/Acak
  (swatch visual); default terakhir per-user (localStorage, hydration-gated).
- `pvp-panel.tsx`: ganti `timeControl:"5+0"` hardcoded dgn picker.
- `game-over-modal.tsx`: urutan Rematch(primary)/Analisis/Tawari Remis (hanya
  saat hidup)/Menyerah(destructive 2-tahap: klik1 arm→klik2 dalam 3s).
AC:
1. chips navigable panah + Enter; default persisten antar sesi.
2. warna tampil via swatch, bukan teks saja.
3. menyerah butuh 2 klik (anti misclick), label berubah "Yakin menyerah?".
4. rematch kirim challenge dgn kontrol waktu sama; tombol state "Menunggu…".

## T5 [P1] — Challenge card + daftar tantangan home (gap G2.3)
Ubah: `views/home-view.tsx` section "Tantangan" atas dashboard: kartu
username/kontrol/rated/warna + countdown ring (visual + sr-only "kedaluwarsa
dalam N dtk"); Terima/Tolak ≥44px. `challenge-card.tsx` sudah ada (realtime.css)
— integrasikan ke home. Empty: "Belum ada tantangan. Undang teman / main vs
bot" + 2 CTA. Guest: lihat, Terima → panel masuk (bukan blokir lihat).
AC:
1. countdown ring terlihat + sr-only paritas; expire → kartu hilang auto.
2. Terima ≥44px keyboard-reachable; Tolak optimistic.
3. empty state + 2 CTA; guest lihat tanpa blokir.

## T6 [P1] — Hook useAuthedFetch (kontrak ui-flow-spec §2)
BARU `lib/use-authed-fetch.ts`: return `{data, state:'loading'|'ready'|'guest'|
'pending'|'error', retry}`. Semua view T1 memakai ini (hapus 4 mapping manual).
AC:
1. guest→401, pending→403 code, error→503, siap→data; retry dgn backoff
   (disable+aria-busy saat berjalan).
2. T1 memakai hook ini (tidak ada fetch manual di view tsb).

## T7 [P2] — Puzzles: filter tema+rating + stats panel + rush pause (gap G3)
Ubah: `views/puzzle-view.tsx` bar filter (tema dari `/api/puzzles/themes` +
preset rating <1200/1200–1800/1800+ + Terapkan/Reset); panel stats (rating/
streak/solved/failed — data dari `/api/home/dashboard`). `views/rush-view.tsx`:
pause saat `visibilitychange` blur; end-screen breakdown benar/salah/rating
tertinggi + posisi leaderboard. Hint 3-stage cue visual beda (sorot bidak→
sorot kotak→panah) di `puzzle-solver.tsx`.
AC:
1. filter tema+rating memaksa `/api/puzzles/next?theme=&minRating=&maxRating=`.
2. stats panel semua angka = teks berlabel.
3. tab blur → rush pause (timer berhenti); end-screen breakdown lengkap.
4. hint stage 1/2/3 cue visual berbeda (bukan teks saja).

## T8 [P2] — Leaderboard kategori waktu + win-rate + sebar a11y (gap G5/G7)
Ubah: `views/leaderboard-view.tsx` chips kategori (Semua/Bullet/Blitz/Rapid →
param `game_type=`; server-side dari games) + kolom win-rate + filter rating +
empty "main rated utk masuk papan" + baris sendiri sticky. Backend: tambah
`game_type` param + kolom win-rate (top-50) di `/api/leaderboard`.
A11y lintas (G7): sebar `useReducedMotion()` ke confetti/animate-in/flybrain/
clock-moves/promotion; focus-trap "Lainnya" sheet; heading `<h2 class=sr-only>`
per grup sidebar; prefer-reduced-motion global.
AC:
1. chips kategori mengubah list (bukan halaman baru).
2. kolom win-rate + baris sendiri sticky + sr-only "Peringkatmu: N".
3. semua animasi hormati reduced-motion; sheet "Lainnya" focus-trap + Esc.

---
## Catatan eksekusi
- Peran: hanya **Dev** edit kode; **QA** murni lapor + restore data test;
  **Designer** docs-only. Sequencing: T1 (commit terpisah) → T2/T3 (P0) →
  T4/T5/T6 (P1) → T7/T8 (P2).
- Deploy: follow skill remote-deploy (push main → CI build+push GHCR → pull di
  sxz + BUILD_ID gate + `docker compose up -d`), verifikasi live via
  `ssh sxz-server 'curl ...'` (jangan tunnel dari sub-agent).
- Data test QA di `users.json`/`sessions.json`/PG WAJIB di-restore setelah
  verifikasi; jangan commit.
