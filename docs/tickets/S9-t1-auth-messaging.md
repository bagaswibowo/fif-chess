# S9-T1 — Auth messaging: pending → 403 `account_pending` di SEMUA endpoint authed + UI jujur

**Role**: PM · **Sprint**: S9 · **Sumber**: `docs/design/s9-s10-scope.md` S9-T1 +
`docs/design/chesscom-parity-audit.md` G0.1–G0.3. Pola template: `lib/puzzle-api.ts`
`resolvePgUser` (FIX-1.2, S7) — 401 unauthenticated / 403 `account_pending` /
403 `account_rejected` / 503 `service_unavailable`, shape `{ error, code?, retryable }`.

## 1. Context (status riil, diverifikasi 991eb25)

**Backend — endpoint yang SUDAH benar** (pakai `resolvePgUser`, grep
`lib/puzzle-api.ts` import): `api/courses`, `api/courses/[id]`, `api/endgames/drills`
(+ `[setId]/next`), `api/friends`, `api/friends/[id]/respond`, `api/games/archive`,
`api/home/dashboard`, `api/insights`, `api/leaderboard`, `api/opening/win-rate`,
`api/practice/weekly`, `api/puzzles/*` (8 route), `api/tournament`, `api/tournament/[id]`.
Cek cepat regresi: `grep -rn "account_pending" app/api/` = semua route di atas +
`api/pvp` (create saja).

**Backend — pelanggaran G0.1** (pending user dapat 401 "login required", padahal
sudah login; helper `currentUser` = `userForToken` hanya resolve status
`approved`, `lib/auth-store.ts:212-215`):
- `app/api/challenge/route.ts` (POST:32, DELETE:100) + `app/api/challenge/[id]/respond/route.ts` (POST:41)
- `app/api/community/route.ts` POST:148-149 (`GET` publik di :143 — jangan disentuh)
- `app/api/games/[id]/favorite/route.ts` PATCH:29
- `app/api/games/[id]/pgn/route.ts` GET:30 + `app/api/games/archive/pgn/route.ts` GET:33
- `app/api/seek/route.ts` GET:32 / POST:41 / DELETE:90 + `app/api/seek/user-seeks/route.ts` GET:21
- `app/api/stats/summary/route.ts` GET:40
- `app/api/pvp/route.ts` — guard FIX-1 hanya di `roomCreate` (:431-434); dispatch POST
  (:150) + GET list games (:100) pakai `currentUserId` (approved-only, :53-61) sehingga
  pending → 401 tanpa `code`; op `join` (:497), `move` (:543), `leave`, `resign`/`draw`
  (:591/:622), `draw-offer` (:650), `note` (:661) → 401 "Sesi tidak valid."

**Backend — sudah compliant, jangan diubah**: `app/api/learn/bookmarks/route.ts`
(kontrak S7 §4.2 eksplisit: file store = 401/400 saja, pending boleh akses) dan
`app/api/match-result/route.ts` (POST terbuka; `currentUser` di `finishGameSnapshot`
optional → delta null, pola vs-bot guest).

**Frontend — pelanggaran G0.1/G0.2/G0.3** (grep `Masuk untuk|Masuk dulu` + 403 handling):
- `components/views/home-view.tsx:52` — SATU mapping: `res.status === 401 ? "Sesi
  berakhir — masuk kembali." : "Gagal memuat dashboard."` → pending (403) dan 503
  sama-sama jadi "Gagal memuat dashboard." (G0.3: error DB dipalsukan).
- `components/pvp-panel.tsx:220` — copy guest sah ("Masuk dulu untuk bermain PvP");
  pending (:222) / rejected (:225) SUDAH benar → guardrail: jangan ubah.
- `components/shell/app-shell.tsx:433-442` — user chip hanya
  `{user.username} · {elo} rating` (guest: "Masuk untuk rating", :442).
  `ShellUser` (`app-shell.tsx:39`) tidak punya `status` → G0.2 (tanpa badge
  approved/pending di mana pun).
- `components/views/tournaments-view.tsx:106-108` — 403 `capacity` vs 403 lainnya →
  "Akun menunggu persetujuan admin" SUDAH benar (guardrail: jangan ubah).
- views lain SUDAH map via `authErrorText` (`lib/use-session.ts:113-124`):
  endgame-drills (:82), friends (:44), leaderboard (:53), archive (:87), courses
  (:109), practice (:48), puzzle-stats, missed-puzzles, openings, lessons —
  tinggal benar saat backend di-fix.
- `components/views/rush-view.tsx:110-112` — `!res.ok` di `/api/puzzles/rush/start`
  → `setDisconnect(true)` mentah (403 pending jadi "disconnect").
- `components/views/daily-puzzle-view.tsx:50-52` — non-ok selain 400 → copy
  "Belum tersedia — kembali besok" (menelan 403/503).

## 2. Task (sub-task per file/endpoint)

1. **Backend helper** — `lib/puzzle-api.ts`: tambah `resolveSessionUser(request)`
   (nama bebas) — pola FIX-1 tanpa query PG: tanpa sesi → 401 `unauthenticated`;
   pending → 403 `account_pending`; rejected → 403 `account_rejected`. (Endpoint yang
   butuh pg-id map username→uuid setelahnya, pola `currentUserId` di `api/pvp` —
   helper TIDAK menggantikan mapping tsb, diff minimal.)
2. **Endpoint challenge/community/games/seek/stats** — ganti guard
   `currentUser`/`currentUserId` dengan helper #1 di:
   `api/challenge` (POST+DELETE), `api/challenge/[id]/respond`,
   `api/community` (POST saja), `api/games/[id]/favorite`, `api/games/[id]/pgn`,
   `api/games/archive/pgn`, `api/seek` (GET+POST+DELETE), `api/seek/user-seeks`,
   `api/stats/summary`. Body sukses (2xx/4xx lain) TIDAK berubah.
3. **Endpoint pvp** — `api/pvp/route.ts`: dispatch POST + GET + op
   join/move/leave/resign/draw/draw-offer/draw-decline/note map pending →
   403 `account_pending` (guard `roomCreate` :431-434 tetap; in-memory room
   tanpa PG jadi TIDAK bisa 503 — sesuai kontrak S6 §"Room ops in-memory").
4. **home-view.tsx** — error dashboard pakai `authStatus` (dipass dari
   `game.tsx`:356-363) + `authErrorText`: pending → "Akun menunggu
   persetujuan admin."; 5xx → pesan generik + tombol "Coba lagi" (bukan
   "Sesi berakhir").
5. **User chip badge** — `ShellUser` (`app-shell.tsx:39`) tambah
   `status?: "pending" | "approved" | "rejected"` (additive; game.tsx
   :1253 pass `currentUser.status`); chip `app-shell.tsx:433-442` render badge
   "Menunggu admin" (pending) / "Ditolak" (rejected) + `sr-only` teks status;
   guest unchanged ("Masuk untuk rating").
6. **rush-view.tsx** — `!res.ok` di start/attempt (sub-task) → map 403
   `account_pending` via `authErrorText` → state pending ("Akun menunggu
   persetujuan admin — selesai setelah disetujui."), 401 → CTA masuk,
   503 → "Server sedang sibuk. Coba lagi."
7. **daily-puzzle-view.tsx** — non-ok :50-52 → 403 pending/rejected →
   `authErrorText`; 400 tetap "Tanggal belum tersedia."; selain itu
   "Gagal memuat. Coba lagi."

## 3. Acceptance criteria (observabel)

- Sehari test user status `pending` (approve flow admin buat dulu):
  - `GET /api/seek`, `GET /api/stats/summary`, `POST /api/challenge`,
    `PATCH /api/games/<id>/favorite`, `GET /api/games/<id>/pgn`,
    `POST /api/community {action:"post"}`, `GET /api/pvp`,
    `POST /api/pvp {action:"join"|...}` → **403** `{"code":"account_pending","retryable":false}`
    (sekarang: 401 tanpa code).
  - `GET /api/leaderboard` pending → tetap 403 `account_pending` (regresi, S7 sudah benar).
  - User **guest** di semua endpoint di atas → tetap **401** `unauthenticated`.
  - User **rejected** → 403 `account_rejected` (bukan 401).
  - `GET /api/learn/bookmarks` pending → **200** (regresi kontrak S7 — jangan ubah).
  - `POST /api/match-result` guest (vs-bot selesai) → tetap 200 `{ok:true}` (regresi vs-bot).
- UI: pending user buka `#/home` → "Akun menunggu persetujuan admin." (bukan
  "Sesi berakhir"); user chip sidebar menunjukkan badge "Menunggu admin";
  rush start pending → panel pending, bukan "Koneksi terputus".
- `node -e` smoke: `curl -H "Cookie: jev_session=<pending-token>"
  http://localhost:3000/api/stats/summary` → HTTP 403, body code `account_pending`.

## 4. Guardrail (JANGAN)

- Jangan ubah respons sukses + status lain (400/404/409/429) di endpoint yang disentuh.
- Jangan tambah guard 401 di `api/match-result` (vs-bot guest + local games) dan
  jangan ubah auth `api/learn/bookmarks` (kontrak S7 eksplisit 401/400-only).
- Jangan sentuh `api/seek/user-seeks` di luar map status (in-memory pool, bukan PG).
- Frontend: jangan ubah copy guest di `pvp-panel.tsx:220`,
  `tournaments-view.tsx:92/105/286/288`, `puzzle-hub.tsx:143`,
  `practice-view.tsx:184`, `courses-view.tsx:198` (sah untuk guest) — hanya
  jalur 403/5xx yang diperbaiki.
- Diff backend per endpoint = swap guard + response code; tanpa migrasi/ADR baru
  (semua mapping FIX-1 sudah ada di `lib/auth-store.ts`).
