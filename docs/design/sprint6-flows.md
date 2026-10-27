# Desain Sprint 6 — Game-Flow Core + Play (S6-T1 .. S6-T5)

**Tiket:** S6-T1..S6-T5 · **Sprint:** 6 · **Peran:** UX/Design · **Tanggal:** 2026-10-27
**Status:** Draft untuk review · design-only (spesifikasi alur/wireframe/copy — tanpa kode).
Bentuk endpoint di tiap tiket adalah **kontrak data untuk backend/frontend (contract-first)**, bukan implementasi.

Sumber: `docs/tickets/S6-sprint-plan.md` (batch-1), gap G2.1/G2.2 `docs/design/chesscom-parity-audit.md`,
struktur menu tiruan `docs/rea/chess-web-menu-feature-map.md` §A/§D (referensi deskriptif SAJA).

---

## 0. Konvensi & guardrail (binding untuk kelima tiket)

### 0.1 Token (referensi nama saja — dari `app/globals.css` + `app/realtime.css`)
- Latar: `--background` (charcoal), `--surface`, `--card`, `--border` / `--border-strong`.
- Aksi: `--primary` (hijau) + `--primary-hover` / `-active` / `-strong`; ring fokus: `--ring`.
- Status: `--success` (menang/positif), `--warning` (hati-hati), `--destructive` (kalah/batal),
  `--accent` (info/tautan). Ikon status selalu dipasangkan teks — jangan warna saja.
- Papan: `--board-light` / `--board-dark` / `--board-mark`.
- **Motion: satu-satunya durasi = `--move-animation-duration`** (180 ms, didefinisikan di
  `app/realtime.css`; TIDAK di `globals.css` — dev: baca dari sana, jangan duplikat di globals).
  Semua transition/animasi S6 memakai var ini. `prefers-reduced-motion: reduce` →
  semua animasi mati (termasuk confetti & animate-in), state visual tetap ada.
- Ikon: **lucide-react** (aset orisinal, bukan set ikon/emoji chess.com; komponen lama icons3d
  tetap dipakai di modal game-over yang sudah ada, tidak dipaksa ganti).

### 0.2 Copy
Bahasa Indonesia, spesifik, tanpa filler marketing. **Setiap angka/statistik yang tampil
= "riil dari endpoint"** — tidak boleh angka mock/hardcoded di copy. Baris copy di bawah ini
menyebut placeholder `{n}` yang HARUS diisi dari respons API.

### 0.3 A11y floor (DHH, binding)
1. Semua view: skip-link "Lewati ke konten utama" → `#main-content` (sudah ada di shell — jangan patahkan).
2. `aria-label`/label berbahasa Indonesia di semua kontrol baru; pesan status `role="status"` +
   `aria-live="polite"`; error fatal `role="alert"`.
3. CUE GANDA: setiap status/hasil = ikon + teks + (opsional) warna. Tidak ada keadaan yang
   hanya terbaca lewat warna/suara.
4. focus-visible ring (`--ring`) di semua chip/tombol baru; modal = focus trap + fokus awal di CTA utama.
5. Data numerik selalu sebagai teks (angka tampil, bukan sekadar bar/ikon).

### 0.4 Matriks state (format bersama semua tiket)
Kolom: Kondisi | Tampilan | CTA | A11y. Kondisi standar: `loading`, `empty`, `error` (termasuk
503 PG down → pesan generik + "Coba lagi", bukan CTA login — bug G0.3), `pending-auth`
(403 `account_pending` → "Akun menunggu persetujuan admin"), `guest` bila relevan.

### 0.5 Shell: item menu baru (penambahan, bukan redesign S5)
- Grup **Bermain**: item baru `Turnamen` → hash `#/tournaments` (navTab `tournaments`).
- Grup **Berlatih**: item baru `Penjelajah` → `#/explorer`, item baru `Insight` → `#/insights`.
- Deep-link publik: `#/insights/{username}` (tanpa login).
- Ikon lucide per item: Turnamen `Trophy`, Penjelajah `Compass`, Insight `LineChart`
  (nama deskriptif; dev bebas pilih varian lucide, konsisten dengan set yang sudah ada di shell).

---

## 1. S6-T1 — Opening Explorer (`#/explorer`)

**Basis:** `POST /api/opening` sudah ada (FEN lookup, book statis ECO). Yang baru:
endpoint agregat + view. **Tidak ada data chess.com** — statistik dari arsip `games` jev-chess.

### 1.1 Jalur masuk / keluar
- Masuk: sidebar Berlatih → "Penjelajah"; deep-link `#/explorer?eco=C33`;
  dari view review: tombol kecil "Pembukaan ini di Penjelajah" (membawa `opening_name` partai).
- Keluar: sidebar (kembali ke papan main); CTA "Materi" per node hanya tampil bila
  server menandai `hasLessons:true` untuk opening itu (konten kursus = S7; jangan
  tampilkan CTA mati — anti-slop: tombol yang menargetkan halaman kosong dilarang).

### 1.2 Wireframe (papan + panel samping)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Penjelajah Pembukaan                       [lucide: Compass]        │
├───────────────────────────────────────┬─────────────────────────────┤
│ PAPAN (react-chessboard, read-only)   │ PANEL (380–430px)           │
│                                       │ ┌─ Filter ────────────────┐ │
│  posisi node terpilih                 │ │ ECO  [____]             │ │
│                                       │ │ Sisi [Putih|Hitam|Keduanya]│
│                                       │ │ Baris ke- [slider 1–20] │ │
│                                       │ │ Waktu [Kilats|Blitz|Rapid]│
│                                       │ └──────────────────────────┘ │
│ [1. e4 e5 2. Kf3 Nc6 3. Gf4]        │ ┌─ Daftar garis (tree) ────┐ │
│  = jalur SAN node, mono, di atas    │ │ ▸ C33 Giuoco Piano      │ │
│  papan                              │ │   1.e4 e5 2.Kf3 Nc6 3.Gf4│ │
│                                       │   Putih {w}% · Remis {d}% · Hitam {l}% │
│                                       │   dari {n} partai (riil)  │ │
│                                       │  ▾ C50 Italian Game …    │ │
│                                       │ └──────────────────────────┘ │
│ [Hasilkan di papan]  [Materi*]       │  *hanya bila hasLessons     │
└───────────────────────────────────────┴─────────────────────────────┘
Mobile: panel jadi bottom-sheet (pola S1); papan di atas, sheet di bawah.
```

Pemilihan visual:
- Daftar garis = list (bukan tree 3-level) — kedalaman 1 dari baris terpilih cukup
  untuk YAGNI; anak garis di-render saat parent di-expand (lamban).
- Statistik per baris = satu baris teks angka (bukan bar warna) — aman color-blind,
  paling ringkas untuk panel sempit.
- Sample kecil: bila `n < 10`, tampilkan `{n} partai — sampel terlalu kecil untuk
  persentase` alih-alih angka % yang menyesatkan.

### 1.3 Copy (riil dari endpoint, placeholder `{}` diisi API)
- Judul view: "Penjelajah Pembukaan". Sub: "Garis dan hasil dari arsip partai jev-chess."
- Label filter: "Kode ECO" / "Sisi" / "Baris ke-" / "Kategori waktu".
- Baris node: `▸ {eco} {nama}` + jalur `1. e4 e5 …` + `{putih}% Putih · {remis}% Remis · {hitam}% Hitam · {n} partai`.
- Kosong: "Belum ada partai dengan garis ini di arsip." + tombol "Hasilkan di papan"
  (memuat FEN node ke papan analisis/review — jalur keluar bermakna, pola S4-T5).
- Loading: "Mencari garis…" (`role="status"`).
- Error: "Gagal memuat penjelajah. Coba lagi." + tombol "Coba lagi"; bila 503:
  "Server sedang sibuk. Coba beberapa saat lagi."
- Guest: statistik tetap boleh dilihat (data publik); tanpa CTA login paksa.
  Bila endpoint menolak guest → tampilkan "Statistik per garis tidak tersedia untuk tamu."

### 1.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading | papan posisi awal + skeleton daftar garis | — | `role="status"` "Mencari garis…" |
| empty | "Belum ada partai dengan garis ini di arsip." | "Hasilkan di papan" | teks + sr-only hint |
| error/503 | pesan error (§1.3) | "Coba lagi" | `role="alert"` |
| pending-auth | "Akun menunggu persetujuan admin." (bila server 403) | — | `role="status"` + badge status akun (G0.2) |
| guest | book statis + "Statistik … tidak tersedia untuk tamu" | "Masuk untuk statistik" | label tombol jelas |

### 1.5 Catatan a11y
- Node = `<button aria-expanded>`; expand/collapse dengan Enter/Space; urutan Tab mengikuti
  visual; tidak perlu roving tabindex penuh (list sederhana).
- Papan read-only tetap memberi koordinat (aria-label "Papan catur, {n} langkah,
  giliran {warna}") agar SR tidak buta konteks.
- Filter `ECO` = input teks dengan `aria-label="Kode ECO"`; slider = input range dengan
  output teks "Baris ke-{n}" (`<output>`).

### 1.6 Kontrak data (dev)
- `GET /api/explorer?eco=&side=w|b|both&depth=1&tc=bullet|blitz|rapid`
  → `{ rows: [{ eco, name, sanPath, side, wWinPct, drawPct, bWinPct, sampleSize,
  hasLessons, fen }] }` — dihitung server dari `games` (`opening_name` + hasil +
  `time_control`); angka semua riil. Buku statis untuk jalur tanpa partai tetap
  tersedia (`sampleSize: 0`).
- `POST /api/opening` lama tidak berubah.

---

## 2. S6-T2 — Clock Presets di Pairing (gap G2.1)

**Konteks:** `pvp-panel.tsx` saat ini: pilihan sisi (Putih/Hitam/Acak) + undangan
by username + gabung kode; `timeControl: "5+0"` ter-hardcode saat challenge dikirim
(dan `seek` juga memakai TC tetap). Ini tiket: user memilih waktu + rated/casual + warna.

### 2.1 Jalur masuk / keluar
- Masuk: view `play` → panel pairing (PvpPanel, tab "Permainan" dalam Main Online).
  Preset juga muncul di: baris tantangan teman (G5.2, queued S6 — siapkan slot CTA
  "Tantangan (3+2)" yang menerima `timeControl` dari pairing saat S6-G2.3 digarap;
  di S6 cukup: preset disimpan ke `localStorage.jev_tc` sebagai default undangan).
- Keluar: pilihan preset → "Buat kamar" / "Undang" → room aktif; batal (X di chip)
  → kembali ke panel awal. Tidak ada dead-end: preset selalu bisa diubah di panel
  kamar aktif SEBELUM lawan menerima.

### 2.2 Wireframe (panel kanan view play)

```
┌──────────────────────────────────────────────┐
│ PAPAN (kiri, 1fr)        │  PANEL PASERING   │
│                        │ ┌─ Waktu ──────────┐│
│  [posisi menunggu]     │ │ 1+0 │ 3+0 │ 3+2  ││
│  menunggu lawan        │ │ 5+0 │ 10+0│ 15+10 ││
│                        │ │ [Lainnya…]       ││
│                        │ └──────────────────┘│
│                        │ ┌─ Mode ────────────┐│
│                        │ │ [Terbuka|Casual]  ││
│                        │ │ terbuka = rating  ││
│                        │ └───────────────────┘│
│                        │ ┌─ Sisi ────────────┐│
│                        │ │ [Putih|Hitam|Acak] ││
│                        │ └───────────────────┘│
│                        │ [Undang @username]   │
│                        │ [Buat kamar terbuka] │
└──────────────────────────────────────────────┘
Custom ("Lainnya…") → inline: [___ mnt] + [___ dtk] (input number, 1–120 / 0–300)
```

Pemilihan visual:
- **Chip preset, bukan dropdown** — 6 preset muat di 2 baris chip di panel 380px;
  chip = pola `ctl ctl-choice` yang sudah ada di PvpPanel (aria-pressed) — konsisten.
- Default: `3+2` (blitz ringan, seimbang kecepatan vs tekanan) — alasan:
  5+0 lama terlalu longgar untuk pemula tanpa increment, 1+0 terlalu brutal;
  3+2 memberi increment 2s supaya blunder waktu tidak menghukum langsung.
  Dev: simpan pilihan terakhir per user (`localStorage.jev_tc_last`), default awal 3+2.
- "Terbuka/Casual" = toggle dua pilihan `aria-pressed`; label "Terbuka" diganti
  **"Terbuka (rating)"** agar jelas implikasinya: chip terpilih = `Rated`, subteks
  "Rating Anda berubah".
- Custom di balik chip "Lainnya…" (expand inline, bukan modal baru) — modal untuk
  2 input number = fraksi layar berlebih; inline lebih hemat dan menjaga fokus.

### 2.3 Copy
- Label grup: "Waktu" / "Mode" / "Sisi" (`<div class="label">` seperti yang ada).
- Chip: `1+0` `3+0` `3+2` `5+0` `10+0` `15+10` + tooltip via `title`
  ("1 menit tanpa tambahan"). Chip kustom: "Lainnya…".
- Input custom: placeholder `mnt` / `dtk`; tombol "Pakai" (aktifkan), "Batal".
- Validasi: input tak valid → "Format: menit + detik (contoh: 5+0)." `role="alert"`.
- Mode: "Terbuka (rating)" / "Casual"; subteks terbuka: "Rating Anda berubah."
- Panel kamar aktif: "Waktu: {tc} · {mode} · Sisi: {sisi}" + tombol "Ubah waktu"
  (hanya saat `waiting` dan kamu pembuat; setelah lawan join → terkunci, subteks
  "Waktu sudah dikunci").
- Undangan masuk menampilkan TC: "@{user} mengundangnya: {tc}, {mode}" — TC wajib
  terbaca sebelum terima (tidak boleh tersembunyi).

### 2.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading (buat/undang) | chip disabled, tombol "…" | — | `aria-busy` pada panel |
| empty | kamar tidak ada → panel pairing penuh (default) | "Buat kamar" | — |
| error (buat gagal) | "Gagal membuat kamar. {pesan}" | "Coba lagi" | `role="alert"` + batas merah `--destructive` |
| pending-auth | panel terkunci: "Akun menunggu persetujuan admin — fitur PvP belum tersedia." (copy PvpPanel sudah ada, pertahankan) | — | `role="status"` |
| input custom invalid | pesan validasi (§2.3) | "Pakai" disabled | `aria-invalid` + label |

### 2.5 Catatan a11y
- Group "Waktu"/"Mode"/"Sisi" = `fieldsets` + `legend` (sr-only OK) — SR tidak
  kehilangan konteks pilihan tunggal.
- Chip `aria-pressed`; perubahan pilihan mengumumkan "Waktu: 3+2 terpilih" via
  `role="status"` sr-only bila SR aktif (jangan spam untuk mouse user — cukup
  visual; SR-only live region cukup update on-change).
- Input custom: `inputmode="numeric"`; label terlihat ("Menit", "Detik"), bukan placeholder saja.

### 2.6 Kontrak data (dev)
- `POST /api/challenge { toUserId, timeControl, rated }` — `rated` sudah diterima
  (default false); `timeControl` kini bebas dari set 6 preset + custom `\d{1,3}\+\d{1,3}`
  (relaksasi regex backend dari `^\d+\+\d+$` tetap aman; preset dipukul rata di UI).
- `POST /api/seek { tc, mode }` — `mode` kini `rating`|`casual` (mapping ke kolom
  `rated` di pool seek, ADR-001).
- WS: pesan `challenge_received` + `game_added` (ADR-002) membawa field
  `timeControl` + `rated` — layer challenge (S1) wajib menampilkan keduanya.
- Room Pvp (`/api/pvp` create) menambah param `timeControl` + `rated` di request
  `create`; `PvpRoom` menambah field `timeControl?: string` + `rated?: boolean`
  agar panel kamar bisa menampilkan §2.3.

---

## 3. S6-T3 — Abort / Rematch / Offer Draw di Game-Over (gap G2.2)

**Konteks:** `game-over-modal.tsx` saat ini: hasil + akurasi CAPS + rating delta
+ CTA "Review Permainan"/"Kembali ke Lobby"/"PGN", auto-review 2.5 dtk. Yang
baru: (a) abort (resign/lelah) yang benar di PARAGRAF PARING AWAL, (b) rematch
satu-klik, (c) tawarkan remis/flag di dalam modal + di panel permainan aktif.

### 3.1 Jalur masuk / keluar
- Masuk:
  - **Abort (awal)**: panel kamar aktif (`waiting` lawan belum mulai, atau
    `active` langkah < 4) → tombol panel "Tinggalkan" (sudah ada, `onLeave`)
    kini bermakna: room dibatalkan server, status arsip `aborted`, lawan dapat
    WS `room_cancelled`.
  - **Resign (paruh jalan)**: board controls "Menyerah" — **konfirmasi 2 tahap
    (arm → konfirmasi dalam 5 dtk; jika 2 tahap, ini scope S6-G2.4, S6-T3 hanya
    memakai pola 1-klik "Resign → Ya" di panel, tanpa delay). Keputusan scope:
    S6-T3 = tombol "Resign" + dialog konfirmasi modal mini (2 tombol);
    G2.4 (arm 2 tahap di ikon board) = tiket queue.
  - **Rematch / offer draw**: hanya dari GameOverModal (pemenang/peserta) —
    rematch tidak di-offer di tengah partai (anti-slop: tempat naturalnya
    setelah selesai; offer draw di tengah partai = tombol "Remis" di panel
    samping, lawan dapat WS `draw_offer`).
- Keluar: rematch diterima → game baru (sisi tetap, TC sama) → papan langsung;
  ditolak/timeout (30 dtk) → modal ditutup → lobby; resign → GameOverModal
  (hasil `resigned`); abort menunggu → balik ke panel pairing.

### 3.2 Wireframe

Panel samping kamar aktif (mode `waiting` / `active`):
```
┌──────────────────────────────────────────────┐
│ PAPAN              │  PANEL PARTAI           │
│                    │  @{lawan} · {tc}        │
│                    │  [Remis] [Menyerah]     │
│                    │  [Tinggalkan]           │
│  (mode waiting:)   │                          │
│                    │  [Tinggalkan kamar]      │
└──────────────────────────────────────────────┘
```
GameOverModal (struktur S2-T1 dipertahankan, baris aksi ditambah):
```
┌────────────────────────────────────────┐
│ [ikon hasil] Kemenangan / Remis / ...  │
│ Akurasi CAPS (riil) + rating delta     │
│────────────────────────────────────────│
│ [Rematch]          [Tawarkan Remis]   │
│ [PGN]              [Review]           │
│ "Lawan setuju rematch — dimulai"      │
└────────────────────────────────────────┘
Rematch ditolak: "Remis ditolak" (copy: "Rematch ditolak @{user}")
```

### 3.3 Copy
- Panel: "Remis" (offer ke lawan), "Menyerah", "Tinggalkan", "Tinggalkan kamar".
- Konfirmasi resign: "Yakin menyerah? Partai dicatat sebagai kalah."
  [Batalkan] [Ya, Menyerah] — fokus awal di "Batalkan" (default aman).
- Rematch di modal: tombol utama "Rematch" (one-click kirim penawaran,
  bukan langsung mulai); substatus: "Menunggu rematch dari @{user}…"
  (`aria-live="polite"`); hasil: "Rematch diterima — lawan baru mulai." /
  "Rematch ditolak @{user}" / "Tidak ada jawaban (30 dtk)."
- Offer draw: [Remis] → status "Menawarkan remis…" → "Remis diterima" (partai
  berakhir `draw`) / "Remis ditolak" / "Tidak ada jawaban."
- Abort menunggu: "Kamar dibatalkan. Lawan telah diberitahu."
- GameOverModal: semua angka di baris akurasi/rating = riil dari
  `/api/twirp/analysis` + perhitungan rating server (bug yang harus diperbaiki:
  badge ELO sekarang hardcoded "+16/−10/+0" di game-over-modal.tsx — ganti ke
  nilai riil `{delta} rating` dari endpoint; kalau belum tersedia, tampilkan
  "Rating diperbarui" tanpa angka — jangan angka palsu).

### 3.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading (rematch menunggu) | substatus "Menunggu rematch…" | "Tutup" membatalkan menunggu | `aria-live="polite"` |
| empty (belum ada lawan di waiting) | panel kamar + "Bagikan kode {code}" | "Tinggalkan" | — |
| error (WS putus saat rematch) | "Koneksi terputus. Rematch tidak terkirim." | "Coba lagi" | `role="alert"` |
| pending-auth | modal hasil tetap tampil; "Rematch"/"Remis" disabled + subteks "Akun menunggu persetujuan admin." | "Review" tetap aktif | `role="status"` |
| offline lawannya (draw tak dijawab) | "Tidak ada jawaban." | "Kembali ke Lobby" | `aria-live` update |

### 3.5 Catatan a11y
- Konfirmasi resign = dialog (role="dialog", aria-labelledby judul), focus trap,
  Escape = batal (pola fokus paling aman, konsisten modal game-over S2-T1).
- Tombol offer draw & rematch di panel: `aria-pressed` saat status "menawarkan…"
  (tombol dalam state pending, bukan disabled — agar user bisa tahu sedang apa).
- Perubahan status rematch/draw selalu dibacakan (teks sr-only + live region),
  bukan perubahan warna chip saja.
- prefers-reduced-motion: konfetti menang dimatikan; modal tetap muncul tanpa zoom-in.

### 3.6 Kontrak data (dev)
- `POST /api/pvp/rematch { code }` → 201 `{ rematchId }`; lawan dapat WS
  `rematch_offer { code, from }` + timer expire 30 dtk; respons
  `POST /api/pvp/rematch/respond { code, accept }`.
- `POST /api/pvp/draw { code }` + WS `draw_offer { code, from }` +
  `POST /api/pvp/draw/respond { code, accept }` (server menutup room `draw`).
- `POST /api/pvp/cancel { code }` (abort menunggu) → room status `aborted`,
  WS `room_cancelled { code, by }`.
- Tabel `games`: nilai `outcome_kind` baru `aborted` + `resigned` (resigned
  sudah ada) — arsip menampilkan "Dibatalkan" dengan badge `--muted` + ikon
  `CircleSlash` (lucide) + teks (cue ganda, jangan warna saja).
- Fix bug: badge ELO di game-over-modal diganti dari respons
  `/api/match-result` (field `ratingDelta` riil) — angka di modal tidak boleh
  lagi hardcoded.

---

## 4. S6-T4 — Insight: Tren Pemain + Deep-link Publik (`#/insights` & `#/insights/{username}`)

**Konteks:** mirror struktur "Tinjauan/Insight" di peta menu (§4 Berlatih:
filter rating-type, kategori waktu, tampilan [Semua|Warna|Buah|Pemain|Performa
Lampau]). Semua angka dari arsip `games` — **riil dari endpoint**.

### 4.1 Jalur masuk / keluar
- Masuk: sidebar Berlatih → "Insight" (default = pemain sendiri); Papan
  Peringkat → klik baris pemain → `#/insights/{username}` (S4-T3 menyediakan
  hook `onOpenProfile` — arahkan ke deep-link ini); deep-link publik dari luar
  (tanpa login) menampilkan Insight pemain tersebut.
- Keluar: "Papan Peringkat" (kembali ke daftar), "Arsip" (partai lengkap
  pemain tersebut), sidebar. Tidak ada CTA "Undang main" dari Insight
  (undangan sudah ada di friends — satu tempat, bukan tempat kedua). Guest melihat Insight publik tanpa paksaan login
  (data agregat partai = publik, pola leaderboard publik yang sudah ada).

### 4.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ Insight: @{user}            [Papan Peringkat]  [Arsip]  (header CTA)│
├───────────────────────────────────────┬─────────────────────────────┤
│ RINGKASAN (kartu, 1 baris)            │ PANEL TREN                 │
│ Partai {n} · Menang {w} · Kalah {l}   │ Filter:                    │
│ · Remis {d} · Rating {r}              │  Jenis [Terbuka|Casual]    │
│                                       │  Waktu [Semua|Blitz|Kilat]  │
│ [Grafik rating: garis waktu]          │ Tampilan:                  │
│  (riil, titik per partai;            │  [Semua][Warna][Buah]      │
│   min {n} partai untuk tampil)        │  [Pemain][Performa]        │
│                                       │ ┌─ panel hasil ──────────┐ │
│                                       │ │ Warna: Putih {pw}%     │ │
│                                       │ │ Hitam {pb}%            │ │
│                                       │ │ Buah (pembukaan):      │ │
│                                       │ │  Italian {n} partai    │ │
│                                       │ │  {namaTop2} …          │ │
│                                       │ └────────────────────────┘ │
│                                       │ "Performa" = 10 partai     │
│                                       │ terakhir (riil)             │
└───────────────────────────────────────┴─────────────────────────────┘
Mobile: kartu ringkas → panel tren jadi bottom-sheet.
```

Pemilihan visual:
- Layout = **1 kolom atas (ringkas) + panel filter/hasil di kanan** — Insight
  bukan papan, jadi tidak pakai layout board+panel; tetap memakai pola panel
  `panel p-3.5` + chip `ctl ctl-choice` agar koheren dengan PuzzleHub
  (learning-hub.tsx: chip kategori + prev/next) dan leaderboard (chip scope).
- Grafik rating = satu garis SVG (stroke `--accent`), titik = hasil partai
  (● menang `--success`, ○ kalah `--destructive`, ◐ remis `--muted-foreground`)
  — bentuk berbeda, bukan warna berbeda (aman color-blind). Tanpa area-fill:
  garis + titik sudah cukup untuk ≤ 500 partai riil; area-fill menambah
  fraksi visual tanpa informasi.
- Tab Tampilan = 5 tab seperti referensi, TAPI hanya tab yang punya data riil
  yang dirender (tanpa data → tab disembunyikan, bukan tab kosong —
  anti-slop). Default "Semua".
- Kartu ringkas: 4 angka kecil, label teks; tanpa badge "hot"/marketing.

### 4.3 Copy
- Judul: "Insight: @{username}" (diri sendiri: "Insight: Kamu").
- Header CTA: "Papan Peringkat" (kembali), "Arsip" (partai lengkap).
- Label kartu: "Partai" / "Menang" / "Kalah" / "Remis" / "Rating".
- Filter: "Jenis" (Terbuka/Casual), "Kategori waktu" (Semua/Blitz/Kilat),
  "Tampilan" (Semua/Warna/Buah/Pemain/Performa).
- Panel hasil:
  - Warna: "Putih {pw}% · Hitam {pb}% (riil dari {n} partai)".
  - Buah: "Pembukaan yang dipakai: {nama} ({n} partai), {nama2} ({n2})."
    (Top 3, diurut jumlah riil; < 5 partai → "Data pembukaan belum cukup.")
  - Pemain: daftar lawan: "{lawan} — {w}M {l}K {d}R ({n} partai)".
  - Performa: "10 partai terakhir: M K M R …" (ikon hasil per partai + teks
    "Menang/Kalah/Remis" — jangan emoji/ikon saja).
- Rating: "Rating: {r}" (riil dari kolom users; guest yang melihat pemain
  lain tetap bisa lihat rating — data akun publik).
- Empty: "Belum ada partai untuk filter ini." / pemain tanpa partai:
  "@{user} belum punya partai selesai."
- Loading: "Menghitung tren…" (`role="status"`).
- Error: "Gagal memuat Insight. Coba lagi." / 503: "Server sedang sibuk."
- Deep-link salah: "Pemain @{user} tidak ditemukan."

### 4.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading | skeleton kartu + "Menghitung tren…" | — | `role="status"` |
| empty (filter) | "Belum ada partai untuk filter ini." + reset filter | "Reset filter" | `role="status"` |
| empty (pemain) | "@{user} belum punya partai selesai." | "Papan Peringkat" | — |
| error/503 | "Gagal memuat Insight. Coba lagi." | "Coba lagi" | `role="alert"` |
| pending-auth (diri sendiri) | "Akun menunggu persetujuan admin — Insight tampil setelah disetujui." | — | `role="status"` + badge |
| guest melihat pemain lain | data penuh (publik) | "Arsip" | — |

### 4.5 Catatan a11y
- Tab `role="tablist"`/`role="tab"` + `aria-selected` + roving tabindex
  (pola leaderboard yang sudah di-QA-kan di S6 QA-report §2 — konsisten).
- Grafik = `role="img"`, `aria-label="Grafik rating {user}, dari {r0} ke {r1}, {n} partai"`
  + tabel data sr-only (satu baris per partai) — SR tidak harus "melihat" garis.
- Filter mengubah data → update hasil lewat `role="status"`
  ("Tampilan sekarang: Warna").
- prefers-reduced-motion: transisi chip/grafik dimatikan; titik grafik tetap
  ada (tanpa animasi masuk).

### 4.6 Kontrak data (dev)
- `GET /api/insights/{username}?type=&tc=&view=last10`
  → `{ user:{username,rating}, summary:{games,wins,losses,draws,rating}, ratingGraph:[{gameId, ratingAfter, result, endedAt}],
     colorSplit:{whiteWinPct,blackWinPct,sampleSize},
     openings:[{name,count}], opponents:[{username,w,l,d,games}],
     recent:[{result,gameType,endedAt}] (10 terakhir) }` —
  semua angka dihitung dari `games` riil; view tanpa data = array kosong
  (UI memutuskan sembunyikan tab).
- Endpoint publik (bukan `/api/stats` yang hanya milik sesi) — guard:
  pemain harus sudah di-approve untuk tampil (pending → 404, bukan 403,
  agar guest tidak tahu keberadaan akun pending).
- Deep-link di hash router: `#/insights/{username}`; parameter query
  (type/tc/view) ikut di hash sehingga shareable.

---

## 5. S6-T5 — Arena Turnamen (`#/tournaments`)

**Konteks:** mirror struktur "Turnamen-turnamen /play/online/tournaments"
(arena live list). Ini MVP: daftar arena + daftar masuk + tampilan arena
aktif. Tanpa sistem poin kompleks YAGNI (S10).

### 5.1 Jalur masuk / keluar
- Masuk: sidebar Bermain → "Turnamen" (navTab `tournaments`); home task card
  "Turnamen berlangsung" (riil, hanya ada saat ada arena dengan pendaftaran
  terbuka di slot user — tanpa task card kalau tidak ada; anti-slop: jangan
  placeholder tugas).
- Keluar: daftar masuk → arena aktif → "Main" di arena itu → papan
  (room turnamen, TC arena); "Keluar arena" (belum mulai main) → kembali ke
  daftar; setelah ronde selesai → "Papan hasil arena" → keluar ke daftar.

### 5.2 Wireframe

Daftar arena:
```
┌──────────────────────────────────────────────────────────────────────┐
│ Turnamen  [Semua | Tersedia]                                        │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ ⏱ 3+2 (Blitz)   "Torneo Blitz 3+2"         [icon3d: trofi]      ││
│ │ Daftar: {joined}/{capacity} riil   Mulai: 2026-10-27 20:00 WITA ││
│ │ Pendaftaran terbuka                            [Daftar]          ││
│ └──────────────────────────────────────────────────────────────────┘│
│ (kartu berikutnya …)                                                │
└──────────────────────────────────────────────────────────────────────┘
```
Arena aktif (view detail):
```
┌──────────────────────────────────────────────────────────────────────┐
│ Torneo Blitz 3+2            [Keluar arena]                           │
├───────────────────────────────────────┬─────────────────────────────┤
│ PAPAN (riil dari room, read-only     │ RUNDI {r}/{total}            │
│  sampai ronde main)                  │  @lawan · {tc} · {status}   │
│  menunggu ronde: "Menunggu ronde     │  [Main] (aktif saat jadwal) │
│  berikutnya ({menit} mnt)"           │  Papan hasil:               │
│                                       │   1. @u1  {score}           │
│                                       │   2. @u2  {score}           │
│                                       │  (riil, per ronde selesai)  │
└───────────────────────────────────────┴─────────────────────────────┘
```

Pemilihan visual:
- Kartu arena = baris (bukan card besar ber-gradasi) — daftar 3–10 arena
  harus scannable; info kritis (TC, nama, kuota, status daftar) satu baris.
  Tanpa badge "PROMO"/"POPULER" — anti-slop.
- Status kuota: teks "{joined}/{capacity}" riil (riil dari endpoint);
  penuh → CTA diganti status "Penuh" (teks, bukan tombol disabled
  misterius).
- Daftar masuk = satu tombol "Daftar" di kanan kartu; setelah daftar,
  Kartu berubah ke "Terdaftar" (status riil per user).
- Papan hasil: tabel teks sederhana + skor `{wins}.{draws}` (riil per
  ronde selesai); tanpa medali/ikon 3D besar — ini daftar, bukan pesta.

### 5.3 Copy
- Judul view: "Turnamen". Filter chips: "Semua" / "Tersedia".
- Kartu: TC "{tc} · {format}", nama "{nama}", "Daftar: {joined}/{capacity}",
  "Mulai: {tanggal} {jam} WITA" (jam lokal user via `Intl`), status:
  "Pendaftaran terbuka" / "Penuh" / "Terdaftar".
- CTA: "Daftar" / "Berhenti daftar" / "Keluar arena" / "Main".
- Waiting room: "Menunggu ronde berikutnya ({menit} mnt)" (riil dari
  jadwal server); ronde mulai: "Ronde {r} dimulai — @lawan".
- Hasil ronde: "Ronde {r} selesai: {w}M {d}R {l}K — papan diperbarui."
  (`aria-live="polite"`).
- Empty: "Belum ada turnamen terjadwal." / "Tidak ada arena untukmu." / "Arena
  penuh — coba yang lain."
- Loading: "Mengambil arena…" ; Error: "Gagal memuat arena. Coba lagi."
- Guest: daftar arena terbuka, CTA "Daftar" → "Masuk untuk daftar" (hanya
  ini yang ter-login-wall; data agregat publik tetap tampil).

### 5.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading | skeleton 3 kartu + "Mengambil arena…" | — | `role="status"` |
| empty | "Belum ada turnamen terjadwal." | — | — |
| error/503 | "Gagal memuat arena. Coba lagi." | "Coba lagi" | `role="alert"` |
| pending-auth | daftar tampil, "Daftar" → "Akun menunggu persetujuan admin." | — | `role="status"` + badge |
| guest | daftar tampil, "Daftar" → "Masuk untuk daftar" | "Masuk" | label tombol jelas |
| arena penuh | status "Penuh" (bukan tombol mati) | "Tersedia" filter | teks status |
| waiting room (WS) | "Menunggu ronde berikutnya ({menit} mnt)" | "Berhenti menunggu" | `aria-live` countdown (teks, bukan ticker visual) |

### 5.5 Catatan a11y
- Countdown ronde: update teks "Menunggu ronde berikutnya: {mm:ss}" tiap detik
  di live region `polite` — tapi **throttle: hanya setiap 5 detik** untuk
  layar reader (jangan spam); ticker visual di panel (opsional, pakai
  `--move-animation-duration` untuk perubahan warna; `prefers-reduced-motion`
  → ticker tetap, hanya transisi warna dimatikan).
- Kartu arena: seluruh kartu bukan tombol (link ke detail) + tombol aksi
  "Daftar" terpisah (nested interactive = anti-pattern).
- Papan hasil: tabel `role="table"` + `<caption>` sr-only "Papan hasil
  {nama arena}".
- Status full/terbuka = teks eksplisit, bukan chip warna saja.

### 5.6 Kontrak data (dev)
- Tabel baru `tournaments { id, name, tc, format, capacity, starts_at,
  created_at, status }` + `tournament_entries { tournament_id, user_id,
  joined_at, score_w, score_d, score_l, finished }`.
- `GET /api/tournaments?open=1` → daftar + `joined` riil (count entry);
  `POST /api/tournaments/{id}/join` (max capacity, idempotent);
  `DELETE /api/tournaments/{id}/leave`.
- WS event (ADR-002 bus): `tournament_round { tournamentId, round, players,
  startAt }` + `tournament_standings { tournamentId, rows }` — view
  arena aktif reaktif; tanpa WS fallback: poll `GET /api/tournaments/{id}`
  tiap 30 detik (hanya saat tab terlihat, pola dashboard home S1).
- Ruang turnamen memakai room Pvp yang sama (satu mekanik room, flag
  `tournament` di room) — jangan mekanik room terpisah (YAGNI).
- `games` arena: `time_control` = TC arena + kolom `tournament_id` (nullable)
  agar arsip bisa filter "turnamen" di S9.

---

## 6. Catatan lindung (cross-tiket)

- Semua 5 view: `#main-content` tetap target skip-link; view baru di-render
  di main (pola shell S4-T1) — jangan pindahkan ke overlay.
- Motion: tidak ada durasi baru; `--move-animation-duration` satu-satunya.
- Aset: tidak ada aset/teks/ikon chess.com; lucide-react + token + copy ID
  asli. Gambar/emoji chess.com dilarang di wireframe implementasi.
- Angka: semua persentase/rating/kuota di copy = riil dari endpoint
  (kontrak §x.6); bila data < 10 sampel, tampilkan kalimat sampel-kecil,
  jangan persentase palsu.
- Gating: guest boleh lihat data agregat publik (explorer, insight, daftar
  arena); login wall hanya di aksi (daftar arena, bikin kamar, rematch).
  `account_pending` → pesan + badge, bukan CTA login palsu (G0.1–G0.3).
- Regresi: view lama (PvpPanel, GameOverModal, leaderboard hook
  `onOpenProfile`) tetap berfungsi; TL regression-first per S6-sprint-plan.
