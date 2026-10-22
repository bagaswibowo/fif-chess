# Desain Sprint 3 — Teka-Teki: Solve Mode, Daily, Rush, & Tema Mastery

**Tiket:** S3-T1 (G8) · S3-T2 (G10) · S3-T3 (G9) · S3-T4 (G8b) · **Sprint:** 3 · **Peran:** Design
**Status:** Draft untuk review · **Tidak berisi kode** — spesifikasi visual & interaksi saja.

Semua token mengacu ke `app/globals.css` (Chess.com Dark Mode Standards v1.1): charcoal `#312e2b`, panel `#262421`, aksi hijau `#81b64c` (box-shadow `0 4px 0 #45753c`), wood light `#f0d9b5` / wood dark `#b58863`. **Tidak ada palet baru** — merah/gold/teks abu mengikuti token error, highlight, dan teks existing. Ikon memakai set **icons3d** (vektor 3D, tanpa emoji). Semua animasi memakai satu var `--move-animation-duration: 180ms`. Layout desktop board kiri / panel kanan; mobile memakai **bottom-sheet** yang tidak menutupi papan penuh (pola Sprint 1).

Referensi UX terverifikasi: `~/projects/active/chess-web/rea/chess-web-ui-ux-analysis.md` §5 (hub + solve mode) dan §6 (Rush).

---

## 1. S3-T1 — Puzzle Solve Mode (`/puzzles`)

### 1.1 Prinsip

- Solve mode adalah **board-first**: papan aktif (`id=board-primary`), panel kanan sekunder.
- Validasi langkah real-time vs `solution_moves` (UCI→SAN, chess.js) — bukan tombol "Kirim".
- Lanjut otomatis setelah benar; salah → retry di posisi yang sama (puzzle tidak berganti).
- Streak adalah metrik emosi utama — selalu terlihat di panel, tidak pernah di atas papan.

### 1.2 Layout

```
DESKTOP (board kiri, panel kanan)
┌─ papan (wood) ──────────┐ ┌─ Panel Solve ───────────────────────┐
│                         │ │ ── Streak ───────────────────────── │
│   id=board-primary      │ │  [ikon 3D api/streak]  5            │
│   puzzle side-to-move   │ │  "Beruntun"  (reset saat salah)     │
│                         │ │ ── Status ───────────────────────── │
│  benar: lawan auto-reply│ │  aria-live="polite":                │
│  (animasi 180ms)        │ │  "Langkah benar — lawan menjawab…"  │
│  salah: board shake     │ │ ── Info puzzle ──────────────────── │
│  (shake 180ms, sekali)  │ │  Rating puzzle · Rating teka-teki   │
│                         │ │ ── Aksi ─────────────────────────── │
│                         │ │  [Petunjuk]   (ghost/outline)       │
│                         │ │  [Teka-Teki Berikutnya] (hijau,     │
│                         │ │   hanya muncul setelah benar)       │
└─────────────────────────┘ └─────────────────────────────────────┘

MOBILE (≤ 768px)
  papan fullscreen atas; panel solve menjadi bottom-sheet
  (tinggi maks ±40% viewport, papan tetap terlihat & interaktif);
  tombol Petunjuk & Berikutnya sticky di dalam sheet.
```

### 1.3 Hint flow (Petunjuk)

1. Klik [Petunjuk] → highlight **bidak pertama solusi** (dari `solution_moves[0]`) dengan ring warna highlight existing pada kotak asal — **tanpa** mengungkap kotak tujuan.
2. Hint kedua (klik ulang) → tambahkan indikasi arah: garis/panah tipis warna highlight dari kotak asal ke arah tujuan (tanpa kotak tujuan menyala penuh).
3. Maksimal 2 level hint; penggunaan hint **tidak merusak streak** (konsisten dengan chess.com — hint bukan kegagalan), tapi puzzle dengan hint ditandai di attempts.
4. Hint hanya tombol ghost — tidak pernah CTA hijau, agar user didorong mencoba dulu.

### 1.4 Feedback benar/salah

| Event | Visual | Audio/haptic opsional |
|---|---|---|
| Langkah benar (bukan langkah terakhir) | Bidak lawan **auto-reply** dengan animasi durasi `--move-animation-duration` (180ms); panel status aria-live "Lawan menjawab…" | — |
| Puzzle selesai (benar terakhir) | Ring hijau halus di sekeliling papan (border token success existing) + tombol [Teka-Teki Berikutnya] muncul (slide 180ms); streak counter +1 dengan animasi scale singkat | — |
| Langkah salah | **Board shake** (translate-x ±4px, 180ms, satu siklus) + bidak kembali ke kotak asal; streak **reset ke 0** dengan transisi angka; status aria-live "Langkah salah — coba lagi" | — |

- Setelah 3 kegagalan berturut pada puzzle yang sama: tawaran lembut di panel — "Lewati teka-teki ini?" (ghost) — lanjut ke puzzle baru tanpa hukuman tambahan selain streak 0.

### 1.5 Upsell ke Rush saat idle (pola chess.com §5)

- Trigger: user idle **±20 detik** setelah puzzle selesai (belum klik "Berikutnya") ATAU setelah 3 lewati beruntun.
- Bentuk: kartu kecil di bagian bawah panel (bukan modal, bukan interstisial):
  ```
  ┌──────────────────────────────────────────┐
  │ [ikon 3D petir/kilat]                    │
  │ Ingin yang lebih cepat?                  │
  │ Coba Teka-Teki Gegas — lawan waktu,      │
  │ selesaikan sebanyak mungkin.             │
  │ [Coba Teka-Teki Gegas]  (hijau, compact) │
  └──────────────────────────────────────────┘
  ```
- Kartu auto-dismiss saat user berinteraksi kembali dengan papan; tidak muncul lagi dalam sesi yang sama setelah 2 kali tampil (anti-jengkel).

### 1.6 Edge cases

| Kasus | Perilaku |
|---|---|
| Puzzle sudah pernah dijawab benar oleh user | `GET next` tidak mengembalikannya; UI tidak perlu state "sudah dikerjakan" |
| Gagal fetch puzzle berikutnya | Panel state skeleton 1x retry; gagal → "Gagal memuat teka-teki" + [Coba Lagi] ghost |
| User refresh di tengah puzzle | Puzzle baru dimuat (tanpa resume — YAGNI), streak diambil dari server |
| Drag bidak ke kotak ilegal | Papan menolak senyap (no shake — shake hanya untuk jawaban salah yang legal secara aturan papan) |

---

## 2. S3-T2 — Daily Puzzle (`/daily`)

### 2.1 Prinsip

- Satu puzzle per tanggal **UTC**, sama untuk semua user (rotasi deterministic server-side).
- Solve interaction identik dengan §1 (reuse puzzle-solver, mode single-puzzle); yang unik hanya **date navigator** dan **Bagikan**.

### 2.2 Date navigator (header, di atas panel)

```
┌────────────────────────────────────────────────┐
│  [←]  Kamis, 22 Okt 2026          [→ disabled] │
│   Hari Sebelumnya              Hari Berikutnya │
└────────────────────────────────────────────────┘
```

- `[←]` / `[→]` = tombol ikon ikon3d panah, ghost/outline; label teks di sampingnya di desktop, ikon saja di mobile (aria-label tetap "Hari Sebelumnya"/"Hari Berikutnya").
- **Hari Berikutnya disabled** bila target > hari ini UTC (opacity token disabled, `aria-disabled`, tidak bisa fokus-klik) — masa depan tidak boleh dilihat.
- Transisi pergantian tanggal: papan cross-fade 180ms (`--move-animation-duration`); URL sync `?date=YYYY-MM-DD` agar shareable.
- Sudah selesai hari itu → banner di panel: "Sudah selesai hari ini ✅ — lihat solusi atau kembali besok." (ikon ikon3d centang, bukan emoji; tombol [Mainkan Teka-Teki Lain] hijau ke `/puzzles`).

### 2.3 Streak harian & Bagikan

- Streak harian tampil di panel: "Streak harian: 3 hari" (ikon ikon3d kalender/api).
- Tombol **[Bagikan]** (hijau, di bawah navigator): salin ke clipboard via `navigator.clipboard`, format:
  `Jev Chess Daily 22 Okt 2026: ✅ 1/1` — plus toast non-blocking "Hasil disalin" (pola toast Sprint 1, bukan alert).
- Gagal clipboard (permission) → fallback: teks hasil ditampilkan di modal kecil untuk copy manual.

### 2.4 Edge cases

| Kasus | Perilaku |
|---|---|
| `?date=` masa depan | Ditolak server (400); UI menampilkan state "Tanggal belum tersedia" + tombol kembali ke hari ini |
| Zona waktu user bukan UTC | Label tanggal ditampilkan dalam UTC dengan catatan halus "Waktu UTC" di bawah navigator (konsistensi rotasi) |
| Belum ada puzzle di band 1200–1800 | Fallback band diperluas (server-side); UI tidak berubah |

---

## 3. S3-T3 — Puzzle Rush (`/puzzles/rush`)

### 3.1 Prinsip (REA §6)

- Kontrak permainan dijelaskan **SEBELUM mulai** — 3 baris aturan eksplisit, bukan modal yang bisa di-skip tanpa dibaca.
- Timer, strike, dan skor dihitung server-side; UI hanya mirror.

### 3.2 Pre-game screen

```
┌─ Teka-Teki Gegas ─────────────────────────────┐
│                                               │
│  [ikon 3D petir besar, aksen hijau]           │
│                                               │
│  Aturan:                                      │
│  1. Selesaikan teka-teki sebanyak mungkin.    │
│  2. Dimulai dari yang mudah dan akan          │
│     bertambah sulit.                          │
│  3. Jika gagal menjawab 3 kali, berakhir.     │
│                                               │
│  Durasi:  [3 menit | 5 menit | Sintasan]      │
│           └─ chips: terpilih = hijau,         │
│              tidak = ghost/outline            │
│                                               │
│  [Kembali]   [ Bermain ]   [Papan Peringkat]  │
│    ghost       hijau          ghost           │
└───────────────────────────────────────────────┘
```

- Chips durasi: satu var `--move-animation-duration` untuk transisi state terpilih. "Sintasan" (endless) = tanpa timer.
- [Papan Peringkat] membuka panel/leaderboard sebagai bottom-sheet di mobile, panel slide di desktop.

### 3.3 In-game HUD

```
DESKTOP: HUD strip di atas papan (full width papan)
┌───────────────────────────────────────────────────┐
│  ⏱ 02:14   |   Skor: 7   |   ♥ ♥ ♥   |  [Berhenti]│
│  (timer ikon3d)         (3 strike indicator)      │
└───────────────────────────────────────────────────┘

MOBILE: HUD strip sticky di atas, ikon + angka kompak.
```

- **Timer**: angka besar `--text-2xl`, warna teks normal; **≤30 detik** → warna token error existing + pulse ringan 180ms per detik (bukan berkedip agresif). Endless: timer diganti ikon ∞ ikon3d + hitungan naik.
- **Skor**: naik dengan animasi scale singkat (180ms) tiap benar.
- **3 strike indicator**: tiga ikon hati ikon3d. Salah → satu hati berubah menjadi ikon hati-patah/redup dengan animasi scale-down 180ms. 2 strike tersisa → hati terakhir diberi ring token error (peringatan). Tanpa emoji.
- **Feedback instan** identik §1.4 (auto-reply lawan saat benar, board shake saat salah) — puzzle berikutnya langsung slide in, tanpa layar antara.
- [Berhenti] ghost — konfirmasi inline kecil ("Akhiri sesi? [Ya | Lanjut]") bukan modal blokir.

### 3.4 End screen

```
┌─ Game Over ───────────────────────────────────────┐
│  [ikon 3D trofi/petir]                            │
│  Skor: 12                                         │
│  Rekor pribadi baru!  (bila beat rush_best)       │
│  ─ atau ─ Rekor pribadi: 15                       │
│                                                   │
│  ── Papan Peringkat (top 20, window harian) ──    │
│  1. <user> — 20     ← baris user di-highlight     │
│     …            warna highlight existing         │
│                                                   │
│  [Main Lagi]  (hijau)      [Kembali]  (ghost)     │
└───────────────────────────────────────────────────┘
```

- Aliran berakhir: timer habis ATAU strike ke-3 → transisi 180ms (fade papan) → end screen; fokus keyboard otomatis ke [Main Lagi].
- Skor ikut rekap user (attempts terekam di `puzzle_attempts`).

### 3.5 Edge cases

| Kasus | Perilaku |
|---|---|
| Salah ke-3 tepat saat timer habis | Game over tetap tunggal — strike dicek dulu server-side, satu end screen |
| Koneksi putus di tengah sesi | HUD menampilkan "Koneksi terputus" + [Coba Lagi]; sesi hangus (state in-memory), skor terakhir yang tersimpan di server yang dipakai |
| Endless: user menutup tab | Tidak ada skor (sesi belum diakhiri eksplisit) — aturan ini tertera kecil di pre-game screen endless |

---

## 4. S3-T4 — Tema Mastery (`/puzzles/learning`)

### 4.1 Prinsip

- Grid 26 tema (key Lichess → label Indonesia dari `THEME_LIST`), mastery = % puzzle tema yang sudah dijaw benar (capped 100).
- Halaman list-first, bukan board-first: papan hanya muncul setelah memilih tema/filter (masuk solve mode §1 dengan `?theme=`).

### 4.2 Grid tema

```
┌─ Filter ─────────────────────────────────────────┐
│  [Select: Semua Tema ▾]  Rating: [800] – [2200]  │
│   (select existing)       (number inputs)        │
├──────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │[ikon3d mate] │ │[ikon3d garpu]│ │[ikon3d…]  │ │
│  │ Skemat       │ │ Garpu        │ │ Pin       │ │
│  │ ▓▓▓▓▓▓▓▓░░ 78%│ │ ▓▓▓▓░░░░░░ 42%│ │ ▓░░ 5%   │ │
│  └──────────────┘ └──────────────┘ └───────────┘ │
│  … (grid 2 kolom mobile, 3–4 kolom desktop)      │
└──────────────────────────────────────────────────┘
```

- Progress bar: track warna panel existing, fill warna hijau `#81b64c`, radius penuh, tinggi ±6px; teks % **selalu** di samping bar (bukan hanya di dalam bar).
- Baris user paling relevan tidak ada — semua kartu setara; urutan default: progress tertinggi → terendah (mendorong melengkapi).
- Kartu tema → klik → masuk solve mode tema itu (rating mengikuti filter number inputs).
- Ikon tema: ikon3d kustom per tema (26 ikon vektor, satu gaya, aksen wood/hijau); tema tanpa ikon khusus memakai ikon generik kuda.

### 4.3 Edge cases

| Kasus | Perilaku |
|---|---|
| Tema dengan 0 attempt | Progress bar kosong + label "0%" (bukan "—") — konsisten dan mendorong mulai |
| Semua puzzle tema sudah benar | Bar penuh 100% + ikon centang kecil ikon3d di kartu |
| Filter rating tidak punya puzzle | Kartu tema tetap tampil; saat masuk latihan → panel state "Tidak ada teka-teki di rentang ini" + [Sesuaikan Filter] ghost |
| Number input min > max | Input min clamp otomatis; tombol latihan disabled dengan tooltip "Rentang rating tidak valid" |

---

## 5. Matriks State Visual (token existing — tanpa palet baru)

| State | Surface | Aksen | Text | Motion |
|---|---|---|---|---|
| Idle / default | panel `#262421` | border `#3d3a34` | teks utama existing | — |
| CTA utama (Bermain / Berikutnya / Bagikan / Main Lagi) | hijau `#81b64c` | box-shadow `0 4px 0 #45753c` | putih | press: shadow menyusut, 180ms |
| Sekunder / ghost (Petunjuk, Kembali, Lewati) | transparan | border `#3d3a34` | teks sekunder | hover: bg subtle existing |
| Benar (puzzle selesai / streak naik) | panel | ring/border token success existing | teks utama | scale 180ms pada counter |
| Salah (langkah salah / strike) | panel | token error existing | teks utama | board shake 180ms sekali |
| Peringatan (≤30s timer, 1 hati tersisa) | panel | token error existing | angka timer error | pulse ringan per detik |
| Loading / fetch puzzle | skeleton (panel + shimmer existing) | — | — | shimmer existing |
| Disabled (Hari Berikutnya future, filter invalid) | — | opacity token disabled | teks disabled | none |
| Terpilih (chip durasi, tema aktif) | hijau `#81b64c` | — | putih | transisi 180ms |
| Highlight hint (kotak asal / arah) | papan | token highlight existing | — | fade-in 180ms |

---

## 6. Copy Indonesia (final, per komponen)

**Solve mode**
- Panel streak: `Beruntun` / angka; reset: angka turun ke `0` tanpa copy hukuman.
- Status aria-live: `Giliranmu — cari langkah terbaik.` / `Langkah benar — lawan menjawab…` / `Puzzle selesai!` / `Langkah salah — coba lagi.`
- Tombol: `Petunjuk` · `Teka-Teki Berikutnya` · `Lewati teka-teki ini?`
- Hint level 2 caption: `Arah langkah terlihat — targetnya tetap rahasia.`
- Upsell: `Ingin yang lebih cepat?` / `Coba Teka-Teki Gegas — lawan waktu, selesaikan sebanyak mungkin.` / tombol `Coba Teka-Teki Gegas`
- Error fetch: `Gagal memuat teka-teki.` / tombol `Coba Lagi`

**Daily**
- Navigator: `Hari Sebelumnya` · `Hari Berikutnya` (aria-label; tanggal tampil `Kamis, 22 Okt 2026`).
- Catatan UTC: `Waktu UTC`
- Solved banner: `Sudah selesai hari ini — lihat solusi atau kembali besok.` / `Mainkan Teka-Teki Lain`
- Share: `Jev Chess Daily 22 Okt 2026: ✅ 1/1` · toast `Hasil disalin`
- Streak harian: `Streak harian: N hari`
- Future date: `Tanggal belum tersedia.`
- Belum tersedia: `Belum tersedia — kembali besok.`

**Rush**
- Aturan (verbatim 3 baris): `1. Selesaikan teka-teki sebanyak mungkin.` / `2. Dimulai dari yang mudah dan akan bertambah sulit.` / `3. Jika gagal menjawab 3 kali, berakhir.`
- Chips: `3 menit` · `5 menit` · `Sintasan`
- Tombol: `Bermain` · `Kembali` · `Papan Peringkat` · `Berhenti`
- HUD: timer `mm:ss`; endless `∞`; `Skor: N`; aria hati: `Kesempatan tersisa: 2 dari 3`
- Konfirmasi berhenti: `Akhiri sesi?` / `Ya` / `Lanjut`
- Disconnect: `Koneksi terputus.` / `Coba Lagi`
- End: `Game Over` / `Skor: N` / `Rekor pribadi baru!` / `Rekor pribadi: N` / `Main Lagi` / `Kembali`
- Catatan endless pre-game: `Menutup tab mengakhiri sesi tanpa menyimpan skor.`

**Tema Mastery**
- Filter: `Semua Tema` / label `Rating` / placeholder `800`–`2200`
- Kartu: `<Nama Tema Indonesia>` + `%` ; 0 attempt: `0%`; complete: `100%`
- Empty filter: `Tidak ada teka-teki di rentang ini.` / `Sesuaikan Filter`
- Invalid range tooltip: `Rentang rating tidak valid`

---

## 7. Checklist A11y (floor — semua halaman Sprint 3)

- [ ] Semua status dinamis (benar/salah/hint/streak/timer kritis) diumumkan via `aria-live="polite"` — papan tidak fokus otomatis saat announce.
- [ ] Board shake & animasi lain dihormati `prefers-reduced-motion` (shake → flash border error statis 180ms; auto-reply tetap, tanpa transisi).
- [ ] Semua ikon ikon3d murni dekoratif punya `aria-hidden`; ikon fungsional (panah navigator, hati strike, timer) punya `aria-label` Indonesia.
- [ ] Strike indicator: teks visual "♥ ♥ ♥" **plus** `aria-label="Kesempatan tersisa: N dari 3"` yang di-update per strike.
- [ ] Timer ≤30s disampaikan sekali via aria-live (bukan tiap detik — spam screen reader).
- [ ] Progress bar tema: `role="progressbar"` dengan `aria-valuenow/min/max` **plus** teks % yang terbaca (bukan hanya fill visual).
- [ ] Navigator tanggal: tombol future pakai `aria-disabled="true"` + `tabindex` tetap (bukan `disabled` murni) agar screen reader mendengar alasnya, dengan `aria-describedby` penjelas "Tanggal masa depan belum tersedia".
- [ ] End screen Rush: fokus keyboard pindah otomatis ke [Main Lagi]; urutan tab logis (skor → leaderboard → CTA).
- [ ] Semua CTA hijau kontras ≥ 4.5:1 dengan teks putih (token existing sudah memenuhi — jangan tint).
- [ ] Bottom-sheet mobile: `role="dialog"` saat modal-like, trap fokus di dalam sheet, Esc/klik-luar menutup, papan di belakang tetap `aria-hidden` sementara sheet aktif.
- [ ] Copy share clipboard disertai umpan balik non-visual (aria-live "Hasil disalin"), bukan hanya toast visual.
- [ ] Hint tidak pernah satu-satunya jalur informasi: solusi tetap dapat dicapai tanpa hint (hint = bantuan, bukan gate).
