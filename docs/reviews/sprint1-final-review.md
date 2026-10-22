# TL Final Review — Sprint 1 Fix Commits (64593eb5, c91b88e4, f0ec477e, a64caa49)

**Reviewer:** Tech Lead · **Date:** 2026-10-22 · **Status:** verifikasi FINAL sebelum push
**Referensi:** docs/reviews/sprint1-t2t3t4-tl-review.md (C1–C12)
**Build:** `npm run build` dijalankan sendiri di sxz-server — **PASS**, semua route ter-commit termasuk `/api/challenge` dan `/api/challenge/[id]/respond`.
**DB:** tabel `challenges` terverifikasi via `docker exec jev-postgres psql -U jev -d jev_chess -c "\d challenges"` — kolom, indeks `(from_user_id,status)` & `(to_user_id,status)`, FK users/games sesuai docs/db/sprint1.md §2. `users_username_key` UNIQUE ada.

---

## 64593eb5 — S1-T2-fix (match atomic + cancel atomic) — **APPROVED**

- **C1 (critical, race double-match): TERTUTUP.** MATCH_LUA sekarang ZREM pool + DEL hash + DEL indeks seek PEMANGGIL di awal script, lalu pop lawan — semua dalam satu EVALSHA, tidak ada round-trip antara. Verifikasi smoke nyata: script dieksekusi identik dengan repo, dua koneksi Redis paralel (EVAL bersamaan, db 9 ephemeral, dibersihkan setelahnya) dengan seek A & B saling terdaftar → **tepat 1 match**, seek kedua return nil, pool & `seek:user:*` & hash bersih (0 sisa). Jendela race tidak ada.
- **C2 (KEYS + non-atomic cancel): TERTUTUP.** `removeUserSeek`/`getUserSeek` pakai indeks `seek:user:{userId}` → Lua REMOVE_LUA (GET idx → ZREM pool by tc:mode → DEL hash + idx, satu script, idempoten). Tidak ada `keys()` tersisa di seek-pool.ts.
- **C3 (UNIQUE username): TERTUTUP.** Dokumentasi eksplisit di docs/db/sprint1.md §Migration + docs/db/sprint1-migration.sql (idempoten); constraint `users_username_key` terverifikasi di DB.
- **C4 (genUuid): TERTUTUP** — `randomUUID()` dari crypto. Bonus: bug `game_removed` mengirim seekId diperbaiki jadi seekId hasil remove.

## c91b88e4 — S1-T3-fix (jev:playing SREM + presence generation) — **APPROVED**

- **C5 (jev:playing leak): TERTUTUP.** api/match-result: setelah GameEnded, ambil kedua pemain dari row game, UPDATE status='finished', petakan pg uuid → store id (join username), `clearPlaying` (SREM per user via setPlaying(false)) baru lalu publish PlayingCountChanged ke topik `presence` setelah count benar-benar turun. Urutan benar.
- **C6 (race offline reconnect): TERTUTUP.** Generation counter per user + refcount saat close: publish offline hanya jika tidak ada conn dengan generation lebih baru. Logika benar dan murah.
- **ADR-002** diamended untuk `subscribe(fromOffset?)` — sesuai instruksi review.

## f0ec477e — S1-T4-fix (frontend) — **APPROVED**

- **C10 (game_added): TERTUTUP.** game.tsx handle `game_added` → setPlayMode("pvp")/setNavTab("play")/setGameActive(true) + set opponent; events.ts frontend adalah file tunggal yang sama dengan backend (toastsTopic ada di kedua sisi — diverifikasi).
- **C9 respond contract:** `resolveChallenge` kini POST `/api/challenge/[id]/respond` { action } sesuai kontrak backend.
- **C12a (a11y): TERTUTUP.** Instance mobile CardBody `aria-hidden` + `tabIndex -1`, role/aria-live dihapus dari instance tersembunyi → tidak dobel announce.
- **C12b (tc di event) — ditunda dengan sadar:** ChallengeReceived belum membawa `tc`; label control pindah ke konstanta `CHALLENGE_CONTROL_LABEL` (satu sumber, bukan string tersebar). Ini masih hardcode "Cepat · 10 menit" — dicatat sebagai **follow-up sprint berikutnya** (tambah field `tc` ke kontrak event dua sisi), tidak memblokir push.

## a64caa49 — S1-T4-backend (api/challenge + respond atomic) — **APPROVED**

- **C9 (endpoint hilang, blocker): TERTUTUP.** POST /api/challenge (INSERT challenges + ChallengeReceived ke matcher target), POST /api/challenge/[id]/respond accept/decline, DELETE cancel. Field & indeks sesuai docs/db/sprint1.md §2; tabel terverifikasi di DB.
- **Atomic claim — terverifikasi nyata:** smoke di jev-postgres (row challenge ephemeral, dihapus setelahnya): dua UPDATE paralel (accept + decline) WHERE status='pending' RETURNING → **tepat satu UPDATE 1**, satu UPDATE 0, status final `accepted`. Tidak bisa double-accept.
- Self-challenge guard, validasi timeControl `^\d+\+\d+$`, cancel hanya oleh pengirim & masih pending — semua benar.
- Catatan minor (non-blocking): doc menulis `id TEXT`, DB memakai `uuid` (app insert `crypto.randomUUID()` string — kompatibel, hanya dokumentasi sedikit meleset).

---

## Ringkasan verdict

| Commit | Verdict |
|---|---|
| 64593eb5 (S1-T2-fix) | APPROVED |
| c91b88e4 (S1-T3-fix) | APPROVED |
| f0ec477e (S1-T4-fix) | APPROVED |
| a64caa49 (S1-T4-backend) | APPROVED |

**Kesimpulan: PUSH READY.** Semua temuan C1–C12 tertutup kecuali C12b (field `tc` di ChallengeReceived) yang disepakati sebagai follow-up. Tidak ada perubahan kode dilakukan oleh review ini.
