# UI Parity v2 — spesifikasi polish jev-chess mendekati pola chess.com

Target: Web Dev. Next.js existing (App Router, Tailwind, shadcn) — semua tiket dirancang
feasible tanpa rewrite. DHH-first: setiap cue audio wajib punya pasangan visual; setiap
komponen baru minimal dari komponen existing; tanpa aset berhak cipta (artwork original
CSS/SVG). Referensi pola: `docs/design/chesscom-ui-analysis.md`.

Prioritas: **P1 = core parity** (kerjakan), **P2 = polish**, **P3 = nice-to-have**.

---

## (a) Board panel chrome — gear/settings + koordinat (P1)

**V1 — Board chrome wrapper.**
- Komponen: `components/board-chrome.tsx` (wrapper di sekitar board existing; board engine tak
  diubah — hanya framing).
- Isi: bar atas (avatar/label player kiri, gear icon ⚙ kanan) di atas board; bar bawah serupa
  untuk lawan/bot; koordinat file a–h di edge bawah + rank 1–8 edge kiri, teks ~10px gray,
  dirender oleh wrapper (absolute di dalam container board), bukan oleh engine.
- Gear: buka popover settings board existing (flip board, tema warna, sound toggle) —
  reuse panel settings bila sudah ada; kalau belum, popover sederhana shadcn.
- AC: (1) board selalu tampil dgn koordinat + gear di desktop & mobile; (2) gear membuka
  popover; (3) koordinat tidak menggeser square (di dalam container); (4) snapshot visual
  via Playwright menyertakan chrome.

**V2 — Tema board & flip via gear (P2).**
- File: `lib/board-theme.ts` + BoardChrome settings.
- AC: pilih 2 tema (green classic, brown) — warna via CSS variables, persist localStorage;
  flip board membalik koordinat juga.

## (b) Right-panel puzzle (P1)

**V3 — Puzzle side panel.**
- Komponen: `components/puzzle-side-panel.tsx`, dipakai `components/views/puzzle-view.tsx`.
- Isi atas-ke-bawah: banner header (icon puzzle orange original SVG + "Puzzle"); kartu rating
  (angka rating puzzle + delta rating user); move list langkah yang sudah dimainkan (scroll);
  baris tombol Hint / Solution (secondary gray); tombol besar hijau **Next Puzzle**
  full-width yang muncul/aktif setelah puzzle selesai (benar).
- AC: (1) panel tampil di kanan board desktop, di bawah board mobile; (2) rating ditampilkan;
  (3) Hint menampilkan petunjuk (highlight square asal, bukan jawaban); Solution memainkan
  langkah benar; (4) Next Puzzle aktif hanya setelah solved, load puzzle baru tanpa reload;
  (5) move list update tiap langkah.

**V4 — Feedback langkah benar/salah (polish visual; logika sudah dari W1).**
- File: `components/puzzle-view.tsx` / board highlight layer existing.
- Pola: square asal+tujuan langkah benar → overlay hijau translucent ~200ms fade; salah →
  merah translucent + shake kecil board (CSS `animate` translate-x ±4px, 300ms); last-move
  amber tetap menyala.
- AC: (1) benar → hijau lalu auto-reply lawan (W1) dengan highlight pasangan; (2) salah →
  merah + shake + pesan inline "Coba lagi"; (3) animasi CSS murni, tak blok input; (4)
  prefers-reduced-motion mematikan shake.

**V5 — Numbered-path progression (original artwork) (P2).**
- Komponen: `components/puzzle-progress-path.tsx` (pure CSS/SVG, bukan copy ilustrasi
  chess.com). Node heksagonal/lingkaran bernomor terhubung garis putus-putus, warna hijau
  untuk selesai, gray untuk belum; posisi user ditandai ring aksen.
- AC: (1) menampilkan progres streak/puzzle hari ini; (2) 100% CSS/SVG buatan sendiri;
  (3) tidak memuat gambar eksternal.

## (c) Langkah benar + auto-reply — polish saja

Tercakup V4 (visual) + V8 (audio). Logika auto-reply = W1, tidak disentuh di sini.

## (d) Sidebar nav 6 grup, label jev-chess sendiri (P1)

**V6 — Sidebar grup 6 + "Lainnya".**
- File: `components/shell/app-shell.tsx` (nav grup sudah ada: 4 live + accordion).
- Ubah struktur jadi 6 grup dengan label jev-chess sendiri (contoh, bukan wajib kata-per-kata):
  Main (home/play), Puzzle, Belajar, Latihan, Tonton, Komunitas — plus Lainnya accordion
  existing. Setiap grup punya satu warna aksen icon sendiri (token CSS, bukan aset).
- Icon: pakai icon set existing (lucide) — dilarang pakai ikon chess.com.
- AC: (1) sidebar desktop menampilkan 6 grup + Lainnya; (2) aksen warna per grup konsisten
  di bottom-nav mobile; (3) aria-current tetap benar (regression BUG-3 tidak kambuh); (4)
  semua route existing tetap terjangkau.

## (e) PWA-lite + audio cue dgn pasangan visual wajib (P1)

**V7 — Web audio cue (Howler-style pattern, pakai Web Audio/HTMLAudio murni).**
- File: `lib/sound.ts` + dipanggil dari move handler (game & puzzle).
- Set cue kecil, file audio original atau di-generate (bukan SFX chess.com): move, capture,
  check, game-end. Fungsi `playCue(name, { visual })` — dipanggil hanya bersama aksi visual
  yang sedang terjadi (highlight/langkah), dan menerima mute dari settings (V1 gear).
- **DHH rule**: tidak ada cue tanpa pasangan visual yang sudah tampil di frame yang sama.
- AC: (1) move/capture/check/game-end bersuara; (2) toggle mute di gear + persist; (3) unit
  test memverifikasi cue dipanggil bersama aksi; (4) tidak autoplay sebelum interaksi user.

**V8 — PWA-lite: manifest + offline shell.**
- File: `public/manifest.webmanifest`, `app/sw.js` (vanilla service worker, tanpa dep),
  registrasi kecil di `app/layout.tsx`.
- Scope: cache shell statis (layout CSS/JS utama, icons); strategi network-first dengan
  cache fallback untuk route utama; TIDAK meng-cache API dinamis. Halaman aktif offline →
  banner "Anda sedang offline" (pasangan visual untuk tidak adanya data live).
- AC: (1) Lighthouse PWA installable; (2) reload offline pada route yang pernah dibuka
  menampilkan shell + banner offline; (3) API tidak di-cache; (4) icons original SVG/PNG
  buatan sendiri di `public/icons`.

## (f) Polish tambahan (P3 — nice-to-have, kerjakan kalau ada sisa kapasitas)

**V9 — Onboarding modal per fitur.**
- Komponen: `components/feature-onboarding.tsx` — pola chess.com: overlay dim + card +
  judul + 1 kalimat + 3 bullet checkmark + 1 CTA hijau full-width + ✕; tampil sekali per
  fitur (localStorage flag) untuk fitur baru (puzzle, rush, coach).
- AC: tampil sekali; dismiss persists; copy bahasa Indonesia original.

**V10 — Podium leaderboard.**
- File: `components/views/leaderboard-view.tsx`.
- Top-3 diberi badge square (emas/perak/perunggu) via CSS; rank 4+ plain text; header icon
  podium SVG original. AC: snapshot visual + list tetap accessible (rank dibacakan screen reader).

**V11 — Player info bars di PvP.**
- File: `components/pvp-panel.tsx` / game view. Bar atas+bawah: avatar + nama + rating +
  timer box; timer box memerah saat < 10 detik (pasangan visual untuk cue time-low).
- AC: timer low-time visual merah; posisi bar benar saat flip board.

**V12 — Statistik live di home (P3).**
- Angka partai/user aktif dari API existing; angka green + caption uppercase gray.
- AC: angka dari API nyata, bukan hardcoded.

---

Urutan eksekusi yang disarankan: V1 → V6 → V3 → V4 → V7 → V8 → V2 → V5 → V9..V12.
Setiap tiket: satu PR kecil, screenshot Playwright sebelum/sesudah di deskripsi, docs
`chesscom-ui-analysis.md` sebagai acuan pola. Regression wajib: nav aria-current, puzzle flow
W1, theme 500 fix (dropdown tema harus tetap load).
