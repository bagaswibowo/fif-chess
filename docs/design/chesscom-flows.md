# Analisis Lengkap Fitur, Menu, Tampilan & Flow — chess.com (2026-10-27)

> **Sumber data 100% riil**: capture via camofox-browser (Camoufox anti-detect,
> sesi login `zenwisteriaclarines`, cookie `ACCESS_TOKEN`+`CHESSCOM_REMEMBERME`),
> snapshot accessibility per halaman → `docs/design/chesscom-flows/raw-*.json`.
> UI sumber render **bahasa Indonesia** (locale ID) — copy di bawah = terjemahan
> resmi UI chess.com, boleh dipakai sebagai acuan copy jev-chess.
> Batasan: pola UX/struktur saja; TIDAK menyalin aset/teks berhak cipta.

## 0. Arsitektur Navigasi (peta menu)

Nav header = **8 slot** (bukan deep-link per halaman — ini temuan struktural
paling penting):

```
Bermain        /play         → lobby multi-mode (Online/Bot/Pelatih/Teman/Turnamen/Varian)
Teka-Teki      /puzzles      → hub solver (Harian/Gegas/Tema/Tanpa Batas)
Belajar        /learn        → lesson hub (level Pemula/Menengah/Tingkat Lanjut + resume)
Berlatih       /train        → hub 7 modul: Kursus, Analisis, Tinjauan, Ruang Kelas,
                                Permainan Akhir, Latihan, Pelatihan
Tonton         /watch        → live events + ChessTV + streamers + jadwal
Komunitas      /community    → grup: Connect (Teman/Klub/Anggota/Pelatih),
                                Players (Top/Papan Peringkat), Content
Lainnya        /other        → grup: Koleksi, Database, Terminologi, Aturan,
                                Jelajahi, Catur Voting, Catur Tunggal, Kejuaraan Komputer
Uji Coba Gratis → upsell strip (CTA premium global, ada di SEMUA halaman)
```

**Temuan kunci (drives jev-chess):**
1. Sub-route banyak **bukan path terpisah**: `/play/online/computer`,
   `/puzzles/daily`, `/leaderboard/blitz` = **404**. Nav sub-item di-switch
   di dalam satu halaman (tab/tablist + query param). JeV: ikut hash-route
   in-page (sudah dilakukan) — jangan buat path API per tab.
2. Streak hari ("59 Days") + rating personal ("6") = **user chip di header**
   (semua halaman) → elemen retensi paling terlihat di seluruh situs.
3. "Hapus Iklan" (`/no-ads?c=no_ads`) ada di footer SEMUA halaman → slot
   monetisasi global; jev tidak perlu (tanpa iklan).
4. `/profile` = 404; profile via chip avatar header (dropdown) + `/archive`
   (riwayat) + leaderboard.

## 1. Per Menu: Tampilan + Flow

### 1.1 Dashboard `/home` (personal, logged-in)
**Tampilan:** greeting user + **streak "59 Days"** (heading h3, posisi
dominan) → 4 kartu action utama:
- "Bermain Online" + picker time-control (button `10 mnt`/`5 mnt`/`1 mnt`)
  + CTA "Mulai Permainan" (e21) → lobby Play.
- "Lawan Bot" / "Lawan Pelatih" / "Bermain dengan Teman" (3 link mode, e23-e25).
- Ringkas personal: "6 6 571 2" = (rating taktik, games hari ini, total
  games, sesuatu) + "Jawab Teka-Teki" (e27).
- **Resume learn**: "Serang di Pusat / Pelajaran Berikutnya" (e28-e29) →
  link ke lesson aktif user.
- **Game terakhir**: "vs fatimaistrying / Ulas Partai" (e30) →
  `/analysis/game/live/{id}?tab=review&flip=false` (deep-link analysis per
  game).

**Flow:** Dashboard = **personal hub**, bukan landing marketing. Urutan
informasi: streak → main sekarang → jawaban taktik → belajar → ulas game
terakhir. Setiap kartu = satu destinasi, label 1 kata + aksi 1 kata.

### 1.2 Play `/play` + `/play/online` (lobby)
**Tampilan:** h1 "Bermain Catur" + **6 kartu mode vertikal** (bukan grid):
| Mode | Sub-copy riil | Destinasi |
|---|---|---|
| Bermain Online | "Bermain vs pemain yang seimbang" | matching queue |
| Lawan Bot | "Tantang bot dari level Mudah hingga Master" | bot ladder |
| Lawan Pelatih | "Belajar sambil bermain bersama Pelatih" | coach games |
| Bermain dengan Teman | "Undang teman untuk bermain catur" | invite link |
| Turnamen | "Ikuti Arena yang bisa dimenangi oleh siapa pun" | /tournaments |
| Varian Catur | "Temukan berbagai cara baru yang asyik untuk bermain catur" | /variants |

Footer lobby: "Riwayat Permainan" + "Papan Peringkat" (cross-link ke
/archive & /leaderboard) + "Hapus Iklan".

**Flow in-online (riil):** board preset sudah muncul SEBELUM cari lawan
("Lawan 10:00" + board 8×8) + panel samping: tab `Permainan Baru |
Permainan | Pemain` + preset "10 mnt (Cepat)" + CTA **"Mulai Permainan"**
+ "Tantangan Kustom" + "Bermain dengan Teman" + "Turnamen" + counter live
**"289,677 PLAYING / 27,835,117 GAMES TODAY"** (social proof real-time).
Klik Mulai → state **"Mencari / Segera dimulai / Batal"** (queue dengan
cancel). Saat match: toolbar game = Pengaturan, "Klik untuk mengaktifkan
perintah suara" (voice commands toggle), "Putar Papan" (flip), "Permainan
Baru", "Batal" + clock per sisi + rating pemain (358 tampil).

**Temuan flow:** (a) rating pemain lawan tampil inline sebagai `(358)`
di samping nama; (b) clock = satu nilai per side, bukan picker saat
mid-game; (c) queue = **inline, bukan halaman baru** — board tetap tampil.

### 1.3 Puzzles `/puzzles` (Teka-Teki)
**Tampilan:** h1 "Teka-Teki" + h3 "Berlatih dengan teka-teki catur dan
tingkatkan permainan Anda." + 3 value-prop h2 ("Selesaikan teka-teki
untuk meningkatkan taktik" / "Tingkatkan keawasan dan pengenalan pada pola"
/ "500K+ teka-teki") + **puzzle carousel personal** (button player:
lorddedi, PolyBhattacharjee +4, wahidinsyahrir…) = puzzle direkomendasikan
riil dari graf pemain + CTA utama **"Jawab Teka-Teki"** (e23) +
"Perluas Menu Teka-teki" (e22, buka panel mode).

**Flow solver (dari doc S3 existing + pola hub):** Hub → klik "Jawab
Teka-Teki" → mode (Harian/Gegas/Tema/Tanpa Batas) → satu puzzle per layar
→ hasil attempt inline di bawah board (bukan modal) → angka strip personal
update. Sub-mode via in-page switch, bukan path (bukti: /puzzles/daily
= 404).

### 1.4 Learn `/learn`
**Tampilan:** h1 "Belajar" + **board mini live di halaman** ("Bermain
1" badge + papan) + h1 "Pembukaan tingkat lanjut" + CTA resume
**"Pelajaran Berikutnya"** (e17) + track h3: **Pemula / Menengah /
Tingkat Lanjut** + control "Scroll to active lesson" (e19, auto-scroll
lesson = pattern carousel lesson) + "Uji Coba Gratis" + modal "Pengaturan".

**Flow:** Learn = **curated path** (3 track) + **resume state** ("Pelajaran
Berikutnya" = next lesson per progress user) + auto-scroll ke lesson aktif.
JeV S7: `learn-state.json` (file store, kontrak [NO-NEW-TABLE]) persis untuk
state resume ini.

### 1.5 Train `/train` (hub modul berlatih — terdetil)
7 kartu modul riil (h1 "Berlatih"):
| Modul | Sub-copy | JeV mapping |
|---|---|---|
| Kursus | "Belajar dari pecatur kesukaan Anda" | S7-T1 courses |
| Analisis | "Temukan langkah terbaik dalam posisi apa pun" | /analysis |
| Tinjauan | "Dapatkan analitik berdasarkan riwayat permainan Anda" | /archive + insights |
| Ruang Kelas | "Kolaborasi di papan catur bersama" | S7-T4 classroom |
| Permainan Akhir | "Berlatih permainan akhir vs komputer" | S7-T5 endgame drills |
| Latihan | "Latih semua aspek permainan Anda melawan komputer" | bot sparring |
| Pelatihan | "Dapatkan pelatihan pribadi berdasarkan partai terdahulu" | coach AI (premium) |

**Temuan:** "Ruang Kelas" (collab board) ada di hub **Train**, bukan nav
utama — jev-chess S7-T4 (classroom) benar menempatkan di grup belajar.

### 1.6 Watch `/watch`
**Tampilan:** h1 "Tonton" + stream live teratas ("Aarav Plays Chess &
Random Talks") + tab **"Acara"** (e16) → list event (h3 + rentang tanggal
riil: Titled Tuesday 2026 2 Jun–29 Des, Chess Club Showdown 30 Sep–31 Des,
Clutch Chess Champions Showdown 27–30 Okt, English Chess Championships
24 Okt–1 Nov) + **"Jadwal Lengkap"** (e20) → grid jadwal ChessTV per hari
(OKT 27 Sel / 28 Rab / 29…) + social links footer (TikTok/X/YouTube/Twitch).

**Flow:** 2 sumber konten: **event terjadwal** (kartu + tanggal) dan
**streamer live** (badge live + viewers). JeV: watch view = event schedule
riil dari DB (bukan placeholder), status live dari engine state.

### 1.7 Community `/community`
3 grup konten riil (heading h2 → item h3 + sub-copy):
- **Connect**: Teman ("Temukan dan tambahkan teman"), Klub ("Bergabung dan
  bertanding di klub Catur"), Anggota, Pelatih.
- **Players**: "Pemain Papan Atas", "Peringkat Catur" (rating per format
  kompetitif), "Papan Peringkat" (format Chess.com).
- **Content**: (list lanjut — blog/podcast).

**Flow:** hub = katalog social graph (hubungan + kompetisi + konten),
bukan feed. JeV: komunitas = teman/klub/anggota riil dari DB user graph.

### 1.8 Other `/other`
8 item riil: **Koleksi** ("Simpan permainan di koleksi untuk dipelajari"),
**Database Permainan** ("Telusuri jutaan permainan catur master"),
**Terminologi Catur**, **Aturan**, **Jelajahi**, **Catur Voting**
("Ikuti voting dengan tim untuk menjalankan langkah"), **Catur Tunggal**
("Pukul buah dengan urutan yang tepat" = shogi-lite), **Kejuaraan Komputer**
("Tonton pertempuran antarmesin"), **ChessKid**.

### 1.9 Leaderboard `/leaderboard`
**Tampilan:** h1 "Papan Peringkat" + filter dual: button **"Semua Tipe
Partai"** + **"Global"** (skala) + **5 kolom format**: Kilat (Blitz 3470
Hikaru), Peluru (Bullet 3602 ArkadiiKhromaev), Cepat (Rapid 2966 ManuDavid),
Harian (Daily 2580 FormerProdigy), + (Tetap/Chess960 tersembulkan
scroll) — tiap kolom = top-5 riil (avatar + GM/FM prefix + rating +
"Tampilkan statusmu!" = badge CTA personal) + **"Lihat Semua"** (expand).

**Flow:** multi-format SEBALAH (columns), bukan tab berganti — top-5 per
format terlihat sekaligus → pembanding cepat lintas format. JeV:
`/api/endgames/drills/leaderboard` (S7) = analog drill-nya; leaderboard
main = table rating riil per TC dari `match_results`.

### 1.10 Tournaments `/tournaments`
**Tampilan:** h1 "Turnamen" + 3 value h2 ("…dimulai setiap beberapa menit"
/ "…Harian" / "Menangi trofi untuk dipajang di Profil Anda") + 2 panel:
**"Turnamen Langsung Berikutnya"** (e22, tabel live: Nama | Pemain | Mulai |
+ CTA **Dimulai** (status) / **Bergabung** (join)) dengan arena riil
("BomJ Champions #1 Arena", "solo Arena", "3+2 Blitz Arena") + panel
turnamen harian.

**Flow:** tabel (bukan card grid) = data-first; kolom CTA berubah status
"Mulai" → "Dimulai"/"Bergabung" → arena full = 403/503. JeV S6 arena
sudah punya; parity = kolom join status + badge trophy profile.

### 1.11 Analysis `/analysis`
**Tampilan:** board + panel mode: **"Analisis / Muat / Atur Posisi /
Analisis Baru / Koleksi Permainan"** + metrik live Hitam 0.3 / Putih
(eval engine riil) + h3 "Start analysis from any position".
Deep-link game: `/analysis/game/live/{id}?tab=review&flip=false`
(muncul di dashboard "Ulas Partai" — review = sub-tab analisis).

**Flow:** 3 entry: (1) game baru selesai → auto-offer review;
(2) upload PGN / koleksikan; (3) set posisi manual → analisis. JeV G4:
panel 3-mode + deep-link `#/game/{id}?tab=review` (Sudah di ADR S6).

### 1.12 Daily `/daily`
**Tampilan:** h1 "Teka-teki Catur Harian" + h3 "Selesaikan dan bagikan
taktik catur hari ini!" + puzzle + "Berapa langkah yang dibutuhkan?"
+ onboarding (Sen–Min makin sulit) + CTA **"Bagikan"** (share hasil) +
"Pengaturan".

**Flow:** satu puzzle per tanggal (deterministic) + streak + share
sosial → loop harian. JeV S7-T3: daily-challenge card + streak dari
`puzzle_attempts` window per hari (riil, bukan hardcoded).

### 1.13 Messages `/messages/{user}`
Thread chat pemain (URL = lawan bicara; inbox = `/messages`).
JeV: out-of-scope sprint, tapi pola URL deep-link per lawan perlu dicatat
untuk fitur challenge/messages nanti.

### 1.14 Archive `/archive` (→ redirect `/games/archive`)
**Tampilan terdetil (285 refs):** h1 "Riwayat Permainan {user}" +
**tablist 8 filter** (Semua/Favorit/Langsung/Harian/Bot/Pelatih/Cari) +
toolbar: "Semua Permainan (806)", sort "Tanggal: Terbaru Dahulu",
"Tampilan Utuh|Singkat" + batch ops (Pilih Semua → Tambah ke Koleksi /
Menganalisis / Unduh PGN / Tampilkan Penanda Waktu) + per-baris:
"Ulasan" (link) + "Tambahkan ke Favorit" + rating badge "48.4 60".

**Flow:** list-riwayat = **filter + sort + batch action** (3 layer),
bukan tabel datar. JeV G6/G2: riwayat view wajib punya filter + batch
PGN download (riil dari `game_logs`).

## 2. Temuan Lintasan (priority untuk jev-chess)

1. **Nav 8-slot dengan hub-pattern**: tiap menu utama = 1 halaman hub,
   sub-item via tab in-page + deep-link hash/query. Jangan path-per-tab.
2. **User chip header (streak + rating) ada di SEMUA halaman** → retensi
   constant; jev shell: tambah streak riil di header (puzzle_attempts
   hari ini + daily).
3. **Personalization 1st class**: dashboard/learn/puzzles semuanya
   "Berikutnya" (resume state). JeV S7 `learn-state.json` = fondasinya.
4. **Social proof live**: counter "289,677 PLAYING / GAMES TODAY" di
   lobby → jev: angka riil dari `game_logs` COUNT() (anti-mock wajib).
5. **Tabel > card untuk data-heavy** (tournaments, leaderboard, archive)
   —JeV S6 arena sudah tabel; leaderboard drill (S7-T5) ikuti pola
   top-5 kolom per kategori.
6. **Batch action** di archive (Koleksi/Analisis/Unduh/Timestamp per
   multi-select) → follow-up archive view jev.
7. **3-mode analysis + review deep-link** (`tab=review&flip=false`) —
   pola query param jev pakai hash `#/game/{id}?tab=review`.
8. **Locale ID penuh**: copy sumber sudah Indonesia → jev tidak perlu
   menerjemahkan lagi; angka tetap 12.000 (format local).

## 3. Gap ke jev-chess (cross-ref audit G0–G7 + sprint)

| Temuan | Status jev | Aksi |
|---|---|---|
| Nav 8-hub (Bermain/Teka-Teki/Belajar/Berlatih/Tonton/Komunitas/Lainnya) | shell S4-S6 ada 6 grup; "Ruang Kelas"+drill ada S7 | S7 nav 4 item baru (courses/learn/practice/classroom) ✓ on-track |
| Streak header | BELUM | follow-up: streak riil dari puzzle_attempts (G6 retensi) |
| "PLAYING/GAMES TODAY" live | BELUM | follow-up: counter riil game_logs (anti-mock) |
| Archive batch PGN+favorite | S3 ada list; batch BELUM | follow-up S8/G6 |
| 5-kolom leaderboard format | S7 drill leaderboard; main leaderboard S6 | extend: kolom per TC (riil rating) |
| Daily puzzle + share | S3 daily ada; share BELUM | low-priority |
| Tournament tabel join-status | S6 arena ✓ | parity CTA status sudah |
| Classroom (Ruang Kelas) | S7-T4 ✓ in-progress | dev agent jalan |

---
Artifact: `raw-*.json` (16 snapshot) di `docs/design/chesscom-flows/`
(browser: camofox-browser, sesi login cookie `CHESSCOM_REMEMBERME` valid
sampai 2027-10-27).
