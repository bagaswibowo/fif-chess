# Sprint 5 — Konsolidasi Menu App Shell

**Peran:** PM · **Status:** Draft · **Tidak berisi kode.**
**Sumber audit:** `components/shell/app-shell.tsx` (GROUPS/OTHER_ITEMS/BOTTOM_ITEMS/more-sheet), `components/game.tsx` (render case navTab), `components/views/*`, `docs/design/sprint4.md`, `docs/design/sprint4-flow-audit.md`, pembanding `chess-web/rea/chess-web-menu-feature-map.md` §A.

---

## 1. Inventaris Menu Saat Ini

Sidebar: 4 grup + Lainnya (14 + 2 item). Bottom nav 5 item. More-sheet mobile 12 + Lainnya.

| Grup | Label | navTab | View file | Fitur live di baliknya | Status |
|---|---|---|---|---|---|
| Bermain | Main Online | `play` | game.tsx inline (play-layout) | Papan + engine + challenge realtime + badge N | live |
| Bermain | Lawan Bot | `bots` | views/versus-bots-view.tsx (135 l) | picker bot → play (engine terpasang) | live |
| Bermain | Pelatih | `coach` | views/coach-mode-view.tsx (758 l) | AI Coach + sub-tab "Jev vs Stockfish" | live, **overlap** (berisi Spectator) |
| Teka-Teki | Teka-Teki | `puzzles` | views/puzzle-hub.tsx (53 l, tab 4) + puzzle-view.tsx | hub 4 tab: unlimited/daily/rush/themes | live, **redundan dgn 3 item sebelah** |
| Teka-Teki | Harian | `daily` | views/daily-puzzle-view.tsx | puzzle harian — juga tab 2 PuzzleHub | live, **duplikat** |
| Teka-Teki | Gegas | `rush` | views/rush-view.tsx | survival 3 strike — juga tab 3 PuzzleHub | live, **duplikat** |
| Teka-Teki | Tema | `themes` | views/themes-mastery-view.tsx | latihan tema — juga tab 4 PuzzleHub | live, **duplikat** |
| Berlatih | Analisis | `review` | game.tsx + PasteBar + GameReview (679 l) | review partai + paste PGN/FEN fast path | live |
| Berlatih | Scan Papan | `scan` | views/scan-view.tsx (1518 l) | load FEN → play | live |
| Berlatih | Visi | `vision` | views/learning-hub.tsx (1231 l) | **Bukan vision drill** — LearningHub (materi belajar); label ≠ isi | live, **mislabel** |
| Berlatih | Permainan Akhir | `drills` | views/endgame-drills-view.tsx (244 l) | 6 set drill, reuse PuzzleSolver | live |
| Komunitas | Komunitas | `community` | views/… (CommunityView) | konten komunitas | live |
| Komunitas | Papan Peringkat | `leaderboard` | views/leaderboard-view.tsx | global/teman, top50 | live |
| Komunitas | Teman | `friends` | views/friends-view.tsx | presence, tantangan inline | live |
| Komunitas | Arsip | `archive` | views/archive-view.tsx | riwayat partai + PGN | live |
| Lainnya | Spectator | `spectator` | components/spectator-view.tsx (1003 l) | AI vs engine arena — **sama dengan sub-tab "Jev vs Stockfish" di coach** | live, **duplikat** |
| Lainnya | Admin | `admin` | AdminPanel | panel admin (isAdmin only) | live |

**View yatim / file duplikat (tidak muncul di menu):**

| File | Status |
|---|---|
| `components/views/guided-play-view.tsx` + `components/guided-play-view.tsx` (2 salinan, 636 l) | **dead** — tidak dirender oleh navTab manapun, pra-REA |
| `components/views/spectator-view.tsx` + `components/spectator-view.tsx` (2 salinan) | duplikat file; hanya `components/spectator-view.tsx` yang diimpor |
| `components/views/puzzle-view.tsx` | live hanya via PuzzleHub tab 1 — OK |

---

## 2. Daftar Redundansi

1. **Spectator punya 2 entry point** — navTab `spectator` (Lainnya) dan sub-tab "Jev vs Stockfish" di dalam `coach`. `setNavTab("spectator")` bahkan memaksa `coachSubTab="spectator"` (game.tsx:209) — dua rute ke view yang sama. Pelanggaran "satu fitur satu entry point".
2. **Harian/Gegas/Tema punya 3 entry point masing-masing** — item sidebar sendiri, tab dalam PuzzleHub, DAN baris di mobile more-sheet (app-shell moreSheetItems). Sidebar + PuzzleHub tabs = dua navigasi paralel ke 4 view yang sama; more-sheet menduplikasi semua item sidebar (lebih dari 12 baris = bukan "Lainnya", hanya sidebar kedua).
3. **"Visi" mislabel** — menu bilang Visi (chess.com = drill koordinat, REA map §7), isi = LearningHub (materi belajar). Menyesatkan user & tidak cocok pembanding.
4. **"Berlatih" bottom nav mengarah ke `review` (Analisis)** — label grup ≠ isi Analisis; shortcut menyesatkan.
5. **View dead: GuidedPlayView** — 636 l x 2 salinan, tidak dirender di manapun (pra-REA).
6. **File duplikat spectator-view & guided-play-view** di `components/` vs `components/views/` — sumber kebingungan import.
7. **Review vs Arsip** — arsip punya jalur ke review (`onGoReview`), review punya link PGN ke arsip: ini shortcut antar-fitur yang berbeda, **OK**, bukan redundansi.
8. **PasteBar di review memuat `onLoadFen/onLoadPgn` yang selalu `setNavTab("play")`** — fast path "analisis" justru lari ke papan main, bukan board analisis; overlap kecil tanggung jawab play vs review.

---

## 3. Struktur Menu Target (usulan)

Prinsip: fitur live = 1 entry point utama; sub-mode hidup sebagai tab dalam view parent (pola PuzzleHub), bukan item sidebar. Grup tetap 4 + Lainnya.

```
BERMAIN
  Main Online      → play
  Lawan Bot        → bots
  Pelatih          → coach   (tab: AI Coach | Jev vs Stockfish)   ← spectator jadi sub-tab

TEKA-TEKI
  Teka-Teki        → puzzles (PuzzleHub tab: Unlimited | Harian | Gegas | Tema)
  (hapus item daily/rush/themes dari sidebar)

BERLATIH
  Analisis         → review
  Scan Papan       → scan
  Materi Belajar   → vision (rename; tetap LearningHub)
  Permainan Akhir  → drills

KOMUNITAS
  Komunitas        → community
  Papan Peringkat  → leaderboard
  Teman            → friends
  Arsip            → archive

LAINNYA
  Admin            → admin (isAdmin only)
  (hapus Spectator)

BOTTOM NAV (5): Home | Bermain | Teka-Teki | Analisis(berlatih) | Komunitas
MORE-SHEET (mobile): hanya item yang tidak ada di 4 grup + Home:
  Lawan Bot, Pelatih, Scan, Materi Belajar, Permainan Akhir, Leaderboard, Teman, Arsip, Admin
  (hapus duplikasi daily/rush/themes/spectator)
```

Deep-link: hash `#/daily`, `#/rush`, `#/themes` dialihkan ke `#/puzzles` (dengan param tab) agar bookmark lama tidak mati.

**Retire/merge:**
- Hapus `components/views/guided-play-view.tsx` DAN `components/guided-play-view.tsx` (dead, YAGNI).
- Hapus `components/views/spectator-view.tsx` (salinan tak terpakai); pindahkan `components/spectator-view.tsx` → `components/views/spectator-view.tsx` agar semua view konsisten satu lokasi.
- navTab `spectator` & `daily`/`rush`/`themes` di-retire dari NavTab union; PuzzleHub/Coach dapat prop `initialTab` dari hash.

---

## 4. Draft Tickets Sprint 5

| Ticket | Isi | Estimasi |
|---|---|---|
| S5-T1 | Shell: hapus item daily/rush/themes/spectator dari GROUPS/OTHER_ITEMS; rapikan more-sheet (hapus duplikasi, sisakan item di luar grup); perbaiki label bottom-nav "Berlatih"→"Analisis" | kecil |
| S5-T2 | Deep-link & hash: alihkan `#/daily|#/rush|#/themes|#/spectator` ke parent (puzzles + coach) dengan initial tab; NavTab union dirapikan di game.tsx + app-shell | sedang |
| S5-T3 | PuzzleHub & Coach terima `initialTab` prop; hapus state sinkronisasi `coachSubTab` manual di game.tsx:209 | kecil |
| S5-T4 | Retire view: hapus GuidedPlayView (2 file), pindahkan spectator-view ke views/, update import | kecil |
| S5-T5 | Rename menu "Visi" → "Materi Belajar" (label id/en, aria-label, ikon) — isi LearningHub tidak berubah | kecil |
| S5-T6 | QA flow audit ulang (pola sprint4-flow-audit.md) untuk struktur baru: setiap item → jalur masuk/keluar | kecil |

---

## 5. Yang Layak Ditambah dari REA Map (murah saja)

- **Puzzle Battle 1v1** (REA §2, P1): belum ada; tapi realtime challenge infra sudah live (Sprint 3) — kandidat Sprint 6+, tidak S5 (bukan konsolidasi).
- **Vision drill koordinat + blind mode** (REA §7): menu "Visi" saat ini kosong dari fitur ini. Jika ingin murah: view drill koordinat kecil sebagai tab ke-2 di Materi Belajar, ATAU rename dulu (S5-T5) dan tunda drill. Rekomendasi: tunda; jangan buat dead promise.
- **Filter arsip per tipe partai** (REA §1 Riwayat): murah, tapi bukan urusan menu — catat sebagai backlog S6.
- Sisanya (Courses, Classroom, Clubs, Events, TV, Forum) = P2, skip — YAGNI.
