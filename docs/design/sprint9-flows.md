# Desain Sprint 9 — Flow & State Components (S9-T1..S9-T4)

**Tiket:** S9-T1..S9-T4 · **Sprint:** 9 · **Peran:** UX/Design · **Tanggal:** 2026-10-28
**Status:** Draft untuk review · design-only (spesifikasi alur/wireframe/copy — tanpa kode).
Bentuk tiap tiket adalah **kontrak untuk dev (backend ∥ frontend)**, bukan implementasi.

Sumber: `docs/design/s9-s10-scope.md` (scope binding), `docs/design/chesscom-parity-audit.md`
gap G0/G1/G6/G7, `docs/design/sprint8-ia.md` §3–§4 (**kontrak `.view-*` + a11y floor —
S9 WAJIB mempertahankan**, bukan mengganti).

Aturan lintas tiket (binding):
- Semua wireframe = ASCII; semua copy = Indonesia 100%.
- View baru/modifikasi memakai helper `.view-root/.view-head/.view-body/.view-cols`
  (S8 §3) — tidak bikin class layout sendiri; aksen per section via token
  `--nav-accent-play/puzzle/drill/learn/social/watch`.
- Invariant S8 §4 tidak boleh patah: `aria-current="page"` TEPAT 1 (gate
  mounted/isDesktop, pola BUG-3), `role="tablist"` strip subtab TANPA aria-current,
  skip-link, focus-visible, viewport 1360×768 tanpa page-scroll.
- Ikon: lucide-react + icons3d (aset orisinal). **DILARANG** menyalin aset/gambar
  chess.com (anti-slop + hak cipta); ilustrasi empty-state dibuat orisinal (§T3.3).

---

## T1 — State Machine Auth Messaging (gap G0.1–G0.3)

### T1.1 Model state

Satu sumber: `useSession()` (`lib/use-session.ts`). UI punya 6 state; state deterministik
vs transien menentukan ada/tidaknya tombol "Coba lagi":

```
                    ┌─────────────┐
   load /api/auth ─► │ S0 LOADING  │  (useSession.loading === true)
                    └──────┬──────┘
        ok, user=null        ok, user.status
             │                 ├──────────────────────┐
             ▼                 ▼                        ▼
        ┌─────────┐      ┌───────────┐            ┌───────────┐
        │ S1 GUEST │      │ S2 PENDING │            │ S3 APPROVED│
        └────┬────┘      └─────┬─────┘            └─────┬─────┘
             │ register/login  │ admin setujui (refresh) │
             ▼                 ▼                         │
        masuk S2          masuk S3                      │
                                                                  │
   fetch /api/auth GAGAL (5xx/DB down/jaringan), SEMUA state ──►┐
                                                                  ▼
                                                            ┌───────────┐
                                                            │ S4 SERVICE │
                                                            │   -DOWN    │
                                                            └───────────┘
   (rejected: ditangani terpisah — pesan "Akun Anda ditolak admin.",
    tanpa CTA; di luar scope S9-T1, perilaku sesuai authErrorText FIX-1.2)
```

- **S2 PENDING** (deterministik): bukan kegagalan transien → **tanpa tombol "Coba
  lagi"**. Satu-satunya jalan keluar = admin menyetujui (badge terlihat sebagai
  pengingat; opsi opsional "Periksa status" = panggil `refresh()`).
- **S4 SERVICE-DOWN** (transien): pesan generik + **WAJIB** tombol "Coba lagi".
  Saat S4, view memakai data state terakhir yang valid (cache `useSession`) dan
  **TIDAK PERNAH** menampilkan CTA login palsu (bug G0.3: 5xx ditelan
  `currentPgUser` → CTA "Masuk untuk melihat…" — pola ini dihapus).
- Backend kontrak: SEMUA endpoint authed memetakan sesi-pending →
  `403 { code: "account_pending" }` (pola `resolvePgUser`, FIX-1.2). QA audit
  endpoint-per-endpoint: `/api/endgames/drills`, `/api/friends`,
  `/api/leaderboard`, `/api/courses`, `/api/pvp`, `/api/games/archive`,
  `/api/practice/*`, `/api/home/dashboard`.

### T1.2 Copy per state (100% Indonesia, tanpa filler)

| State | View (data authed gagal) | Chip user (shell) |
|---|---|---|
| S0 | (view tidak render data; jika endpoint tetap di-fetch, pakai `LoadingState` T3) | (tanpa chip status) |
| S1 GUEST | `401` → "Masuk untuk melihat {konteks}." + CTA "Masuk atau Daftar" | "Tamu" / "Masuk untuk rating" / tombol "Masuk atau Daftar" |
| S2 PENDING | `403 account_pending` → **"Akun menunggu persetujuan admin."** + sub-copy "Fitur {konteks} akan terbuka setelah admin menyetujui akunmu." **Tanpa CTA login, tanpa "Coba lagi".** | Badge amber **"Menunggu"** (lihat T1.3) |
| S3 APPROVED | Normal — tidak ada pesan khusus. | Titik hijau (ada) + rating (ada); **tanpa badge tambahan** |
| S4 SERVICE-DOWN | `5xx / 503 / account_missing / jaringan` → **"Terjadi gangguan layanan. Data tidak dapat dimuat."** + tombol **"Coba lagi"** + kode sr-only | Chip tetap memakai cache; sub-copy chip: "Koneksi terputus — coba muat ulang" |

- `account_missing` = transien (sinkron DB) → **boleh** "Coba lagi" (perlu beda
  dari `account_pending`: teks "Akun belum tersinkron dengan database." + "Coba lagi").
- CTA login sah HANYA untuk `401` sungguhan (belum login). Ini aturan anti-CTA-palsu.

### T1.3 Badge status di user chip — 3 permukaan shell

Badge tampil di ketiganya agar status terbaca di semua breakpoint:

```
  DESKTOP TOPBAR (56px)              DESKTOP SIDEBAR BAWAH (profil)
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ [Q] @zenwisteriaclarines [Menunggu]│ │ [Q] @zenwisteriaclarines          │
└──────────────────────────────────┘  │     ● 1450 rating   [Menunggu]   │
  [Q] = avatar inisial, ● = dot       └──────────────────────────────────┘
  ada, badge = pill, bukan warna saja
  MOBILE TOPBAR (shell header)
┌────────────────────────────────────┐
│ [Q●]   (● = ring/circle amber 4px)  │
└────────────────────────────────────┘
```

| Permukaan | Approved | Pending |
|---|---|---|
| Topbar desktop | avatar + `@username` | avatar + `@username` + pill `Menunggu` (amber, teks bukan warna saja) |
| Sidebar bawah (profil) | `●` dot + `{elo} rating` | `●` dot + `{elo} rating` + pill `Menunggu` |
| Mobile topbar | avatar polos | avatar dengan ring amber `2px` + `sr-only` "Status akun: menunggu" |

`aria-label` chip (ketiga permukaan, satu pola):
- pending: `Akun @nama — status: menunggu persetujuan admin`
- approved: `Akun @nama — status: aktif, rating {elo}`
- S4: append `, koneksi terputus`

**Keputusan desain T1:** badge visual HANYA untuk state abnormal (pending = pill
amber; S4 = sub-copy). Approved TIDAK dapat pill baru — titik hijau + rating yang
sudah ada sudah cukup; menambah pill "Aktif" akan menambah noise di setiap view.
Screen reader tetap mendapat status lengkap lewat `aria-label` di atas (keputusan
ini menjaga a11y floor tanpa membebani viewport 1360×768).

### T1.4 Pola tombol "Coba lagi"

```
┌───────────────────────────────────────────────────────┐
│  ⚠  Terjadi gangguan layanan.                         │  role="alert"
│     Data tidak dapat dimuat.                           │
│  ┌───────────────┐  [Periksa status]  (S2 only, ops.) │
│  │   Coba lagi   │                                     │
│  └───────────────┘  <span class="sr-only">Kode 503</span>
└───────────────────────────────────────────────────────┘
```

1. Tombol `primary` label "Coba lagi" → panggil ulang loader view (T3 `ErrorState.onRetry`).
2. Saat retry: tombol `disabled`, label berganti "Mencoba…" (`role="status"` aria-live
   polite), ikon spinner lucide `LoaderCircle` (diam saat reduced-motion).
3. Retry gagal: pesan sama kembali + kode sr-only diperbarui; maksimal auto-retry = 0
   (hanya manual — hindari loop spam saat DB down).
4. S2 (pending): TIDAK ada tombol ini (deterministik). S1 (guest, 401): tombol diganti
   CTA "Masuk atau Daftar" (buka `AuthPanel` modal yang sudah ada).

Wireframe view pending (Pola B, aksen `--nav-accent-social`):

```
┌──────────────────────────────────────────────────────────┐
│ [Papan Peringkat ▸ Kilat · Ekspres · Rapid]  (view-head) │
├──────────────────────────────────────────────────────────┤
│ view-body (center, tanpa tabel):                          │
│   ◔  (ic shield, lucide, warna section, tidak warna saja) │
│   Akun menunggu persetujuan admin.                       │
│   Fitur papan peringkat akan terbuka setelah admin        │
│   menyetujui akunmu.                                      │
│   (tanpa tombol — lihat badge "Menunggu" di user chip)   │
└──────────────────────────────────────────────────────────┘
```

Cakupan T1 (dari scope): endgame-drills, friends, leaderboard, courses, pvp-panel,
archive, practice, home — semua memakai pemetaan `authErrorText` yang sama; pvp-panel
ganti pesan pending sekarang ("fitur PvP belum tersedia") dengan pesan standar di atas.
Home guest diperbaiki: `401` dashboard TIDAK lagi "Sesi berakhir — masuk kembali."
(lihat T2.1 — guest mendapat landing, bukan error).

---

## T2 — Guest Gating per 8 Section (gap G1.1–G1.2)

### T2.1 Matriks gating guest (8 section S8)

Aturan: guest boleh MASUK semua section yang fitur lokalnya bekerja (pola audit §1:
bots/scan/coach/spectator/learning hub/paste-PGN review = tanpa API authed). Gating
tinggal di data personal (progress, attempt, CRUD, match) — CTA kontekstual di
**momen relevan**, tidak memblokir masuk. Nav rejection di `game.tsx
handleNavClick` untuk view guest-terbuka **dihapus**; yang tersisa hanya 2,8s
notice lama → diganti notice persisten (§T2.2).

| # | Section (S8) | Subtab | Guest bebas? | Yang tetap gated (CTA konteks) |
|---|---|---|---|---|
| 1 | Beranda | home | 🟡 LANDING | Dashboard 401 → landing guest (bukan error): hero "Selamat datang di FIF Chess" + 2 kartu CTA: "Main dengan Bot" (→ `#bots`, bebas) + "Daftar untuk menyimpan progres" (→ AuthPanel). T2 keputusan D2.1. |
| 2 | Main | play | ✅ | Papan+AI bebas (engine lokal `/api/engine-move`). Gated: PvP create/invite (CTA "Masuk untuk bermain PvP" di panel PvP), broadcast publik (opsional, CTA kecil). CTA setelah game selesai vs AI: "Daftar untuk menyimpan riwayat" di GameOverModal (momen relevan). |
| 2b | Main | bots | ✅ | Penuh — grid + filter lokal, main AI. Tanpa CTA. |
| 2c | Main | tournaments | 🟡 | Daftar arena dilihat bebas (GET publik sesuai audit §5: "GET publik"). Gated: "Bergabung" → CTA "Masuk untuk bergabung" (login-wall pada aksi join, bukan pada masuk). |
| 3 | Taktik | puzzles | 🟡 | Unlimited/daily: SOLVE bebas (lokal). Gated: POST attempt/streak/rating (CTA "Daftar untuk menyimpan progres" muncul HANYA setelah puzzle selesai — momen relevan, bukan blokir). Rush: mulai bebas, leaderboard+attempt gated. |
| 4 | Analisis | review | ✅ | Paste PGN/FEN analisis penuh bebas. Gated: muat dari riwayat/arsip sendiri (CTA "Masuk untuk memuat partaimu"). |
| 4b | Analisis | scan | ✅ | Kamera+`/api/scan-board` on-device — bebas penuh. |
| 5 | Latih | explorer / insights | ✅ | Data publik bebas. Gated: insight SENGSIH sendiri (angka "—", pola S7) + CTA "Masuk untuk melihat statistikmu". |
| 5b | Latih | practice | 🟡 | Kartu target mingguan = data personal → angka "—" + CTA "Daftar untuk menyimpan progres". |
| 5c | Latih | drills | ❌ | Latihan kurasi butuh progress (pola S7 §5.3: login-wall panel saja, copy "Masuk untuk melihat latihan permainan akhir."). |
| 5d | Latih | vision | ✅ | Free — materi statis + drill lokal. |
| 6 | Belajar | courses / learn / classroom | 🟡 | Materi baca bebas (S7). Gated: progres, bookmark, attempt (CTA "Daftar untuk menyimpan progres" di bawah materi yang selesai dibaca — momen relevan). |
| 6b | Belajar | coach | ✅ | Engine lokal — bebas penuh, tanpa CTA. |
| 7 | Tonton | archive | ❌ | Arsip personal → notice guest persisten (§T2.2) + CTA "Masuk untuk melihat arsip partaimu." |
| 8 | Komunitas | leaderboard / friends / community | 🟡 / ❌ / 🟡 | Leaderboard global DILIHAT bebas (GET publik, highlight "barismu" tidak muncul saat guest — baris "kamu" disembunyikan, bukan angka mock). Friends = CRUD personal → notice persisten + CTA "Daftar untuk menambah teman." Komunitas: feed dilihat bebas, posting → CTA "Masuk untuk menulis." |

**Aturan CTA (anti-slop):**
1. CTA daftar/masuk HANYA di momen: setelah selesai puzzle, setelah selesai game
   vs AI, di bawah materi belajar yang selesai, dan pada aksi yang gagal 401.
2. TIDAK ADA notice memblokir navigasi; nav bebas (matriks di atas).
3. CTA = 1 tombol per konteks (pilihan: "Masuk atau Daftar" membuka AuthPanel yang
   sudah ada; tidak ada modal multi-step baru).
4. Angka personal yang tidak tersedia untuk guest = `"—"` (no-mock, pola S7),
   bukan 0 dan bukan placeholder.

### T2.2 Notice guest persisten (ganti notice 2,8 detik)

Notice inline di atas konten view (di bawah strip subtab, di dalam `.view-root`,
`shrink-0` — TIDAK menggeser rantai tinggi S8), muncul saat guest membuka area
yang perlu login (archive, friends, CTA-gated drill), dan saat 401 pada aksi:

```
 .view-root
 ┌────────────────────────────────────────────────────────────┐
 │ view-head (filter/pill, tetap berfungsi)                   │
 ├────────────────────────────────────────────────────────────┤
 │ ┌────────────────────────────────────────────────────────┐ │
 │ │ 👤  Kamu sedang menjelajah sebagai tamu.        [×]    │ │  ← role="alert"
 │ │    Daftar untuk simpan progresmu. [Daftar]             │ │     persisten,
 │ └────────────────────────────────────────────────────────┘ │     tidak auto-hide
 │ view-body (konten: "—" + daftar/panel sesuai gating)      │
 └────────────────────────────────────────────────────────────┘
```

Konteks copy per area (ikon lucide, cue ganda):
- archive: "Kamu sedang menjelajah sebagai tamu." / "Daftar untuk simpan progresmu." / CTA "Daftar" → AuthPanel
- friends: "Kamu sedang menjelajah sebagai tamu." / "Daftar untuk menambah teman." / CTA "Daftar"
- drills (login-wall panel): "Masuk untuk melihat latihan permainan akhir." / CTA "Masuk"
- generic 401 pada aksi: "Fitur ini membutuhkan akun." / CTA "Masuk atau Daftar"

Spesifikasi:
1. `role="alert"` (alert = assertive; guest bukan error fatal tapi butuh perhatian
   — audit G1.2 menuntut SR tidak melewatkannya). Persisnya: `role="status"
   aria-live="polite"` saat notice MENEMBUS area, `role="alert"` hanya saat
   berubah menjadi pesan 401-aksi. Keputusan D2.2 di bawah.
2. **Persisten** sampai dismiss (tombol `[×]` dengan `aria-label="Tutup pengumuman"`).
   Tidak auto-hide; tidak ada timer. State per-area disimpan dalam sesi (localStorage
   `jev_notice_dismissed`), jadi navigasi antar view masih menampilkan notice untuk
   area yang belum didismiss — user tidak dibom-bardir tiap pindah tab.
3. Setelah dismiss: tidak tampil lagi di sesi itu (tetap tampil di area lain
   yang masih gated). Saat user login: seluruh notice guest dihapus permanen.
4. Tinggi notice ≈ 56px (1 baris + padding); di area pola B/C notice masuk di dalam
   `.view-body` paling atas agar tetap scroll-internal dan tidak merusak no-scroll
   S8 di 1360×768.

**Keputusan desain T2:** notice persisten disimpan di **shell** (di atas konten,
bukan per view) — karena gating adalah sifat shell (per section), dan notice yang
dipindah-pindah per view akan duplikat logika 8×. Implikasi: shell menambah
prop `guestNotice: { area, cta } | null` yang di-set oleh `handleNavClick`
(pengganti notice 2,8s) dan di-clear saat `currentUser` != null. View tetap
menampilkan CTA 401-aksi sendiri (T3 ErrorState) — notice shell = konteks
"siapa kamu", CTA view = "apa yang harus dilakukan".

---

## T3 — Komponen Shared State: ErrorState / EmptyState / LoadingState (gap G6.2–G6.4)

Satu komponen per state, dipakai SEMUA view; pola error/loading/empty per-view
(grep `error ?` / `loading ?` di `components/` + `components/views/`) diganti
tanpa menghapus fitur. Lokasi: `components/ui/state/` (`error-state.tsx`,
`empty-state.tsx`, `loading-state.tsx`), export barrel `components/ui/state/index.ts`.

### T3.1 `ErrorState` (satu komponen, semua varian auth/service)

Props:
```
{
  message: string;            // copy Indonesia per T1.2 (diambil dari authErrorText)
  code?: string;             // kode sr-only, mis. "503", "account_missing"
  retryable?: boolean;       // false untuk account_pending → tombol "Coba lagi" TIDAK render
  ctaLabel?: string;         // overrides; default "Coba lagi"; untuk 401 → "Masuk atau Daftar"
  onRetry?: () => void;      // WAJIB bila retryable; bila ctaLabel login → openAuth dari parent
  context?: string;          // nama view ("papan peringkat", "arsip partai") — masuk sub-copy
  className?: string;        // default: isi penuh .view-body, center
}
```
Render (di dalam `.view-body`):
```
┌───────────────────────────────────────────────────┐
│                 (⚠ ilustrasi, T3.3)               │
│  Terjadi gangguan layanan.                        │
│  Data papan peringkat tidak dapat dimuat.         │
│  ┌────────────┐  <span class="sr-only">Kode 503</span>
│  │ Coba lagi  │
│  └────────────┘
└───────────────────────────────────────────────────┘
```
- Kontainer: `role="alert"` untuk 5xx/401-aksi; `role="status"` untuk
  `account_pending` (informasi, bukan error) — mengikuti T1.
- `onRetry` dipanggil; parent me-set state loading → render `LoadingState`.

### T3.2 `EmptyState` (1 ilustrasi + 1 CTA)

Props:
```
{
  illustration: "board" | "trophy" | "archive" | "puzzle";  // ilustrasi orisinal T3.3
  title: string;        // mis. "Arsipmu masih kosong"
  hint?: string;        // mis. "Selesaikan partai untuk memunculkannya di sini."
  ctaLabel?: string;    // satu CTA; mis. "Main sekarang"
  onCta?: () => void;   // navigasi ke play / auth panel
  className?: string;
}
```
Render: ilustrasi SVG 96×96 (garis tunggal, stroke, aksen section), title
`text-sm font-bold`, hint `text-xs text-neutral-400`, CTA 1 tombol (variant
sesuai aksen section). Tanpa ilustrasi boleh (`illustration` optional →
hanya teks) untuk empty-data kecil di dalam panel (mis. tab kosong).

### T3.3 `LoadingState` (skeleton standar)

Props:
```
{
  variant: "list" | "board" | "dashboard" | "card";   // pola A/B/C/D S8
  rows?: number;                                       // default 6 utk list
  label?: string;     // default "Memuat…"; WAJIB sr-only, bukan disembunyikan
  className?: string;
}
```
- Render: kontainer `role="status"` + `aria-live="polite"` berisi
  `<span class="sr-only">{label ?? "Memuat…"}</span>` + skeleton baris
  (bg `--surface`, `animate-pulse` — **diam otomatis saat reduced-motion**
  via guard global S8 §4). Dimensi mengikuti pola: list = baris ≤44px,
  dashboard = 4 kartu 12px gap (Pola D), board = kotak papan `aspect-square`
  ≤540px + panel sisi.
- Skeleton TIDAK menampilkan angka palsu (no-mock) — placeholder abu-abu.

### T3.4 Ilustrasi orisinal (BUKAN aset chess.com)

Gaya: **flat line-art sederhana, stroke 2px, satu aksen warna section
(`--nav-accent-*`), latar transparan, maksimal 4–5 bentuk**. Semua digambar
manual sebagai inline-SVG di `components/ui/state/illust/` (bukan import
dari library ilustrasi, bukan screenshot/aset pihak ketiga). Deskripsi:

- `board` (arsip kosong / general): kotak 4×4 grid persegi kecil (bukan papan
  8×8 penuh — abstraksi "daftar") + 1 bentuk bidak abstrak: lingkaran
  bertopi (raja) yang miring 10° keluar dari grid — mengisyaratkan "belum
  ada permainan tersimpan". Aksen `--nav-accent-watch`.
- `trophy` (leaderboard kosong): piala siluet dua-cangkang + 3 titik kecil
  di bawah (peringkat). Aksen `--nav-accent-social`.
- `puzzle` (teka-teki/empty latihan): 3 persegi bergeser + 1 piece
  (kuda abstrak = dua segitiga + kepala bulat) melompati celah.
  Aksen `--nav-accent-puzzle`.
- `error` (ErrorState): awan bergaris 2 garis horizontal (badai ringan)
  di atas 2 kotak kecil yang saling bertumpuk — "layanan sedang terganggu",
  tanpa wajah/warna merah (kontras dari teks, bukan ilustrasi).
- Aksen error khusus (5xx) memakai warna `--destructive` pada garis,
  tetap cue teks (kontra-sesama: warna + teks, bukan warna saja).

### T3.5 Contoh pemakaian (2 view wajib + 1 opsional)

1. **Pola B — `leaderboard-view`** (header pin filter tetap hidup saat
   loading, pola komentar view baris 82–85):
   - loading → `<LoadingState variant="list" label="Memuat papan peringkat…" />`
   - error → `<ErrorState message={authErrorText(...)} context="papan peringkat"
     retryable onRetry={load} ctaLabel={is401 ? "Masuk atau Daftar" : "Coba lagi"} />`
   - empty (scope global, riil kosong) → `<EmptyState illustration="trophy"
     title="Papan peringkat masih kosong" hint="Main partai rated untuk masuk papan."
     ctaLabel="Main sekarang" onCta={onPlayOnline} />`
2. **Pola A — `endgame-drills-view`**:
   - loading → `<LoadingState variant="card" />` (grid 2×2 set)
   - error → `<ErrorState retryable={code !== "account_pending"} .../>`
     (pending: tanpa tombol, sesuai T1)
   - empty (user approved belum mulai set apa pun) → `<EmptyState
     illustration="puzzle" title="Belum ada latihan dimulai"
     hint="Pilih satu set permainan akhir untuk memulai." />`
3. **Pola D — `home-view`** (opsional, masuk scope karena T1): guest
   landing + `<EmptyState>` tidak dipakai; 401 dashboard = landing T2.1;
   5xx → `<ErrorState retryable onRetry={load} />` di body kartu (Pola D).

QA acceptance T3: `grep -rn "error ?" components/ | wc -l` menurun drastis
(semua view route via 3 komponen); tidak ada view lagi yang render skeleton
/spinner sendiri; build + typecheck bersih; 1360×768 tanpa page-scroll.

---

## T4 — A11y Sweep: Shell Part, Reduced-Motion, Focus-Trap Sheet (gap G7.1–G7.3)

### T4.1 Ceklist a11y per shell part (invariant S8 §4 = baseline, S9 = sweep)

`components/shell/app-shell.tsx` (bagian: skip-link, mobile topbar, desktop
sidebar, topbar desktop, strip subtab, bottom-nav mobile, more-sheet, search
combobox, dock modal, auth modal):

| Part | Invariant S8 (JANGAN patahkan) | Sweep S9 (perbaiki/tambah) |
|---|---|---|
| Skip-link | `#main-content`, fokus-able pertama | [x] ada — verifikasi `tabIndex` tidak tergeser elemen baru |
| Sidebar 8 section | `aria-current="page"` TEPAT 1, gate `mounted && active && isDesktop` (BUG-3) | Tambah `<h2 class="sr-only">{section.title}</h2>` di atas setiap grup item yang punya subtab (orientasi SR; saat ini grup hanya `button` tanpa heading semantik — audit G1.3). Label `nav` tetap "Navigasi utama". |
| Accordion "Lainnya" | `aria-expanded` + `aria-controls="shell-others"`; item hidden TAKAN `aria-current` (gate `!othersOpen`) | Tambah heading sr-only "Menu lainnya" untuk `#shell-others`; item admin tetap `aria-current` hanya saat terbuka + desktop + mounted (pola BUG-3 sama). |
| User chip (3 permukaan, T1.3) | `aria-label` Indonesia ("Akun @…") | Lengkapi `aria-label` dengan status (T1.3); dot/badge `aria-hidden="true"`; badge pill WAJIB ada teks (bukan warna saja) — cue ganda. |
| Topbar desktop (search) | `role="combobox"` + `listbox`, `ArrowUp/Down/Enter`, `onBlur` debounce | `aria-activedescendant` pada item yang di-highlight (sekarang hanya `aria-selected` di listbox — SR tidak tahu cursor); hasil "Tidak ada hasil untuk …" tetap `aria-live="polite"`. |
| Strip subtab | `role="tablist"` + `tab`/`aria-selected`, TANPA `aria-current` (S8 §4) | Tambah keyboard roving: `ArrowRight/ArrowLeft` pindah tab, `Home/End` ke awal/akhir, `Enter/Space` aktivasi; fokus di tab yang `aria-selected`. TIDAK menambah `aria-current` (invariant). |
| Bottom-nav mobile (5 + Lainnya) | `aria-current` gate `!isDesktop` + mounted | `role="navigation"` + label "Navigasi bawah" (ada); tombol "Menu Lainnya" `aria-haspopup="dialog"` (ada). Sweep: pastikan `PlayingBadge` sr-only text mengikuti `aria-label` item. |
| More-sheet mobile | `role="dialog" aria-modal` + focus trap eksisting (effect lines 249–269) | T4.3: perbaiki trap (bug focusables dihitung 1×) + `aria-current` item (sudah ada lines 669/696 — sweep: tambah gate `mounted` yang sudah ada, pastikan TIDAK ditambah lagi di luar 1). Heading `h2` "Menu Lainnya" → ganti ke `h2 sr-only` di dalam dialog agar tidak bersaing dengan heading view (visual handle tetap ada). |
| Search combobox (mobile) | — | Mobile TIDAK punya input search (hanya topbar desktop) — tidak ada aksi. |
| Dock modal (4) | close + Esc | Sweep: tiap dock = dialog `aria-modal`, fokus ke close button saat buka, trap Tab, Esc → fokus kembali trigger (ikon dock). |
| Auth modal + GameOverModal + PromotionDialog | Esc/backdrop close | Fokus awal: AuthPanel → input username; GameOverModal → CTA "Main lagi" (jika sudah ada; kalau belum, tambah); trap Tab semua. |

**Aturan:** semua sweep di atas TIDAK mengubah jumlah `aria-current` (tetap
TEPAT 1 di satu tempat), TIDAK menyentuh `role="tablist"` strip subtab, dan
tidak menambah tinggi shell (skip-link/heading sr-only = 0px).

### T4.2 `prefers-reduced-motion` — daftar animasi yang harus hormat

Guard global sudah ada di `app/globals.css` (baris 406: `animation-duration:
0.01ms` untuk semua elemen saat reduce) + baris 661 (puzzle-shake +
animate-pulse dimatikan). Sweep S9 = pastikan SEMUA animasi JS-driven ikut
mati (guard CSS tidak menyentuh apa yang di-set inline style oleh JS):

| Animasi (file) | Perilaku saat `prefers-reduced-motion: reduce` |
|---|---|
| Confetti (`components/confetti.tsx`) | **Tidak di-render sama sekali** (check sudah ada — pertahankan). |
| `animate-in` / `slide-in-from-bottom` (more-sheet, modal, `app/globals.css` + Tailwind) | Guard CSS global sudah menonaktifkan transition; **sheet/modal tetap WAJIB muncul (state visual ada, hanya tanpa transisi)** — jangan hapus elemen. |
| `animate-pulse` (jam catur kritis, "Sedang Berpikir…", dot live) | Mati (guard global + baris 661). Tambah `aria-hidden` + teks status terpisah sudah ada — pertahankan; **jangan pakai `opacity` keyframe sebagai satu-satunya cue** (kontras warna + teks tetap). |
| Flybrain visualizer (`components/flybrain-visualizer.tsx`) | Freeze frame terakhir (set state `frozen=true`); tombol "Jalankan ulang" tetap ada. |
| Board piece-drop `animationDurationInMs: 200` (react-chessboard, game.tsx line 1661) | Set ke `0` saat reduce (prop `animationDurationInMs` — dev baca dari hook reduced-motion). |
| Shake langkah salah (`.puzzle-shake`, globals.css:628) | Mati (guard baris 661 sudah ada — verify). |
| Transisi `transition-all duration-150` chip/tombol shell | Guard global 406 cover; verifikasi saja. |
| `ClockMovesFullscreen` / `EvalBar` animasi | Freeze saat reduce; angka/teks tetap update (tidak mengandalkan transisi). |

Implementasi: **hook tunggal** `useReducedMotion()` (matchMedia listener,
sambil SSR-safe) di `lib/hooks` — semua komponen JS-driven (confetti,
flybrain, chessboard, clock) memanggil hook ini, TIDAK cek inline
`matchMedia` sendiri (sekarang tiap file cek sendiri — grep
`matchMedia("prefers-reduced-motion` di components/ = 4+ tempat duplikat).
Hook + guard CSS global = satu sumber kebenaran.

**Keputusan desain T4 (D4.1):** guard CSS global (`globals.css:406`)
dipertahankan sebagai *jaring pengaman*; hook `useReducedMotion` hanya
dipakai untuk **efek JS yang tidak bisa di-guard CSS** (konfetti mount,
chessboard duration, flybrain frame). Alasannya: dua lapis (CSS + hook)
adalah satu pola yang sudah dipakai `confetti.tsx` (JS guard) dan
`puzzle-solver` (JS guard) — konsisten, dan mengurangi risiko "animasi
palsu" yang hanya mati karena CSS (state JS masih berjalan).

### T4.3 Pola focus-trap untuk sheet (more-sheet + dock) — 1 hook

Bug saat ini (`app-shell.tsx` lines 249–269): `focusables` dihitung SATU
KALI saat effect mount (saat sheet baru buka, sebelum item "Lainnya"
sebagian render di DOM — item admin muncul via accordion lain).
Tab terakhir yang valid bisa jadi tombol yang sudah unmounted → focus
terjebak di `document.body`.

Pola S9 (dipakai more-sheet + 4 dock modal + auth modal + game-over
modal + promotion dialog):
1. `useFocusTrap(ref, active)` hook tunggal: **re-query `focusables`
   setiap ketukan Tab** (bukan sekali di mount).
2. Saat sheet terbuka: fokus → item pertama dalam daftar (bukan close
   button).
3. `Tab` di item terakhir → wrap ke item pertama; `Shift+Tab` di item
   pertama → wrap ke item terakhir.
4. `Escape` → tutup sheet + fokus kembali ke trigger (`moreTriggerRef` /
   ikon dock) — pola yang sudah ada di lines 232–247; sweep: pastikan
   trigger selalu ada saat `mounted`.
5. Backdrop klik → tutup + fokus ke trigger (sudah ada lines 625–629).
6. `aria-modal="true"` + `inert` pada konten di belakang sheet (opsional,
   hanya jika browser support — fallback: fokus trap saja).

Wireframe (more-sheet, mobile):

```
┌──────────────────────────────┐
│  [backdrop, inert]           │
│  ┌────────────────────────┐  │
│  │ ═══ handle ═══  [×]    │  │  ← close button: akhir daftar Tab
│  │  MAIN                 │  │
│  │  [Turnamen] [Main]     │  │  ← grid 2 kolom, roving fokus
│  │  Taktik                 │  │
│  │  [Teka-Teki]            │  │
│  │  ... (grup per section) │  │  ← Scroll internal di sheet (max 60vh)
│  │  LAINNYA                │  │
│  │  [Admin]                │  │
│  └────────────────────────┘  │
│  focus trap: Tab terakhir → wrap; Esc → tutup → fokus "Menu Lainnya"
└──────────────────────────────┘
```

### T4.4 QA acceptance T4 (semua di 1360×768)

1. `document.querySelectorAll('[aria-current="page"]').length === 1`
   di SEMUA breakpoint (768px border, accordion open/closed, sheet
   open/closed, mobile/desktop) — invariant BUG-3, pola S8 §4.
2. Keyboard-only path: skip-link → search (ArrowUp/Down) → section
   sidebar → subtab (ArrowLeft/Right/Home/End) → bottom-nav →
   more-sheet (Tab/Esc) → dock modal (Tab/Esc). Tidak ada focus yang
   hilang (body) dan tidak ada elemen ter-focus yang tidak terlihat.
3. `prefers-reduced-motion: reduce` (DevTools emulation): konfetti
   tidak mount; sheet terbuka/muncul tanpa transisi tapi state visual
   ada; flybrain freeze; chessboard piece-drop instan; semua animasi
   pulse/shake hilang.
4. Heading struktur: `document.querySelectorAll('h2.sr-only, h1.sr-only')`
   ≥ 1 per grup sidebar yang punya subtab + 1 di sheet "Menu Lainnya".
5. Game-over modal hasil TETAP `aria-live` (S7 G7.3) — tidak berubah.

---

## Ringkasan Keputusan Desain Penting (1 per tiket, untuk laporan)

- **D1.1 (T1):** Badge status user TIDAK ditambahkan untuk state
  approved — hanya pill "Menunggu" (pending) + sub-copy koneksi (S4).
  Alasannya: titik hijau + rating yang sudah ada sudah cukup untuk
  state normal; menambah pill "Aktif" hanya menambah noise di semua
  view dan melanggar pola minimalis S8 §0 (padat, aksen via token).
- **D2.1 (T2):** Home guest = **landing guest** (bukan error).
  `401` dashboard diganti dengan hero "Selamat datang" + 2 kartu
  (Main dengan Bot + Daftar). Alasannya: guest yang masuk pertama
  kali TIDAK boleh melihat "Sesi berakhir" (bug aktif G0.3) —
  landing adalah first impression (prioritas audit §3 item 3).
- **D3.1 (T3):** Ilustrasi empty/error = **line-art abstraksi orisinal**
  (grid 4×4, piala siluet, kuda abstrak, awan badai) TIDAK aset
  pihak ketiga. Alasannya: audit §1 "semua aset direkomendasikan
  dibuat sendiri / open-source" + anti-slop + hak cipta.
- **D4.1 (T4):** Hook `useReducedMotion` tunggal untuk efek JS-only;
  guard CSS global tetap sebagai jaring pengaman. Alasannya: pola
  2 lapis sudah ada di `confetti.tsx` (JS) + `globals.css:406`
  (CSS); menyatukan ke 1 hook mengeliminasi 4+ pengecekan
  `matchMedia` yang tersebar, dan memastikan animasi JS tidak
  "palsu mati" (state JS masih berjalan meski transisi CSS nonaktif).
