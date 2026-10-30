# Flow Alignment Map — chess.com ↔ jev-chess

> Tujuan: menyeragamkan **alur penggunaan & fitur** jev-chess dengan pola UX
> chess.com, sebagai acuan redesign. Ini pemetaan *pola*, bukan salinan aset/teks
> berhak cipta. Semua rekomendasi hormat aksesibilitas DHH (cue visual+teks,
> focus visible, `aria-live`, `prefers-reduced-motion`).
>
> Sumber data riil: `docs/design/chesscom-flows.md` (capture camofox-browser,
> locale ID), `chesscom-parity-audit.md` (gap G0–G7), `ui-flow-spec.md`
> (kontrak state machine), `menu-flows-chesscom.md` (deskripsi flow 4 menu).
> Tanggal analisis: 2026-10-30.

---

## 0. Temuan struktural kunci (drives desain)

1. **Nav = 8 slot, sub-route bukan path terpisah.** chess.com menukar sub-konteks
   *di dalam satu halaman* (tab/tablist + hash/query) — `/play/online/computer`,
   `/puzzles/daily`, `/leaderboard/blitz` = **404**. jev-chess sudah ikut
   hash-route in-page (S8). **Jangan** bikin path API per tab.
2. **User chip di header = retensi paling kuat.** Streak hari + rating personal
   tampil di *semua* halaman. jev-chess: tambah **streak harian** + rating ke
   user-chip shell (sekarang hanya rating; pill status ada, streak belum).
3. **Fitur lokal terbuka untuk guest; CTA login hanya di momen relevan**
   (setelah puzzle/game selesai) — bukan blokir masuk. jev-chess masih terlalu
   ketat (`handleNavClick`: guest cuma `home`/`play`).
4. **State machine auth seragam (FIX-1):** `loading→ready|guest|pending|error`.
   `pending` = 403 `account_pending` → "Akun menunggu persetujuan admin"
   (ikon jam, **bukan** CTA login palsu). Bug inti G0 yang harus dihapus.

---

## 1. Peta Navigasi — chess.com ↔ jev-chess

| chess.com (8 slot) | jev-chess section (S8) | jev-chess subtab | Gap |
|---|---|---|---|
| Beranda /home | **Beranda** | home | tambah streak + resume learn + game terakhir di dashboard |
| Play /play | **Main** | play, bots, tournaments | + Coach & Teman sebagai mode lobby (chess.com "Lawan Pelatih"/"Teman" ada di /play) |
| Teka-Teki /puzzles | **Taktik** | puzzles | + filter tema+rating di unlimited; + stats panel |
| (Learn /learn) | **Belajar** | courses, learn, classroom, coach | + resume "Pelajaran Berikutnya" + auto-scroll lesson aktif |
| Train /train | **Latih** | explorer, insights, practice, drills, vision | mapping modul sudah dekat; + mastery % persisten per tema |
| Watch /watch | **Tonton** | archive | chess.com Watch = live events + ChessTV; jev-chess = Arsip Partai (berbeda) → pertahankan, rename jelas |
| Community /community | **Komunitas** | leaderboard, friends, community | + tab scope (Pemain/Teman) + filter kategori waktu |
| Lainnya /other | **Lainnya** (accordion+sheet) | review, scan, admin, dsb. | review/scan adalah Analisis jev-chess (ikon medal+scan) — posisi semantik berbeda |
| Analisis (di jev) | **Analisis** | review, scan | chess.com review ada di /train + deep-link /analysis — jev pisahkan sebagai section (OK) |

> JeV punya **8 section** = sejajar 8 slot chess.com. Selaraskan *nama grup*
> dengan mental-model chess.com (Main/Taktik/Belajar/Latih/Tonton/Komunitas)
> sudah terjadi di S8. Yang kurang: **Analisis & Scan** yang di chess.com
> tersebar di Train/Other — di jev jadi section sendiri (perlu keputusan).

---

## 2. Flow per Fitur — pola chess.com → kondisi jev-chess → rekomendasi

### 2.1 Dashboard / Beranda
- **chess.com:** streak dominan → main sekarang (picker time-control) →
  jawab taktik → resume learn → ulas game terakhir.
- **jev-chess:** dashboard via `/api/home/dashboard`; guest landing belum jelas.
- **Rekomendasi:** greeting + streak api (ikon) → 4 kartu aksi (1 label + 1 CTA)
  → strip personal (rating puzzle, games hari ini) → resume learn → game terakhir
  (deep-link review). Guest: landing "Mulai main vs bot" tanpa blokir.

### 2.2 Play / Main (lobby + pairing)
- **chess.com:** 6 kartu mode vertikal; board preset muncul **sebelum** pairing
  + counter live "playing/games today"; queue inline (Mencari/Segera/Batal);
  toolbar game = Putar, suara, Perbarui, Bata + clock per sisi + rating lawan inline.
- **jev-chess gap (G2):** time-control **hardcode 5+0**, tak ada picker;
  tak ada abort/rematch/offer-draw; belum ada daftar tantangan masuk/keluar
  dengan countdown expiry.
- **Rekomendasi:** TimeControlPicker (preset chip 1+0/3+0/3+2/5+0/10+0/15+10
  + Kustom, `role=radiogroup` + rated toggle + pilihan warna swatch); queue
  inline di atas board; game-over modal = Rematch(primary)/Analisis/Tawari
  Remis/Menyerah(2-tahap); challenge-card countdown ring (visual+sr-only).

### 2.3 Puzzles / Taktik
- **chess.com:** hub = stats strip personal + 4 kartu mode (Unlimited/Harian/
  Gegas/Tema); solver = 1 puzzle/layar + hasil attempt **inline** di bawah
  board (hijau ✓/merah ✕ + langkah terbaik + CTA Lanjut); Gegas = pre-screen
  aturan + HUD skor/waktu/streak + pause saat blur; Tema = grid mastery %.
- **jev-chess gap (G3):** unlimited tak punya filter tema+rentang rating;
  stats panel parsial; rush belum pause saat blur; hint berjenjang perlu cue
  visual beda per stage (sorot bidak→sorot kotak→panah).
- **Rekomendasi:** filter tema (dari `/api/puzzles/themes`) + preset rating
  (<1200/1200–1800/1800+) + hint 3-stage; panel stats (rating/streak/solved/
  failed, semua teks berlabel); hasil attempt inline; rush end-screen breakdown.
  Endpoint ada: `/api/puzzles/next?theme=&minRating=&maxRating=`, `/daily`,
  `/rush/*`, `/themes`. Kurang: agregat stats (gabung dashboard).

### 2.4 Learn / Belajar
- **chess.com:** board mini live + 3 track (Pemula/Menengah/Lanjut) + resume
  "Pelajaran Berikutnya" + auto-scroll ke lesson aktif.
- **jev-chess:** `learn-state.json` (file store, [NO-NEW-TABLE]) sudah siap
  untuk state resume. S9 sudah hapus papan ilustrasi statis.
- **Rekomendasi:** CTA resume per progress + auto-scroll lesson aktif +
  progress bar per track.

### 2.5 Train / Latih
- **chess.com:** hub 7 modul (Kursus/Analisis/Tinjauan/Ruang Kelas/Permainan
  Akhir/Latihan/Pelatihan).
- **jev-chess:** 5 subtab (explorer/insights/practice/drills/vision).
- **Rekomendasi:** selaraskan nama modul dengan pola "7 kartu" chess.com bila
  ingin parity penuh; minimal pastikan mastery % persisten + link silang
  Analisis (G4.1/G4.2: akurasi per pemain + blunder meter per pemain).

### 2.6 Leaderboard / Komunitas
- **chess.com:** tab Pemain|Trophy + chips kategori (Bullet/Blitz/Rapid);
  baris = rank(medal 3 besar)+username+rating+game+win-rate; baris sendiri
  sticky "kamu di #N".
- **jev-chess gap (G5):** `/api/leaderboard?scope=global|friends` tanpa
  kategori waktu, tanpa win-rate.
- **Rekomendasi:** chips kategori + tab scope (friends→tab) + kolom win-rate
  + filter rating + empty-state "main rated untuk masuk papan".

### 2.7 Onboarding & state (G6, cross-cutting)
- Onboarding 3 langkah (pilih rating awal → main pertama → puzzle pertama).
- Standarkan `StateMessage` (empty/loading/error/pending) + skeleton +
  ilustrasi SVG buatan sendiri (bukan aset pihak ketiga).

---

## 3. Prioritas Eksekusi (redesign)

- **P0 (bug/retensi):** G0 auth messaging (hapus CTA login palsu utk
  pending), streak+rating di user-chip shell, gate nav guest longgar (G1.1).
- **P1 (core play):** TimeControlPicker + game-over modal (rematch/draw/
  abort) + challenge-card countdown (G2).
- **P1 (tactics):** filter tema+rating + stats panel + rush pause (G3).
- **P2 (community/stats):** leaderboard kategori waktu+win-rate (G5),
  resume learn (2.4), onboarding (G6.1).
- **P2 (a11y):** sebar `prefers-reduced-motion` + focus trap sheet +
  heading sr-only grup (G7).
