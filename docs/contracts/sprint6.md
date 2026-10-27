# Sprint 6 Game-Flow — Shared API Contract (contract-first, backend + frontend)

**Status:** Accepted · **Date:** 2026-10-27 · **Sumber keputusan:** `docs/adr/ADR-009-sprint6-gameflow.md`
**Scope:** S6-T1..T5. Satu-satunya kontrak shared yang di-import kedua sisi (backend
implement route, frontend implement caller). Semua bentuk di bawah harus eksak —
tidak menambah field tanpa ADR.

Kunci konvensi:
- **[REUSE]** = endpoint/field/event yang SUDAH ADA (grep `app/api/…`,
  `lib/realtime/events.ts`, `lib/opening-book.ts`, `lib/realtime/seek-pool.ts`,
  `docs/db/db-schema.sql`). Tidak berubah di S6.
- **[NEW]** = endpoint/op/event/table yang dibuat S6 (ADR-009). Tiap item [NEW]
  merujuk keputusan ADR-009 D1..D5.
- Error codes standar (FIX-1, `lib/puzzle-api.ts`): `401 unauthenticated`,
  `403 account_pending` (sesi valid, status pending), `403 account_rejected`,
  `403 account_missing`, `503 service_unavailable` (DB down, retryable),
  `429` (rate limit, retryable). Route in-memory (`api/pvp` room ops) tidak
  bisa 503 (tidak menyentuh PG).
- Time control: string `"<menit>+<inkremen>"` regex `\d+\+\d+` (format tunggal
  di `games.time_control`, `challenges.time_control`, `SeekTicket.tc`).
  Kategori waktu diturunkan dari menit (aturan `api/leaderboard`):
  bullet <3, blitz 3..<10, rapid ≥10 — **kirimkan hanya `tc` + `rated`**,
  jangan kirim kategori (ADR-009 D2.2).

---

## 1. Endpoint — HTTP

### 1.1 Opening Explorer (S6-T1, ADR-009 D1)

`POST /api/opening` **[REUSE — tanpa perubahan]**
Body `{ fen: string }`. Respons `FenLookupResponse` (existing
`lib/opening-book.ts`):

```ts
interface FenLookupResponse {
  fen: string;
  valid: boolean;
  sideToMove: "w" | "b";
  fullmoveNumber: number;
  halfmoveClock: number;
  opening?: OpeningInfo; // { name: string; eco: string; moves: string[]; position: string; isInBook: boolean }
}
```

Candidate move per node dari `lib/engines/opening-book.ts`
(`getOpeningBookMove(fen, seed): string | null` — UCI `"e2e4"`; array =
multi-candidate). Win-rate per posisi DARI DATA RIIL:

`GET /api/opening/win-rate?fen=<FEN>` **[NEW — ADR-009 D1.2]**
SQL-side agregasi dari `game_moves.fen` × `games` (hanya `status='finished'`;
indeks `idx_game_moves_game` + `idx_games_white_ended/_black_ended`).
401/403-FIX-1/503 seperti standard. Respons:

```ts
interface WinRateResponse {
  fen: string;
  samples: number;            // jumlah game finished yang melewati FEN tsb
  wins: number;              // menang dari sisi yang bergerak di FEN tsb
  losses: number;
  draws: number;
  winRate: number | null;    // wins/samples (0..1, 2 desimal), null jika samples===0
}
```

Tab "Buah" di view `/explorer` **tidak punya data** di S6 (placeholder,
ADR-009 D1.4 — tidak dipanggil endpoint mana pun).

Cross-link kursus: navigasi internal `/courses?opening=<eco>` — S7 (queued),
bukan endpoint.

### 1.2 Clock Presets di Pairing (S6-T2, ADR-009 D2) — REUSE, tanpa perubahan payload

Konstanta preset (frontend-only, D2.2):

```ts
const CLOCK_PRESETS: { label: string; tc: string; category: "bullet" | "blitz" | "rapid" }[] = [
  { label: "1+0",  tc: "1+0",  category: "bullet" },
  { label: "3+0",  tc: "3+0",  category: "bullet" },
  { label: "3+2",  tc: "3+2",  category: "blitz"  },
  { label: "5+0",  tc: "5+0",  category: "blitz"  },
  { label: "10+0", tc: "10+0", category: "rapid"  },
  { label: "15+10",tc: "15+10",category: "rapid"  },
]; // + "custom": input base & increment, validasi \d+\+\d+ client-side
```

- **Challenge flow:**
  `POST /api/challenge { toUserId: string, timeControl: string, rated?: boolean }`
  **[REUSE]** → 201 `{ ok: true, challengeId: string }`.
  `POST /api/challenge/[id]/respond { action: "accept" | "decline" }` **[REUSE]**
  → accept: 201 `{ ok: true, status: "accepted", gameId: string }`;
  decline: 200 `{ ok: true, status: "declined" }`.
  `DELETE /api/challenge?id=<id>` **[REUSE]** → `{ ok: true }` (cancel).
- **Quick-pairing (seek) flow:**
  `POST /api/seek { tc: string, mode: "rated" | "casual" }` **[REUSE]**
  → 201 `{ ok: true, seek: SeekTicket }`.
  `GET /api/seek` / `GET /api/seek/user-seeks` **[REUSE]** (bootstrap).
  `DELETE /api/seek` **[REUSE]** → `{ ok: boolean }`.
  `SeekTicket` (existing `lib/realtime/seek-pool.ts`):
  `{ seekId, userId, pgUserId, rating, tc, mode: "casual"|"rated", createdAt }`.
  **Tidak ada field warna** di seek (D2.3): warna acak di matcher.
- **Pilihan warna** (white/black/random): hanya tersedia di invitation
  `POST /api/pvp { action: "create", side?: "white"|"black"|"random",
  invitedUser?: string }` **[REUSE, op existing `roomCreate`]** — respons
  201 `{ success: true, room: PvpRoom, yourSide: "white"|"black", playerToken: string }`.
  Challenge→game & seek tetap acak warna (behavior existing, tidak diubah).
- **Tidak ada endpoint baru di D2** (ADR-009 D2.4).

### 1.3 Abort / Rematch / Offer-Draw (S6-T3, ADR-009 D3)

Semua op di route existing `POST /api/pvp` (body `{ action, code, playerToken,
… }` — pola `components/pvp-panel.tsx`):

- **Abort:** `POST /api/pvp { action: "leave", code, playerToken }` **[REUSE op,
  perilaku diperluas D3.1]** — room `active` + `moves.length===0` → room ditutup
  `outcomeKind:"aborted"`, `winner:null`, lalu publish **`GameAborted` [NEW]**
  (payload §2). 404 jika kode tidak ada; 400 jika room sudah `finished`.
  Game DB yang belum dimulai ditutup lewat `DELETE /api/challenge?id=`
  **[REUSE]** (status 'cancelled') — sesuai D3.1.
- **Resign:** `POST /api/pvp { action: "resign", code, playerToken }`
  **[REUSE, `roomOutcome` existing]** → `{ success: true, room: PvpRoom }`.
  Event WS `GameEnded { result }` [REUSE] (dipublish `api/match-result` untuk
  game DB) — **tidak ada event resign baru**.
- **Offer-draw:** `POST /api/pvp { action: "draw-offer", code, playerToken }`
  **[NEW op — D3.3]** → `{ success: true }` + publish **`DrawOffered` [NEW]**.
  Lawan accept: `action: "draw"` **[REUSE op existing]** → outcome draw.
  Lawan decline: `POST /api/pvp { action: "draw-decline", code, playerToken }`
  **[NEW op — D3.3]** → `{ success: true }` + publish **`DrawDeclined` [NEW]**.
- **Rematch:** **tidak ada endpoint baru** (D3.2) — pola existing
  `components/views/archive-view.tsx` `sendRematch`, diekstrak ke
  `lib/rematch.ts` (refactor frontend lokal):
  1. `GET /api/auth/lookupByUsername?username=<opp>` **[REUSE]** →
     `{ id: string }` (404 bila tak ada).
  2. `POST /api/challenge { toUserId: id, timeControl: <tc dari game> | "3+2" default, rated: true }`
     **[REUSE]** → 201 `{ ok, challengeId }`.
  3. Backend publish `ChallengeReceived` [REUSE] ke matcher target +
     **`RematchRequested` [NEW]** (payload §2) ke `matcher/<target>` — konteks
     "rematch dari partai X" untuk modal game-over.

Guard (D3.5): user status `pending` menolak op room-creator (403
`account_pending`, pola `roomCreate` yang sudah cek `approved` pada invitedUser);
401 tanpa session; room ops tidak bisa 503.

### 1.4 Insights (S6-T4, ADR-009 D4)

`GET /api/insights` **[NEW]** — param query (semua opsional kecuali `user`):
`?user=<username>&window=30|90|365|all&game_type=bullet|blitz|rapid&color=w|b`
- `user` = session sendiri → guard FIX-1 (401/403 `account_pending`/503).
- `user` ≠ session → **publik, tanpa guard** (mengexpose username + rating,
  konsisten `api/leaderboard`). 404 bila username tak ada.
- Param invalid (`window`/`game_type`/`color`) → 400.
- Agregasi SQL-side dari `games` (indeks existing `idx_games_*`), pattern
  `api/stats/summary` + kategori waktu `api/leaderboard`. Respons:

```ts
interface InsightsResponse {
  user: { username: string; rating: number | null };
  window: "30" | "90" | "365" | "all";
  gameType: "bullet" | "blitz" | "rapid" | null;
  color: "w" | "b" | null;
  totals: { wins: number; losses: number; draws: number; games: number;
           winRate: number | null };        // winRate 0..1, 2 desimal (pola api/leaderboard)
  byType: Record<string, { wins: number; losses: number; draws: number; total: number }>;
  ratingGraph: { date: string | null; gameId: string; gameType: string | null; rating: number | null }[];
  ratingDelta: number | null;              // latest − earliest (null jika <2 titik)
  recentGames: RecentGame[];              // ≤10, shape = recentGames GET /api/home/dashboard [REUSE shape]
}
// RecentGame (existing, dashboard): { id, myResult: "win"|"loss"|"draw", opponent: { username, rating }, timeControl, gameType, endedAt }
// Catatan: recentGames kosong untuk deep-link publik (perspektif "you" tidak terdefinisi)
// — client menampilkan byType/ratingGraph saja.
```

Deep-link frontend: `/insights` (sesi sendiri) & `/insights/<user>` (publik) —
sama-sama memanggil endpoint di atas.

### 1.5 Tournaments Arena (S6-T5, ADR-009 D5)

- `GET /api/tournament` **[NEW — publik]** → `{ arenas: TournamentArena[] }`.
- `POST /api/tournament` **[NEW — auth]** (create arena). Body
  `{ name?, timeControl, rated?, startAt?, capacity? }`
  → 201 `{ ok: true, tournamentId: string }`. 400 bila `timeControl` tidak
  lolos `\d+\+\d+`; `startAt` default = now + 30 menit bila kosong;
  `capacity` default 8.
- `POST /api/tournament/[id]` **[NEW — auth]** (join). Body
  `{ user }` opsional (username guest-join; tanpa = sesi sendiri).
  → 201 `{ ok: true, tournamentId: string }`. 404 arena tidak ada /
  sudah live/finished (join hanya saat `registration`); 403 bila penuh.
- `GET /api/tournament/[id]` **[NEW — publik]** → detail arena + entrants
  (bootstrap). 404 bila tidak ada.

Auth/error codes: create/join → 401 tanpa session, 403 `account_pending`
(user pending), 503 DB down (pola `resolvePgUser`). GET publik → 404/503
saja.

```ts
type TournamentStatus = "registration" | "live" | "finished";
interface TournamentArena {
  id: string;
  name: string;
  timeControl: string;          // "<menit>+<inkremen>" (format tunggal)
  rated: boolean;
  status: TournamentStatus;
  startAt: number;             // epoch ms
  capacity: number;
  entrants: number;            // jumlah tournament_players status 'joined'
  currentPlayers?: number;     // entrants yang sedang dipairing saat 'live'
}
interface TournamentPlayer {
  username: string;
  rating: number;
  joinedAt: number;
}
```

**Matching arena = REUSE seek pool existing (D5.2): TIDAK ADA pairing
algorithm baru di endpoint ini.** Saat `startAt` tiba, sweep in-process
(30s, pattern `lib/realtime/matcher.ts`) membuat seek ticket sementara per
entrant (tc = `timeControl` arena, mode = `rated ? "rated" : "casual"`) dan
membiarkan matcher atomic-Lua (`lib/realtime/seek-pool.ts`) yang mem-pair &
menciptakan `games` row + publish `GameAdded`/`GameStarted` [REUSE].
Entrants belum ter-pair → sweep berikutnya (ronde 2, seek ulang).
Bracket/Swiss/live-ranking = out of scope S6 (defer).

Schema [NEW — `docs/db/sprint6-migration.sql`, idempoten, pola
sprint4-migration.sql]:

```sql
CREATE TABLE IF NOT EXISTS tournaments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name         varchar(100) NOT NULL,
    time_control varchar(10) NOT NULL,
    rated        boolean NOT NULL DEFAULT false,
    status       varchar(20) NOT NULL DEFAULT 'registration', -- registration|live|finished
    start_at     timestamptz NOT NULL,
    capacity     integer NOT NULL DEFAULT 8,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tournament_players (
    tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id       uuid NOT NULL REFERENCES users(id),
    status        varchar(20) NOT NULL DEFAULT 'joined',
    joined_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments (status, start_at);
CREATE INDEX IF NOT EXISTS idx_tournament_players_t ON tournament_players (tournament_id, status);
```

---

## 2. WebSocket — event names & payloads

Framing/transport: REUSE penuh ADR-001/002 (`lib/realtime/ws-gateway.ts`,
`frame.ts` `{op, topic, offset?, payload?}`, auth handshake `jev_session`).
Event di-broadcast via `publishBusEvent` (`lib/realtime/bus.ts`) — tidak ada
client publish. Tipe NEW ditambahkan ke union `RealtimeEvent`
(`lib/realtime/events.ts`); topic builder [NEW] `tournamentTopic(id)`
ditambahkan di file yang sama.

### 2.1 Event [REUSE] (tidak berubah — sebutkan untuk kelengkapan kontrak)

| Event | Payload | Topic | Dipakai S6 |
|---|---|---|---|
| `GameAdded` | `{ gameId, white, black }` | `matcher/<userId>` | D5 (match arena) |
| `GameRemoved` | `{ gameId }` | `matcher/<userId>` | D3/D5 (cancel) |
| `GameStarted` | `{ gameId, white, black }` | `game/<id>/moves` | D3 (rematch→game) |
| `MoveMade` | `{ gameId, san, fen, moveNumber }` | `game/<id>/moves` | gameplay |
| `GameEnded` | `{ gameId, result }` | `game/<id>/moves` | D3 resign/D5 hasil |
| `ChallengeReceived` | `{ challengeId, fromUserId, fromUsername }` | `matcher/<userId>` | D3 rematch, pairing |
| `ChallengeResolved` | `{ challengeId, accepted }` | `matcher/<userId>` | D3 lifecycle |
| `PresenceChanged` | `{ userId, online }` | `presence/<userId>` | — |
| `PlayingCountChanged` | `{ count }` | `presence` | badge nav |

### 2.2 Event [NEW] — ADR-009

```ts
// D3 — game-flow (topic game/<id>/moves kecuali noted)
type GameAborted     = { type: "game_aborted";     gameId: string; reason: "aborted" };
type DrawOffered     = { type: "draw_offered";     gameId: string; fromUser: string }; // store id (auth)
type DrawDeclined    = { type: "draw_declined";    gameId: string };
type RematchRequested= { type: "rematch_requested"; gameId: string; challengeId: string; fromUser: string }; // topic matcher/<target>
// D5 — tournament
type TournamentUpdated = {
  type: "tournament_updated";
  tournamentId: string;
  status: "registration" | "live" | "finished";
  entrants: number;
}; // topic tournament/<id> [NEW builder] + salinan toasts/<creator>
```

Union: `RealtimeEvent = … | GameAborted | DrawOffered | DrawDeclined |
RematchRequested | TournamentUpdated` (additive — subscriber lama tetap
render, TL regression gate).

`gameId` pada event game-flow = `code` room in-memory (`FIF-XXXXXX`,
pola `PvpRoom.code`) saat game dari `api/pvp`, atau pg uuid saat game dari
challenge/seek — konsisten dengan behavior `GameStarted`/`GameEnded`
existing (keduanya sudah campur-dua sumber, tidak dinormalisasi di S6).

---

## 3. Matriks NEW vs REUSE (referensi cepat)

| Item | Status | ADR |
|---|---|---|
| `POST /api/opening` | REUSE | D1 |
| `GET /api/opening/win-rate` | **NEW** | D1 |
| `POST /api/challenge` (+timeControl, rated) | REUSE | D2 |
| `POST /api/challenge/[id]/respond` | REUSE | D2/D3 |
| `DELETE /api/challenge?id=` | REUSE | D3 (abort game DB) |
| `POST /api/seek` (+tc, mode) | REUSE | D2 |
| `GET /api/seek` / `GET /api/seek/user-seeks` / `DELETE /api/seek` | REUSE | D2 |
| `POST /api/pvp` op `create/join/move/leave/resign/draw` | REUSE (op; `leave` diperluas untuk abort) | D3 |
| `POST /api/pvp` op `draw-offer` / `draw-decline` | **NEW op di route existing** | D3 |
| `POST /api/match-result` (resign→GameEnded, rating snapshot) | REUSE | D3 |
| `GET /api/auth/lookupByUsername` | REUSE (rematch lookup) | D3 |
| `GET /api/insights` (+deep-link publik) | **NEW** | D4 |
| `GET /api/tournament`, `POST /api/tournament`, `POST /api/tournament/[id]`, `GET /api/tournament/[id]` | **NEW** (4 endpoint, 1 modul) | D5 |
| Tabel `tournaments` + `tournament_players` | **NEW** (migrasi S6) | D5 |
| Event `GameAborted`/`DrawOffered`/`DrawDeclined`/`RematchRequested`/`TournamentUpdated` + `tournamentTopic()` | **NEW** (additive ke union) | D3/D5 |
| `challenges`, `games`, `users`, seek-pool Redis keys | REUSE (tanpa skema perubahan) | D1–D4 |

## 4. Aturan implementasi (untuk backend & frontend)

1. Backend: route [NEW] memakai `resolvePgUser` (FIX-1) bila menyentuh PG;
   response error shape `{ error, code?, retryable }` (pola `puzzle-api.ts`).
2. Frontend: import type dari satu tempat — bentuk §1/§2 ini adalah
   sumber; `lib/rematch.ts` (ekstraksi `sendRematch`) menjadi satu util
   untuk game-over-modal + archive-view (D3.2).
3. Tidak ada mock data / angka statis di tabel arena, insights, win-rate
   (prinsip global S6) — semua dari query/Redis pool.
4. A11y floor untuk UI baru (skip-link, `aria-label` ID, focus-visible) —
   gate TL, bukan kontrak API.
5. Regression (TL): semua event §2.1 + route §1 [REUSE] harus tetap
   render/berjalan identik setelah perubahan additive.
