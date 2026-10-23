# Spec Eksekusi — 4 Menu (Puzzles, Leaderboard, Archive, Recent Games) — WS-2.5

Designer docs-only → untuk Web/Backend Dev (satu-satunya yang edit kode).
Tanggal: 2026-10-23. Referensi: docs/design/menu-flows-chesscom.md (flow), ui-flow-spec.md
(StateMessage + useAuthedFetch wajib di semua view), chesscom-parity-audit.md (G3/G5/G6).
DHH binding: cue visual + teks berpasangan, aria-live, fokus terlihat, reduced-motion.
Tidak ada kode/aset/teks chess.com yang disalin — hanya pola UX.

Urutan prioritas: **T1 → T2 → T3 → T4 → T5 → T6 → T7** (T1/T2 unblock data untuk UI lain;
T3–T6 bisa paralel setelah itu; T7 QA penutup).

---

## T1 (Backend) — Recent games feed di home dashboard
**Endpoint:** perluas `GET /api/home/dashboard` dengan `recentGames[]` (max 5).
**Query tambahan (Promise.all ke-4):**
```sql
SELECT g.id, g.result, g.white_user_id, g.black_user_id, g.time_control, g.game_type,
       g.white_rating_before, g.black_rating_before, g.ended_at
FROM games g
WHERE (g.white_user_id = $1::uuid OR g.black_user_id = $1::uuid)
  AND g.status <> 'active'
ORDER BY COALESCE(g.ended_at, g.created_at) DESC LIMIT 5
```
Join usernames (uw/ub) seperti query existing di route.ts. Bentuk respons per item:
`{ id, myResult: 'win'|'loss'|'draw', opponent: {username, rating}, timeControl, gameType,
   endedAt }`.
**Acceptance:**
- curl approved + cookie → dashboard JSON punya `recentGames` array ≤5, terurut desc.
- Result dihitung dari perspektif user (win bila result = warna user).
- Pending → 403 code=account_pending; guest → 401; PG down → 503 (kontrak FIX-1).
- User tanpa game → `recentGames: []` (bukan null/field hilang).

## T2 (Backend) — Opening name & durasi di archive rows
**Endpoint:** `GET /api/games/archive` — tambah per row `opening_name: string|null`,
`duration_sec: number|null`.
- Opening: baca `game_moves` game tsb, `matchOpening()` dari `lib/opening-book.ts`
  (fungsi sudah ada; jangan duplikasi logika). Bila moves < 4 ply → null.
- Duration: `EXTRACT(EPOCH FROM (ended_at - created_at))` bila keduanya ada.
- Batch agar tidak N+1: kumpulkan moves 20 game di satu query (`WHERE game_id = ANY($1)`
  ORDER BY game_id, ply) lalu hitung opening di Node.
**Acceptance:**
- Row JSON punya kedua field (nullable). Game dengan <4 ply → opening_name null.
- Waktu respons endpoint tidak bertambah >300ms vs baseline (ukur dengan curl time_total).

## T3 (Backend) — Leaderboard filter kategori waktu + win-rate
**Endpoint:** `GET /api/leaderboard?scope=global|friends&game_type=bullet|blitz|rapid` (param opsional).
- game_type derive dari `games.game_type='live'` + `games.time_control` (bullet <3, blitz <10, rapid ≥10 menit — konsisten dgn definisi ui-flow-spec §3).
- Win-rate per user top-50: `COUNT(*) FILTER (WHERE win)::float / GREATEST(COUNT(*),1)`.
- Respons entry: `{ rank, username, rating, games, winRate (0–1, 2 desimal), isMe }`.
- Backward-compat: tanpa param game_type → perilaku lama persis (kolom baru boleh ditambah).
**Acceptance:**
- curl `?scope=global&game_type=blitz` → hanya agregat game blitz.
- `winRate` ada di tiap entry; tanpa game → 0 + games=0.
- Param invalid (`game_type=foo`) → 400 dengan pesan Indonesia.

## T4 (Web) — Leaderboard UI: tab Pemain/Teman + chips kategori + win-rate
**Komponen:** ubah `components/views/leaderboard-view.tsx`.
- Tab segmented "Pemain | Teman" (mapping scope global/friends — sudah ada, jadikan tab eksplisit).
- Chips kategori: Semua / Bullet / Blitz / Rapid → param game_type. `role="tablist"` + aria-selected, arrow-key navigable.
- Kolom tabel: Rank · Pemain · Rating · Game · Win-rate (persen, teks berlabel).
- Baris sendiri: highlight warna + bar 3px kiri (bukan warna saja) + sr-only "Peringkat kamu: N"; sticky bila di luar 50 besar (sudah ada pola meOutside — pertahankan).
- Empty (0 entries): "Papan masih kosong — main rated untuk masuk papan" + tombol "Main sekarang" (onPlayOnline sudah ada).
- Semua fetch via `useAuthedFetch` (StateMessage; hapus mapping error manual).
**Acceptance:**
- Chips mengubah list tanpa reload halaman; state aktif ada aria-selected + indikator visual non-warna.
- Keyboard: tab/chips/rows semua reachable, focus ring terlihat.
- Empty state tampil bila entries=0 dengan 1 CTA.
- SR: struktur `<table>` dengan `<th scope>`; total rank "kamu" tersedia sebagai teks.

## T5 (Web) — Archive UI: hasil berwarna+teks, opening, aksi Analisis/Rematch/Share
**Komponen:** ubah `components/views/archive-view.tsx`.
- Row layout: [badge W/L/D ikon ✓/✕/½ + teks Menang/Kalah/Remis, warna kontras + ikon]
  · lawan (username + rating) · opening name · kontrol waktu · durasi (mm:ss) ·
  delta rating (+8 hijau / −5 merah, ikon panah) · tanggal relatif.
- Aksi per row (ikon + tooltip + aria-label): **Analisis** (onGoReview dgn gameId —
  cek prop existing), **Share** (copy link `/review/<id>` atau unduh PGN satu game via
  `/api/games/[id]/pgn` — sudah ada), **Rematch** (kirim `POST /api/challenge` ke lawan
  dengan time_control game tsb; state tombol "Menunggu…" + aria-live; lawan offline →
  pesan inline), **Favorit** (toggle sudah ada).
- Pagination: prev/next + teks "Halaman N dari M" (bukan infinite scroll); fokus pindah
  ke atas list saat ganti halaman (fokus management, bukan scroll jebakan).
- Filter chips: tetap 6 chip existing + counter per chip (counts sudah ada dari API).
- Semua state via `useAuthedFetch`/StateMessage; empty state: "Belum ada partai" + 2 CTA
  (Main vs Bot / Main Online).
**Acceptance:**
- W/L/D selalu tampil ikon + teks (bukan warna saja); delta rating ada tanda panah + angka.
- Rematch mengirim challenge nyata (verify via network tab / DB challenges row) dan tombol
  masuk state menunggu; tidak ada tombol rematch utk game vs bot tanpa lawan (disable + tooltip).
- Analisis membuka game-review dengan game yang benar (PGN matches).
- Pagination menjaga posisi fokus & list terbaca SR ("Halaman 2 dari 5").

## T6 (Web) — Puzzle hub: stats panel + filter tema/rating + mode kartu
**Komponen:** ubah `components/views/puzzle-hub.tsx`, `puzzle-view.tsx`, `rush-view.tsx`.
- Hub: stats strip personal di atas (rating puzzle, streak, solved/failed hari ini — dari
  `/api/home/dashboard` T1-existing fields, atau `/api/puzzles/stats` bila dibuat terpisah;
  semua angka sebagai teks berlabel, ikon sekunder) + 4 kartu mode (Unlimited/Harian/
  Gegas/Latihan Tema) dengan nama + deskripsi 1 kalimat.
- puzzle-view (Unlimited): bar filter — dropdown tema (dari `/api/puzzles/themes`, sudah ada),
  preset rating chips (<1200/1200–1800/1800+), Terapkan + Reset → panggil
  `/api/puzzles/next?theme=&minRating=&maxRating=` (endpoint sudah support).
  Hasil attempt: banner inline bawah papan (✓ hijau "Benar!" / ✕ merah + langkah terbaik)
  + aria-live polite; tombol "Lanjut" eksplisit (Enter juga); tanpa auto-advance saat
  reduced-motion.
- rush-view: pre-screen aturan + durasi (3/5 mnt) + best score; end-screen breakdown
  (benar/salah/best-streak) + tombol "Main lagi"; HUD skor+waktu tetap aria-live (sudah ada);
  pause otomatis saat `document.visibilitychange` hidden.
**Acceptance:**
- Stats strip tampil utk approved; guest melihat strip kosong + CTA "Masuk untuk menyimpan
  rating" hanya di strip (bukan blokir mencoba 1 puzzle).
- Filter tema+rating mengubah puzzle berikutnya (verify query param di network).
- Rush di-pause saat tab blur (waktu tidak berkurang) dan resume saat kembali; breakdown
  end-screen akurat vs attempt log.
- Semua angka/hasil sebagai teks; banner hasil aria-live; reduced-motion: tanpa confetti/
  auto-advance.

## T7 (QA) — Regression pass 4 menu (guest/pending/approved/admin)
Laporan only. Matrix: tiap menu × 4 role; cek kontrak state machine (401/403/503/ready),
DHH (aria-live ada, ikon+teks berpasangan, fokus terlihat), data benar (recentGames urut,
win-rate konsisten dgn DB, opening name matches PGN).
**Acceptance:** laporan QA di docs/design/sprint6.md dengan status per sel matrix; bug
ditemukan ditulis sebagai tiket follow-up.

---

## Dependensi & urutan
```
T1 ─┬─ T6 (dashboard stats)
T2 ─┴─ T5 (archive rows)
T3 ──── T4 (leaderboard data)
T4/T5/T6 (paralel, Web) → T7 (QA)
```
Tiket Backend (T1–T3) boleh jalan paralel; UI tiket menunggu endpoint-nya masing-masing.
Semua tiket UI WAJIB pakai `useAuthedFetch` + StateMessage (ui-flow-spec §2) — bukan
mapping error manual.

## Tiket ringkas
| # | Assignee | Judul | Blok |
|---|---|---|---|
| T1 | Backend | Dashboard recentGames[5] | — |
| T2 | Backend | Archive rows: opening_name + duration_sec | — |
| T3 | Backend | Leaderboard game_type filter + win_rate | — |
| T4 | Web | Leaderboard UI tab+chips+win-rate | T3 |
| T5 | Web | Archive UI hasil+opening+aksi | T2 |
| T6 | Web | Puzzle hub stats+filter+rush breakdown | T1 (parsial) |
| T7 | QA | Regression matrix 4 menu × 4 role | T4–T6 |
