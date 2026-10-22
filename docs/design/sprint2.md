# Desain Sprint 2 — Auto Review, Arsip Game, & Analysis Fast-path

**Tiket:** S2-T1 (G5) · S2-T2 (G11) · S2-T4 (G7) · **Sprint:** 2 · **Peran:** Design
**Status:** Draft untuk review · **Tidak berisi kode** — spesifikasi visual & interaksi saja.

Semua token mengacu ke `app/globals.css` (Chess.com Dark Mode Standards v1.1): charcoal `#312e2b`, panel `#262421`, aksi hijau `#81b64c` (box-shadow `0 4px 0 #45753c`), wood light `#f0d9b5` / wood dark `#b58863`. **Tidak ada palet baru** di dokumen ini — merah/gold/teks abu mengikuti token error, highlight, dan teks yang sudah ada. Ikon memakai set **icons3d** (vektor 3D, tanpa emoji). Semua animasi memakai satu var `--move-animation-duration: 180ms`.

---

## 1. S2-T1 — Flow End-game → Auto Review

### 1.1 Prinsip

- Modal hasil (`game-over-modal.tsx`) **tidak lagi dead-end**: CTA utama langsung masuk review.
- Auto-redirect hanya untuk **pemain** (bukan spectator) — spectator melihat modal hasil tanpa CTA review otomatis, hanya tombol "Lihat Analisis" manual.
- Dua jalur masuk review, mana yang lebih dulu:
  1. **Timer 2.5s** setelah `status` finished (event realtime topik game/presence existing), ATAU
  2. **Modal ditutup** oleh user (klik CTA maupun backdrop/Esc).
- Destinasi tunggal: `/analysis/[gameId]?tab=review`.

### 1.2 Flow utama

```
Game finished (realtime: status → finished)
  → game-over-modal terbuka, fokus keyboard di tombol pertama [Review Permainan]
  │
  ├─ PEMAIN
  │   ┌───────────── game-over-modal ─────────────┐
  │   │  [ikon 3D: raja terbaring, aksen wood]    │
  │   │  "Kemenangan!" / "Kekalahan" / "Remis"    │
  │   │  <ringkasan hasil + lawan>                │
  │   │                                           │
  │   │  ┌─────────────────────────────────────┐  │
  │   │  │  Review Permainan   (hijau #81b64c) │  │  ← CTA utama
  │   │  └─────────────────────────────────────┘  │
  │   │  Kembali ke Lobby       (ghost/outline)   │  ← sekunder
  │   └───────────────────────────────────────────┘
  │   → auto-redirect ke /analysis/[gameId]?tab=review setelah 2.5s
  │     ATAU saat CTA/modal ditutup (mana yang dulu)
  │   → countdown halus di bawah CTA: "Membuka review…" (teks, bukan spinner penuh)
  │
  └─ SPECTATOR
      modal sama TANPA timer auto-redirect;
      CTA "Lihat Analisis" (hijau, manual) + "Kembali ke Lobby"
```

### 1.3 Halaman Review (`/analysis/[gameId]?tab=review`)

```
DESKTOP (board kiri, panel kanan)
┌─ papan (wood) ──────────┐ ┌─ Panel Review ──────────────────────┐
│                         │ │ Tab: [Ringkasan | Review | Langkah] │
│                         │ │                                     │
│                         │ │ ── Ringkasan akurasi per pemain ──  │
│                         │ │ ── Daftar blunder/kesalahan besar ──│
│                         │ │   (klik → papan lompat ke langkah)  │
│                         │ │ ── Commentary ───────────────────── │
│                         │ │ [ikon 3D speaker] coach audio       │
│                         │ │  ┌──────────────────────────┐       │
│                         │ │  │ ▶/⏸  "Di langkah 23…"    │       │
│                         │ │  └──────────────────────────┘       │
│                         │ │  [ikon 3D speaker-silang] = MUTE    │
└─────────────────────────┘ └─────────────────────────────────────┘
```

- **Coach audio**: satu toggle mute/play. State disimpan di `localStorage` (key preferensi mute, persist lintas sesi). Saat mute, ikon berganti speaker-silang + baris commentary tetap tampil sebagai teks.
- **Idempoten**: review membaca `analysis_results` (UNIQUE game_id) — jika sudah ada, langsung render; refresh tidak memicu analisis kedua.
- **Error engine**: state khusus (lihat §4.1), bukan JSON palsu.

### 1.4 Edge cases

| Kasus | Perilaku |
|---|---|
| Analisis belum selesai saat user tiba | Panel review menampilkan state LOADING (skeleton) sampai pipeline selesai |
| Engine gagal | Panel → state ERROR dengan copy §5.1 + tombol "Coba Lagi" (ghost) |
| Refresh halaman review | Membaca row existing, tanpa INSERT kedua (1 row per game_id) |
| User menutup modal sebelum 2.5s | Redirect terjadi saat penutupan (tak dobel) |
| Game vs bot / casual | Review tetap tersedia; delta rating disembunyikan bila tidak ada snapshot |

---

## 2. S2-T2 — Wireframe Arsip Game (`/games/archive`)

### 2.1 Prinsip (dari analisis chess-web §11)

- Filter tabs persis pola chess.com: `[Semua | Favorit | Live | Harian | Bot | Coach]` — **counter total per tab** di samping label.
- Satu row per game, semua aksi per row; delta rating **±** dengan tanda benar (+ hijau token aksi, − token teks sekunder/mute).
- Checkbox untuk **bulk PGN** (digabung client-side, satu file multi-game, bukan zip).

### 2.2 Wireframe desktop

```
┌─ /games/archive ────────────────────────────────────────────────────────┐
│  Arsip Permainan                                                        │
│                                                                         │
│  [Semua 128] [Favorit 12] [Live 96] [Harian 8] [Bot 20] [Coach 4]       │
│   ──────── (tab aktif: underline hijau, teks putih; lain: teks abu)     │
│                                                                         │
│  [☐ Pilih semua di tab ini]        [Unduh PGN Terpilih (n)] ← muncul    │
│                                       hanya saat n ≥ 1                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ ☐ │ ⬤ │ lawan_A (1543)  ±N  │ 1–0 │ Menang  +12 │ 21 Okt │ ⭐ ⤓ ▶ │  │
│  │ ☐ │ ⬤ │ lawan_B (1601)  ±N  │ ½–½ │ Remis    0  │ 20 Okt │ ⭐ ⤓ ▶ │  │
│  │ ☐ │ ⬤ │ lawan_C (1498)  ±N  │ 0–1 │ Kalah   −9  │ 18 Okt │ ⭐ ⤓ ▶ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│   kolom: checkbox · warna bidak kita (putih/hitam) · lawan (nama+rating)│
│          + time control ("10+0") · skor · hasil & delta rating · tanggal│
│          · aksi [Favorit | Unduh PGN | Analisis]                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Aksi per row (ikon icons3d, masing-masing aria-label)

| Ikon | Aksi | Perilaku |
|---|---|---|
| ⭐ (bintang 3D) | Favorit | Toggle **optimistic** (<200ms perceived), persist server; bintang terisi hijau saat favorit |
| ⤓ (unduh 3D) | Unduh PGN | `GET /api/games/[id]/pgn` → file `.pgn` satu game |
| ▶ (play/analytics 3D) | Analisis | Link ke `/analysis/[gameId]?tab=review` (S2-T1) |

### 2.4 Mobile variant (≤ 768px)

```
  Tab filter → scroll horizontal, snap; counter tetap terlihat
  ┌─────────────────────────────────────┐
  │ ⬤ lawan_A (1543) · 10+0       ⭐    │
  │ 1–0 Menang +12 · 21 Okt             │
  │ [⤓ PGN]              [▶ Analisis]   │
  ├─────────────────────────────────────┤
  │ ⬤ lawan_B (1601) · 5+3        ☆    │
  │ ½–½ Remis 0 · 20 Okt                │
  │ [⤓ PGN]              [▶ Analisis]   │
  └─────────────────────────────────────┘
```

- Checkbox bulk di mobile diganti **mode pilih**: tautan "Pilih" di header → checkbox muncul di tiap row + bar aksi sticky bawah "Unduh PGN (n) · Batal".
- Row adalah elemen fokusable tunggal; aksi ikon tetap tombol terpisah di dalamnya.
- List pakai **bottom-sheet** tidak diperlukan di sini (halaman penuh), tetapi detail game bila ditambahkan nanti mengikuti pola bottom-sheet existing.

### 2.5 Edge cases

| Kasus | Perilaku |
|---|---|
| Tab kosong | Empty state: ikon 3D + copy §5.2, tanpa spinner |
| Toggle favorit gagal (network) | Rollback visual + toast error inline |
| Delta rating tidak ada snapshot | Sel delta "—" (bukan 0) |
| Bulk download 0 dipilih | Tombol disable; saat ≥1: label "Unduh PGN (n)" |
| Pagination | Cursor `ended_at`, tombol "Muat lebih banyak" di akhir list (bukan infinite scroll — hemat a11y) |

---

## 3. S2-T4 — Paste Bar Analysis (G7)

### 3.1 Posisi & struktur

Satu input universal di **halaman `/analysis`, paling atas** (di atas kartu entri), persis pola chess.com §7. Power users maksimal 2 klik.

```
┌─ /analysis ─────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────┐ ┌────────┐ │
│ │ Tempel PGN, FEN, atau tautan game internal…      │ │Analisis│ │
│ └──────────────────────────────────────────────────┘ └────────┘ │
│  ↳ pesan inline di bawah bar (loading / error / sukses)         │
│                                                                 │
│ [kartu entri existing…]                                         │
└─────────────────────────────────────────────────────────────────┘
```

- **Textarea 1 baris** (auto-grow maks 2 baris) + tombol hijau **"Analisis"** (`#81b64c`, shadow `0 4px 0 #45753c`). **Enter = submit**; Shift+Enter = baris baru.
- Placeholder: `Tempel PGN, FEN, atau tautan game internal…`
- **Deteksi otomatis**: FEN (6 field, dipisah spasi) → board langsung posisi itu; PGN (header tags + movetext) → board posisi awal + movelist terisi; URL internal `/analysis/[gameId]` → redirect (link eksternal = out of scope).
- Fast-path memakai **jalur analisis existing 100%** (`api/analysis`) — hanya pintu masuk baru.

### 3.2 State bar

| State | Visual |
|---|---|
| IDLE | Border token border existing; fokus: ring focus token (a11y floor) |
| PARSING/LOADING | Bar disabled + spinner kecil di dalam tombol; teks tombol "Memproses…"; `aria-busy="true"` pada bar |
| SUCCESS FEN | Bar kosong, fokus kembali ke bar; papan langsung menampilkan posisi; toast halus "Posisi dimuat" |
| SUCCESS PGN | Board + movelist terisi; bar kosong |
| ERROR | Border token error; pesan inline merah (aria-live=polite) di bawah bar, teks input tetap utuh agar bisa diperbaiki; fokus pindah ke pesan error |

### 3.3 Error copy (Indonesia spesifik — bukan generik)

| Trigger | Copy |
|---|---|
| Input kosong / whitespace | "Masukkan PGN atau FEN terlebih dahulu." |
| Tampak FEN tapi struktur salah | "FEN tidak valid — pastikan formatnya 6 bagian dipisah spasi (mis. `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`)." |
| Tampak PGN tapi movetext rusak | "PGN tidak valid — gerakan tidak bisa dibaca. Periksa movetext atau tempel ulang PGN lengkap dengan header." |
| FEN illegal (posisi mustahil, raja kena/dua raja, pion di rank 1/8) | "FEN tidak valid — posisi papan tidak mungkin terjadi dalam permainan catur." |
| PGN header ada tapi tanpa langkah | "PGN tidak berisi langkah apa pun." |
| Tautan ditempel bukan internal | "Hanya tautan game internal yang didukung. Gunakan PGN atau FEN." |
| Paste sampah total | "Input tidak dikenali. Tempel PGN, FEN, atau tautan game internal." |

---

## 4. State Visual Komponen (token existing)

### 4.1 Matriks state umum

Semua komponen di bawah mengikuti varian tombol existing: **primary** (hijau `#81b64c`, hover menggelap sedikit, active `translateY(2px)` + shadow mengecil), **ghost/outline** (border token border, teks token teks utama), **disabled** (opacity, tanpa shadow). Fokus selalu ring focus token — tanpa kecuali (a11y floor).

| Komponen | Default | Hover/Focus | Active/Pressed | Disabled | Loading | Error |
|---|---|---|---|---|---|---|
| **game-over-modal** | backdrop token panel gelap; kartu panel `#262421`, radius existing | backdrop tidak interaktif; CTA ikut varian tombol | — | — | countdown teks "Membuka review…" | n/a (modal selalu sukses) |
| **CTA Review Permainan** | hijau primary, ikon 3D chart/analisis kiri label | brightness naik + ring fokus | shadow `0 2px 0 #45753c` | n/a | — | — |
| **Panel review (tab review)** | panel `#262421`; tab aktif: underline hijau + teks putih; tab lain teks abu | tab: teks memutih | — | — | **skeleton** shimmer token surface-alt (bukan spinner penuh) untuk ringkasan & daftar blunder | panel error: ikon 3D peringatan + copy §5.1 + [Coba Lagi] ghost |
| **Coach audio toggle** | tombol ikon 3D speaker; playing: gelombang animasi 180ms | ring fokus | pressed scale 0.98 | — | — | mute: ikon speaker-silang, warna teks abu; tetap fokusable |
| **Tab filter arsip** | teks abu + counter dalam pill surface-alt | teks putih | — | — | counter "…" saat fetch | counter tetap, list menampilkan error inline + retry |
| **Row arsip** | background transparan; zebra halus surface-alt | background surface-alt penuh; ikon aksi opacity 0.6→1 | — | — | — | ikon aksi tetap aktif; kegagalan aksi → toast error |
| **Toggle favorit** | bintang 3D outline | bintang sedikit membesar (180ms) | — | saat rollback: getar 180ms + toast | — | — |
| **Checkbox bulk** | kotak border token | ring fokus | — | — | — | — |
| **Tombol "Unduh PGN Terpilih (n)"** | hijau primary, disable saat n=0 | — | — | opacity + tanpa shadow | spinner dalam tombol, label tetap | toast "Gagal mengunduh PGN" |
| **Paste bar** | textarea surface-alt, border token | border putih tipis + ring fokus | — | — | textarea disabled + tombol "Memproses…" + `aria-busy` | border token error + pesan inline merah §3.3 |

### 4.2 Aturan transisi

- Satu-satunya durasi: `var(--move-animation-duration)` (180ms) — tab underline, skeleton shimmer, bintang, ikon, backdrop modal.
- **Tanpa** animasi enter/exit > 180ms; bottom-sheet existing tidak tersentuh di sprint ini.

---

## 5. Copy ID (Indonesia, spesifik per komponen)

### 5.1 S2-T1 — Modal & Review

| Elemen | Copy |
|---|---|
| Judul modal (menang/kalah/remis, sudut pemain) | "Kemenangan!" / "Kekalahan" / "Remis" / "Waktu Habis — Menang" / "Waktu Habis — Kalah" |
| Subjudul modal | "vs <lawan> · <control waktu>" (mis. "vs budi · 10 menit") |
| CTA utama | "Review Permainan" |
| CTA sekunder | "Kembali ke Lobby" |
| Countdown bawah CTA | "Membuka review…" |
| Spectator CTA | "Lihat Analisis" |
| Judul panel | "Review Permainan" |
| Tab panel | "Ringkasan" / "Review" / "Langkah" |
| Loading review | "Menganalisis permainan…" |
| Error engine | "Analisis gagal dijalankan. Coba lagi — kalau masih gagal, permainan ini belum bisa direview." |
| Tombol error | "Coba Lagi" |
| Label audio | "Komentar Coach" |
| Aria toggle mute | "Putar komentar coach" / "Bisukan komentar coach" |

### 5.2 S2-T2 — Arsip

| Elemen | Copy |
|---|---|
| Judul halaman | "Arsip Permainan" |
| Tab | "Semua" / "Favorit" / "Live" / "Harian" / "Bot" / "Coach" |
| Pilih semua | "Pilih semua di tab ini" |
| Bulk | "Unduh PGN Terpilih (<n>)" |
| Per row | hasil: "Menang" / "Kalah" / "Remis"; delta: "+12" / "−9" / "0"; kosong: "—" |
| Aria aksi | "Favoritkan permainan vs <lawan>" / "Hapus dari favorit vs <lawan>" / "Unduh PGN vs <lawan>" / "Analisis permainan vs <lawan>" |
| Empty state tab | "Belum ada permainan di tab ini." (Favorit: "Belum ada favorit — tandai permainan dengan ikon bintang.") |
| Toast gagal favorit | "Gagal memperbarui favorit. Coba lagi." |
| Toast gagal unduh | "Gagal mengunduh PGN. Coba lagi." |
| Muat lebih banyak | "Muat lebih banyak" |

### 5.3 S2-T4 — Paste bar

| Elemen | Copy |
|---|---|
| Placeholder | "Tempel PGN, FEN, atau tautan game internal…" |
| Tombol | "Analisis" |
| Loading tombol | "Memproses…" |
| Sukses FEN | "Posisi dimuat." |
| Sukses PGN | "Permainan dimuat." |
| Error | lihat tabel §3.3 (jangan diringkas jadi "Input tidak valid") |

---

## 6. A11y Checklist

- [ ] **Modal hasil**: focus trap penuh; fokus awal di [Review Permainan]; Esc menutup (= jalur redirect); `role="dialog"` + `aria-modal` + label dari judul modal; fokus kembali ke elemen pemicu saat tertutup.
- [ ] Redirect otomatis 2.5s: timer **dibatalkan** bila fokus user sedang berpindah di dalam modal; tidak ada redirect saat tab tidak terlihat (`document.hidden`).
- [ ] Panel review: tab pakai `role="tablist"/"tab"/"tabpanel"` + navigasi panah; skeleton diberi `aria-busy` dan `aria-live` pengumuman "Menganalisis permainan…" → selesai.
- [ ] Coach audio: toggle `aria-pressed`; perubahan mute diumumkan via `aria-live=polite`.
- [ ] Error review & paste bar: `role="alert"`/`aria-live="polite"`; fokus pindah ke pesan error; teks error spesifik (§3.3, §5.1).
- [ ] Arsip: tab filter `role="tablist"` + `aria-selected`; counter dibacakan ("Semua, 128 permainan"); row fokusable, ikon aksi = tombol terpisah dengan aria-label §5.2; checkbox punya label terkait row.
- [ ] Delta rating: tanda ± tidak hanya warna — teks "+12"/"−9" eksplisit (bukan ikon warna saja).
- [ ] Kontras: semua kombinasi teks/latar lolos WCAG AA dengan token existing (teks abu hanya untuk informasi sekunder, tidak untuk aksi).
- [ ] Paste bar: label programatik (`aria-label` pada textarea), `aria-busy` saat loading, error `aria-live=polite`.
- [ ] Semua fokus memakai ring focus token existing; `focus-visible` konsisten; tidak ada outline dihapus tanpa pengganti.
- [ ] Semua interaksi keyboard: Tab urutan logis (modal → tab panel → baris → aksi; paste bar → tombol → kartu entri).
- [ ] Ikon icons3d tidak pernah membawa makna tanpa teks/aria-label (bukan emoji, bukan icon-only tanpa label).

---

**Referensi:** `~/projects/active/chess-web/rea/chess-web-ui-ux-analysis.md` §7 (Analysis paste bar), §11 (Arsip: filter tabs + bulk + delta ±). Tiket sumber: `docs/tickets/S2-T1-endgame-auto-review.md`, `S2-T2-game-archive.md`, `S2-T4-analysis-fastpath.md`.
