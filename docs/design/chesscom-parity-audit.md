# Chess.com Parity Audit — jev-chess (Workstream-2)

Designer docs-only. Tanggal: 2026-10-23. Referensi chess.com dipakai HANYA sebagai
referensi pola UX/layout (deskriptif) — tidak ada kode, aset, gambar, font, ikon, atau teks
berhak cipta yang disalin. Semua aset direkomendasikan dibuat sendiri / open-source.

Prinsip aksesibilitas (DHH, binding untuk semua rekomendasi):
- Semua status/kelas/hasil punya CUE VISUAL (ikon, teks, warna kontras) — tidak pernah rely pada audio/suara saja.
- Setiap pesan punya `aria-live="polite"` (atau `assertive` untuk error fatal) + `role="status"`.
- Fokus keyboard selalu terlihat (`focus-visible ring`), semua aksi reachable via keyboard.
- Animasi hormati `prefers-reduced-motion: reduce`.

---

## 1. Matriks Fitur × Akses (WS-2.1)

Keterangan akses: ✅ penuh · 🟡 terbatas/menggantung · ❌ ditolak · ⚠️ rusak/palsu.
"Pending" = login sukses tapi status akun menunggu persetujuan admin. Bug inti saat ini:
API mengembalikan 401 untuk pending (padahal semestinya 403 `account_pending`), sehingga
view menampilkan CTA "Masuk untuk melihat..." PALSU bagi user yang sudah login (R1/R2).

| # | Fitur (view) | Guest | Pending | Approved | Admin | Catatan kondisi saat ini |
|---|---|---|---|---|---|---|
| 1 | Home / Bermain Online (`home-view`) | 🟡 dashboard gagal, pesan "Sesi berakhir" keliru utk guest | ⚠️ 401 palsu → CTA login palsu | ✅ | ✅ | `/api/home/dashboard`; guest perlu landing jelas |
| 2 | Lawan Bot (`versus-bots-view`) | ✅ (grid + filter lokal) | ✅ | ✅ | ✅ | Tidak butuh API; main lokal |
| 3 | Pelatih (`coach-mode-view`) | ✅ (engine lokal via `/api/engine-move`) | ✅ | ✅ | ✅ | Tidak ada gating terdeteksi |
| 4 | Teka-Teki Hub (`puzzle-hub`: unlimited/daily/rush/themes) | 🟡 puzzle umum bisa dicoba; statistik/rating ❌ | ⚠️ attempt/streak gagal dgn 401 palsu | ✅ | ✅ | `/api/puzzles/*`; hub tab: Teka-Teki/Harian/Gegas/Latihan Tema |
| 5 | Puzzle Harian (`daily-puzzle-view`) | 🟡 lihat puzzle | ⚠️ attempt gagal | ✅ | ✅ | `/api/puzzles/daily?date=` |
| 6 | Puzzle Rush (`rush-view`) | ❌ butuh sesi | ⚠️ start/attempt 401 palsu | ✅ | ✅ | `/api/puzzles/rush/start|leaderboard|attempt`; aria-live HUD sudah ada |
| 7 | Latihan Tema (`themes-mastery-view`) | 🟡 daftar tema terlihat | ⚠️ next/attempt 401 palsu | ✅ | ✅ | `/api/puzzles/themes`, `/next` |
| 8 | Permainan Akhir (`endgame-drills-view`) | ❌ | ⚠️ "Masuk untuk melihat latihan..." palsu | ✅ | ✅ | `/api/endgames/drills`; 6 set kurasi, progress % |
| 9 | Analisis/Review (`game-review`) | 🟡 via paste PGN | ✅ | ✅ | ✅ | EvalBar + blunder detection (delta cp) sudah ada |
| 10 | Arsip (`archive-view`) | ❌ | ⚠️ CTA palsu | ✅ | ✅ | `/api/games/archive` + unduh PGN |
| 11 | Papan Peringkat (`leaderboard-view`) | ❌ | ⚠️ CTA palsu | ✅ | ✅ | `/api/leaderboard?scope=`; highlight baris sendiri |
| 12 | Teman (`friends-view`) | ❌ | ⚠️ CTA palsu | ✅ | ✅ | `/api/friends` CRUD + respond + tantangan inline |
| 13 | PvP (`pvp-panel`) | ❌ ("Masuk dulu...") | ⚠️ invite gagal | ✅ | ✅ | invite `timeControl: "5+0" hardcoded` |
| 14 | Spectator (`spectator-view`) | 🟡 broadcast publik bisa dilihat | ✅ | ✅ | ✅ | `/api/broadcast`; prediksi engine |
| 15 | Scan Papan (`scan-view`) | ✅ kamera lokal | ✅ | ✅ | ✅ | `/api/scan-board`; fitur berat, on-device |
| 16 | Learning Hub (`learning-hub`) | ✅ materi statis | ✅ | ✅ | ✅ | Tanpa API terdeteksi |
| 17 | Admin (`admin-panel`) | ❌ | ❌ | ❌ | ✅ | Approval flow |

Aturan nav (`game.tsx` `handleNavClick`): guest hanya boleh `home`/`play`; tab lain
ditolak dengan notice sementara 2,8 detik. Ini terlalu ketat — versus-bots, scan,
learning hub, spectator, coach tidak butuh login (lihat gap G1).

## 2. Gap List UX per Fitur vs Pola chess.com (WS-2.2, deskriptif)

### G0 — Auth messaging (bug aktif, prioritas #1)
- G0.1 Pending user melihat CTA "Masuk untuk melihat..." palsu di 4 view (friends,
  leaderboard, archive, endgame-drills) + pvp-panel + game.tsx. Harusnya: 403
  `account_pending` → pesan "Akun menunggu persetujuan admin" + status badge.
- G0.2 Tidak ada indikator status akun (approved/pending) di mana pun di UI. chess.com
  selalu menampilkan status akun jelas di profil/header.
- G0.3 Error server (503/PG down) dipetakan jadi CTA login (error ditelan di
  `currentPgUser`). Harusnya pesan generik + tombol "Coba lagi".

### G1 — Nav & gating
- G1.1 Guest ditolak dari fitur yang sebenarnya bekerja tanpa login (bots, scan,
  learning hub, coach, spectator, paste-PGN review). Pola chess.com: fitur lokal
  terbuka penuh untuk guest; CTA "daftar untuk menyimpan progres" hanya di momen
  relevan (setelah selesai puzzle/game), bukan sebagai blokir masuk.
- G1.2 Notice nav guest hanya muncul 2,8 detik lalu hilang — buruk untuk screen reader
  dan user lambat membaca. Harusnya inline `role="alert"` persisten sampai didismiss.
- G1.3 Mobile bottom-nav 5 item + sheet "Lainnya" (8 item) — sheet tidak menandai item
  aktif dengan pola sama seperti sidebar (aria-current sudah ada di sidebar; pastikan
  sheet juga). Desktop sidebar 4 grup + accordion "Lainnya" — grup label tidak punya
  heading semantik (`<h2>` sr-only) untuk orientasi SR.

### G2 — Board controls & game flow (vs pola chess.com)
- G2.1 Clock presets: tidak ada pemilihan waktu control di UI pairing (PvP hardcode
  "5+0"). chess.com punya preset 1+0/3+0/3+2/5+0/10+0/15+10 + custom. Butuh picker
  preset + toggle rated/casual + pilihan warna (putih/hitam/acak).
- G2.2 Abort/rematch/offer-draw: tidak ditemukan flow abort di awal game, rematch
  satu-klik di game-over-modal, atau offer draw/flag. Ini alur standar quick pairing.
- G2.3 Game list / quick pairing: home hanya dashboard; belum ada daftar tantangan
  masuk/keluar seperti challenge-card yang bisa diterima/ditolak dengan satu ketukan +
  countdown expiry terlihat (visual + aria).
- G2.4 Board controls: flip/coords/settings ada, tapi pastikan semua ikon tombol punya
  tooltip + `aria-label` berbahasa Indonesia dan fokus visible; tombol pasukkan langkah
  (flag/Resign) butuh konfirmasi 2-tahap (klik pertama = arm, kedua = konfirmasi) untuk
  cegah misclick.

### G3 — Puzzle flow
- G3.1 Filter tema di puzzle unlimited: themes-mastery punya daftar tema, tapi puzzle
  unlimited tidak punya filter rating-range/tema seperti pola chess.com (pilih tema +
  rentang rating + mode hint).
- G3.2 Stats panel puzzle: rating puzzle pribadi, streak, accuracy — hanya parsial.
  Butuh panel ringkas (rating, streak hari, solved/failed hari ini) dengan angka
  selalu sebagai teks (bukan ikon saja).
- G3.3 Rush: HUD aria-live sudah ada (bagus). Tambah: pausing saat tab blur, indikator
  "puzzle berikutnya" visual, dan hasil akhir dengan breakdown benar/salah.
- G3.4 Hint berjenjang (stage) sudah ada — tambahkan cue visual berbeda per stage
  (sorot bidak → sorot kotak → panah) supaya tidak rely pada teks saja.

### G4 — Review / analysis
- G4.1 EvalBar + blunder detection sudah ada (bagus). Gap: persentase akurasi per
  pemain di akhir review, dan daftar langkah kritis yang bisa diklik untuk lompat.
- G4.2 Blunder meter per pemain (bar Inaccuracy/Mistake/Blunder) — badge warna sudah
  ada (amber/red); tambahkan ikon + teks ganda untuk color-blind safety.

### G5 — Stats & komunitas
- G5.1 Leaderboard: ada scope + highlight baris sendiri. Tambah: filter rentang
  rating, dan empty-state yang menjelaskan cara masuk papan (main rated).
- G5.2 Friends: presence dot sudah ada + sr-only (bagus). Tambah: tombol tantangan
  langsung dari baris teman dengan preset waktu (lihat G2.1).

### G6 — Onboarding & empty/loading/error states
- G6.1 Belum ada onboarding flow untuk user baru-approved (tour singkat: main pertama,
  puzzle pertama). Pola chess.com: 3 langkah pilihan rating awal → langsung ke game.
- G6.2 Loading: sebagian view sudah pakai `role="status" aria-live` "Memuat…" (bagus);
  standarkan skeleton vs spinner ke satu komponen.
- G6.3 Error: standarkan komponen `ErrorState` (pesan generik + "Coba lagi" + kode
  error sr-only) — sekarang tiap view punya pola error sendiri.
- G6.4 Empty state: archive/leaderboard/friends butuh empty state dengan ilustrasi
  sendiri (bukan aset chess.com) + satu CTA.

### G7 — Aksesibilitas (lintas fitur)
- G7.1 `prefers-reduced-motion` hanya ditemukan di puzzle-solver — sebarkan ke semua
  animasi (confetti, animate-in, pulse, flybrain-visualizer).
- G7.2 Keyboard: pastikan bottom-nav & "Lainnya" sheet operabel penuh via keyboard
  (focus trap saat sheet terbuka, Escape menutup).
- G7.3 Suara game (jika ada) harus opsional + selalu ada pasangan visual; hasil game
  sudah punya aria-live di game-over-modal — pertahankan.

## 3. Prioritas (urut dampak, untuk WS-2.3)
1. G0.1–G0.3 (bug CTA palsu) — blok semua fitur untuk pending user.
2. G2.1 clock presets + G2.2 abort/rematch/draw — inti pengalaman bermain.
3. G1.1 gating guest yang benar — first impression.
4. G3.1–G3.2 puzzle filter + stats — retensi harian.
5. G4.1 akurasi + daftar langkah kritis.
6. G6 onboarding + standardisasi empty/loading/error.
7. G7 aksesibilitas sweep.

## 4. Lampiran — Guest capture halaman publik chess.com (2026-10-27)

> Login sesi cookie kadaluwarsa (`psid`/`GCLB` expired) → capture full dilakukan
> sebagai **guest** (tanpa Turnstile bypass). Area member-only (Dashboard,
> Analysis, Leaderboard personal, Settings, Messages, Profile stats) **LEWAT**
> dan ditandai di bawah. Pola di sini = referensi parity untuk G1/G5/G6.
> Screenshot + text dump: `workspace/20261026_.../guest-pages.json`.

| Halaman (URL final) | Pola utama yang terlihat (guest) | Relevansi jev-chess |
|---|---|---|
| `/tournaments` | Hero + CTA "Join tournaments starting every few minutes" (Fast/Arcade/Blitz/Rapid) + grid "Daily Tournaments" multi-game + "Win trophies to display on your Profile". Filter via Search; tanpa login hanya bisa lihat, join dibelokkan ke auth. | S6 Tournaments view: tambahkan tier Fast/Arcade/Blitz/Rapid + badge trophy + CTA join-gated (FIX-1 401/403). |
| `/watch` | Tab: Live events, ChessTV, Streamers; event card "Titled Tuesday" (jadwal + peserta) + daftar streamer grid. | Watch view: 3 sumber konten (live/event/streamer), card event dengan slot waktu. |
| `/play/online` (dari `/live`) | Redirect ke lobby Play: kartu "vs Computer / vs Friend / vs Stranger" + clock picker + daily/arena entry. Lobby, bukan live-game list, untuk guest. | Play lobby: 3 mode kartu + preset clock (G2.1) — guest bisa mulai vs Computer tanpa akun. |
| `/daily` | "Daily Chess Puzzles — Your Daily Challenge": 1 puzzle fokus + streak + share. | Practice (S7-T3): daily-challenge card + streak counter (riil dari puzzle_attempts). |
| `/puzzles` | Hero "500k+ Problems" + filter theme/difficulty/seed + recommended + daily. | G3.1: puzzle filter (theme+difficulty) wajib; angka "500k" = data riil, jangan hardcode. |
| `/play` | "Play Chess Online for Free with Friends & Family": quick-find game by rating + join-by-link. | Play vs Friend: CTA join-by-link + matching by rating band. |

**Catatan member-only yang LEWAT (butuh login aktif untuk capture lanjutan):**
Dashboard (riwayat game + streak), Analysis (upload PGN), Profile/Stats,
Messages/Challenges, Settings, Leaderboard personal — pola-nya sudah
tercover di audit §1 matriks; capture visual area ini ditunda sampai
Pak export cookie fresh (opsi 2).
