# jev-chess Architecture Spec (Sprint8 — Konsolidasi)

Tanggal: 2026-10-23 · HEAD saat review: 4c28371d · Branch: deploy-sprint4 (= origin/main)

## 1. Peta Struktur

- **lib/** — domain & infra. Inti identitas: `auth-store.ts` (file-store users.json/sessions.json, HMAC token, `userForToken` vs `sessionUserForToken`), `user-auth.ts`, `use-session.ts` (client + `authErrorText`/`authErrorPayload`). Puzzle: `puzzle-api.ts` (`resolvePgUser`, `toDto`, `currentStreak`), `puzzle-solve.ts`, `puzzle-store.ts`, `puzzle-data.ts` (bank statis legacy). Infra: `db.ts` (PG), `realtime/ws-gateway.ts`, `kenari-client.ts`, `jev.ts`.
- **app/api/** — 28 grup route, ~40+ handler. Pola auth tersebar: `resolvePgUser` (18 file, family puzzle/endgame/friends/home/leaderboard), `currentUser`+mapping manual username→PG id (games/*), `userForToken` (ws-gateway), dan 23 route lain yang inline `NextResponse.json({ error ... 401/403 })`.
- **components/** — `puzzle-solver.tsx` adalah mesin papan puzzle (juga dipakai endgame drills). Enam view meng-import langsung: puzzle-view, rush-view, daily-puzzle-view, endgame-drills-view, missed-puzzles-view, themes-mastery-view — kontrak props sudah seragam (konvensi "kontrak sama dgn view lain"), tapi tidak diekspos sebagai tipe.

## 2. Duplikasi (hasil grep, angka asli)

| Pola | Lokasi | Jumlah |
|---|---|---|
| `resolvePgUser` dipakai | app/api | 18 route |
| Inline error JSON 401/403 (`NextResponse.json({ error`) | app/api | 32 file, 24 di luar puzzle family |
| Inline `503` DB guard | app/api | 8 |
| Mapping manual users.json id → PG uuid via username | games/*, match-result, respond | 5+ salinan komentar identik |
| `authErrorText` konsumen | lib/use-session.ts | 1 (dipakai view puzzle/stats) |

Kesimpulan: ada DUA API auth paralel — `resolvePgUser` (kaya: status, drift R4, 503) dan `currentUser`/manual (miskin: null → 401 generik, tanpa pending/rejected/drift/503). Ini perbedaan semantik nyata yang terlihat user antar-halaman.

## 3. Deepening Opportunities (Deep Modules)

1. **`routeAuth(req)`** — angkat `resolvePgUser` dari `lib/puzzle-api.ts` ke `lib/route-auth.ts`, jadikan satu-satunya gerbang auth semua API route. Return `{ ok, user } | { ok, response }` seperti sekarang. Sekaligus ekspor `pgIdByUsername()` untuk menelan 5+ salinan mapping username→uuid. Estimasi: helper 0.5 hari; migrasi 32 file inline 401 @ ~10 mnt/file ≈ 1 hari. Nilai: satu tempat untuk memperbaiki pesan 401/403/503 (client sudah siap via `authErrorText`).
2. **`StateMessage` komponen** — BELUM ADA (hanya disebut di komentar `puzzle-stats-view.tsx` / `missed-puzzles-view.tsx`). Buat `components/ui/state-message.tsx` (variant: empty/guest/error/loading), ganti fallback duplikat di views. Estimasi: 0.5 hari.
3. **Kontrak PuzzleSolver** — 6 view pass props identik; ekspor `export type PuzzleSolveConfig` dari puzzle-solver.tsx (type-only, tidak menyentuh logika) + satu `PuzzleSolveScreen` wrapper opsional nanti. Estimasi: 0.25 hari.

## 4. Technical Debt Berisiko

- **Dual-source identity**: users.json masih sumber session/auth (`auth-store.ts`, `use-session.ts`), PG hanya mirror untuk data game/puzzle. Mirror di `app/api/auth/route.ts:156` bisa gagal diam-diam (error di-log saja). R4 drift (user ada di file, tidak di PG) dihandle di resolvePgUser tapi TIDAK di route games/* — user login valid bisa dapat 401 kosong di arsip.
- **users.json masih dipakai untuk**: sumber `loadUsers()` untuk SEMUA auth, sesi (sessions.json), status pending/rejected, scrypt password, seed admin. Bukan legacy — masih critical path. Konsolidasi harus mendahulukan satu gerbang auth (A1) sebelum mikir migrasi penuh ke PG.
- **Service worker**: `public/sw.js` network-first dengan `CACHE_NAME="jev-chess-shell-v1"` statis, API tidak pernah di-cache. Risiko rendah, tapi cache shell tidak dibundle dengan build id — setelah deploy baru, shell lama bisa tampil sampai network-first refresh; QA catat ":43173 masih kode lama". Disarankan: masukkan hash build/versi ke CACHE_NAME saat build (atau unregister sw di dev).
- **Hardcoded strings**: endpoint AI hardcoded (`lib/kenari-client.ts` KENARI_ENDPOINT, `lib/jev.ts` TYPESAFE_ENDPOINT, `lib/flybrain/service.ts` codexUrl) — pindah ke env dengan fallback. `ADMIN_USERNAME` hardcoded di auth-store (acceptable, dokumentasikan).
- **ws-gateway** masih pakai `userForToken` (bukan session-aware) — 401/403 status tak pernah sampai ke WS; samakan semantik saat A1.

## 5. Urutan Refactor (tiket A) — kompatibel workstream puzzle

Batasan: JANGAN sentuh `components/puzzle-solver.tsx` (sedang diperbaiki) dan `lib/puzzle-api.ts` saat workstream puzzle aktif; tiket A1 dilakukan dengan re-export kompatibel sehingga pemanggil lama tidak putus.

- **A1 — lib/route-auth.ts**: pindahkan `resolvePgUser` + tambah `routeAuth(req)` + `pgIdByUsername()`. `lib/puzzle-api.ts` re-export (tanpa ubah perilaku). 0.5h.
- **A2 — Migrasi 18 route puzzle/endgame/friends/home/leaderboard** ke import baru (mechanical, grep-able). 1h.
- **A3 — Migrasi 24 route inline 401/403** (games/*, challenge, seek, stats, threats, pvp, dst.) ke `routeAuth`; sekalian hilangkan 5+ duplikat mapping username→uuid. 1 hari. *Pisah dari A2 agar tidak bersentuhan dengan deploy puzzle.*
- **A4 — StateMessage komponen + adopsi di views** (bukan puzzle-solver.tsx). 0.5 hari.
- **A5 — ws-gateway pakai sessionUserForToken** via routeAuth-semantics. 2h.
- **A6 — Endpoint AI → env config** (kenari/typesafe/codex). 1h.
- **A7 — sw.js CACHE_NAME dari build id** (Next public runtime env atau generated sw). 2h.
- **A8 (opsional, setelah semua di atas) — `export type PuzzleSolveConfig`** di puzzle-solver.tsx — jalankan HANYA setelah workstream puzzle merge. 0.25h.

Urutan A1→A2→A4 aman paralel dengan puzzle; A3, A8 tunggu giliran.
