# Desain Sprint 1 — Inline Challenge & Badge Realtime

**Tiket:** S1-T4 (G4) · **Sprint:** 1 · **Prioritas:** P1 · **Peran:** Design
**Status:** Draft untuk review · **Tidak berisi kode** — spesifikasi visual & interaksi saja.

Semua token mengacu ke `app/globals.css` (Chess.com Dark Mode Standards v1.1). **Tidak ada palet baru** yang diperkenalkan di dokumen ini.

---

## 1. Flow Inline Challenge

### 1.1 Prinsip (dari analisis chess-web)

- Challenge **selalu inline**, dual-button `[Tolak | Terima]` — **tidak ada halaman atau modal perantara**.
- Board tetap **kiri / panel kanan** di desktop; mobile memakai **bottom-sheet** yang tidak menutup papan penuh.
- Sumber event: topik `matcher/<userId>`; aksi lewat `api/challenge` (POST / POST-cancel).
- Semua transisi panel/animasi memakai satu var: `--move-animation-duration: 180ms`.

### 1.2 Flow Terima (A mengirim seek ke B)

```
DESKTOP
┌────────────────────────────────────────────────────────────────┐
│ A: /play/online → tab "Permainan Baru" → pilih control waktu   │
│    → klik "Cari Lawan" (aksi hijau, box-shadow 0 4px 0 #45753c)│
│    → state panel: SEEKING ("Mencari lawan…")                   │
│ B: (di /home atau /play/online) ChallengeCard muncul realtime  │
│    di daftar "Permainan" + badge nav ikut menyesuaikan         │
│    → klik [Terima] (hijau)                                     │
│    → POST api/challenge → matcher S1-T2 membentuk match        │
│    → card berganti state ACCEPTED ("Mempersiapkan papan…")     │
│    → navigasi ke /game/live/<id>, papan aktif                  │
│ A: state SEEKING → MATCHED → redirect otomatis ke /game/live   │
└────────────────────────────────────────────────────────────────┘
```

```
MOBILE (≤ 768px)
  B di halaman mana pun
    → bottom-sheet slide-up dari bawah (tinggi maks ±40% viewport,
      papan/tampilan di belakang tetap terlihat & interaktif di atasnya)
    → isi sheet: ChallengeCard (identik dengan desktop)
    → [Terima] → sheet kolaps (180ms) → game start fullscreen
```

### 1.3 Flow Tolak

```
B klik [Tolak] (ghost/outline, bukan hijau)
  → POST cancel → publish GameRemoved ke pengirim (A)
  → card B: state DECLINED, hilang otomatis setelah ±2 detik
  → A: toast non-blocking: "<B> menolak tantangan" (channel toasts,
     bukan modal) → state A kembali SEEKING (jika masih seek) atau IDLE
```

### 1.4 Edge cases

| Kasus | Perilaku |
|---|---|
| A membatalkan seek sendiri sebelum match | A → IDLE; B yang belum menerima: card hilang + toast "Tantangan dibatalkan" |
| B mengabaikan card > 60 detik | card memudar (opacity) lalu auto-expire; A menerima GameRemoved |
| B menerima tapi match gagal dibentuk | card → state DECLINED dengan copy "Tantangan tidak lagi tersedia"; A kembali SEEKING |
| B sedang dalam game | card tidak muncul; challenge otomatis ditolak server-side, A menerima GameRemoved |
| Klik ganda [Terima] | tombol disable setelah klik pertama (state ACCEPTED idempoten) |

---

## 2. Wireframe ASCII

### 2.1 ChallengeCard (desktop, panel kanan / daftar "Permainan")

```
┌─ ChallengeCard ───────────────────────────────┐
│  [ikon 3D vector: dua bidak berhadapan,        │
│   kuda vs raja, warna papan wood]              │
│                                                │
│  <username lawan>  <rating>                    │
│  Cepat · 10 menit        ← control + format    │
│                                                │
│  ┌───────────────┐  ┌───────────────┐          │
│  │     Tolak     │  │    Terima     │          │
│  └───────────────┘  └───────────────┘          │
│   ghost/outline       hijau #81b64c            │
│   border #3d3a34      box-shadow 0 4px 0 #45753c│
└────────────────────────────────────────────────┘
  Container: background var(--card) #262421, radius --radius-lg
  Ikon: SVG kustom 3D vector — TANPA emoji
```

### 2.2 Badge nav realtime "Bermain N"

```
Desktop (sidebar kiri, ~72px):
┌──────┐
│ logo │
├──────┤
│ ♟≤3D │  ← item nav "Bermain"
│ svg  │     ikon 3D vector SVG kustom
│ Bermain     │
│ ┌───┐│
│ │ 3 ││  ← badge: bg var(--primary) #81b64c, teks putih,
│ └───┘│     radius penuh, min-width 20px, font --text-xs
├──────┤
│Teka- │
│Teki  │
└──────┘

Perilaku: N = jumlah game aktif user (WS push, satu topik satu
konsumen). N=0 → badge disembunyikan (bukan "0"). N>9 → tampil "9+".
Update badge dengan transisi scale singkat 180ms (--move-animation-duration).
```

### 2.3 Mobile bottom-sheet

```
┌──────────────────┐
│                  │
│   (papan/last    │  ← tetap terlihat, redup 40%
│    state halaman)│
│                  │
├──── handle ──────┤  ← drag handle 32x4, var(--border-strong)
│                  │
│  [ChallengeCard] │  ← konten identik 2.1
│                  │
│  [Tolak] [Terima]│  ← tinggi tombol --ctl-h-md (46px),
│                  │     ≥ --tap (44px) area sentuh
└──────────────────┘
  bg var(--surface) #211f1d, radius atas --radius-2xl
  slide-up 180ms ease-out; klik di luar sheet = TIDAK menutup
  (aksi eksplisit Tolak/Terima saja, hindari salah sentuh)
```

---

## 3. Spesifikasi State Visual

| State | Trigger | Visual | Token |
|---|---|---|---|
| **idle** | tidak ada seek/challenge aktif | panel pairing normal; tombol "Cari Lawan" siap; badge nav disembunyikan | bg `--surface`, teks `--foreground`, tombol `--primary` |
| **seeking** | A klik "Cari Lawan" | tombol berganti "Mencari lawan…" (disabled, spinner ikon SVG, bukan teks berkedip); aksi berubah jadi "Batalkan" (ghost); counter sosial opsional "N pemain daring" (`--muted-foreground`) | bg tetap `--surface`; aksen hover `--surface-hover`; teks sekunder `--muted-foreground` #9e9b97 |
| **incoming-match** | ChallengeCard tampil di B | card slide-in 180ms; ikon bidak 3D wood; label control waktu; dua tombol; ring fokus `--ring` #81b64c saat navigasi keyboard | card bg `--card` #262421, border `--border` #3d3a34; Terima `--primary` + shadow `0 4px 0 #45753c`; Tolak outline `--border-strong` #4a4740, teks `--foreground` |
| **accepted** | B klik Terima (sebelum papan siap) | kedua tombol disable; card overlay teks "Mempersiapkan papan…"; border card berganti `--primary` (tanpa glow) | disabled: opacity 0.6; border `--primary-hover` #72a342 |
| **declined** | B klik Tolak / auto-expire / challenge dicabut | card memudar (opacity → 0, 180ms) lalu unmount; toast non-blocking di A | teks status memakai `--muted-foreground`; toast bg `--popover` #262421; error serius (match gagal) memakai `--destructive` #f5222d — jangan untuk tolak biasa |

Aturan animasi: **satu sumber kebenaran** — semua durasi (slide-in card, kolaps sheet, fade declined, pulse badge) membaca `--move-animation-duration`. Tidak ada durasi hardcoded.

---

## 4. Copy Bahasa Indonesia (spesifik, bukan filler)

| Lokasi | Copy | Alasan |
|---|---|---|
| Tombol aksi pairing | `Cari Lawan` | deskriptif, satu makna |
| State seeking | `Mencari lawan…` + subteks `Batalkan pencarian` | status + aksi keluar eksplisit |
| Judul card | `<username> (<rating>) menantang Anda` | subjek–aksi jelas, bukan "Anda punya undangan!" |
| Baris control | `Cepat · 10 menit` / `Blitz · 5 menit` / `Tanpa pemasa` | istilah catur baku id |
| Tombol | `Tolak` / `Terima` | sesuai tiket, urutan tetap Tolak–Terima |
| State accepted | `Mempersiapkan papan…` | konkret: yang disiapkan papan, bukan "memuat" |
| Toast diterima (untuk A) | `<B> menerima tantangan Anda` | sekaligus penanda redirect akan terjadi |
| Toast ditolak (untuk A) | `<B> menolak tantangan` | netral, tanpa rasa bersalah |
| Toast dicabut (untuk B) | `Tantangan dibatalkan` | pasif, pengirim tidak dinamaikan |
| Expire | `Tantangan kedaluwarsa` | bukan "waktu habis" (ambigu dengan jam game) |
| Match gagal | `Tantangan tidak lagi tersedia` | bukan "terjadi kesalahan" |
| Badge nav | `Bermain` + angka | mengikuti pola chess.com ("Bermain 3"); aria-label terpisah, lihat §5 |
| Empty state daftar challenge | `Belum ada tantangan` | faktual, bukan "mulai petualanganmu!" |

Larangan: tidak ada tanda seru ganda, tidak ada "Yuk!"/"Seru!", tidak ada emoji, tidak ada kopas bahasa Inggris ("Challenge accepted!").

---

## 5. Checklist A11y (komponen baru: ChallengeCard, badge nav, bottom-sheet)

- [ ] **Skip-link** tetap jadi elemen fokus pertama di semua halaman tempat card muncul (`Lewati ke konten`); card tidak boleh menyisip sebelum skip-link di urutan tab.
- [ ] `ChallengeCard` → `role="status"` + `aria-live="polite"` agar kemunculan diumumkan pembaca layar; jangan `assertive` (jangan memotong).
- [ ] Card punya heading (`<h3>` level benar) berisi nama lawan; pembaca layar tidak menebak dari layout.
- [ ] **Ikon-only** (ikon bidak, ikon spinner, ikon nav "Bermain") → `aria-hidden="true"` pada SVG, nama diungkap lewat teks/`aria-label` di tombol atau item nav.
- [ ] Badge nav: item nav `aria-label="Bermain, 3 permainan aktif"`; angka badge `aria-hidden` (nilai sudah di label). N=0 → badge `hidden` agar tidak dibaca.
- [ ] Urutan fokus di card: `Tolak` → `Terima` (kiri→kanan, sesuai urutan visual).
- [ ] `focus-visible` pada kedua tombol: ring `--ring` #81b64c, offset 2px — jangan di-suppress.
- [ ] Saat state accepted/declined, tombol yang disable tetap dalam DOM tapi `disabled` + perubahan diumumkan (`aria-live` pada wrapper status card, teks "Mempersiapkan papan…" dsb.).
- [ ] Bottom-sheet: `role="dialog"` **tidak dipakai** (bukan modal — tidak memblokir); pakai `role="region"` + `aria-label="Tantangan masuk"`. Fokus **tidak** dipaksa masuk sheet; fokus pindah ke tombol Terima hanya via Tab alami.
- [ ] Sheet tidak menutup penuh: konten di belakang tetap terjangkau (tidak ada `inert`/`aria-hidden` pada halaman).
- [ ] Target sentuh kedua tombol ≥ 44px (`--tap`), jarak antar tombol ≥ 8px.
- [ ] Kontras: teks `--muted-foreground` (#9e9b97) di atas `--card` (#262421) ≥ 4.5:1 — verifikasi sebelum implementasi; angka badge putih di atas #81b64c ≥ 3:1 (teks besar/bold).
- [ ] Semua animasi ≤ 180ms via `--move-animation-duration`; hormati `prefers-reduced-motion` (transisi jadi instan, tanpa slide/scale).
- [ ] Toast non-blocking `role="status"`; tidak pernah memakai `alert()`.

---

## Referensi

- `app/globals.css` — token desain (charcoal #1a1714/#262421, hijau #81b64c, papan #f0d9b5/#b58863).
- `docs/tickets/S1-T4-inline-challenge.md` — ruang lingkup & acceptance.
- `~/projects/active/chess-web/rea/chess-web-ui-ux-analysis.md` — pola terverifikasi chess.com (inline dual-button, badge realtime, bottom-sheet mobile, a11y floor).
