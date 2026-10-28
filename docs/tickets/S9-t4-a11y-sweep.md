# S9-T4 — A11y sweep: prefers-reduced-motion, keyboard bottom-nav/sheet, heading sr-only, aria-current

**Role**: PM · **Sprint**: S9 · **Sumber**: `docs/design/s9-s10-scope.md` S9-T4 +
`docs/design/chesscom-parity-audit.md` G7.1–G7.3.

## 1. Context (status riil, diverifikasi 991eb25)

**G7.1 — prefers-reduced-motion (audit klaim "hanya di puzzle-solver"
SUDAH STALE — jangan klaim ulang):**
- `app/globals.css:406-413` — blanket rule
  `*,*::before,*::after{animation/transition:0.01ms}` sudah ada
  (sejak 95c4c1e) → semua animasi CSS global (termasuk Tailwind
  `animate-in/fade-in/slide-in-from-bottom` — Tailwind v4,
  `@tailwindcss/postcss`, keyframes di node_modules, jadi ter-cover
  blanket) dan `animate-pulse`/`animate-ping`
  (`flybrain-visualizer.tsx:94`, `friends-view.tsx:240`) **sudah mati
  saat reduced-motion ON**.
- `app/globals.css:661-667` — guard khusus `.puzzle-shake` +
  `.animate-pulse` (redundan dgn blanket, boleh dipertahankan).
- JS-side guard SUDAH ada di: `puzzle-solver.tsx:121` (auto-advance
  700ms→60ms), `confetti.tsx:13` (konfetti off),
  `puzzle-view.tsx:53`, `insights-view.tsx` (transisi chip/grafik,
  komentar :20).
- **Gap riil tersisa (audit, bukan asumsi)**: titik
  timer/JS-driven decorative yang TIDAK punya guard reduced-motion
  saat ini — checklist yang harus dev audit per titik, bukan per
  file: `components/scan-view.tsx:691` (file yang live — diimport
  `game.tsx:27`; copy twin `components/views/scan-view.tsx` juga
  :691 bila masih dipakai): interval
  `stepEngineSolve` 600ms — auto-solve = progres fungsional, kemungkinan
  **jangan** dimatikan; verifikasi: bila output visual-nya murni
  progres, biarkan; bila transisi dekoratif, guard),
  `components/game-over-modal.tsx:69` (rAF = focus saja, aman),
  `components/paste-bar.tsx:51/75` (rAF = focus, aman).
  **Scope T4 = audit + tambah guard hanya pada titik dekoratif yang
  terbukti tanpa guard**, bukan "menyebar blanket ke semua view".
  Bila audit konklusif "sudah semua ter-cover" → T4 item 1 = close
  dengan catatan audit, tanpa kode.

**G7.2 — keyboard bottom-nav + "Lainnya" sheet:**
- SUDAH ADA: focus trap more-sheet `app-shell.tsx:249-268`
  (`role="dialog" aria-modal`, Tab wrap), Esc tutup + focus balik ke
  trigger (:234-241), skip-link (:322-328), `focus-visible` di semua
  item nav.
- **Gap riil**: tidak ada navigasi **panah** — grep `onKeyDown` di
  `app-shell.tsx` hanya 1 hit (search combobox :486-490). Bottom-nav
  5 item (:581-605) + item sheet (:660-700) hanya operable via Tab;
  audit G7.2 minta arah panah (Home/End opsional, YAGNI — batasi
  Left/Right/Up/Down sesuai layout grid).

**G7.1b — heading semantik per grup:**
- Sidebar: 8 section `app-shell.tsx:371-393` = tombol `aria-label`,
  **tidak ada `<h2>` sr-only** per grup (audit G1.3/G7.1: "grup
  label tidak punya heading semantik").
- More-sheet: label section = `<div className="px-1 pb-1 …">`
  (:672-677, :699-704) — bukan heading; cuma `<h2>Menu Lainnya</h2>`
  :641.
- Strip subtab (`role="tablist"` :543-573) sudah punya
  `aria-label="Bagian <title>"` — cukup, jangan duplikat.

**G7.3 / BUG-3 — `aria-current` konsisten:**
- Pola BUG-3 `mounted && … && isDesktop` sudah dipakai di section
  button (:386), accordion "Lainnya" (:403 + `!othersOpen`),
  bottom-nav (:591, :669/:696 dgn `!isDesktop`).
- **Konsistensi cek**: item other-sheet (:696) dan bottom-nav (:591)
  sudah gate `mounted`; invariant "TEPAT 1 `aria-current=\"page\"`"
  (header file :9-11) = QA DevTools: `document.querySelectorAll(
  "[aria-current='page']").length <= 1` di 3 layout (desktop
  / mobile / accordion open-closed).

**Suara (G7.3): ADA** — `lib/chess-sound.ts` (Web Audio engine,
zero-dep) dipanggil `game.tsx:592-702/917-921` (move/check/capture/
castle/game-end) + `coach-mode-view.tsx:270-336` +
`learning-hub.tsx`; toggle opsional SUDAH ada: `dock-modals.tsx:67-87`
(`jev_sound_enabled` localStorage, switch UI :380). Sesuai audit G7.3
("opsional + pasangan visual; hasil game sudah ada aria-live di
game-over-modal — pertahankan"), **T4 hanya memverifikasi toggle +
visual cue, TIDAK membangun fitur baru**: cek visual cue per aksi
suara sudah ada (move = langkah di papan, check = highlight,
game-end = modal), dan default toggle tetap `true` (status quo,
YAGNI).

## 2. Task (sub-task per file)

1. **Reduced-motion audit JS-driven** — checklist per titik di §1
   (titik utama `components/scan-view.tsx:691` + twin
   `components/views/scan-view.tsx`; `flybrain-visualizer.tsx` hanya
   verifikasi CSS). Tambah hook `lib/use-reduced-motion.ts` (pola
   `puzzle-solver.tsx:121`) HANYA bila audit menemukan titik
   dekoratif tanpa guard; bila tidak ada → item close tanpa kode.
   CSS-only = jangan disentuh (blanket `app/globals.css:406` cover).
2. **Keyboard arrow bottom-nav + sheet** — `components/shell/
   app-shell.tsx`: `onKeyDown` di `<nav aria-label="Navigasi
   bawah">` (:581) → Left/Right antar 6 item (5 + Lainnya),
   Up/Down di more-sheet (grid 2 kolom, :660-700, wrap) +
   Home/End **jangan** (YAGNI). Fokus tetap dalam trap existing
   (jangan rusak :249-268).
3. **Heading sr-only grup** — `app-shell.tsx`: tiap grup sidebar
   (section button :375-392, `SECTIONS.map`) prepend
   `<h2 className="sr-only">{s.title}</h2>`; tiap grup label
   more-sheet (div :672-677 & :699-704) → `<h3 className="sr-only">`
   (hierarki: h1 app → h2 grup → h3 subgrup; TL putar).
4. **Konsistensi `aria-current`** — verifikasi saja: pastikan semua
   tempat render item (section :386, accordion :403, bottom-nav
   :591, sheet :669/:696) memakai gate `mounted &&` + breakpoint
   benar (invariant 1, BUG-3). Jika ditemukan item tanpa gate
   `mounted` → tambah (diff 1 line).
5. **Suara G7.3 — verifikasi** (tanpa kode baru): toggle
   `jev_sound_enabled` (dock-modals) berfungsi mati-kan
   `chessSound.*` di game.tsx/coach-mode; visual cue per aksi
   (move/check/game-end) sudah ada — cukup QA.
6. **QA selector** (untuk gate TL) — script `grep/DevTools` tertulis
   di ticket: invariant "≤1 `[aria-current='page']` visible" +
   "Esc closes sheet, fokus balik ke trigger" + "reduced-motion on:
   animasi dekoratif mati, progres fungsi (clock/rush timer) tetap".

## 3. Acceptance criteria (observabel)

- Desktop: `document.querySelectorAll('[aria-current="page"]')`
  ≤ 1 elemen **visible** (hidden accordion dikecualikan, pola BUG-3)
  di state: section aktif, accordion open, accordion closed,
  mobile.
- Mobile, sheet terbuka: Tab berputar di dalam sheet; Esc → sheet
  tutup + fokus di trigger "Lainnya" (regresi, tetap jalan).
- Bottom-nav: focus di item → Left/Right pindah fokus antar item;
  focus di item sheet → Up/Down pindah antar baris grid.
- Sidebar: heading SR per grup terbaca — VoiceOver/NVDA: 8 heading
  (grup) + subtab "Bagian X" unchanged.
- `prefers-reduced-motion: reduce` (emulate DevTools): overlay
  scan-view `animate-in` (:1035, CSS) tetap mati via blanket
  :406; flybrain `animate-ping` (:94) + `animate-pulse`
  (friends-view :240) + confetti off (`confetti.tsx:13`) —
  regresi, jangan rusak. Bila audit menambah hook T4.1: timer
  dekoratif scan :691 dimatikan saat reduce (fungsi solve tetap
  jalan, hanya pacing visual off).
- Suara: toggle off di dock-modals → `chessSound.playMove()` dst.
  di game.tsx / coach-mode-view tidak terdengar; visual cue
  (langkah di papan, highlight check, modal game-end) ada tanpa
  perubahan.
- QA: `prefers-reduced-motion` OFF → semua layout S8 render identik
  1360×768 (no-scroll invariant S8 tidak rusak).

## 4. Guardrail (JANGAN)

- **Jangan ubah logika nav** (`navigate`, hash resolve
  `navTabFromHash` game.tsx, routing section/subtab S8) — T4 hanya
  menambah atribut/focus/heading.
- Jangan ubah CSS blanket :406 (regresi risk global) dan jangan
  buat token animasi baru (anti-slop: pakai token existing
  `--nav-accent-*`, `var(--primary)`).
- Jangan tambah suara (G7.3 non-applicable — tidak ada sumber
  audio di repo; jangan bikin fitur "sound on/off" yang tidak
  ada isinya).
- Jangan ubah `role="tablist"` strip subtab (:543-573) — sudah
  benar.
- Heading baru = `sr-only` saja (visual label section tetap yang
  ada, tanpa duplikat teks).
- Suara: jangan bikin fitur on/off baru atau perubahan engine
  `lib/chess-sound.ts` — toggle `jev_sound_enabled` (dock-modals)
  sudah memenuhi G7.3; T4 hanya verifikasi visual cue existing.
