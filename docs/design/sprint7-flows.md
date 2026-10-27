# Desain Sprint 7 — Learn Layer (S7-T1 .. S7-T5)

**Tiket:** S7-T1..S7-T5 · **Sprint:** 7 · **Peran:** UX/Design · **Tanggal:** 2026-10-27
**Status:** Draft untuk review · design-only (spesifikasi alur/wireframe/copy — tanpa kode).
Bentuk endpoint di tiap tiket adalah **kontrak data untuk backend/frontend (contract-first)**, bukan implementasi.

Sumber: `docs/tickets/S7-learn-layer.md`, `docs/design/sprint6-flows.md` §0 (konvensi S6 berlaku di sini),
`docs/design/chesscom-parity-audit.md` (prinsip a11y DHH **binding**), struktur menu
`docs/rea/chess-web-menu-feature-map.md` §3 Belajar/§4 Berlatih (referensi deskriptif SAJA —
tidak ada aset/teks/ikon chess.com yang disalin), `components/views/learning-hub.tsx` +
`components/views/endgame-drills-view.tsx` (pola yang di-reuse, bukan di-fork).

Fakta dasar yang mengikat: **tidak ada aset video** — semua "pelajaran" adalah materi tertulis +
papan/posisi interaktif (react-chessboard). Larangan faking player video total. Semua angka
(progress, hitung soal, target mingguan, leaderboard) = **riil dari endpoint** — tidak ada
angka mock/hardcoded di copy; placeholder `{}` di bawah HARUS diisi dari respons API.

---

## 0. Konvensi & guardrail (binding untuk kelima tiket)

Sama persis dengan `sprint6-flows.md` §0 (token, copy ID, a11y floor DHH, matriks state,
motion var tunggal `--move-animation-duration` dari `app/realtime.css`, lucide-react,
anti-slop, G0.1–G0.3 auth messaging). Tambahan khusus S7:

### 0.1 Reuse komponen yang DISKONTRA (jangan bikin pohon komponen baru)
| Pola | Sumber | Dipakai di |
|---|---|---|
| Kartu set: grid 1/2/3 kolom, baris `h-2 rounded-full` progress `role="progressbar"`, CTA "Mulai/Lanjutkan/Ulangi", badge tuntas di kanan-atas | `endgame-drills-view.tsx` | T1 daftar course, T5 grid set terfilter |
| Baris navigasi: `select` (Pilih item) + tombol Prev/Next (ChevronLeft/Right) | `learning-hub.tsx` §nav | T1 course-detail (step pagination) |
| Solve mode `PuzzleSolver` + `fetchHint` 3 level + `submitAttempt` | `puzzle-solver.tsx` + T2 tantangan & T1 drill step |
| Papan read-only + panah + squareStyles highlight | `learning-hub.tsx` board | T2 ilustrasi materi & tab "Terangkan" |
| Chip kategori `ctl ctl-choice` + `select` `ctl ctl-sm` | `learning-hub.tsx` | T3 kategori, T5 filter row |
| Kartu target ringkas 1 baris + panel samping | `insights-view.tsx` (S6-T4) | T3 kartu target mingguan |
| Panel kamar `panel p-3.5` + CTA tombol utama | `pvp-panel.tsx` / S6-T2 | T4 classroom |
| Modal: focus trap + fokus awal di CTA + Escape | S2-T1 GameOverModal | T4 join-by-code |

### 0.2 Shell: item menu baru (penambahan ke `app-shell.tsx`, pola S6 §0.5)
- Grup **Belajar**: `Kursus` → `#/courses` (navTab `courses`); `Pelajaran` → `#/learn`
  (navTab `learn`); `Ruang Kelas` → `#/classroom` (navTab `classroom`).
- Grup **Latihan**: `Pusat Latihan` → `#/practice` (navTab `practice`).
  (Label "Pusat Latihan" karena grupnya sendiri sudah bernama "Latihan" — hindari item=grup
  yang tumpang tindih; dev bebas pilih varian lucide, konsisten set shell.)
- Ikon lucide (nama deskriptif): Kursus `Books`, Pelajaran `NotebookText`,
  Pusat Latihan `Target`, Ruang Kelas `Presentation`.
- Deep-link publik: `#/courses/{id}`, `#/learn/{lessonId}`, `#/learn/openings/{eco}`
  (tanpa login — konten statis; aksi tulis tetap login-wall).
- `NavTab` union + `navTabFromHash` di `components/game.tsx`: tambah 4 nilai
  (`courses`, `learn`, `practice`, `classroom`); semua view render di `#main-content`
  (pola shell — jangan overlay).

### 0.3 Gating (lanjutan aturan S6 §6)
- Konten statis (course, lesson, opening line, daftar tema drill) = **terbuka untuk guest**.
- Aksi tulis (catat progres, bookmark, attempt) = login + akun approved;
  `account_pending` → pesan + badge, BUKAN CTA login palsu (G0.1–G0.3).
- Angka pada kondisi guest/pending = tidak tampil angka, ganti tanda "—" + teks penjelas
  (jangan angka 0 yang menyamar sebagai riil, jangan angka mock).

## 1. S7-T1 — Courses (`#/courses` + `#/courses/{courseId}`)

**Konteks:** `lib/courses.ts` (statis terkurasi, pola `lib/learning-hub.ts`):
`Course { id, title, subtitle, level, estMinutes, icon, steps: CourseStep[] }`;
`CourseStep { id, title, kind: "tactic" | "drill" | "quiz", ref: string, summary }`
— `ref` = id puzzle existing / drill set id (`lib/endgame-drills.ts`) / quest id
(`learning-hub`). Progress riil dari tabel progress (DB engineer pilih: reuse
`learning_progress` atau tabel quest existing — kontrak di §1.6, **bukan baru dari nol
bila memang bisa reuse**; jangan bikin table duplikat).

### 1.1 Jalur masuk / keluar
- Masuk: sidebar Belajar → "Kursus" (`#/courses`); deep-link `#/courses/{id}`;
  cross-link dari Pelajar (`#/learn`): tiap lesson punya CTA "Masukkan ke kursus"
  hanya bila lesson tsb memang step di suatu course (anti-slop: CTA hanya tampil
  bila benar ada course yang merujuk id-nya).
- Keluar: step kind `tactic`/`drill` → tombol "Lakukan" pindah ke view yang JUALAH ada
  (puzzles via `navTab:"puzzles"` + deep-link tab, atau drills), dengan state "kembali ke
  course" disimpan di `localStorage.jev_course_resume` (courseId + stepIndex) sehingga
  user dapat kembali; kelar step di view tujuan → tandai selesai (riil via endpoint)
  otomatis hanya jika step terpetakan & sumbernya tercatat selesai. CTA utama detail =
  "Lanjut" (ke step berikutnya) atau "Kembali ke daftar" di header.

### 1.2 Wireframe

Daftar course:
```
┌──────────────────────────────────────────────────────────────────────┐
│ Kursus  [lucide: Books]     (header, judul h1)                      │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ {icon} "Kursus Taktik Dasar"           {level} · {est} mnt      │ │
│ │ {subtitle} (max 2 baris)                                          │ │
│ │ ▓▓▓▓▓▓░░░░░░ {done}/{steps} · {pct}%                            │ │
│ │                                              [Lanjutkan ▸]       │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ (card berikutnya — grid sm:2 lg:3, pola endgame-drills-view)        │
└──────────────────────────────────────────────────────────────────────┘
```
Course detail (pagination step — reuse baris select + Prev/Next learning-hub):
```
┌──────────────────────────────────────────────────────────────────────┐
│ Kursus Taktik Dasar                    [Kembali ke daftar]          │
├──────────────────────────────────────────────────────────────────────┤
│ [Step 1 ▸][Step 2 · aktif][Step 3 ○]  ← chip step (pola tab strip) │
│ │ STEP 2 · {judul step} · {jenis: taktik/drill/kuiz}               │
│ │ {summary step}                                                    │
│ │ [Lakukan pada papan ▸]   [Tandai selesai]   [Lanjut ke Step 3]   │
└──────────────────────────────────────────────────────────────────────┘
```

Pemilihan visual:
- Card = **baris-info di dalam kartu, tanpa gradien/badge marketing** (pola kartu
  endgame-drills: judul + deskripsi 2 baris + progress bar). Alasan: daftar 3–8 course
  harus scannable; informasi kritis = judul, level, lama, progress, CTA — semua satu
  kartu kecil, konsisten dengan grid drill yang sudah ada (tidak inventaris card baru).
- CTA card: `{pct}=0 → "Mulai"` / `0<{pct}<100 → "Lanjutkan"` / `100 → "Ulangi"` —
  **persis logika CTA endgame-drills-view** (reuse perilaku, bukan component).
- Progress bar: `role="progressbar"` + `aria-valuenow` + teks `{solved}/{total} ·
  {pct}%` di bawah bar (data numerik selalu teks, floor a11y §0.4).
- Step pagination = **tab-strip chip + select "Pilih step" tersembunyi (mobile)** —
  reuse pola navigasi learning-hub (select + Prev/Next), karena course biasanya ≤ 10
  step; tab strip untuk ≤ 10, select saat > 10 (dev pilih threshold, jangan 2 sistem).
- "Lakukan" = link keluar ke view existing (YAGNI: materi tidak ditulis ulang di course
  — step hanyalah pointer + 1–2 kalimat summary orisinal).

### 1.3 Copy
- Judul view: "Kursus". Sub: "Jalur latihan terstruktur — tiap langkah mengarah ke materi
  dan drill yang sudah ada di jev-chess."
- Level label (statis dari `lib/courses.ts`): "Pemula" / "Menengah" / "Lanjutan".
- Card baris 2: "{level} · ±{est} menit" (estimasi lama = data kurasi statis, boleh
  hardcoded di `lib/courses.ts` — BUKAN angka riil; label "±" jujur).
- Progress teks: "{done} dari {steps} selesai · {pct}%" (riil dari endpoint).
- CTA: "Mulai" / "Lanjutkan" / "Ulangi" / "Lakukan pada papan" / "Tandai selesai" /
  "Lanjut" / "Kembali ke daftar".
- Step selesai: "Selesai ✓" di chip step (ikon + teks, cue ganda).
- Empty (course tanpa step yang resolv-able): "Kursus ini sedang dirombak — belum ada
  langkah yang bisa dibuka." (tanpa CTA buta; jangan tampilkan CTA ke halaman kosong).
- Loading: "Mengambil kursus…" (`role="status"`).
- Error: "Gagal memuat kursus. Coba lagi." / 503: "Server sedang sibuk. Coba beberapa
  saat lagi."
- Guest/pending: daftar & progress bar tetap tampil; angka guest = "—" + "Masuk untuk
  melihat progresmu" (label tombol jelas, bukan "Masuk untuk melihat…"; pending →
  "Akun menunggu persetujuan admin." + badge).

### 1.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading | skeleton 3 kartu + "Mengambil kursus…" | — | `role="status"` |
| empty (belum ada course) | "Belum ada kursus terbit." (konten kurasi) | "Pelajaran" (ke `#/learn`) | — |
| error/503 | pesan §1.3 | "Coba lagi" | `role="alert"` |
| pending-auth | daftar tampil, progress "—" + pesan | "Lakukan" tetap bisa ke materi statis | `role="status"` + badge |
| guest | daftar tampil, progress "—" | "Masuk untuk melihat progresmu" | label tombol jelas |
| step tak resolv-able | chip step ditandai "tidak tersedia" (bukan hidden) | langkah lain tetap bisa | teks status per chip |

### 1.5 Catatan a11y
- Chip step = `role="tablist"` + `aria-selected` + roving tabindex (pola tab yang sudah
  di-QA di leaderboard S6 — konsisten; saat > 10 step, select menggantikan strip).
- Progress bar sudah punya `role="progressbar"`; pastikan teks persen tetap tersedia
  (jangan bar saja — floor §0.4.5).
- "Lakukan pada papan" = link (`<a>`/button fokusable) dengan `aria-label="Lakukan
  {judul step} pada {nama view}"` — SR tahu ke mana pergi.
- prefers-reduced-motion: transisi bar `duration-[var(--move-animation-duration)]`
  dimatikan; lebar bar tetap benar tanpa animasi.

### 1.6 Kontrak data (dev)
- `GET /api/courses` → `{ courses: [{ id, title, subtitle, level, estMinutes, icon,
  stepCount, doneCount, progressPct }] }` — `doneCount/progressPct` dihitung server
  (riil); guest & pending → `progressPct: null` (UI menampilkan "—").
- `GET /api/courses/{id}?step={n}` → `{ course:{...}, step:{ id, title, kind, ref,
  summary, done, next?: { id, title } }, stepsTotal }`.
- `POST /api/courses/{id}/steps/{stepId}/complete` → idempotent, `{ done, progressPct }`
  riil (perubahan progress diumumkan view via `role="status"` "Step selesai — progress
  {pct}%").
- Sumber tabel: reuse `learning_progress` (pola quest learning-hub) dengan
  `ref_kind:"course_step"` — DB engineer konfirmasi di gate; bila tidak memungkinkan,
  tabel baru `course_progress` minimal `{ user_id, course_id, step_id, completed_at }`
  (dilarang duplikat quest yang sudah merekam hal sama).
- `lib/courses.ts`: `icon` = nama lucide (mis. "Swords", "Shield"), bukan URL/gambar.

---

## 2. S7-T2 — Lessons & Openings Lessons (`#/learn`, `#/learn/openings/{eco}`)

**Konteks:** `#/learn` = upgrade view "Materi Belajar" (navTab lama `vision`).
Pelajaran = materi TERSTULIS + ilustrasi papan (react-chessboard interaktif) —
**jelas ke user: "Materi tertulis — tanpa video"**. Openings lesson = katalog dari
`lib/engines/opening-book.ts` (riil, sudah ada) + `POST /api/opening` (FEN lookup,
S6-T1 tidak mengubahnya). Cross-link: CTA "Materi" di Explorer (S6-T1 `hasLessons`)
arah ke `#/learn/openings/{eco}`.

### 2.1 Jalur masuk / keluar
- Masuk: sidebar → "Pelajaran" (`#/learn`); dari Explorer: "Materi" per node →
  `#/learn/openings/{eco}`; deep-link `#/learn/{lessonId}` publik.
- Keluar: tiap lesson: CTA "Terus berlatih" → routes ke drill/puzzle terkait
  (`#/practice` atau `#/drills`); pelajaran opening → "Main di papan" (mode Tantangan
  di §2.3) + "Buka di Penjelajah" (kembali ke `#/explorer?eco=`). Bookmark = CTA
  per lesson, tersimpan per user.

### 2.2 Wireframe

Katalog lesson:
```
┌──────────────────────────────────────────────────────────────────────┐
│ Pelajaran  [NotebookText]                    [Cari materi…] (input) │
├──────────────────────────────────────────────────────────────────────┤
│ [Taktik ▾][Pembukaan ▾][Akhir ▾]   ← chip filter kategori (pola    │
│                                             chip learning-hub)      │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ {icon} {judul lesson}   {n} menit · {level}          [Bookmark ★]│
│ │ {satu baris deskripsi orisinal}                              ▸  ││
│ └──────────────────────────────────────────────────────────────────┘│
│ (list 1 kolom — lesson = bacaan, bukan grid scan cepat)            │
└──────────────────────────────────────────────────────────────────────┘
```
Detail lesson (pola layout learning-hub: papan kiri + panel kanan):
```
┌──────────────────────────────────────────────────────────────────────┐
│ {judul lesson}      [Bookmark] [Terus berlatih ▸] [Kembali ke daftar]│
├───────────────────────────────────────┬─────────────────────────────┤
│ PAPAN (react-chessboard interaktif)  │ PANEL MATERI (scroll)       │
│                                       │ ┌ Materi ────────────────┐ │
│  posisi ilustrasi step saat ini      │ │ "Materi tertulis —      │ │
│  + panah/lingkaran langkah kunci     │ │  tanpa video. Ilustrasi │ │
│                                       │ │  di papan mengikuti     │ │
│ [←  Sebelumnya] [Berikutnya →]       │ │  materi." (sub-judul)  │ │
│                                       │ │ 1. Paragraf konsep…     │ │
│                                       │ │ 2. Paragraf + FEN step  │ │
│                                       │ │    (klik → pindah papan)│ │
│                                       │ └──────────────────────────┘│
│                                       │ [Tantangan ▸] [Selesai ✓]   │
└──────────────────────────────────────────────────────────────────────┘
Mobile: panel jadi bottom-sheet (pola S1/S6 §1).
```

Detail opening (3 mode — `#/learn/openings/{eco}`):
```
│ {eco} {nama opening}   (riil dari opening-book + /api/opening)     │
│ [Terangkan] [Tantangan] [Kemahiran]   ← 3-mode, pola tab strip    │
│ Terangkan   → jalur langkah buku step-by-step, papan bergerak
│               per langkah, teks orisinal 1–2 kalimat per fase
│               (awal/gambit/posisi)
│ Tantangan   → "Reproduksi jalur: mainkan {k} langkah pertama
│               {nama} pada papan (mulai dari posisi awal)"
│               instruksi: input SAN langkah 1–{k} → validasi vs book
│ Kemahiran   → drill mini: 2–3 puzzle dari posisi {nama}
│               (puzzle existing bertema opening, reuse solver)
```

Pemilihan visual:
- Lesson list = **1 kolom list baris** (bukan grid). Alasan: lesson adalah entri
  "judul + deskripsi 1 baris + CTA"; grid 3 kolom memaksa 2 baris untuk deskripsi
  yang harusnya 1 baris — fraksi visual tanpa informasi. Sama persis dengan pola
  list baris kartu arena S6-T5.
- Detail lesson = **papan kiri + panel kanan** — reuse layout learning-hub PERSIS
  (`grid lg:grid-cols-[1fr_380px]` + BoardControls + panel `panel p-3.5`); tidak ada
  pohon komponen baru (guardrail §0.1).
- "Materi tertulis" = **sub-judul permanen di panel**, bukan toast satu kali:
  jujur terus bahwa tidak ada video — anti-slop (jangan player palsu).
- 3-mode opening: **tab strip chip** (pola `ctl ctl-choice`), bukan wizard 3 halaman —
  mode saling terkait pada opening yang sama, navigasi harus instan.

### 2.3 Copy
- Sub-judul katalog: "Materi orisinal jev-chess — tertulis + ilustrasi papan.
  Pelajaran pembukaan dari buku pembukaan lokal (riil dari lib/engines/opening-book)."
- Label mode: "Terangkan" / "Tantangan" / "Kemahiran" + deskripsi 1 baris per tab:
  - Terangkan: "Jalur langkah demi langkah, penjelasannya mengikuti papan."
  - Tantangan: "Buat sendiri {k} langkah pertama — papan memvalidasi."
  - Kemahiran: "{n} drill singkat dari posisi {nama} (riil dari pool puzzle)."
- Tantangan: instruksi "Giliranmu: tulis langkah ke-{i} (SAN)." / valid:
  "Betul — {san} cocok dengan jalur buku." / salah: "Bukan jalur buku. Coba lagi."
  / selesai: "Selesai — kamu reproduksi {k} dari {total} langkah {nama}."
- Bookmark: label tombol "Simpan" / "Tersimpan ✓" (state aria-pressed; SR baca
  "Pelajaran {judul}, tersimpan").
- Selesai: "Pelajaran selesai ✓" + CTA "Terus berlatih" → kategori terkait.
- Kosong (kemahiran tanpa pool puzzle): "Belum ada drill untuk {nama} — mulai dari
  jalur Terangkan dulu." (CTA ke tab lain, bukan tombol mati).
- Loading: "Membuka pelajaran…" ; Error: "Gagal memuat pelajaran. Coba lagi."
- Guest: semua materi + tantangan boleh; "Simpan" → "Masuk untuk menyimpan
  pelajaran" (hanya ini login-wall).

### 2.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading | skeleton panel + papan posisi awal | — | `role="status"` "Membuka pelajaran…" |
| empty (kategori filter) | "Belum ada materi di kategori ini." | "Tampilkan semua" | `role="status"` |
| empty (kemahiran) | pesan §2.3 | "Terangkan dulu" (tab) | teks |
| error/503 | pesan + "Coba lagi" | "Coba lagi" | `role="alert"` |
| pending-auth | materi tampil; "Simpan" disabled + "Akun menunggu persetujuan admin." | — | `role="status"` + badge |
| guest | penuh; bookmark login-wall | "Masuk untuk menyimpan pelajaran" | label jelas |
| tantangan salah | "Bukan jalur buku. Coba lagi." (hint opsional 1x) | "Tampilkan petunjuk" | `role="status"` |

### 2.5 Catatan a11y
- Tab mode = `tablist` + roving tabindex (konsisten S6 §4.5); papan interaktif di
  mode Terangkan: tombol "Lanjut langkah" fokusable terpisah (jangan SR harus
  berinteraksi dengan DOM papan react-chessboard untuk maju).
- Papan illustrasi: `aria-label="Ilustrasi {judul pelajaran}, posisi langkah {i}"`
  + urutan SAN di panel (teks) — SR tidak buta visual.
- Bookmark = 1 tombol per lesson, state `aria-pressed` + ikon `Star` (outline/solid
  beda, teks selalu ada di samping ikon — cue ganda).
- prefers-reduced-motion: fade panel & transisi tab dimatikan; isi tetap tampil.

### 2.6 Kontrak data (dev)
- `lib/lessons.ts` (statis, pola `lib/learning-hub.ts`): `Lesson { id, category,
  title, description, level, estMinutes, icon, steps: [{ text, fen?, san?, note? }]
  }` — `steps` = materi tertulis + FEN per ilustrasi (bukan video).
- `GET /api/lessons?category=` → `{ lessons: [...] , progressPct?: null|number }`.
- `POST /api/lessons/{id}/bookmark` / `DELETE .../bookmark` → `{ bookmarked: true }`.
- Opening lesson (riil): `GET /api/openings/{eco}/lesson` →
  `{ eco, name, sanPath (dari opening-book, riil), totalMoves, mastery: { puzzleIds:
  string[] } (pool puzzle bertema opening — sumber: query themes kolom puzzles,
  seperti kurasi lib/endgame-drills.ts), bookLines: [{ san, fen, phase: "awal"|"gambit"|"posisi" }] }`.
- `POST /api/openings/{eco}/challenge` → `{ k, acceptsSan: string[] }` (server memvalidasi
  langkah 1..k vs `opening-book.ts` + `/api/opening` — angka riil).
- Cross-link Explorer: field `hasLessons` di `GET /api/explorer` (S6-T1) diaktifkan
  = `true` hanya bila `GET /api/openings/{eco}/lesson` punya `sanPath.length >= 1`.

## 3. S7-T3 — Practice Hub (`#/practice`)

**Konteks:** satu pintu masuk ke drill existing (tactical motif = puzzle themes S3
`themes-mastery-view`, endgame = drills S4 `endgame-drills-view`, opening = pool
S7-T2), plus kartu target mingguan riil dari `puzzle_attempts`.

### 3.1 Jalur masuk / keluar
- Masuk: sidebar (grup Teka-Teki atau Latihan — dev pilih, label "Pusat Latihan") →
  `#/practice`; task card home "Target mingguanmu" (hanya muncul bila ada target
  yang terukur riil minggu ini — anti-slop: tanpa target = tidak ada card, bukan
  placeholder).
- Keluar: tiap chip kategori → route ke view existing tanpa duplicating UI-nya
  (puzzles tab Tema / drills / learn openings dengan query `?filter=`);
  CTA kartu target "Lanjut berlatih" → drill terdekat dengan progres < 100%.

### 3.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ Pusat Latihan  [Target]        (header h1)                           │
├──────────────────────────────────────────────────────────────────────┤
│ KATEGORI                                                            │
│ [Motif Taktik] [Permainan Akhir] [Pembukaan]      ← chip (pola     │
│   → /puzzles?tab=themes        → /drills           → /learn?cat=open │
│                                                                     │
│ ┌─ Target Mingguan ────────────────────────────────────────────────┐│
│ │ Diselesaikan minggu ini: {done} dari {target}  (riil dari       ││
│ │  puzzle_attempts, 7 hari berjalan, bukan angka preset)          ││
│ │ ▓▓▓▓▓░░░ {done}/{target}                                       ││
│ │ [Lanjut berlatih ▸]   (ke drill set terdekat < 100%)            ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─ Latihan Terbuka ────────────────────────────────────────────────┐│
│ │ {nama set/tema} · {solved}/{total} · {pct}%      [Buka ▸]      ││
│ │ (baris per set drill/tema riil, pola daftar endgame-drills)     ││
│ └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

Pemilihan visual:
- Chip kategori = **3 chip saja** (tactical/endgame/opening), pola `ctl ctl-choice`
  learning-hub — bukan submenu per tema (YAGNI: tema sudah ada di views-nya; hub ini
  hanya routing + target). Alasan: hub tidak boleh menyalin ulang daftar tema
  (duplikasi state); chip = router ke view owner.
- Kartu target = **kartu 1 panel** (pola kartu ringkas insights S6-T4): angka 2 +
  bar + 1 CTA. Target `{target}` = konfig sederhana server-side (default 10/minggu,
  **riil** dari `puzzle_attempts` 7 hari berjalan — bukan mock, bukan user-input
  untuk S7; input target = antrean fitur, jangan disisipkan).
- "Latihan Terbuka" = baris set (bukan grid) — konsisten dengan baris kartu arena
  S6-T5 untuk daftar yang scannable.

### 3.3 Copy
- Sub judul: "Pilih jalur latihan — semua angka di sini dihitung dari soal yang
  sudah kamu kerjakan."
- Chip: "Motif Taktik" / "Permainan Akhir" / "Pembukaan".
- Kartu target: "Target mingguan: {done} dari {target} soal" + sub "Dihitung dari
  7 hari berjalan (riil)". CTA: "Lanjut berlatih".
- Target tercapai: "Target minggu ini tercapai ✓ — {done} soal." (ikon + teks).
- Empty (belum ada attempt): "Belum ada soal selesai minggu ini. Mulai dari Motif
  Taktik dulu." (CTA chip, bukan angka 0/10 yang palsu).
- Loading: "Menghitung target mingguan…" ; Error: "Gagal memuat pusat latihan.
  Coba lagi."

### 3.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading | chip aktif + skeleton kartu | — | `role="status"` |
| empty (attempt 0) | pesan §3.3 | chip "Motif Taktik" | `role="status"` |
| error/503 | pesan + "Coba lagi" | "Coba lagi" | `role="alert"` |
| pending-auth | chip tetap route (view drill memgate sendiri); kartu target "—" | — | `role="status"` + badge |
| guest | chip + list riil (publik); kartu target "—" | "Masuk untuk menghitung target mingguanmu" | label jelas |
| tercapai | banner §3.3 | "Latihan terbuka" (anchor ke list) | `role="status"` |

### 3.5 Catatan a11y
- Chip = `aria-pressed` + perubahan pilihan diumumkan `role="status"`
  ("Arahkan ke Permainan Akhir") bila SR aktif.
- Kartu target: angka selalu teks + progressbar `aria-label`; jangan bar tanpa angka
  (floor §0.4.5).
- prefers-reduced-motion: bar target transisi warna dimatikan.

### 3.6 Kontrak data (dev)
- `GET /api/practice/summary` → `{ weekDone, weekTarget, weekStart (ISO), sets:
  [{ id, title, theme, solved, total, progressPct, view: "puzzles"|"drills"|"openings",
  drillRef? }] }` — `weekDone` = count `puzzle_attempts.correct=1` dalam 7 hari
  berjalan (riil); `sets` digabung dari `/api/endgames/drills` + themes (S3) +
  opening pools (S7-T2) — **satu sumber query server, jangan 3 fetch paralel client
  yang bisa tidak konsisten**.
- `weekTarget` = konfig server (mulai 10); endpoint wajib field `weekStart` agar UI
  bisa menampilkan "sejak {tgl}".

---

## 4. S7-T4 — Classroom (`#/classroom`)

**Konteks:** join-by-room-code + board collab "saling jelaskan" — reuse mekanik
room Pvp existing (`app/api/pvp/route.ts` op create/join/move + WS bus ADR-002,
`PvpRoom` in-memory), mode annotate bersama. YAGNI: 1 room code, 2 pemain, move +
catatan teks; tanpa persistent rekaman, tanpa AI matching.

### 4.1 Jalur masuk / keluar
- Masuk: sidebar → "Ruang Kelas" (`#/classroom`); dari pairing panel (opsi CTA
  "Tanya kelas" hanya bila user punya room aktif — anti-slop).
- Keluar: "Tinggalkan" → lobby/panel awal; room penuh (2) → tamu ketiga dapat
  status "Penuh", bukan antrian (YAGNI tanpa queue).

### 4.2 Wireframe

Lobby (tanpa room aktif):
```
┌──────────────────────────────────────────────────────────────────────┐
│ Ruang Kelas  [Presentation]        (header h1)                      │
├──────────────────────────────────────────────────────────────────────┤
│ Kode ruang: [ 123456 | Salin ]   [Coba kode…]      ← input join     │
│                                                                     │
│ ┌─ Status ruang ──────────────────────────────────────────────────┐│
│ │ ● Tidak ada yang bergabung. (dot --muted, teks status)          ││
│ │ Buat ruang baru → memunculkan kode {code} yang bisa dibagikan.  ││
│ └──────────────────────────────────────────────────────────────────┘│
│ [Buat ruang baru]                                                   │
└──────────────────────────────────────────────────────────────────────┘
```
Room aktif (2 pemain, collab board + panel catatan samping):
```
┌──────────────────────────────────────────────────────────────────────┐
│ {code} · {pemain1} vs {pemain2}   [Tinggalkan]  (kode bisa disalin) │
├───────────────────────────────────────┬─────────────────────────────┤
│ PAPAN (react-chessboard, 2 player)   │ CATATAN (panel, 300px)     │
│  move bersama, giliran terlihat       │ ┌───────────────────────┐ │
│  [←] [→] [Balik]  (kontrol move)     │ │ @p2: "coba lihat d5  │ │
│                                       │ │   terancam" (ts)       │ │
│                                       │ │ @p1: "betul — f6 juga │ │
│                                       │ │   opsi" (ts)          │ │
│                                       │ │ [Tulis catatan…][Kirim]│ │
│                                       │ └───────────────────────┘ │
│                                       │ sub: "Catatan bertahan    │
│                                       │ hanya selama room aktif."  │
└───────────────────────────────────────┴─────────────────────────────┘
Mobile: catatan jadi bottom-sheet di bawah papan (pola S1).
```

Pemilihan visual:
- Join = **input + tombol "Coba"** di lobby (bukan modal besar) — YAGNI: 1 input
  kode, bukan form 5 field. Bilang apa yang terjadi dengan copy §4.3, jangan
  dialog.
- Catatan panel = **list teks + input 1 baris** (pola chat ringan, baris per
  penulis dengan timestamp) — bukan rich editor (YAGNI; plain text saja).
- Status "● Tidak ada yang bergabung" = dot + **teks** (bukan dot saja — cue
  ganda floor §0.4.3); dot hijau saat 1 pemain, penuh 2 pemain.

### 4.3 Copy
- Judul: "Ruang Kelas". Sub: "Jelaskan langkah bersama — 2 pemain, papan dan
  catatan bersama. Tanpa rekaman: catatan hilang saat ruang tutup."
- Input: label "Kode ruang" (placeholder "mis. 123456"); tombol "Coba" /
  "Buat ruang baru".
- Status: "Tidak ada yang bergabung." / "{p} bergabung ({p}/2)." /
  "Penuh — ruang kelas maksimal 2 pemain."
- Catatan: placeholder input "Tulis catatan untuk {p1}…" + tombol "Kirim"
  (Enter juga kirim); kos: "Catatan belum ada." / "Catatan {author}:
  '{teks}'" (sr-only live region).
- Move: status giliran "Giliran {warna} ({user})" (teks di panel atas papan).
- Tinggalkan: "Tinggalkan ruang?" [Tetap] [Tinggalkan] (fokus awal "Tetap"
  — default aman, pola S6 §3.5).
- Error join: "Ruang {kode} tidak ditemukan." / "Ruang {kode} sudah penuh."
- Loading: "Menghubungkan ke ruang…" ; WS putus: "Koneksi terputus —
  mencoba ulang… (3×)" lalu "Koneksi terputus. Ruang mungkin sudah ditutup."

### 4.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading (join/membuat) | "Menghubungkan ke ruang…" + tombol disabled | — | `role="status"` |
| empty (tidak ada room user) | lobby + "Tidak ada yang bergabung." | "Buat ruang baru" | dot + teks |
| empty (catatan) | "Catatan belum ada." | input tetap bisa | — |
| error (kode salah) | "Ruang {kode} tidak ditemukan." | "Coba lagi" (kode tetap di input) | `role="alert"` |
| penuh | "Penuh — ruang kelas maksimal 2 pemain." | "Tinggalkan" | teks status |
| pending-auth | "Akun menunggu persetujuan admin — ruang kelas belum tersedia." | — | `role="status"` + badge |
| WS putus | "Koneksi terputus — mencoba ulang…" → gagal: pesan §4.3 | "Coba lagi" / "Tinggalkan" | `role="alert"` |

### 4.5 Catatan a11y
- Input kode: `inputmode="numeric"`, `aria-label="Kode ruang"`, label terlihat
  (bukan placeholder saja).
- Live region `polite` mengumumkan: join/leave pemain, giliran berubah, catatan
  baru (teks, bukan warna dot saja). Throttle update WS: satu pengumuman per
  event, jangan per frame.
- Panel catatan scroll-able: `aria-label="Daftar catatan ruang"`; input
  fokusable; Enter kirim, Shift+Enter tidak perlu (input 1 baris).
- prefers-reduced-motion: highlight petak move terakhir dimatikan (tetap ada
  teks "Giliran {warna}").

### 4.6 Kontrak data (dev)
- Reuse op `create`/`join`/`move` di `/api/pvp` — **tambah flag `purpose:
  "classroom"` di create + field `note?: { author, text, at }[]` di
  `publicRoom()` (S6-T2 sudah menambah field ke `PvpRoom` — pola yang sama,
  jangan mekanik room baru).
- WS event baru (bus ADR-002): `classroom_note { code, author, text, at }` +
  piggyback `room_moved` yang sudah ada untuk sync papan (opsi move sudah
  memakai op `move` room).
- `POST /api/classroom/notes { code, text }` (2–500 char; server reject > 500
  dengan 422 "Catatan terlalu panjang (maks 500).") — validasi sisi server,
  bukan hanya UI.
- Tanpa tabel baru: catatan in-memory pada room (YAGNI, tanpa rekaman
  persisten sesuai tiket) + TTL room Pvp yang sudah ada (30 menit,
  `rooms` map GC) — jangan bikin penyimpanan kedua.

## 5. S7-T5 — Endgames Multi-Filter + Leaderboard (`#/drills` upgrade)

**Konteks:** view drill endgame S4 (`endgame-drills-view.tsx` + `GET /api/endgames/drills`)
sudah ada: grid 6 set + progress bar + CTA per set. Yang ditambah: (a) filter row
(tema + progress), (b) panel leaderboard drill riil dari data completion.

### 5.1 Jalur masuk / keluar
- Masuk: sidebar → "Permainan Akhir" (`#/drills`); dari Practice hub
  (`#/practice` chip "Permainan Akhir" §3.2); dari review partai: tombol kecil
  "Latihan posisi serupa" hanya bila hasil analisis (riil dari CAPS/posisi
  arsip) memetakan ke tema drill (anti-slop: tanpa mapping = tidak ada CTA).
- Keluar: klik set → solve mode (perilaku S4 tidak berubah: `PuzzleSolver` +
  `Kembali`); dari leaderboard: klik nama pemain → `#/insights/{username}`
  (deep-link publik S6-T4) — jalur keluar bermakna, bukan dead-end.

### 5.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ Permainan Akhir  [Dumbbell]      (header h1, pola S4 dipertahankan)  │
├──────────────────────────────────────────────────────────────────────┤
│ FILTER ROW                                                          │
│ Tema: [Semua|Skakmat|Pion|Perwira|Benteng|Menteri|Ketimpangan]     │
│ Progress: [Semua|Mulai (0–49%)|Berjalan (50–99%)|Tuntas (100%)]    │
│ (pola chip ctl ctl-choice learning-hub; 2 baris, wrap di mobile)   │
│                                                                     │
│ ┌─ Grid set terfilter (pola endgame-drills, 1/2/3 kolom) ────────┐  │
│ │ {nama set} · {theme} · {solved}/{total} · {pct}%  [Mulai/…]    │  │
│ └────────────────────────────────────────────────────────────────┘  │
│ (kosong: "Belum ada set untuk filter ini." + [Reset filter])       │
│                                                                     │
│ ┌─ Peringkat Latihan ─────────────────────────────────────────────┐ │
│ │ [Global|7 hari]  (tab chip kecil, pola leaderboard S6)         │ │
│ │ #  Pemain        Set paling tuntas    Skor drill               │ │
│ │ 1  @{u1}        {nama set} · {n}/{m}   {pct}% (riil)          │ │
│ │ 2  @{u2}        {nama set} · {n2}/{m2} {pct2}% (riil)         │ │
│ │ (baris sendiri di-highlight, pola leaderboard-view existing)   │ │
│ │ [Belum ada data] (kosong — copy §5.3)                          │ │
│ └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Pemilihan visual:
- Filter = **chip 2 baris** (bukan dropdown `select`). Alasan: tema drill
  hanya 7 nilai + progress 4 nilai = himpunan kecil & tetap; chip
  `aria-pressed` sudah di-QA di views S6 (T2/T5) — konsisten, dan hasil
  filter terlihat langsung (bukan tersembunyi di dialog). Mobile: wrap baris.
- Label tema memakai **nama set drill riil dari `lib/endgame-drills.ts`**
  (Skakmat = set yang memuat motif skakmat, Pion/Perwira/Benteng/Menteri/
  Ketimpangan = `theme` kolom set); nilai "Semua" selalu ada. Jangan bikin
  taksonomi baru di luar `puzzles.themes` (duplicacy — YAGNI).
- Leaderboard = **tabel teks sederhana 4 kolom** + highlight baris sendiri
  (pola `leaderboard-view` S4-T3) — bukan card ber-gradasi/medali 3D
  (anti-slop; ini panel di bawah grid, bukan view utama). Skor =
  `{pct}%` per set ter-tuntas-nya (riil dari completion data; definisi
  "skor drill" = progress tertinggi di antara set — angka tetap teks).
- Scope tab: hanya **Global / 7 hari** (bukan rentang bebas) — YAGNI;
  data drill completion per user baru mulai terisi sekarang, rentang
  panjang hanya akan menampilkan papan kosong berbulan-bulan (anti-slop).

### 5.3 Copy
- Label filter: "Tema:" / "Progress:". Chip progress: "Mulai" (0–49%),
  "Berjalan" (50–99%), "Tuntas" (100%) — rentang selalu tampil di tooltip
  `title` + teks (bukan warna chip saja).
- Kosong filter: "Belum ada set untuk filter ini." + CTA "Reset filter".
- Kosong leaderboard: **"Belum ada data — selesaikan satu set latihan
  dulu, lalu namamu akan muncul di sini."** (mengarahkan, bukan
  "0 pemain"; angka 0 tidak pernah tampil sebagai nilai riil palsu).
- Baris leaderboard: "#{rank} · @{username} · {nama set} · {n}/{total} ·
  {pct}%" (semua riil; `n` = soal tuntas di set tersebut).
- Baris sendiri: "Kamu" menggantikan "@{username}" (pola highlight
  leaderboard S4).
- Loading: "Mencocokkan filter…" / leaderboard: "Mengambil peringkat…"
  (`role="status"`).
- Error: "Gagal memuat peringkat latihan. Coba lagi." / 503: "Server
  sedang sibuk."
- Guest: grid set + filter tetap tampil; panel leaderboard diganti status
  teks "Peringkat latihan membutuhkan akun." + CTA "Masuk untuk melihat
  peringkat" (login wall di panel saja, bukan di seluruh view — pola S6
  gating).

### 5.4 Matriks state
| Kondisi | Tampilan | CTA | A11y |
|---|---|---|---|
| loading | grid skeleton + "Mencocokkan filter…" | — | `role="status"` |
| empty (filter) | "Belum ada set untuk filter ini." | "Reset filter" | `role="status"` |
| empty (leaderboard) | "Belum ada data — selesaikan satu set latihan dulu, lalu namamu akan muncul di sini." | "Mulai" (anchor ke set pertama 0%) | teks |
| error/503 | pesan §5.3 | "Coba lagi" | `role="alert"` |
| pending-auth | grid tampil; panel "Akun menunggu persetujuan admin — peringkat tampil setelah disetujui." | — | `role="status"` + badge |
| guest | grid + filter; panel leaderboard = status login-wall | "Masuk untuk melihat peringkat" | label jelas |

### 5.5 Catatan a11y
- Filter chip = `aria-pressed` + hasil diumumkan via `role="status"`
  ("Tampil {n} set untuk tema {tema}, progress {label}").
- Tabel leaderboard = `role="table"` + `<caption>` sr-only
  "Peringkat latihan endgame, scope {scope}"; baris sendiri diberi
  `aria-current="true"` (bukan warna highlight saja — cue ganda).
- Progress bar set: `role="progressbar"` + angka teks (pola S4 sudah ada,
  pertahankan).
- prefers-reduced-motion: highlight baris & transisi chip dimatikan.

### 5.6 Kontrak data (dev)
- `GET /api/endgames/drills?theme=&progress=` → bentuk S4 + param filter:
  `theme` = salah satu `puzzles.themes` endgame (7 nilai, dari
  `lib/endgame-drills.ts` — sumber taksonomi tunggal); `progress` =
  `all|started|ongoing|done` (mapping 0–49/50–99/100). Response tetap
  `{ sets: [DrillSet] }` (field S4 dipertahankan, filter server-side).
- `GET /api/endgames/leaderboard?scope=global|7d` →
  `{ rows: [{ rank, username, topSet: { id, title, solved, total,
  progressPct } }], selfRank?: number|null }` — riil dari
  completion data (DB engineer tentukan sumber di gate:
  `puzzle_attempts` join kurasi `lib/endgame-drills.ts` per user,
  atau tabel progress riil yang sama yang dipakai S7-T1 — **jangan
  tiga sumber berbeda**). Minimum 1 baris per scope untuk tampil;
  tanpa data → `rows: []` (UI pakai empty copy §5.3, bukan angka 0).
- Guard guest: leaderboard 401 (bukan data) → UI tampilkan status
  login-wall (§5.3), grid tetap 200.

---

## 6. Catatan lindung (cross-tiket)

- Semua 5 view: `#main-content` tetap target skip-link; render di main
  (pola shell S4-T1), jangan overlay. `NavTab` union + `navTabFromHash`
  di `components/game.tsx` dan `app-shell.tsx`: tambah 4 nilai (§0.2).
- Motion: tidak ada durasi baru; `--move-animation-duration`
  (dari `app/realtime.css`) satu-satunya; `prefers-reduced-motion`
  mematikan semua transisi S7.
- Aset: tidak ada aset/teks/ikon/foto/font chess.com; lucide-react +
  token CSS + copy ID orisinal. Ikon course/lesson = nama lucide di
  `lib/courses.ts` / `lib/lessons.ts`, bukan gambar.
- Angka: semua progress/%/skor/kuota = riil dari endpoint (kontrak
  §x.6 di tiap tiket). Konten kurasi statis (`estMinutes`, deskripsi,
  FEN ilustrasi) boleh hidup di `lib/*.ts` — itu bukan angka "riil",
  dan labelnya tidak boleh diklaim sebagai statistik.
- Gating: konten statis + tantangan bacaan = guest OK; aksi tulis
  (progress, bookmark, catatan kelas, attempt) = login + approved;
  `account_pending` → pesan + badge, jangan CTA login palsu (G0.1–G0.3).
- Tanpa aset video: setiap view S7 yang disebut "pelajaran" WAJIB
  menampilkan sub-judul "Materi tertulis" (§2.2) — tidak boleh ada
  placeholder player, poster frame, atau tombol putar.
- Regresi: perilaku `endgame-drills-view.tsx` (S4) tidak berubah —
  S7-T5 hanya menambah filter + panel leaderboard di bawah;
  `learning-hub` (navTab `vision`) tetap berfungsi, S7-T2 menambah
  `navTab "learn"` baru, bukan mengganti `vision`.
- Dua agent backend/frontend di repo yang sama: frontend menambah
  `navTab` union + shell items; backend menambah endpoint §x.6 tanpa
  mengubah respons lama S4/S6 (field tambahan, bukan perubahan tipe).


