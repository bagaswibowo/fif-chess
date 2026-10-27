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
| Pola | Deskripsi | View |
|---|---|---|
| **A** papan+panel | grid `[1fr 320px]`, papan square ≤540px, panel `overflow-y-auto` internal | play, bots, review, scan, classroom, drills |
| **B** list+header pin | header filter/pill 44px sticky + body `overflow-y-auto` tinggi-sisa | leaderboard, archive, explorer, tournaments, courses, learn |
| **C** detail 2-kolom | konten detail + sidebar meta, dua-duanya scroll internal | course/lesson detail, insight profil, friends detail |
| **D** dashboard | grid kartu padat tinggi-terpas (total ≤ area konten), tanpa scroll | home, practice, vision |

Ketinggian baris data: ≤44px. Gap kartu: 12px. Tidak ada view yang boleh menghasilkan tinggi konten > area konten di 1360×768 tanpa memotong ke pola B/C (internal scroll).

## 4. Regression Guardrails
- `aria-current="page"` tetap TEPAT 1 (aturan BUG-3 + gating mounted/isDesktop dipertahankan).
- `PlayingBadge` tetap di item Main; dock modal (teman/pesan/notif/pengaturan) tidak berubah.
- Auth guard: view yang butuh login tetap menampilkan empty-state, bukan crash.
- Wrapper `mobile-feature-page` (overflow bebas) dihapus/ diganti pola A/B/C; mobile bottom-nav 5 item tetap untuk <768px.

## 5. Definition of Done per View
Render di 1360×768: page scrollbar = 0, overlap = 0, semua CTA terjangkau, internal scroll hanya di region tetap, `aria-current` valid. Build + typecheck + runtime smoke graph `lib/realtime` (relative import, tanpa `@/`).
