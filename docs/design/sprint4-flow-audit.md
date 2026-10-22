# Sprint 4 — Flow Audit (S4-T5)

**Tanggal:** 2026-10-23 · **Scope:** peta flow §9 `docs/design/sprint4.md` — setiap view wajib punya jalur masuk (sidebar/home) dan jalur keluar bermakna (tidak ada dead end).

## 1. Tabel audit per view

| View (navTab) | Jalur masuk | Jalur keluar | Status |
|---|---|---|---|
| home | default setelah login; hash `#/home`; logo sidebar; bottom-nav Home | task cards → puzzles/daily/review/archive; Bermain Online → play/review | OK |
| play | sidebar Bermain; task card; home dual-aksi [Main]; challenge accepted; bottom-nav | modal akhir → Review Partai (auto 2.5s, GameOverModal `onReview`) | OK |
| bots | sidebar Bermain → Lawan Bot | pilih bot → play (engine terpasang) | OK |
| coach | sidebar Bermain → Pelatih | sub-tab Spectator; board-only view | OK |
| spectator | sidebar **Lainnya** → Spectator (sub-tab coach otomatis) | klik Pelatih → coach | OK (fix S4-T1: sub-tab sync `navTab==='spectator'`) |
| puzzles | sidebar Teka-Teki; task card 1 | PuzzleHub tab Harian/Gegas/Tema; onBack → play | OK |
| daily | sidebar Teka-Teki → Harian; task card 2 | tab Teka-Teki di PuzzleHub | OK |
| rush | sidebar Teka-Teki → Gegas; upsell PuzzleView idle | onBack → play | OK |
| themes | sidebar Teka-Teki → Tema | onBack → play | OK |
| review | sidebar Berlatih → Analisis; modal akhir game; home [Review] | "Kembali Bermain" → play; **[fix] link "Arsip (PGN)" → `/api/games/archive/pgn`** | OK (fix S4-T5) |
| scan | sidebar Berlatih → Scan Papan | load FEN → play | OK |
| vision | sidebar Berlatih → Visi (LearningHub) | konten belajar mandiri — keluar via sidebar | OK |
| drills | sidebar Berlatih → Permainan Akhir | solve mode (S3-T1); tombol Kembali → daftar set | OK (S4-T4) |
| community | sidebar Komunitas; bottom-nav Komunitas | konten komunitas — keluar via sidebar | OK |
| leaderboard | sidebar Komunitas → Papan Peringkat | username → profil (deep-link hooks disediakan) | OK (S4-T3) |
| friends | sidebar Komunitas → Teman | Tantangan → play; dock friends modal | OK (S4-T3) |
| archive | sidebar Komunitas → Arsip | GameReview (riwayat + PGN arsip server) | OK (S4-T5 fix: link dari review) |
| admin | sidebar **Lainnya** (hanya `isAdmin`) | panel admin mandiri | OK |

## 2. End-game loop (verifikasi kode-path)

1. Game berakhir → `GameOverModal` (`onReview` + auto-review 2.5s) → `setNavTab("review")` → GameReview. ✔
2. Review → header punya "Kembali Bermain" (play) dan kini link "Arsip (PGN)" (`/api/games/archive/pgn`, guard session). ✔
3. Arsip → game tersimpan di `games` (status finished) + riwayat `lib/game-history` — terbaca di Daftar Pertandingan. ✔
4. Analisis cepat: PasteBar di view review (S2-T4 fast-path) tetap tersedia. ✔

## 3. Challenge flow

Challenge masuk (WS `challenge_received`) → ChallengeLayer dual-button → accept → `game_added` → auto navigate play + badge N realtime. Muncul juga di Home "Bermain Online" (dashboard `gamesAktif`, refresh saat tab visible). ✔

## 4. Fix kecil yang diterapkan

- **game-review.tsx**: tambah link "Arsip (PGN)" — sebelumnya view review tidak punya jalur ke arsip server S2-T2 (hanya localStorage).
- **game.tsx (S4-T1)**: `navTab === "spectator"` men-sync sub-tab coach; guard handleNavClick mengizinkan `home` untuk guest.
- Home → navTab default `home` (bukan play) sesuai design §2.

## 5. Keyboard-only walk (a11y §8)

login (AuthPanel input) → Tab ke skip-link "Lewati ke konten utama" → main `#main-content` fokus → task card (button, Enter) → PuzzleSolver (papan interaktif) → sidebar via Tab (aria-current = halaman saat ini) → Bermain Online row → [Main] Enter → play. Semua interaktif semantik (button/a/input), focus-visible ring hijau. ✔

## 6. Sisa (tidak dikerjakan — di luar scope S4)

- Leaderboard username → halaman profil publik terpisah belum ada (deep-link hook disiapkan, `onOpenProfile`).
- Presence dot friends hanya live saat teman konek WS (kontrak S1-T3) — offline count bukan bug.
