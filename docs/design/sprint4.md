# Desain Sprint 4 — App Shell, Home Dashboard, Sosial, & Endgame Drills

**Tiket:** S4-T1 · S4-T2 · S4-T3 · S4-T4 · **Sprint:** 4 · **Peran:** Design
**Status:** Draft untuk review · **Tidak berisi kode** — spesifikasi visual & interaksi saja.

Semua token mengacu ke `app/globals.css`: charcoal `#312e2b`, panel `#262421`, aksi hijau `#81b64c` (box-shadow `0 4px 0 #45753c`), wood light `#f0d9b5` / wood dark `#b58863`. **Tidak ada palet baru.** Ikon memakai set **icons3d** (vektor 3D, tanpa emoji). Semua animasi via var `--move-animation-duration: 180ms`. Mobile memakai bottom-sheet (pola Sprint 1) dan bottom nav baru (§1.4).

**Prinsip utama:** kita meniru **struktur** chess.com (sidebar fixed + topbar + badge realtime, task cards, dual-aksi, leaderboard/friends), **bukan visual mentahnya** — jev-chess tetap charcoal/panel/hijau dengan icons3d. Upsell/topbar-CTA chess.com **tidak** dipindah (tidak ada paywall di jev-chess). Hanya grup menu yang fiturnya live yang ditampilkan: **Bermain, Teka-Teki, Berlatih, Komunitas** (+ Lainnya sebagai collapse).

Referensi terverifikasi: `~/projects/active/chess-web/rea/chess-web-ui-ux-analysis.md` §0/§1/§13, `rea/chess-web-menu-feature-map.md` §A/§D.

---

## 1. S4-T1 — App Shell (`components/shell/app-shell.tsx`)

### 1.1 Wireframe desktop

```
┌──────────────────────────────────────────────────────────────────────┐
│ ┌─ SIDEBAR (fixed, 240px; collapsed 72px, expand on hover/klik) ──┐ │ ┌─ TOPBAR (56px, panel bg) ──────────────────────────┐
│ │ [logo jev-chess]                                                │ │ │ [🔍 Cari pemain / partai……………  ]      [avatar @user] │
│ │                                                                 │ │ └────────────────────────────────────────────────────┘
│ │ BERMAIN                                                         │ │ ┌─ MAIN CONTENT ─────────────────────────────────────┐
│ │  [icon3d board]  Main Online        ← /play                     │ │ │                                                    │
│ │  [icon3d bot]    Lawan Bot          ← /bots                     │ │ │   <main id="main-content" tabindex="-1">           │
│ │  [icon3d coach]  Pelatih            ← /coach                    │ │ │   view aktif dirender di sini;                     │
│ │                                                                 │ │ │   sidebar & topbar tetap terlihat                  │
│ │ TEKA-TEKI                                                       │ │ │                                                    │
│ │  [icon3d puzzle] Teka-Teki          ← /puzzles                  │ │ │                                                    │
│ │  [icon3d kalender] Harian           ← /daily                    │ │ │                                                    │
│ │  [icon3d petir]  Gegas              ← /rush                     │ │ │                                                    │
│ │  [icon3d tema]   Tema               ← /themes                   │ │ │                                                    │
│ │                                                                 │ │ │                                                    │
│ │ BERLATIH                                                        │ │ │                                                    │
│ │  [icon3d magnifier] Analisis        ← /review                   │ │ │                                                    │
│ │  [icon3d scan]   Scan Papan         ← /scan                     │ │ │                                                    │
│ │  [icon3d eye]    Visi               ← /vision                   │ │ │                                                    │
│ │  [icon3d crown]  Permainan Akhir    ← /drills  (S4-T4)          │ │ │                                                    │
│ │                                                                 │ │ │                                                    │
│ │ KOMUNITAS                                                       │ │ │                                                    │
│ │  [icon3d people] Komunitas          ← /community                │ │ │                                                    │
│ │  [icon3d trophy] Papan Peringkat    ← /leaderboard (S4-T3)      │ │ │                                                    │
│ │  [icon3d friend] Teman              ← /friends     (S4-T3)      │ │ │                                                    │
│ │  [icon3d archive]Arsip              ← /archive     (S2-T2)      │ │ │                                                    │
│ │                                                                 │ │ │                                                    │
│ │ LAINNYA  [chevron ▾]  ← accordion collapse                      │ │ │                                                    │
│ │   (terbuka hanya berisi: Spectator, Admin — Admin tampil        │ │ │                                                    │
│ │    hanya bila role admin)                                       │ │ │                                                    │
│ └─────────────────────────────────────────────────────────────────┘ │ └────────────────────────────────────────────────────┘
```

- **Badge inline "Bermain N"**: komponen `playing-badge.tsx` (data `use-realtime`, pubsub `alert/alerts`) dirender inline di samping label "Main Online" — pill kecil bg hijau `#81b64c`, teks charcoal, angka N = game aktif user. Badge disembunyikan (`aria-hidden`) saat N = 0. Angka update realtime tanpa reload (signature UX #8).
- **Lainnya** = satu baris accordion (bukan grup permanen) — klik toggle expand 180ms, `aria-expanded` di tombol, konten `aria-hidden` saat collapsed. Default collapsed.
- Tidak ada item menu yang mengarah ke fitur belum ada (no dead end). Bila item belum live, item tidak dirender — bukan dirender disabled.
- **Collapsed state (72px)**: hanya icons3d + badge angka (badge = angka saja di atas icon); tooltip native via `title` + `aria-label` penuh di elemen; expand on hover (desktop pointer) dan on click (toggle pinned).

### 1.2 Topbar

```
┌──────────────────────────────────────────────────────────────────────┐
│ [🔍 Cari pemain atau partai…          ]              [avatar] @user  │
└──────────────────────────────────────────────────────────────────────┘
```

- Search bar: lebar maks 420px, bg charcoal `#312e2b`, border token existing, placeholder "Cari pemain atau partai…". Debounce 300ms → endpoint stats/players existing; hasil = dropdown panel (panel bg) di bawah bar: maks 5 hasil, tiap row [avatar mini] [username] [rating]; klik row → profil/stats (deep-link, signature UX #6). Keyboard: ↑/↓ navigasi hasil, Enter pilih, Esc tutup; `role="combobox"` + `aria-expanded` + listbox results.
- Kanan: avatar + username → dropdown kecil (Profil & Stats, Keluar). Tidak ada upsell/premium — bagian ini sengaja tidak meniru chess.com.
- Topbar sticky (fixed top), sidebar fixed kiri; keduanya di atas main content (z-index token existing).

### 1.3 State menu (matriks ringkas — detail di §6)

| State | Visual |
|---|---|
| Default | teks teks-muted existing, icon3d warna netral |
| Hover (desktop) | bg panel `#262421` di row, teks naik ke teks-primary |
| Fokus (keyboard) | `focus-visible` ring hijau `#81b64c` 2px, sama dengan hover visual + ring |
| Aktif (view saat ini) | bg hijau transparan (token success subtle existing), strip 3px hijau di sisi kiri row, teks hijau |
| Aktif + badge | badge tetap tampil |
| Pressed | scale 0.98, 180ms |

Transisi semua state via `--move-animation-duration`.

### 1.4 Mobile (≤768px)

```
┌──────────────────────────┐
│  [topbar ringkas: logo]  │   ← sidebar hilang; search jadi ikon 🔍 → full-screen overlay search
│                          │
│      main content        │
│  (board/panel penuh)     │
│                          │
├──────────────────────────┤
│ 🏠    ♟️    🧩    📚    👥 │   ← bottom nav (5 item): Home, Bermain, Teka-Teki, Berlatih, Komunitas
│ Bermain(badge N)         │      fixed bottom, bg panel, safe-area-inset-bottom
└──────────────────────────┘
```

- Bottom nav 5 item utama (ikon3d + label mikro 10px); item "Bermain" menampilkan badge N realtime di pojok icon.
- **More-sheet**: akses item lain (Harian, Gegas, Tema, Analisis, Scan, Visi, Permainan Akhir, Papan Peringkat, Teman, Arsip, Spectator, Admin) via tombol **Lainnya** (icon3d titik-tiga) di ujung kanan nav → **bottom-sheet** pola Sprint 1 (tinggi maks 60% viewport, drag-handle, tutup dengan swipe-down atau Esc/klik backdrop, focus ter-trap di sheet, fokus kembali ke trigger saat tutup).
- Nav menghormati `env(safe-area-inset-bottom)` (perangkat ber-notch).
- Sidebar desktop tidak pernah dirender di mobile (display:none); bottom nav tidak pernah di desktop.

### 1.5 State `navTab`

- State `navTab` diangkat dari `game.tsx` ke shell level (hash URL, mis. `#/play`), sehingga deep-link & back-button bekerja. Render view di `<main>`; logic game di dalam view tidak diubah (minimal diff).

---

## 2. S4-T2 — Home Dashboard (`components/views/home-view.tsx`)

### 2.1 Layout

```
DESKTOP
┌──────────────────────────────────────────────────────────────┐
│  Selamat datang, <username> 👋        [icon3d api] Streak 5 hari │  ← greeting + streak ringkas (data S3-T2)
├──────────────────────────────────────────────────────────────┤
│  ┌─ Task Card 1 ─────┐ ┌─ Task Card 2 ─────┐ ┌─ Task Card 3 ─┐ │
│  │ [icon3d puzzle]   │ │ [icon3d kalender] │ │ [icon3d film] │ │
│  │ Jawab Teka-Teki   │ │ Teka-Teki Harian  │ │ Ulas Partai   │ │
│  │ [Mulai]  (hijau)  │ │ [Mainkan] (hijau) │ │ [Ulas] (hijau)│ │
│  └───────────────────┘ └───────────────────┘ └───────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Bermain Online                                    (live N)   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [⏱ 10|0] vs @budi (1420) · giliranmu      [Main] [Review] │ │
│  │ [⏱ 5|3]  vs @sari (1380) · menunggu      [Main] [Review] │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

MOBILE: kartu task = horizontal scroll-snap 1 baris; section Bermain Online
rows full-width, tombol aksi tetap terlihat (bukan di dalam sheet).
```

### 2.2 Task cards harian (engagement loop, signature UX #1)

| Kartu | Target | State todo | State done |
|---|---|---|---|
| Jawab Teka-Teki | `/puzzles` | CTA hijau "Mulai" | CTA disabled + label "Selesai" + icon3d centang hijau; kartu opacity sedikit turun, border hijau tipis |
| Teka-Teki Harian | `/daily` | CTA hijau "Mainkan" | sama |
| Ulas Partai | arsip partai terakhir yang belum di-review (query S2-T2) | CTA hijau "Ulas" | hilang dari daftar / tandai selesai bila review dibuat |

- Setiap kartu = satu `<button>` penuh (1 klik langsung ke aktivitas) dengan `aria-label` deskriptif, mis. "Jawab teka-teki hari ini".
- Sub-label dinamis: kartu puzzle menampilkan rating band target; kartu ulas menampilkan lawan + tanggal partai terakhir. **Bila data kosong: label jujur ("Belum ada partai untuk diulas"), CTA tetap mengarah ke arsip — bukan angka dummy.**
- Streak di header: icon3d api + "Streak 5 hari"; angka dari S3-T2, animasi scale singkat saat bertambah.

### 2.3 Bermain Online (dual-aksi, signature UX #1/#2)

- Row game aktif (dari presence/use-realtime + endpoint game user): `[waktu control chip] [lawan + rating] [status giliran]` + **dua tombol eksplisit**: **[Main]** (hijau → view game) dan **[Review]** (outline/ghost → game-review). Klik area row lain → Main.
- Row giliran lawan: status "Menunggu lawan…", tombol [Main] tetap (menonton posisi sendiri), [Review] tetap tersedia.
- Realtime: row muncul/hilang tanpa reload; new-row animasi fade-slide 180ms.
- **Empty state**: kartu panel dengan ilustrasi icon3d papan kosong + teks "Tidak ada permainan aktif" + CTA hijau **[Main Online]** → `/play`. Tidak ada placeholder palsu (no-mock).

---

## 3. S4-T3a — Leaderboard (`components/views/leaderboard-view.tsx`)

### 3.1 Layout

```
┌────────────────────────────────────────────────────────────┐
│  Papan Peringkat                                           │
│  [ Tab: Global | Teman ]        ← segmented control        │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ #   Pemain              Rating   Main                  │ │
│ │ 1   @juara            1875      214        ← row standar│
│ │ 2   @kedua            1821      198                         │
│ │ …   (top 50)                                            │ │
│ │ ┌────────────────────────────────────────────────────┐ │ │
│ │ │ 47  @sayamu          1245      89     ← STICKY bottom │ │ │
│ │ └────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

- Tab **Global** = top 50 dari API leaderboard (SQL-side ORDER BY + LIMIT, data stats S2-T3). Tab **Teman** = peringkat hanya antara friends (list friends, diurut rating).
- Row user sendiri: **sticky di bawah tabel** (bila tidak masuk top 50) + highlight bg hijau subtle; jika masuk top 50, row di posisinya tetap di-highlight.
- Kolom: peringkat, username (link → profil/stats publik, signature UX #6), rating, jumlah game. Header kolom `scope="col"`; tabel semantik `<table>`.
- Angka peringkat 1–3 diberi icon3d medali (emas/perak/perunggu) di samping angka.
- Pagination: hanya "50 teratas" — tidak ada paging (YAGNI); tab Teman menampilkan semua teman.
- **Empty state**: "Papan peringkat masih kosong — mainkan partai pertamamu!" + CTA Main Online. No-mock.

---

## 4. S4-T3b — Friends (`components/views/friends-view.tsx`, masuk grup Komunitas)

### 4.1 Layout

```
┌────────────────────────────────────────────────────────────┐
│  Teman                            [+ Tambah Teman] (hijau)  │
│ ── Permintaan Masuk (2) ──────────────────────────────────  │
│ │ @anon_bravo  [Terima] (hijau) [Tolak] (ghost) │  ← dual-button
│ ── Daftar Teman ──────────────────────────────────────────  │
│ │ ● @budi (1420)                    [Tantangan] [⋯] │        │
│ │ ○ @sari (1380)  · offline         [Tantangan] [⋯] │        │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

- **Presence dot**: ● online (hijau, dari jev:online presence S1-T3), ○ offline (teks-muted). Dot punya teks sr-only "online"/"offline" — tidak bergantung warna saja.
- **Permintaan masuk**: row terpisah di atas, badge jumlah di heading; tiap row **dual-button Terima/Tolak** inline (signature UX #2) — Terima hijau, Tolak ghost. Aksi langsung (tanpa halaman perantara), row hilang dengan animasi 180ms + toast konfirmasi.
- **Tantangan inline**: tombol per teman memicu challenge flow S1-T4 (kirim challenge realtime); setelah terkirim → tombol berubah "Terkirim ✓" disabled + toast.
- **Tambah Teman**: modal kecil input username (validasi exist) + submit; sukses → toast; username tak ada → inline error di modal.
- **[⋯] opsi**: menu kecil — Lihat Profil, Hapus Teman (dengan konfirmasi modal, bukan `confirm()`).
- Empty state: "Belum punya teman — tambahkan dengan username." No-mock.

---

## 5. S4-T4 — Endgame Drills (`components/views/endgame-drills-view.tsx`)

### 5.1 Layout

```
┌────────────────────────────────────────────────────────────┐
│  Permainan Akhir            "Kurasi teka-teki akhir per tema" │
│ ┌─ Set Card ──────┐ ┌─ Set Card ──────┐ ┌─ Set Card ─────┐  │
│ │ [icon3d crown]  │ │ [icon3d rook]   │ │ [icon3d queen] │  │
│ │ Skakmat Dasar   │ │ Benteng vs Bidak│ │ Menteri Mati   │  │
│ │ ▓▓▓▓▓▓░░░░ 62%  │ │ ▓▓░░░░░░░░ 20%  │ │ ░░░░░░░░░░  0% │  │
│ │ [Lanjutkan]     │ │ [Mulai]         │ │ [Mulai]        │  │
│ └─────────────────┘ └─────────────────┘ └────────────────┘  │
│   … 5–6 set total (mapping statis di lib/endgame-drills.ts)  │
└────────────────────────────────────────────────────────────┘
```

- **Set**: hasil kurasi puzzle bertema `endgame` (kolom `themes` existing) — 5–6 set, mis. "Skakmat Dasar", "Benteng vs Bidak", "Menteri + Raja Mati", "Ketimpangan Material", "Pion Akhir". Mapping set→puzzle ids **statis** (konstanta lib), bukan tabel baru.
- **Progress %** per set = solved-unique / total puzzle set (dari `puzzle_attempts`, pola S3-T4). Progress bar pakai token hijau + **teks % eksplisit** untuk screen reader (`aria-label="Progress 62 persen"`), bukan hanya visual bar.
- Klik set → **solve mode puzzle core (S3-T1)** dengan pool puzzle dari set itu saja; hint, streak, dan feedback benar/salah semua reuse — tanpa duplikasi komponen. Tombol kartu: "Mulai" (0%), "Lanjutkan" (>0%, <100%), "Ulangi" (100%, ghost).
- Set selesai 100%: icon3d piala kecil di pojok kartu + border hijau tipis.
- Mobile: kartu grid 1 kolom; progress bar full-width.

---

## 6. Matriks State Visual (token existing)

| State | Background | Border/Ring | Teks/Icon | Motion |
|---|---|---|---|---|
| Menu sidebar default | transparan (atas charcoal) | — | teks-muted | — |
| Menu hover | panel `#262421` | — | teks-primary | 180ms |
| Menu fokus (focus-visible) | panel | ring 2px hijau `#81b64c` | teks-primary | 180ms |
| Menu aktif | hijau subtle (token success-alpha existing) | strip kiri 3px hijau | hijau | 180ms |
| Badge Bermain N | hijau `#81b64c` | — | charcoal, bold | update realtime |
| CTA primer (Main/Mulai/Terima) | hijau `#81b64c` | shadow `0 4px 0 #45753c` | charcoal/putih token existing | press scale 0.98 |
| CTA sekunder (Review/Tolak/Petunjuk) | transparan | border teks-muted | teks-primary | 180ms |
| Disabled (task done) | panel | — | teks-muted + icon3d centang | — |
| Presence online | dot hijau | — | sr-only "online" | pulse halus 180ms |
| Presence offline | dot teks-muted | — | sr-only "offline" | — |
| Row user sendiri (leaderboard) | hijau subtle | border hijau tipis | teks-primary | sticky, tanpa animasi |
| Board shake (salah, reuse S3) | — | — | — | translate-x ±4px, 180ms, 1 siklus |
| Bottom-sheet (mobile) | panel | radius atas token existing | — | slide-up 180ms |

Tidak ada token baru; semua warna mengacu `app/globals.css`. Icon selalu icons3d — emoji tidak pernah dipakai di UI (wireframe di atas hanya sketsa ASCII; representasi ikon sebenarnya icon3d).

---

## 7. Copy Indonesia (per komponen)

| Komponen | Copy |
|---|---|
| Search placeholder | `Cari pemain atau partai…` |
| Search empty result | `Tidak ada hasil untuk "…"` |
| Sidebar grup | `Bermain`, `Teka-Teki`, `Berlatih`, `Komunitas`, `Lainnya` |
| Sidebar item aktif (sr-only) | `(halaman saat ini)` |
| Greeting | `Selamat datang, {username}` |
| Streak | `Streak {n} hari` |
| Task card 1 | `Jawab Teka-Teki` / CTA `Mulai` / done `Selesai` |
| Task card 2 | `Teka-Teki Harian` / CTA `Mainkan` |
| Task card 3 | `Ulas Partai` / CTA `Ulas` / empty `Belum ada partai untuk diulas` |
| Section game | `Bermain Online` |
| Row status | `Giliranmu`, `Menunggu lawan…` |
| Row aksi | `Main`, `Review` |
| Empty Bermain Online | `Tidak ada permainan aktif` + CTA `Main Online` |
| Leaderboard title | `Papan Peringkat`; tabs `Global`, `Teman`; kolom `#`, `Pemain`, `Rating`, `Main` |
| Leaderboard empty | `Papan peringkat masih kosong — mainkan partai pertamamu!` |
| Friends title | `Teman`; `Tambah Teman`, `Permintaan Masuk ({n})`, `Terima`, `Tolak`, `Tantangan`, `Terkirim`, `Hapus Teman` |
| Presence | `online`, `offline` (sr-only) |
| Drills title | `Permainan Akhir`; subtitle `Kurasi teka-teki akhir per tema`; CTA `Mulai` / `Lanjutkan` / `Ulangi`; progress sr `Progress {n} persen` |
| Drills empty | `Belum ada set permainan akhir yang tersedia` |
| Toast umum | `Tersalin`, `Teman ditambahkan`, `Tantangan terkirim`, `Perubahan disimpan` |
| Modal konfirmasi hapus | `Hapus {username} dari daftar teman?` / `Batal` / `Hapus` |
| More-sheet title | `Menu Lainnya` |

---

## 8. A11y Checklist (a11y floor)

- [ ] **Landmark**: sidebar `<nav aria-label="Navigasi utama">`; topbar `<header>`; konten `<main id="main-content" tabindex="-1">`; bottom nav `<nav aria-label="Navigasi bawah">`. Hanya satu `<main>`.
- [ ] **Skip-link** diperbarui: target tetap `#main-content` (kini di dalam shell, bukan body) — link pertama yang fokus-able, terlihat saat fokus.
- [ ] **Semua item nav** (sidebar, bottom nav, more-sheet) = elemen interaktif semantik (link/button) dengan `aria-label` atau teks label penuh; icon-only state (collapsed) wajib `aria-label`.
- [ ] **aria-current="page"** pada item menu aktif; badge N punya sr-only "N permainan aktif".
- [ ] **Bottom-nav safe-area**: `padding-bottom: env(safe-area-inset-bottom)`; nav tidak pernah menutupi konten fokus — main content diberi padding-bottom setinggi nav.
- [ ] **Focus management saat view switch**: render view baru → `main.focus()` (dengan `preventScroll` bila tak perlu scroll), judul view (`<h1>`) dibacakan; hash change tidak melempar fokus ke body.
- [ ] **Bottom-sheet more-sheet**: focus trap saat terbuka, Esc & swipe-down menutup, fokus kembali ke tombol trigger, `role="dialog"` + `aria-modal`.
- [ ] **Keyboard nav lengkap**: Tab urut logis topbar → sidebar → main; ↑/↓ di search combobox; Enter pada row game = aksi Main, Review tetap tombol terpisah yang fokus-able.
- [ ] **Realtime announcements**: badge N dan row Bermain Online update → `aria-live="polite"` region tunggal (debounce, maks 1 pengumuman / 5 detik) agar tidak spam screen reader.
- [ ] **Kontras**: semua kombinasi teks/bg memenuhi 4.5:1 (teks-muted di panel diverifikasi terhadap token existing); presence dot tidak pernah satu-satunya indikator status.
- [ ] **Animasi**: semua durasi dari `--move-animation-duration`; hormati `prefers-reduced-motion` (shake/slide → fade instan).
- [ ] **Keyboard-only walk** (diverifikasi di S4-T5): login → home → task card → puzzle solve → kembali → Bermain Online row → Main — semua tanpa mouse.

---

## 9. Peta Flow Sprint 4 (untuk audit S4-T5)

```
login ──► HOME (greeting+streak)
            │ task cards ──► /puzzles | /daily | review terakhir
            │ Bermain Online rows ──► [Main] game · [Review] game-review
            ▼
SIDEBAR ──► Bermain (play/bots/coach) · Teka-Teki (puzzles/daily/rush/themes)
            Berlatih (review/scan/vision/drills) · Komunitas (community/leaderboard/friends/archive)
challenge masuk ──► Terima (dual-button) ──► game aktif ──► muncul di HOME + badge nav N
end-game ──► modal Review Partai ──► game-review ──► Arsip & Analisis
drills set ──► solve mode (S3-T1) ──► progress % naik ──► kartu set ter-update
```

Setiap view wajib punya jalur masuk (sidebar/home) dan jalur keluar bermakna — audit lengkap per view ada di `docs/design/sprint4-flow-audit.md` (S4-T5).
