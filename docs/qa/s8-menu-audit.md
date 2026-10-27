# S8 — Audit QA Semi-Menu Produksi 1360×768 (Baseline Pra-Refactor)

- **Target:** https://jev-chess.bagaswibowo.app (sxz-server, S7 live, CF tunnel http2)
- **Tanggal:** 2026-10-27 (UTC)
- **Viewport:** 1360×768 via `cdp('Emulation.setDeviceMetricsOverride', width=1360, height=768, deviceScaleFactor=1)` di-set ulang di setiap fresh load; terverifikasi `innerWidth=1360, innerHeight=768`.
- **Metode:** audit HANYA (baca DOM + konsola + jaringan via CDP `Network.responseReceived` + `Runtime.consoleAPICalled`). Tidak ada perubahan kode/konfigurasi produksi.
- **Spesimen IA:** semua 21 hash lama (`#/home … #/admin`) masih reachable — konfirmasi baseline SEBELUM refactor S8 (kontrak `docs/design/sprint8-ia.md`).
- **Session:** sebagian besar probed dengan akun QA `s8qa_audit` (status `pending`, dibuat khusus untuk audit ini) + spot-check guest (logout).

## ⚠️ Housekeeping — akun QA (JANGAN hapus sendiri; konfirmasi TL dulu)

- Baris `s8qa_audit` (id `u-45a15372`, full_name "S8 QA Audit") ada di users store **server** (registrasi via `/api/auth` POST → `users.json` sxz-server).
- Data terkait: 0 game, 0 progres (status pending → tidak bisa main). Satu-satunya jejak = baris users + sesi.
- **Tindak lanjut TL setelah audit:** bersihkan baris `s8qa_audit` di users store produksi. Tidak ada cleanup lain.

## Ringkasan Temuan

| Prioritas | Jumlah | Item |
|---|---|---|
| **P0** | 1 | `#/drills` crash total (React #300, shell hilang) |
| **P1** | 1 | `#/puzzles` `aria-current="page"` = 2 (regresi BUG-3, inkontrak spec §4) |
| **P2** | 6 | admin kosong, a11y input community, pesan arsip 401, home pending generik, 403 dashboard per-menu, coach scroll internal 96px |
| **Total** | **8** | |

Kondisi baik (baseline): **0 page-scroll di semua 21 menu** (`documentElement.scrollHeight = innerHeight = 768` di semua; overflow 0px), **0 overlap bounding-box** komponen mayor di semua menu, 0 console error selain crash drills, 0 fitur mati (CTA "Coba Lagi" benar-benar re-fetch).

## Tabel 1-Menu-per-Baris

Kondisi: logged-in `s8qa_audit` (pending) kecuali dicatat. PageScroll = `scrollHeight − innerHeight` (overflow; 0 = tidak ada page scrollbar).

| Menu | PageScroll(px) | Overlap (list) | Console/API errors (list) | A11y | FiturMati (list) | Prioritas |
|---|---|---|---|---|---|---|
| `#/home` | 0 | — | `/api/home/dashboard` 403 (pending); UI generik "Gagal memuat dashboard" | 1 ✓, skip-link ✓ | — | P2 (pesan pending) |
| `#/play` | 0 | papan 616px muat, panel kanan rata | `/api/home/dashboard` 403 | 1 ✓ | — | — |
| `#/bots` | 0 | — | `/api/home/dashboard` 403 | 1 ✓ | — | — |
| `#/tournaments` | 0 | — | `/api/home/dashboard` 403 | 1 ✓ | — | — |
| `#/puzzles` | 0 | — | `+` `/api/puzzles/tiers`,`/themes`,`/next` 403 (diproses: "Akun menunggu") | **2 ✗** ("Teka-Teki" ×2) | — | **P1** |
| `#/review` | 0 | — | `/api/home/dashboard` 403 | 1 ✓ | — | — |
| `#/scan` | 0 | — | `/api/home/dashboard` 403 | 1 ✓ | — | — |
| `#/explorer` | 0 | — | `+` `/api/opening/win-rate` 403 | 1 ✓ | — | — |
| `#/insights` | 0 | — | `+` `/api/insights` 403 | 1 ✓ | — | — |
| `#/practice` | 0 | — | `+` `/api/practice/weekly`,`/api/endgames/drills` 403 | 1 ✓ | — | — |
| `#/drills` | 0 | — (shell hilang) | **React #300 ×2**; `/api/endgames/drills` 403 | 0 ✗ | seluruh view | **P0** |
| `#/vision` | 0 | — | `/api/home/dashboard` 403 | 1 ✓ | — | — |
| `#/coach` | 0 | — (scroll internal 96px, wilayah tetap) | `/api/home/dashboard` 403 | 1 ✓ | — | P2 (visual) |
| `#/courses` | 0 | — | `+` `/api/courses` 403 | 1 ✓ | — | — |
| `#/learn` | 0 | — | `/api/home/dashboard` 403 | 1 ✓ | — | — |
| `#/classroom` | 0 | — | `/api/home/dashboard` 403 | 1 ✓ | — | — |
| `#/archive` | 0 | — | `+` `/api/games/archive` **401** (user logged-in!); pesan "Masuk…" menyesatkan | 1 ✓ | — | P2 |
| `#/leaderboard` | 0 | — | `+` `/api/leaderboard` 403; "Akses ditolak" | 1 ✓ | — | — |
| `#/friends` | 0 | — | `+` `/api/friends` 403 | 1 ✓ | — | — |
| `#/community` | 0 | — | `/api/home/dashboard` 403 | input search + 4 input modal **tanpa label** ✗ | — | P2 |
| `#/admin` | 0 | — | `/api/home/dashboard` 403 | **0 ✗** + konten kosong (non-admin) | — | P2 |

### Catatan guest (spot-check)
- `#/drills` sebagai **guest**: crash #300 sama (reproduksi deterministik).
- `#/home` guest: form auth inline, `/api/home/dashboard` tidak dipanggil (hanya saat ada sesi).
- A11y global: skip-link "Lewati ke konten utama" ada di semua menu (satu elemen, `a[href=#main-content]`).

## Detail Per Temuan

### F1 (P0) — `#/drills` crash total: React #300, shell hilang
- **Reproduksi (deterministik, 3/3 trial, guest & pending):** fresh load → `window.location.hash = "#/drills"` → whole app render error boundary: `TERJADI KESALAHAN APLIKASI … Minified React error #300`.
- **Bukti JS:**
  ```js
  document.querySelector('.app-shell') // null setelah navigasi
  document.querySelector('div.min-h-screen').innerText // "TERJADI KESALAHAN APLICASI … Minified React error #300"
  // console.error: "Error: Minified React error #300 …" + "FIF Chess Runtime Error: …"
  // 403 pemicu: /api/endgames/drills -> 403 (gugus & pending)
  ```
- **Root cause (read-only, verifikasi statis):** `components/views/endgame-drills-view.tsx` — early `return` **sebelum hook** — `if (error) { return … }` (baris ±256) terletak di atas `const themeChips = useMemo(…)` (baris ±265). Saat fetch `/api/endgames/drills` 401/403/`!ok` (→ `setError`), cabang `error` mengembalikan JSX sebelum `useMemo` ter-execute → jumlah hook render ≠ jumlah sebelumnya → React error #300 ("Rendered fewer hooks than expected. This may be caused by an accidental early return statement." — react.dev/errors/300).
- **Dampak:** menu Latihan-Penglihatan-drill 100% mati untuk user yang belum approved (mayoritas 39 user: mayoritas pending); crash menimpa shell termasuk sidebar/nav. **Severity P0 (crash).**
- **Bahan fix (dispatch wave-2):** pindahkan semua hook di atas early return di `EndgameDrillsView` (atau `return null`-nya ke dalam render, bukan sebelum hook). Tidak perlu migrasi.

### F2 (P1) — `#/puzzles` `aria-current="page"` = 2 (regresi BUG-3 / inkontrak spec §4)
- **Reproduksi:** fresh load → `#/puzzles` → `document.querySelectorAll('[aria-current="page"]').length === 2`, keduanya visible:
  ```js
  // kedua elemen: sidebar section button "Teka-Teki" (shell) + strip-subtab "Teka-Teki"
  ```
- **Kontrak:** spec §4 regression guardrail "`aria-current='page'` tetap TEPAT 1 (aturan BUG-3)"; QA S5 BUG-3 gating `mounted/isDesktop` untuk section button (app-shell.tsx ±388/±550) — strip subtab S8 menambahkan elemen kedua tanpa gating.
- **Dampak:** screen reader mengumumkan dua "halaman aktif"; audit QA di wave-2 akan gagal guardrail. **Severity P1 (rusak — kontrak a11y regresi).**
- **Bahan fix:** strip subtab pakai `role="tablist"` + `role="tab"`/`aria-selected`, hilangkan `aria-current="page"` dari strip (section tetap satu-satunya pembawa `aria-current`).

### F3 (P2) — `#/admin` non-admin: konten kosong + `aria-current` = 0
- **Reproduksi:** logged-in non-admin → `#/admin` → `main.innerText === ""`, `[aria-current="page"]` = 0, accordion "Lainnya ▾" sidebar ada tapi item admin ter-filter (`visibleOthers` hanya saat `user.isAdmin`).
- **Dampak:** deep-link `#/admin` (masih di daftar `navTab` lama, game.tsx:253) menghasilkan layar blank tanpa empty-state — inkonsisten guardrail spec §4 "view butuh login menampilkan empty-state, bukan crash". **Severity P2 (visual/UX).**
- **Bahan fix:** render empty-state "Khusus admin" untuk non-admin; `navTabFromHash` redirect non-admin ke `#/home`.

### F4 (P2) — `#/community`: input tanpa label (a11y)
- **Reproduksi:** `#/community` → probe input visible tanpa `label[for]`/`aria-label`:
  - `input[type=text] placeholder="Cari topik diskusi atau username…"` (search komunitas)
  - di modal "Buat Topik Baru": `<select>` kategori + `input` judul (`placeholder="Contoh: Analisis Pembukaan Sisilia Najdorf…"`) + 2 textarea/rich-text (`placeholder="Tulis opini, penjelasan taktis…"`) — **4 input unlabeled di modal**.
- **Dampak:** gagal kontrak a11y floor ("input punya label"). **Severity P2.**

### F5 (P2) — `#/archive`: user logged-in (pending) dapat 401 → pesan "Masuk untuk melihat arsip partai"
- **Reproduksi:** session `s8qa_audit` → `#/archive` → `GET /api/games/archive?filter=all&page=1` → **401** (bukan 403) → UI menampilkan CTA login padahal user sudah login.
- **Kontrak:** lib/use-session.ts FIX-1.2: "401 = benar-benar belum login; 403 = pending/rejected". API archive memetakan sesi-pending ke 401 → pesan UI menyesatkan. **Severity P2 (honest error handling).**
- **Bahan fix:** `/api/games/archive` return 403 `code:"account_pending"` untuk sesi pending; frontend pakai `authErrorText`.

### F6 (P2) — `#/home` pending: error generik "Gagal memuat dashboard. [Coba Lagi]"
- **Reproduksi:** session pending → `#/home` → `GET /api/home/dashboard` 403 → home hanya menampilkan "Gagal memuat dashboard / Coba Lagi" (tombol berfungsi: memicu fetch ulang, diverifikasi).
- **Dampak:** tidak ada penyataan "menunggu persetujuan admin" di dashboard — user pending tidak tahu alasannya. **Severity P2.**

### F7 (P2) — `/api/home/dashboard` dipanggil di SETIAP menu (403 noise utk pending/guest)
- **Reproduksi:** sweep 21 menu → `/api/home/dashboard` muncul di resource list semua menu (shell-level, bukan hanya view home). Utk akun pending = 403 di tiap navigasi.
- **Dampak:** trafik 4xx sia-sia; noise di jaringan utk audit/pengguna. **Severity P2.**
- **Bahan fix:** fetch dashboard hanya saat `navTab === "home"` (atau cache+revalidate per shell-load 1×).

### F8 (P2) — `#/coach`: konten 96px melampaui region → scroll internal
- **Reproduksi:** `#/coach` → `.mobile-feature-page (overflow-y-auto)` `scrollHeight=666 vs clientHeight=570` (delta 96px); board-workspace bottom 816 > main bottom 768 tapi dipotong region scroll tetap.
- **Dampak:** bukan pelanggaran (scroll hanya di region internal — sesuai spec §0.3), tetapi di target 1360×768 papan coach tidak muat utuh → CTA bawah perlu scroll. **Severity P2 (visual; bahan layout Pola-A S8).**

## Positif yang terkonfirmasi (baseline baik)
- 21/21 menu: **0 page-scrollbar** (scrollHeight = 768 = innerHeight), 0 overlap komponen, 0 console error di luar F1.
- CTA "Coba Lagi" home/leaderboard benar-benar re-fetch (verified via resource timing: `/api/home/dashboard` fire ulang pasca-klik).
- Modal "Buat Topik Baru" community terbuka & terisi rich-text (fitur hidup).
- `aria-current=1` + skip-link valid di 19/21 menu (kecuali puzzles=2 & drills/admin=0).

## Checklist Dispatch Wave-2 (P0–P1)
1. **[P0/F1]** `endgame-drills-view.tsx`: pindahkan `useMemo(themeChips)` (+ hook lain) di atas early-return `if (error)` / `if (activeSet)` — atau jadikan cabang error in-render. Verifikasi: `#/drills` guest+pending render "Akun menunggu…", shell tetap, 0 crash.
2. **[P1/F2]** `app-shell.tsx` strip subtab: ganti `aria-current` → `role="tablist"/"tab" + aria-selected`; pertahankan `aria-current="page"` hanya di section button. Verifikasi: `document.querySelectorAll('[aria-current="page"]').length === 1` di semua 21 hash.
3. Regresikan F3–F8 bila bandwidth (P2); F5/F7 butuh sentuhan server (route) — tidak dalam scope "audit-only", tandai untuk wave-2 server.

## Alat & Artifacts
- Browser: default session `browser_exec`; workspace `/opt/data/profiles/developer/cache/browser-use/workspace/sa-2-60483673/` — `audit_results.json`, `aria_sweep.json`, `crash_matrix.json`, `console_sweep.json` (raw probe 21 menu × state).
- Screenshot: 2 capture (play, home) di workspace.
