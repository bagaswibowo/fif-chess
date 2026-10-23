# Menu Flows — ala chess.com (deskriptif UX) — jev-chess (WS-2.5)

Designer docs-only. Tanggal: 2026-10-23. Referensi chess.com dipakai HANYA sebagai
pola UX/struktur konten (deskriptif) — tidak ada kode, aset, teks berhak cipta yang disalin.
DHH binding: setiap state punya cue visual + teks, region status `aria-live`, fokus keyboard
terlihat, animasi hormat `prefers-reduced-motion`.

Mencakup 4 menu yang dikeluhkan user: **Puzzles, Leaderboard, Archive, Recent Games**.
Baselines: docs/design/chesscom-parity-audit.md (gap G0–G7), docs/design/ui-flow-spec.md
(StateMessage + useAuthedFetch), pm-execution-plan.md (FIX-1 done: 401/403/503 konsisten).

Kontrak state machine (sama utk semua view, dari ui-flow-spec §2, hook `useAuthedFetch`):
`loading` (skeleton + role=status) → `ready` | `guest` (CTA Masuk) | `pending` (403
account_pending → "Akun menunggu persetujuan admin", tanpa CTA login) | `error` (503/lain,
pesan generik + "Coba lagi", kode error sr-only). Setiap menu di bawah hanya mendeskripsikan
state `ready` per langkah; state machine di atas berlaku seragam.

---

## 1. PUZZLES (Teka-Teki Hub)

### Flow chess.com (pola)
1. Masuk (nav "Puzzles") → land di **Puzzle Hub**: stats strip personal di atas
   (rating puzzle, streak hari, solved/failed hari ini) + 4 kartu mode besar:
   Unlimited, Harian (Daily), Gegas (Rush), Latihan Tema. Kartu mode = pintu;
   user baru langsung paham pilihannya tanpa baca manual.
2. Klik mode → masuk solver. Yang membuat jelas:
   - Satu puzzle per layar, panel samping = SATU aksi utama (papan), meta ringkas
     (rating puzzle, tema) di atas papan.
   - Hasil attempt inline di bawah papan (bukan modal): hijau ✓ "Benar!" /
     merah ✕ "Salah" + langkah terbaik + tombol "Lanjut" (Enter juga lanjut).
   - Stats ter-update visible di strip atas setelah attempt (angka berubah = feedback).
3. Klik "Harian" → puzzle tanggal hari ini, banner "Puzzle Harian — 23 Okt 2026",
   streak counter; selesai → hasil + link "Lihat pembahasan".
4. Klik "Gegas" (Rush) → pre-screen: penjelasan aturan 1 kalimat + tombol "Mulai",
   pilihan durasi (3/5 mnt), best score pribadi. HUD selama rush: skor, waktu sisa
   (teks besar + progress ring), streak benar beruntun; pause otomatis saat tab blur.
   Akhir → breakdown: benar / salah / rating tertinggi dicapai + tombol "Main lagi" +
   posisi di leaderboard rush.
5. Klik "Latihan Tema" → grid tema (nama tema + jumlah soal + mastery %), pilih tema
   → puzzle berurutan tema tsb; progress bar mastery per tema persisten.

### Struktur konten per state (puzzle-hub & solver)
- loading: skeleton kartu mode / skeleton papan (kotak abu), teks sr-only "Memuat…".
- empty: guest boleh coba 1 puzzle (evaluasi), tapi stats panel kosong →
  "Masuk untuk menyimpan rating & streak" (CTA hanya di momen relevan — G1.1).
- loaded: seperti flow di atas.
- error: StateMessage error + Coba lagi.

### Kebutuhan spesifik jev-chess (mapping gap)
- G3.1: filter tema + rentang rating di tab Unlimited (dropdown tema dari
  `/api/puzzles/themes`, preset rating <1200 / 1200–1800 / 1800+, Terapkan/Reset).
- G3.2: stats panel (rating, streak, solved/failed hari ini) — data sudah ada
  (`/api/home/dashboard`: solvedToday, streakHarian; rating dari users.rating).
- G3.3: rush end-screen breakdown + pausing on blur.
- G3.4: hint berjenjang dengan cue visual beda per stage (sorot bidak → sorot kotak → panah).
- Endpoint yang ada: `/api/puzzles/next?theme=&minRating=&maxRating=`,
  `/api/puzzles/daily?date=`, `/api/puzzles/rush/*`, `/api/puzzles/themes`.
  Yang kurang: agregat stats puzzle pribadi (bisa gabung dari dashboard atau
  `GET /api/puzzles/stats` baru: rating, streak, solvedToday, failedToday).

### Kenapa flow ini jelas bagi user baru
Stats strip = konteks personal sejak detik pertama; 4 kartu mode = pilihan terbatas & bernama;
hasil attempt selalu dekat papan (视线不移开); CTA "Lanjut" eksplisit (tidak auto-advance
saat reduced-motion).

---

## 2. LEADERBOARD (Papan Peringkat)

### Flow chess.com (pola)
1. Masuk (nav "Papan Peringkat") → default tab **Pemain**, segmented control atas:
   "Pemain" | "Trophy" (turnamen/kejuaraan). Segmented = satu klik pindah konteks.
2. Di bawah tab: **filter kelas rating / kategori waktu** — chips: Bullet / Blitz /
   Rapid (di jev-chess bisa: Semua / Bullet / Blitz / Rapid sesuai game_type/time_control),
   plus preset rentang rating bila relevan. Pilihan filter mengubah list, bukan halaman baru.
3. List: baris kartu pemain = rank (medal visual utk 3 besar + teks angka), username,
   rating, jumlah game, win-rate % (teks berlabel). Baris sendiri di-highlight +
   sticky di bawah bila di luar viewport (pola chess.com: "kamu di #212").
4. Klik baris pemain → profil/stats pemain (deep-link), bukan halaman terpisah wajib.
5. Empty: "Papan masih kosong — main rated untuk masuk papan" + CTA "Main sekarang".

### Struktur konten per state
- loading: skeleton 5 baris tabel.
- guest/pending/error: kontrak seragam (§ atas).
- loaded: tab + chips filter + tabel semantik (`<table>` dengan th scope) +
  highlight baris sendiri (warna + indentasi bar kiri, bukan warna saja) +
  sr-only "Peringkat kamu: N".
- empty (0 entries): ilustrasi trofi buatan sendiri + 1 CTA.

### Kebutuhan jev-chess
- Sekarang `/api/leaderboard?scope=global|friends` — tanpa kategori waktu, tanpa win-rate.
- Tambahan: param `game_type=bullet|blitz|rapid` (filter server-side dari games.time_control/
  game_type), kolom win-rate (hits dari games result utk user top-50), tetap top 50.
- UI: chips kategori + tab Pemain/Teman (friends sudah ada sebagai scope — jadikan tab).

### Kenapa jelas bagi user baru
Segmented tab + chips terlihat sebelum list; baris sendiri selalu terlihat ("kamu di sini")
= orientasi instan; tiap kolom ada header label (rank/rating/game/win-rate).

---

## 3. GAME ARCHIVE (Arsip Partai)

### Flow chess.com (pola)
1. Masuk (nav "Arsip") → list partai terbaru dulu (desc), tiap baris preview ringkas:
   hasil W/L/D dengan warna + teks (hijau "Menang" / merah "Kalah" / abu "Remis" —
   jangan warna saja), lawan + rating lawan, kontrol waktu, opening name, tanggal, delta rating.
2. Filter bar di atas: tabs/chips per kategori (Semua/Favorit/Live/Harian/Bot/Coach —
   jev-chess sudah punya 6 chip ini) + pagination.
3. Aksi per baris: **Analisis** (buka game-review dgn PGN game itu), **Share** (copy link/
   PGN), **Rematch** (kirim challenge ke lawan dengan kontrol waktu sama), **Favorit**
   (toggle, optimistic). Semua tombol ikon + aria-label + tooltip.
4. Klik baris → expand preview papan mini (kata chess.com: hover/preview) atau langsung
   buka review — satu jalan utama, jangan dua.
5. Pagination: tombol prev/next + "Halaman 2 dari 12", bukan infinite scroll (list ringan,
   posisi baca terjaga). Unduh PGN multi-game tetap tersedia di header.

### Struktur konten per state
- loading: skeleton 8 baris list.
- empty: "Belum ada partai. Main lawan bot atau online" + 2 CTA.
- guest/pending/error: kontrak seragam.
- loaded: chip counts (Semua 24 · Live 10 · ...) + list + pagination.

### Kebutuhan jev-chess
- `/api/games/archive` sudah ada (filter/page/counts) tapi row-nya belum punya **opening
  name** dan **durasi**. Tambah: `opening_name` (derive dari game_moves via lib/opening-book
  — matching sudah ada di `lib/opening-book.ts`), `duration_sec` (created_at→ended_at),
  `opponent` sudah ada, `rating_delta` sudah ada.
- Endpoint tambahan yang disarankan: `GET /api/games/archive?filter=...&page=...&game_type=`
  (filter kategori waktu bullet/blitz/rapid untuk baris live), tetap satu endpoint.
- Rematch perlu `POST /api/challenge` dengan userId lawan + time_control dari game —
  challenge API sudah ada; tinggal wiring tombol.

### Kenapa jelas
W/L/D selalu terlihat di kiri baris = scan cepat; aksi 3 tombol konsisten per baris;
filter chips + counter = ukuran arsip terasa.

---

## 4. RECENT GAMES (feed ringkas di Home)

### Flow chess.com (pola)
1. Home, di bawah CTA "Main" → section **"Permainan Terakhir"** (5 item terakhir),
   tiap item satu baris: hasil berwarna W/L/D (ikon ✓/✕/½ + teks), lawan, opening name,
   akurasi % bila sudah di-review, tanggal relatif ("2 jam lalu").
2. Klik item → langsung **Analisis/Review** game itu (deep-link ke game-review) —
   feed adalah pintu masuk review, bukan arsip mini.
3. Footer section: link "Lihat semua partai" → Archive view (menutup loop navigasi).
4. Tidak ada game sama sekali (user baru): section disembunyikan atau empty state
   "Mainkan partai pertamamu" + CTA — jangan tampilkan header kosong.

### Struktur konten per state
- loading: skeleton 3 baris.
- empty: 1 CTA "Main vs Bot" (guest juga boleh).
- loaded: 5 baris + "Lihat semua".
- error: StateMessage ringkas + Coba lagi (feed tidak boleh bikin seluruh home gagal —
  error terisolasi per section).

### Kebutuhan jev-chess
- Feed diambil dari `games` table: `GET /api/home/recent-games?limit=5` BARU (ringan):
  id, result (W/L/D dari perspektif saya), opponent username+rating, time_control,
  opening_name (via opening-book), accuracy (nullable — dari analysis bila tersedia),
  ended_at. Atau diperluas `/api/home/dashboard` dengan `recentGames[]` (tetap 1 call —
  dashboard sudah Promise.all, tambah 1 query; direkomendasikan opsi ini).
- Accuracy: belum ada penyimpanan per-game di PG — tiket terpisah (opsional, fase 2):
  simpan accuracy putih/hitam saat game-review selesai, kolom `accuracy_white`,
  `accuracy_black` di games (migration ringan). Sampai ada, tampilkan opening + durasi saja.

### Kenapa jelas
Warna+ikon+teks hasil = dipahami dalam 1 detik; satu klik = review; "lihat semua"
menjelaskan relasi ke Archive tanpa perlu penjelasan.

---

## Ringkasan endpoint plan (gabungan)

| Endpoint | Status | Perubahan |
|---|---|---|
| `GET /api/puzzles/stats` | BARU | rating, streak, solvedToday, failedToday (bisa juga gabung dashboard) |
| `GET /api/puzzles/next` | ADA | sudah support theme/minRating/maxRating — dipakai filter UI |
| `GET /api/leaderboard` | ADA | tambah param `game_type`, kolom win_rate, games |
| `GET /api/games/archive` | ADA | tambah opening_name, duration_sec per row |
| `POST /api/challenge` | ADA | wiring tombol Rematch di archive |
| `GET /api/home/dashboard` | ADA | tambah `recentGames[5]` (result, opponent, opening, duration, accuracy) |
