# S9-T3 — Standardisasi state components: 1 ErrorState / 1 EmptyState / 1 LoadingState

**Role**: PM · **Sprint**: S9 · **Sumber**: `docs/design/s9-s10-scope.md` S9-T3 +
`docs/design/chesscom-parity-audit.md` G6.2–G6.4.

## 1. Context (status riil, diverifikasi 991eb25)

**Tidak ada komponen state bersama.** `components/ui/` berisi hanya
`alert.tsx badge.tsx button.tsx card.tsx dialog.tsx scroll-area.tsx` —
grep `EmptyState|ErrorState|LoadingState` di `components/` = 0 hasil.

**Pola error/loading/empty per view** (grep `error ?|error &&|Coba lagi`
di `components/views/*.tsx`): 12 view menulis pola sendiri —
`archive-view, classroom-view, courses-view, daily-puzzle-view,
endgame-drills-view, explorer-view, friends-view, leaderboard-view,
openings-view, puzzle-view, scan-view, tournaments-view`. Contoh
divergensi riil:
- `leaderboard-view.tsx:140-156` — loading = span inline `animate-pulse`
  "Memuat papan peringkat…"; error = panel + tombol "Coba lagi";
  empty = card "Papan masih kosong — main rated untuk masuk papan" +
  CTA "Main sekarang" (empty-state terbaik saat ini, jadi template).
- `endgame-drills-view.tsx:446-467` — loading "Mengambil peringkat…"
  (`role="status"`), error `role="alert"` + "Coba lagi" di header,
  empty :476 "Belum ada data — selesaikan satu set latihan dulu…".
- `tournaments-view.tsx:38-41,178-186` — pola ketiga: state
  `authNote`/`toast` + busy-per-id, tanpa `role="alert"`/`role="status"`.
- `puzzle-view.tsx:83-92` — error ditelan: `if (!retryRef.current)
  return;` (percobaan pertama di-silent, kedua baru tampil) — pola
  paling buruk, wajib disamakan.

**Kontrak S8 view** (helper `.view-root/.view-head/.view-body/
.view-grid-board/.view-cols/.view-cards` di `app/globals.css:476-523`):
27/29 file view sudah pakai helper; **2 tidak**: `components/views/
classroom-view.tsx` dan `components/views/game-review.tsx` (grep
`view-root|view-head|view-body` = 0 di keduanya). Note: dua-duanya
di-wrap `<div className="view-root">` oleh parent `game.tsx:1348-1351`
(classroom) dan :1512 (game-review) — jadi fix = migrasi pola A/B/C/D
ke DALKAM view (S8 scope) atau konfirmasi wrapper memadai (TL putar).

**Empty-state tanpa ilustrasi/CTA** (G6.4): `archive-view.tsx:258`
= `<p>Belum ada partai</p>` telanjang (no CTA, no ilustrasi);
`friends-view.tsx:229-232` = teks "Belum punya teman — tambahkan
dengan username." (ada, tapi tanpa CTA tombol); leaderboard sudah
lengkap (template). `missed-puzzles-view.tsx:197-205` dan
`themes-mastery-view.tsx:76` empty-tekst saja.

**Loading**: pola 3 macam bercampur — `animate-pulse` inline
(leaderboard/friends/courses), `animate-spin` Loader2 (courses
:174-180, endgame-drills board), spinner `Loader2` vs pulse. G6.2
"standarkan skeleton vs spinner ke satu komponen".

## 2. Task (sub-task per file)

**T3.1 — Komponen** (file baru di `components/ui/`):
- `components/ui/error-state.tsx` — `ErrorState`: props
  `{ message: string; onRetry?: () => void; code?: string; ctx?: string }`.
  Render: pesan generik + tombol "Coba lagi" (jika `onRetry`) +
  `<span className="sr-only">Kode error: {code}</span>` +
  `role="alert"`. Aksen warna dari `var(--destructive)` (token CSS,
  anti-slop — tidak warna hex baru).
- `components/ui/empty-state.tsx` — `EmptyState`: props
  `{ title: string; hint?: string; ctaLabel?: string; onCta?: () => void }`.
  Ilustrasi original inline SVG sederhana (bukan aset pihak ketiga,
  pola icon 3D existing `components/icons3d.tsx` atau SVG baru di
  `components/ui/` — TL pilih, tanpa aset luar), 1 CTA max.
- `components/ui/loading-state.tsx` — `LoadingState`: props
  `{ label: string; skeleton?: "row" | "grid" | "board" }`.
  Skeleton = blok `animate-pulse` (existing token) +
  `role="status" aria-live="polite"` label (pola leaderboard :143
  yang SUDAH benar).

**T3.2 — Ganti di view (12 view di §1)** — tiap view: import 3
komponen, ganti blok `error ? …`, `loading ? …`, empty telanjang.
Urutan kerja per view (diff minimal):
1. `puzzle-view.tsx` — hapus silent-first-retry (:83-92); pakai
   ErrorState + LoadingState.
2. `archive-view.tsx` — empty :258 → EmptyState + CTA "Main sekarang"
   (prop navigasi via `onNavigate` existing HomeView-style, atau
   tanpa CTA bila tidak ada route target — minimal CTA "Cari dari
   Explorer" bila ada; TL putar).
3. `tournaments-view.tsx` — `authNote` :183-186 → ErrorState (tanpa
   retry untuk authNote), toast tetap.
4. `classroom-view.tsx` + migrasi `.view-*` (lihat T3.4).
5. Sisanya (leaderboard, friends, courses, endgame-drills, explorer,
   openings, scan, daily-puzzle) — swap 1:1 ke komponen; copy teks
   TIDAK berubah (anti-slop: jangan romantisasi copy).

**T3.3 — View S8 contract (2 file)** — `classroom-view.tsx` dan
`game-review.tsx`: adopsi Pola A (`.view-head` + `.view-body`)
sesuai `docs/design/sprint8-ia.md` §3, di-gate `1360×768` no-scroll.
Bila TL memutuskan wrapper parent memadai, dokumentasikan di
ticket ini + update scope doc — jangan diam-diam.

**T3.4 — Empty-state upgrade** — `friends-view.tsx:229` tambah
CTA (tombul, bukan hanya instruksi teks); `missed-puzzles-view` dan
`themes-mastery-view` empty → EmptyState (tanpa CTA paksa — 0 puzzle
gagal = "mantap", :197 sudah ok, tinggal wrap).

## 3. Acceptance criteria (observabel)

- `grep -rn "Coba lagi" components/views/*.tsx` setelah T3 = hanya
  muncul via `ErrorState` (import) — 0 view menulis tombol retry
  manual. (Verifikasi: `grep -rln "Coba lagi" components/views/`
  → 0 file selain import.)
- Di `1360×768`, 8 section IA S8: tiap view yang difetch render
  LoadingState dengan `role="status"` (QA DevTools: 1 pola, bukan
  3 macam spinner).
- `archive-view` kosong → EmptyState dengan ilustrasi + tepat 1 CTA.
- `classroom-view` + `game-review` render di dalam `.view-root`
  (grep `view-head` di kedua file → ≥1 hit) ATAU note TL tertulis
  di sini.
- Regresi: semua view approve-user render identik data (no-mock:
  angka masih dari endpoint, tanpa perubahan fetch).

## 4. Guardrail (JANGAN)

- **Jangan ubah endpoint / lib / DB** (semua perubahan frontend di
  `components/` saja; fetch tetap apa adanya).
- Jangan hapus fitur: `role="alert"` yang sudah benar
  (endgame-drills :455, friends presence dot :240-242) tetap.
- Jangan romantisasi copy / tambah animasi dekoratif — ganti
  struktural saja (anti-slop, minimal-diff).
- Jangan sentuh pola `authStatus`/`authErrorText` yang sudah benar
  (S9-T1 territory); T3 hanya ganti render layer.
- Ilustrasi EmptyState: SVG original, tanpa aset chess.com (hard
  rule kontrak S7 §4.6 tetap berlaku).
