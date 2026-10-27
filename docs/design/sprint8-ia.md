# S8 — Information Architecture & Kontrak No-Scroll (1360×768)

Orchestrator decision: dokumen ini adalah OTORITAS untuk restrukturisasi menu + layout.
Dev yang menyentuh shell/view WAJIB reconcile terhadap file ini (atau amend di commit yang sama).

## 0. Tujuan & Batas
- Standar layar: **1360×768** (viewport desktop). Di ukuran ini: **0 page scrollbar, 0 overlap komponen**.
- Menu disederhanakan (21 tab flat → 8 section), **tanpa menghilangkan satupun fitur** — semua `navTab` lama tetap reachable.
- Scroll hanya boleh terjadi **di dalam region internal** yang berukuran tetap (bukan halaman).
- Minimalis: padat, satu level hierarki subtab, tanpa nested section. Aksen tetap via token CSS V6 (`--nav-accent-*`).
- A11y floor dipertahankan: skip-link, `aria-current` tepat 1, `role="tablist"` untuk subtab, focus-visible, `prefers-reduced-motion`.

## 1. IA Baru — 8 Section
```
Beranda      → home
Main         → play (default) | bots | tournaments
Taktik       → puzzles  (PuzzleHub: harian/terlewat/statistik tetap di-internal)
Analisis     → review | scan
Latih        → explorer | insights | practice | drills | vision
Belajar      → courses | learn | classroom | coach
Tonton       → archive
Komunitas    → leaderboard | friends | community
Lainnya      → admin  (admin-only, accordion, default collapsed)
```
- Klik section → aktifkan subtab default + tampilkan strip subtab.
- Section tunggal (Beranda, Taktik, Tonton) tanpa strip subtab.
- **Hash routing lama tetap valid**: `#courses`, `#play`, `#vision` dsb. resolve ke section+subtab baru. Deep-link detail (`?cat=`, course id, tournament id) tidak berubah.

## 2. Ukuran Shell (deterministik)
- Sidebar: 240px fixed, scroll internal hanya jika viewport <768px.
- Topbar: 56px fixed.
- Subtab strip: 44px, hanya saat section punya ≥2 subtab; sticky di atas konten.
- Area konten: `h = calc(100dvh - 56px - 44px(strip))`, padding 16px, `overflow-hidden`.
- Rantai: `main > view-root(h-full) > …` semua flex-child pakai `min-h-0`.

## 3. Pola Layout per Tipe View
**Helper class (ditambahkan shell agent ke `app/globals.css`; nama ini KONTRAK bagi semua view — jangan bikin class sendiri):**
- `.view-root` — `h-full w-full min-h-0 flex flex-col` (wrapper paling dalam tiap view, menggantikan `mobile-feature-page`)
- `.view-head` — baris header/filter 44px `shrink-0` (sticky di dalam view, bukan halaman)
- `.view-body` — `flex-1 min-h-0 overflow-y-auto` (satu-satunya region scroll internal)
- `.view-grid-board` — `h-full grid grid-cols-[minmax(0,1fr)_320px] gap-3` (Pola A)
- `.view-cols` — `h-full grid grid-cols-[minmax(0,1fr)_300px] gap-3` (Pola C)
- `.view-cards` — grid kartu rapat, `auto-rows-min` (Pola D)

| Pola | Deskripsi | View |
|---|---|---|
| **A** papan+panel | `.view-grid-board`: papan ≤540px di kiri, panel `.view-body` di kanan | play, bots, review, scan, classroom, drills |
| **B** list+header pin | `.view-head` (filter/pill) + `.view-body` list baris ≤44px | leaderboard, archive, explorer, tournaments, courses, learn |
| **C** detail 2-kolom | `.view-cols`: konten detail `.view-body` + sidebar meta `.view-body` | course/lesson detail, insight profil, friends detail |
| **D** dashboard | `.view-cards` tinggi-terpas total ≤ area konten, tanpa scroll | home, practice, vision |

Ketinggian baris data: ≤44px. Gap kartu: 12px. Tidak ada view yang boleh menghasilkan tinggi konten > area konten di 1360×768 tanpa memotong ke pola B/C (internal scroll).

## 4. Regression Guardrails
- `aria-current="page"` tetap TEPAT 1 (aturan BUG-3 + gating mounted/isDesktop dipertahankan).
- `PlayingBadge` tetap di item Main; dock modal (teman/pesan/notif/pengaturan) tidak berubah.
- Auth guard: view yang butuh login tetap menampilkan empty-state, bukan crash.
- Wrapper `mobile-feature-page` (overflow bebas) dihapus/ diganti pola A/B/C; mobile bottom-nav 5 item tetap untuk <768px.

## 5. Definition of Done per View
Render di 1360×768: page scrollbar = 0, overlap = 0, semua CTA terjangkau, internal scroll hanya di region tetap, `aria-current` valid. Build + typecheck + runtime smoke graph `lib/realtime` (relative import, tanpa `@/`).
