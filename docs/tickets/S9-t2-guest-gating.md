# S9-T2 — Guest gating: fitur lokal terbuka tanpa login + notice persisten + CTA di momen relevan

**Role**: PM · **Sprint**: S9 · **Sumber**: `docs/design/s9-s10-scope.md` S9-T2 +
`docs/design/chesscom-parity-audit.md` G1.1–G1.2.

## 1. Context (status riil, diverifikasi 991eb25)

**Nav rejection aktif** — `components/game.tsx:447-456` `handleNavClick`:
guest (`currentUser === null`) hanya boleh `home` / `play`; tab lain →
`setAuthNotice("Masuk terlebih dahulu untuk membuka fitur ini.")` +
`window.setTimeout(() => setAuthNotice(null), 2800)` (:450-451).
Render notice :2208-2215: `role="status"` inline floating, **tanpa tombol
dismiss**, hilang sendiri setelah 2,8s (G1.2 — buruk utk screen reader).
Catatan: guest yang lolos ke `home` justru render blank — `game.tsx:1270`
`{currentUser && navTab === "home" && <HomeView …/>}` (G0: "dashboard
gagal / kosong utk guest", matriks audit #1 🟡).

**View yang SUDAH terbuka tanpa guard di game.tsx** (blok tanpa
`currentUser &&`, jadi hanya terbendung handleNavClick):
- `bots` :1543 (`VersusBotsView` — grid + filter lokal, audit #3 ✅),
- `coach` :1368 (subtab coach + `spectator` → `SpectatorView` via
  `components/views/spectator-view.tsx`; engine lokal `/api/engine-move`, audit #14 🟡),
- `vision` :1450 (`LearningHub` — materi statis, audit #16 ✅),
- `review` :1452 (PasteBar + `GameReview` paste PGN, audit #9 🟡),
- `scan` :1519 (`ScanView` — kamera lokal + `/api/scan-board`, audit #15 ✅).

**View yang tetap member-only** (S8 render di balik `currentUser &&`,
TIDAK dibuka di S9 sesuai scope): `leaderboard` :1278, `friends` :1283,
`archive` :1407, `home` :1270.

**CTA di momen relevan — belum ada**: `components/game-over-modal.tsx`
(selesai game/bot) dan end-screen `components/views/rush-view.tsx`
(:447-449 "Kamu keluar") tidak menawarkan "Daftar untuk simpan progres"
ke guest; guest yang main vs bot selesai game dapat modal hasil tanpa
momen konversi. `components/views/puzzle-stats-view.tsx:71` sudah
bertuliskan CTA "Masuk untuk melihat akurasi…" sebagai **blokir masuk**
(pola lama yang scope S9-T2 ubah — CTA hanya di momen selesai).

**Spectator**: `components/views/spectator-view.tsx` +
`app/api/broadcast/route.ts` publik ✅ (audit #14). `ScanView` prop
`onLoadFen` (game.tsx:1519) setelah scan sukses → `setNavTab("play")`
→ guest bisa lanjut main bot tanpa login ✅ (jangan ubah).

## 2. Task (sub-task per file)

1. **`components/game.tsx`** — `handleNavClick` (:447-456): hapus
   rejection guest. Daftar tab guest-allowed = `home, play, bots, coach,
   review, scan, vision` (konstanta array di file, satu tempat). Tab
   member-only yang di-klik guest (`leaderboard, friends, archive,
   puzzles, drills, community, explorer, insights, tournaments, courses,
   learn, practice, classroom`) → TIDAK redirect+reject, render view
   normal TETAPI notice guest persisten tetap muncul (lihat #2).
2. **Notice guest persisten** — `game.tsx` state `authNotice`
   (:420/:450/:2208-2215): `role="alert"` inline (bukan floating fixed),
   teks + **tombol dismiss** (Esc juga menutup, pola focus trap
   more-sheet `app-shell.tsx:251-268`), persisten sampai didismiss
   (bukan 2,8s). Tampilkan saat guest di view member-only atau guest di
   mana pun ada aksi butuh akun.
3. **CTA "Daftar untuk simpan progres" di momen relevan**:
   - `components/game-over-modal.tsx`: guest (`user` null) selesai main
     bot → baris CTA → buka modal auth (prop existing
     `onOpenAuth`-style dari parent game.tsx, wiring prop additive).
   - `components/views/rush-view.tsx` end-screen (:447+): guest selesai
     rush → CTA daftar (rush S10 boleh simpan hasil; untuk S9 hanya
     copy CTA, tanpa persistensi data).
   - Ganti pola blokir di `components/views/puzzle-stats-view.tsx:71`
     dari "Masuk untuk melihat…" menjadi state guest netral
     ("Daftar untuk melihat statistikmu") — CTA, bukan dinding.
4. **Guest di `home`** — `game.tsx:1270`: guest tetap `home` → render
   HomeView **juga untuk guest** dengan state "Belum masuk — daftar
   untuk dashboard personal" (bukan blank). (Matriks audit #1:
   "guest perlu landing jelas".)
   - Alternatif minimal: notice persisten + CTA login di main area;
     implementer pilih, TL gate. Kriteria: tidak ada blank.

## 3. Acceptance criteria (observabel)

- Guest (belum login) klik "Lawan Bot" / "Pelatih" / "Tonton" (spectator)
  / "Scan Papan" / "Ulas Partai" (review) / "Belajar" (vision) di
  sidebar → view render, **tanpa** notice "Masuk terlebih dahulu…".
- Guest klik "Teman" / "Arsip" / "Papan Peringkat" → view render +
  notice `role="alert"` persisten di atas konten; notice **hilang hanya
  lewat tombol dismiss / Esc** (QA: setelah 5s notice masih ada).
- Guest selesai main vs bot → modal hasil memuat CTA "Daftar untuk
  simpan progres" yang membuka modal auth; setelah daftar, CTA tidak
  muncul lagi (user approved).
- Guest selesai rush → end-screen memuat CTA daftar.
- Deep-link `#/bots` tanpa login → langsung render (audit #3 ✅), tanpa
  redirect.

## 4. Guardrail (JANGAN)

- Jangan buka view yang butuh API authed tanpa guard: `leaderboard`,
  `friends`, `archive`, `home` (dashboard), `puzzles/daily/rush
  attempt`, `drills`, `courses/learn/practice` tetap ditolak di level
  API (401/403) — pembukaan nav hanya utk view lokal di daftar #1.
  notice + state guest di view tsb = hasil kerja S9-T1/T3, bukan T2.
- Jangan ubah logika `navTabFromHash` (:203-256) dan deep-link resolve
  S7 (kursus/lesson/classroom) — hanya `handleNavClick` + render
  notice + CTA.
- Jangan ubah gating admin (`:463-466` redirect non-admin dari #/admin).
- Tanpa fitur baru: tanpa persistensi progres guest, tanpa endpoint baru
  (no-mock; CTA daftar = navigasi ke modal auth existing
  `game.tsx:1257` `onOpenAuth`).
