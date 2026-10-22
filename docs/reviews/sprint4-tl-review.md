# TL Review — Sprint 4 Final (8 commit)

**Reviewer:** Tech Lead · **Tanggal:** 2026-10-23 · **Base:** ae0a4bd0 → HEAD 3c56687a (lokal, belum push)
**Verifikasi mandiri di sxz-server:** `npx tsc --noEmit` = PASS · `npx next build` = PASS (BUILD_ID uA3ikh3uST8wcNxsjNe_V) · `npx vitest run lib/puzzle-solve.test.ts lib/pgn-parse.test.ts` = 27/27 PASS.

## Verdict per commit

| Commit | Scope | Verdict |
|---|---|---|
| e70061f0 | api/home/dashboard | **APPROVED** |
| cf3d82dc | api/friends + leaderboard | **CHANGES_REQUIRED** |
| 9ec0e9fa | endgame drills backend | **APPROVED** |
| b003cffa | app shell + refactor game.tsx | **CHANGES_REQUIRED** |
| 72ac3d8f | home dashboard view | **APPROVED** |
| f6aac28b | leaderboard + friends view | **APPROVED (bersyarat)** |
| dd2e4eb5 | endgame drills view | **APPROVED** |
| 3c56687a | flow audit + link fix | **APPROVED** |

## Detail temuan

### cf3d82dc — api/friends (CHANGES_REQUIRED)

1. **BUG FUNGSIONAL — row `id` tidak diekspos.** `GET /api/friends` tidak mengembalikan `f.id`, padahal frontend (f6aac28b) memanggil `POST /api/friends/${person.id}/respond` dan `DELETE /api/friends?id=${person.id}`. `person.id` selalu `undefined` → tombol Terima/Tolak/Hapus selalu gagal ("id permintaan tidak tersedia."). Fix: tambahkan `f.id` di SELECT ketiga query + `id` di `shape()`.
2. **BUG DATA — duplikat teman setelah accept.** Accept meng-UPDATE row pengirim→penerima menjadi `accepted` DAN insert row arah balik `accepted` (desain dua-row). Tapi query list friends membaca kedua arah tanpa dedupe → teman yang sama muncul 2× (React `key={p.username}` duplikat). Fix: `SELECT DISTINCT ON (u.id) ...` atau filter/dedupe.
3. **Username enumeration (minor).** `POST {username}`: 404 "User tidak ditemukan." untuk user tak dikenal vs 409/201 untuk yang dikenal → attacker bisa memetakan username valid. Risiko rendah untuk app internal kampus; rekomendasi: respons generik. Tidak blocking jika disadari.
4. Yang sudah benar: respond guard penerima benar (`friend_user_id = $2 AND status='pending' FOR UPDATE` dalam transaction, idempoten); unfriend dua arah benar (DELETE pair dua arah dalam transaction, 403 bila bukan pihak relasi); semua query parameterized; leaderboard hanya mengekspos username/rating/games — tidak ada email/hash bocor; ranking SQL-side (`row_number() OVER (ORDER BY rating DESC, username ASC)`), bukan hardcoded client-side.

### b003cffa — app shell / refactor game.tsx (CHANGES_REQUIRED)

1. **BUG NAVIGASI — 4 navTab tanpa render case.** `NavTab` type, hash parser, dan sidebar shell memuat `daily`, `rush`, `themes`, `archive`, tapi `game.tsx` hanya merender view untuk: home, leaderboard, friends, drills, coach(+spectator), puzzles, vision, review, scan, community, admin, bots, play. Klik "Harian"/"Gegas"/"Tema"/"Arsip" → navTab berubah + hash `#/daily` dst, tapi **main content blank**. Home task card "Ulas Partai" (tanpa lastGame) juga menavigasi ke `archive` → blank. Fix: map `daily/rush/themes` → `PuzzleHub` (tab awal), `archive` → view arsip existing.
2. Regression check lainnya PASS: 13 view ter-render (hanya 4 mapping di atas yang hilang); auth guard tetap (`!currentUser` → AuthPanel; handleNavClick kini mengizinkan play+home untuk guest — sesuai flow audit); challenge flow utuh (`challenge_received` → ChallengeLayer, `game_added` → setPlayMode("pvp") + setNavTab("play") + setGameActive); review flow utuh (PasteBar + GameReview, back-to-play); spectator sync beres (efek `navTab==="spectator"` → setCoachSubTab). Hash deep-link untuk guest aman: view ber-login-guard jatuh ke AuthPanel.
3. a11y shell baik: skip-link, aria-current="page", focus-visible ring, combobox `role/aria-expanded/aria-autocomplete`, Esc kembalikan fokus ke trigger, more-sheet `role="dialog" aria-modal` + focus trap sederhana (cukup, konten statis).
4. Search combobox: debounce 300ms benar, tapi sumbernya `/api/leaderboard?scope=global` (top-50) difilter client-side — bukan endpoint search; `pickResult` mengabaikan username (`void username`) dan hanya pindah ke leaderboard — deep-link profil (design §1.2, signature UX #6) belum jalan. Minor, catat sebagai sisa, tidak blocking.

### dd2e4eb5 — drills view (APPROVED, catatan minor)

- `refresh()` membaca state `sets` lama (stale closure) setelah `await loadSets()` — state belum terupdate saat `sets?.find(...)` → progress header bisa lama. Perbaiki dengan mengembalikan data dari `loadSets()`. Kosmetik.
- Kontrak next/attempt/hint konsisten dengan S3-T1 PuzzleSolver; progressbar aria benar; 404 done-state ditangani.

### 72ac3d8f / e70061f0 — home dashboard (APPROVED)

- Dashboard scoped penuh ke session user (semua query `me.pgId`), parameterized, tanpa data sensitif. Catatan: `myTurn` = "giliran putih" (heuristic terdokumentasi di kode) — oke untuk sekarang, tingkatkan saat sinkronisasi papan berikutnya.
- Frontend honest empty state, refresh on visibilitychange, aria-live.

### f6aac28b — leaderboard + friends view (APPROVED bersyarat)

- XSS: username dirender sebagai teks React (`@{p.username}`) — tidak ada dangerouslySetInnerHTML di kedua view. Aman.
- Sticky-me, medali, segmented role="tab" benar. Bersyarat: Terima/Tolak/Hapus baru hidup setelah cf3d82dc #1 (row id) — bukan bug view; view sudah meng-handle `id` undefined dengan pesan jelas.
- `onChallenge` di game.tsx baru `setPlayMode("pvp"); navigate("play")` — tantangan inline belum benar-benar mengirim challenge ke user tsb, tapi FriendsView sudah mem-flash "Tantangan terkirim." → toast misleading. Dokumen sebagai sisa S4.

### 9ec0e9fa / 3c56687a — APPROVED

- Drills backend: pool SQL-side parameterized (`ANY($1::uuid[])` + tema GIN), kontrak puzzles/next dipertahani, progress derive tanpa tabel baru. `random()` per request oke skala ini.
- Flow audit masuk akal & jujur (sisa §6 diakui). Fix link Arsip (PGN) benar mengarah ke `/api/games/archive/pgn` yang ada di route build. Satu inkonsistensi: tabel audit menyebut `daily/rush/themes/archive` "OK" padahal render case-nya hilang (temuan b003cffa #1) — perbaiki tabel setelah fix.

## SQL & security ringkas

- Semua query baru parameterized ($1/$2 pg) — tidak ada interpolasi string nilai user. ORDER BY/LIMIT hardcoded di SQL (bukan input user). Tidak ada injeksi.
- Tidak ada email/hash/token di respons leaderboard/friends/dashboard. Presence hanya boolean online.
- Migration sprint4 idempoten + backup pg_dump pre-migration ada (51 MB).

## Kesimpulan

**PUSH READY = NO.** Dua commit CHANGES_REQUIRED: cf3d82dc (row id + duplikat friends — mematikan fitur sosial) dan b003cffa (4 navTab blank). Estimasi fix: ~30–60 menit (tambah `f.id` + dedupe di GET friends; map 4 tab ke view di game.tsx). Setelah fix + re-run build/test, layak push.
