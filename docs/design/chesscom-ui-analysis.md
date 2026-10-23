# Chess.com UI Analysis — referensi visual & UX untuk jev-chess

Sumber: 15 screenshot di `docs/design/reference-screenshots/` (analisis vision per file) + stack
Wappalyzer (PWA, Vue.js+Svelte, PubSubJS realtime, Howler.js audio, Sentry, Cloudflare).
Batas legal: hanya POLA UX/struktur visual yang diambil. Tidak ada aset, ilustrasi, teks, font,
atau ikon chess.com yang disalin — semua padanan jev-chess dibuat original (CSS/SVG sendiri).

## Palet & bahasa visual global

| Token | chess.com (referensi) | Padanan jev-chess (fungsi sama, nilai bebas) |
|---|---|---|
| Background halaman | charcoal gelap #1c1b19–#2a2a2a | dark charcoal `bg-zinc-900` existing |
| Panel/card | sedikit lebih terang (#2b2926), rounded, divider tipis | `bg-zinc-800 rounded-lg` existing |
| Primary CTA | hijau terang (#81b64c) dgn 3D bottom-edge | satu hijau primary per zona (sudah sesuai) |
| Board | cream #ebecd0 / green #779556 | tema board existing (cream/green) dipertahankan |
| Benar / CTA afirmatif | HIJAU (highlight square, tombol Ok/Next) | hijau = benar/success |
| Salah / bahaya | MERAH (square salah, king check, timer low-time) | merah = salah/check |
| Last-move / target | kuning translucent | amber translucent |
| Aksen ikon per grup nav | 1 warna per grup (orange puzzle, biru learn, dst) | aksen warna per grup nav (bukan copy ikon) |

Konstanta pola yang berlaku di SEMUA halaman:
- Layout 3 kolom: sidebar kiri fixed (~170px) + konten tengah + panel kanan opsional.
- Satu primary green CTA per zona — hierarki CTA selalu jelas (Sign Up green vs Log In gray).
- Tipografi bold white untuk heading, gray untuk sekunder/placeholder.
- Border-radius konsisten di semua button, board container, card, modal.

## Analisis per halaman

### 01–03 Home (landing, logged out)
- Grid: sidebar + board hero kiri + onboarding panel kanan.
- Board hero: posisi dramatis, king hitam di square merah (check) + badge lingkaran; crown hijau
  untuk sisi menang → **penggunaan warna fungsional sebagai storytelling**.
- Onboarding panel: headline besar 2 baris + subheadline + satu CTA "Get Started" hijau besar.
- Sidebar: logo, 6 grup nav (Play/Puzzles/Learn/Train/Watch/Community) + Other, search,
  Sign Up (green) / Log In (dark gray), footer links.
- **Pola DHH**: halaman langsung menunjukkan produk (board hidup), bukan mockup.

### 04/04c/05 Puzzles
- Grid: sidebar + board panel tengah + puzzle panel kanan (+ promo card kanan-jauh, skip).
- Board chrome: gear/settings icon di pojok kanan-atas area board; koordinat a–h bawah, 1–8 kiri
  dalam teks kecil abu-abu di dalam square.
- Player info bars atas & bawah board: avatar + username + rating, timer box gelap di kanan.
- Right panel puzzle: header (icon + judul di banner gelap), rating puzzle, move list,
  tombol Hint / Solution, tombol besar green **Next Puzzle** setelah selesai.
- Promo card: ilustrasi numbered-path (stump kayu bernomor 1–7) = progresi visual perjalanan
  puzzle; speech bubble "It's time to get solving!" = prompt inline (onboarding ringan).
- Onboarding modal (05): panel gelap rounded, judul, 1 kalimat tagline, 3 bullet checkmark
  benefit, satu tombol green "Ok" full-width, ✕ pojok kanan-atas, overlay dim.
- **Feedback langkah**: square highlight translucent hijau = langkah benar, merah = salah
  (menyala 1 langkah lalu fade), plus last-move amber.

### 06 Leaderboard
- Grid: sidebar + konten tengah + panel kanan (statistik).
- Header: judul + podium icon (gold/silver/bronze).
- Filter bar: dua dropdown gelap (game type, region) berdampingan.
- List: badge rank square (1 gold, 2 silver, 3 bronze; #4+ plain text) → avatar → tag title
  (merah) → username bold → flag → rating right-aligned. Top-3 diberi badge, sisanya teks.
- Panel kanan: angka besar statistik + caption uppercase gray.
- **Pola**: pemeringkatan dikomunikasikan lewat badge warna, bukan ukuran/dekorasi.

### 07/08 Archive / Login gate
- 07 & 08 sama-sama menangkap login modal (bukan archive list): card gelap rounded, input
  username (icon orang) + password (icon gembok + eye toggle), remember-me, tombol hijau besar,
  divider "OR", social buttons. Background halaman diberi pola diamond gelap subtle.
- **Pola**: form login ringkas satu kolom, satu CTA primary; konten dibelakang dim.
- Catatan QA: 2 dari 15 screenshot gagal capture (04b & 11 → 404; 07/08 → login gate), sehingga
  pola archive/daily-puzzle diambil dari pengetahuan domain chess.com, bukan dari gambar.

### 09 Play Online
- Grid: sidebar + board panel tengah + right panel setup.
- Board chrome: gear icon di bar atas board (sejajar avatar opponent), koordinat a–h / 1–8,
  player bars atas-bawah dengan timer box (gelap; merah saat low-time).
- Right panel: 3 tab (New Game aktif / Games / Players) → dropdown time control → CTA green
  besar "Start Game" → 3 tombol sekunder (custom/friend/tournament) → statistik live
  (X playing, Y games today, angka green).
- **Pola**: satu flow utama vertikal di right panel; tab untuk mengganti mode.

### 10 Lessons
- Header judul + icon biru; row kartu kategori horizontal (icon berwarna + label).
- Search bar; section checklist "Ready to Play...".
- Onboarding modal: judul + subtitle + ilustrasi besar + 3 bullet benefit (▶/✓/♛) + Ok green.
- **Pola**: kartu kategori dgn icon berwarna per topik; modal benefit selalu 3 bullet + 1 CTA.

### 12 Puzzle Rush
- Mode selection tersembunyi di balik modal: SCORE + selection box + tombol Play.
- Onboarding modal: judul + tagline + icon flames orange-red + 3 aturan bullet + Ok green.
- **Pola**: setiap mode baru diperkenalkan lewat modal "aturan main" yang sama bentuknya.

## Pola cross-cutting

1. **Onboarding modal**: overlay dim → card gelap rounded → judul + 1 kalimat → 3 bullet
   checkmark → satu CTA green full-width → ✕. Konsisten dipakai untuk setiap fitur baru.
2. **Feedback langkah**: square highlight translucent (hijau benar / merah salah / amber
   last-move) + getaran/shake board saat salah + sound. Audio & visual selalu berpasangan.
3. **Audio (Howler.js)**: set kound kecil — move (klik kayu), capture (ketukan lebih berat),
   check (nada tinggi), game end. Fire bersamaan dengan highlight visual.
4. **Realtime (PubSubJS)**: state game live (timer, move) dipush, bukan poll → jev-chess pakai
   polling/SSE existing, pola UI-nya sama: timer & move list update in-place tanpa reload.
5. **PWA**: chess.com installable; offline shell untuk halaman statis. Untuk jev-chess →
   manifest + service worker minimal (lihat ui-parity-v2.md V9).
6. **Board chrome wajib**: gear settings, koordinat, player bars — board tidak pernah telanjang.
