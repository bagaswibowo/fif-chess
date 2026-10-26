# Chess-Web — Blueprint Pemetaan Fitur chess.com (REA Static + Runtime)

**Tanggal:** 2026-10-22 · **Metode:** REA static (APK 4.10.20, jadx) + REA runtime authenticated (Camoufox session web, cookie-inject jalur 2)
**Disiplin bukti:** `[OBS-STATIC]` = dekompilasi APK · `[OBS-RUNTIME]` = traffic teramati di sesi web authenticated · `[REF]` = referensi string/metadata · `Unknown` = belum terbukti.

---

## 1. Arsitektur Transport (diverifikasi runtime)

| Transport | Endpoint | Bukti |
|---|---|---|
| HTTP REST internal (web API) | `https://www.chess.com/callback/**` | [OBS-RUNTIME] 19+ endpoint, GET/POST, cookie-session |
| Connect-RPC (POST JSON) | `https://api.chess.com/rpc/<proto.Service>/<Method>` | [OBS-RUNTIME] BotGroupService, CoachesService, FlairService |
| Publik read-only | `https://api.chess.com/pub/**` | [OBS-RUNTIME] tanpa auth (clubs, leaderboards) |
| WebSocket pubsub (web client) | `wss://www.chess.com/pubsub?uid=<userUuid>&client_type=web&client_version=1.6.0` | [OBS-RUNTIME] 5 koneksi, 170 frame |
| WebSocket CometD/Bayeux | `wss://live2.chess.com/cometd` | [OBS-RUNTIME] handshake v1.0, protocolversion 2.1 |
| Twirp (app) | `https://analysis.chess.com/twirp/` | [OBS-STATIC] konstanta; web memakai /rpc/ [OBS-RUNTIME] |

## 2. Protokol WebSocket (inti gameplay live)

### 2.1 Pubsub web (`/pubsub`)
Framing: `<opcode>[<array>,…]` — opcode teramati:
- `0` [sid, 20, 45, {subscribeRetryTimeoutMs, maxPendingRequests, responseMaxDelayMs, maxReconnectionDelayMs}] — handshake/hello
- `41` `["<topic>"]` — subscribe
- `45` `[n, "<topic>", "<streamOffset>"]` — ack subscribe
- `47` `[n, "<topic>", "<offset>", <eventJson>]` — data event
- `2` `[3]` — heartbeat/ack

Topik teramati [OBS-RUNTIME]:
`matcher/tickets/users/:me`, `matcher/incoming-challenges/users/:me`,
`tournaments/standings|games/users/:me`, `gamelist/top/top50` (event `GameAdded`/`GameRemoved` w/ game object: id, legacyId, variant, timeclass, timeControl),
`chat/users/<uuid>`, `settings/users/<uuid>/updated|reset`,
`toasts/users/<uuid>/notices`, `toasts/updates/...`, `toasts/tv/featured/id_ID`,
`invitations/users/:me`, `user-relationships/friends/<uuid>`,
`uifragments/list-fragments/web/users/<uuid>`, `battle/challenges/<uuid>`,
`progression/users/:me`, `presence/users/<uuid>`, `clubs/user/admin/live-challenges`.

Offset stream format: `<ms>-<seq>` (Redis stream ID semantics).

### 2.2 CometD (`wss://live2.chess.com/cometd`)
Bayeux handshake: `/meta/handshake` → clientId; `/meta/connect` loop (connectionType `ssl-websocket`, ext.timesync, ext.ack batch).
Service channels [OBS-RUNTIME]: `/service/user` (tid: `FollowedUserList`, `Subscribe` ke `/chat`,`/announce`), `/service/game` (tid: `ChallengeList`, sid `gserv`), `/chat` (tid: `RoomList`).
Server stats di handshake: `{users: 58473, games: 40, seeks: 0, tournaments: 29, teammatches: 0, arenas: 0}` + objek user (id legacy, uuid, uid=username).
**Move gameplay realtime = CometD `/service/game` + pubsub event** (HTTP POST tidak muncul saat submit move [OBS-RUNTIME negatif]).

## 3. Inventaris Endpoint HTTP Teramati (runtime, session authenticated)

| Endpoint | Fungsi |
|---|---|
| GET `/callback/alert/alerts` | notifikasi agregat: games, messages, game_seek |
| GET `/callback/messages/list/inbox` | inbox pesan |
| GET `/callback/security/user/roles` | role/permission user |
| GET `/callback/user/daily/games` | daily chess aktif |
| GET `/callback/game_seek/user-seeks` | seeks pencarian game |
| POST `/callback/game/fens` | FEN batch (preview posisi) |
| GET `/callback/tactics/stats/user` | stats puzzle user |
| GET `/callback/tactics/challenge/stats/user` | stats puzzle battle |
| GET `/callback/tactics/prestige-level-point-system-config/1` | config sistem poin |
| GET `/callback/leagues/division-start-check` | league division |
| GET `/callback/clubs/user/admin/live-challenges` | club challenges |
| GET `/callback/classroom/get-countries` | referensi negara |
| GET `/callback/today/{articles,blogs,lessons,news,videos}` | feed konten today |
| GET `/chess-tv/callback/schedule/id_ID` + `/calendar/id` | jadwal ChessTV (locale) |
| POST `/rpc/chesscom.bots.v1.BotGroupService/ListBotGroups` `{withBots:true}` | daftar bot |
| POST `/rpc/chesscom.coaches.v2.CoachesService/{GetCurrentCoach,ListCoaches}` | coach |
| POST `/rpc/chesscom.flair.v1.FlairService/GetUserFlair` `{}` | flair |
| GET `/pub/player/<user>/clubs` | API publik |

Daily puzzle app-side (Twirp, [OBS-STATIC]): `chesscom.puzzles.v2.DailyPuzzleService` → GetDailyPuzzle, GetDailyPuzzleById, GetDailyPuzzlesByRange, GetDailyPuzzleUserStats, GetDailyPuzzleAttemptsByRange, ListFriendsWhoCompletedDailyPuzzle, SubmitDailyPuzzleAction. Web-side harian di-host di `/puzzles/` (route `/daily-puzzle` mati — Missing Page).

## 4. Inventaris Fitur (146 modul APK → prioritas porting web)

| Prioritas | Fitur | Transport utama | Status bukti |
|---|---|---|---|
| P0 | Play online (pairing/seeks) | pubsub matcher + CometD /service/game | [OBS-RUNTIME] |
| P0 | Play vs Bots | /rpc BotGroupService + WS moves | [OBS-RUNTIME] |
| P0 | Puzzles + Rush | callback/tactics + progression WS | [OBS-RUNTIME] |
| P0 | Analysis board | analysis.chess.com (Twirp/WS) | [OBS-STATIC] |
| P1 | Daily chess | callback/user/daily/games | [OBS-RUNTIME] |
| P1 | Game list/lobby | pubsub gamelist/top/top50 | [OBS-RUNTIME] |
| P1 | Chat + toasts | pubsub chat/toasts + CometD /chat | [OBS-RUNTIME] |
| P1 | Tournaments/arena | pubsub tournaments/* | [OBS-RUNTIME] |
| P2 | Leagues, clubs, friends, presence, invitations | pubsub topic terkait | [OBS-RUNTIME] |
| P2 | Lessons, today feed, ChessTV | callback/today, /chess-tv | [OBS-RUNTIME] |
| P3 | Membership/paywall, ads, themes, settings | Twirp service statis + settings WS | [OBS-STATIC] |
| P3 | Activity feed, forums, articles, news | Twirp + callback/today | [OBS-STATIC] |

## 5. Blueprint Implementasi chess-web

Stack mengikuti jev-chess yang ada (Next.js + Prisma). Modul minimal P0:

1. **Game service** — session user, chess.js state, move validation; persist `games`, `moves`.
2. **Realtime gateway** — WebSocket server (uWS/WS) meniru protokol pubsub: opcode subscribe/ack/data + topic naming `matcher/users/:id`, `gamelist/top50`; Redis Stream untuk offset `<ms>-<seq>`.
3. **Matcher** — seek pool (rating bucket), publish `GameAdded` ke `gamelist/top50`.
4. **Bot engine** — Stockfish WASM (opsi: engine lokal via UCI di server), expose `/rpc/BotGroupService/ListBotGroups` kompatibel.
5. **Puzzles** — DB `puzzles` (Lichess puzzle dump), endpoint `tactics/stats/user`, submit flow + `progression` stream.
6. **Analysis** — Stockfish server-side + board editor PGN/FEN (callback/game/fens pattern).
7. **Presence & chat** — pubsub topic presence/chat per user/room.
8. **Auth** — sesi cookie; username/uuid/id legacy triple seperti chess.com.

## 6. Residual Unknowns

- Payload CometD `/service/game` saat game BERLANGSUNG penuh (hanya lobby teramati — game seek tidak match dalam sesi capture). → probe: mainkan 1 game blitz nyata sampai move pertama lawan.
- Format publish move client→server (CometD publish vs pubsub opcode lain, mis. `3`/`7`). → probe sama.
- Twirp auth header untuk api.chess.com/rpc (kemungkinan cookie forward; request capture menunjukkan cookie-session cukup).
- Engine vs-bots APK (806 kelas, murni Kotlin tanpa JNI di base split) — tidak relevan untuk porting web (pakai Stockfish).

## 7. Artefak
- Static: `rea-report-chess-com-4.10.20.md`, `rea-feature-trace-…`, `rea-storage-crypto-…`, `rea-packer-analysis-…`, `SPEC.md` (dev VPS `/opt/data/projects/chess-rea/`)
- Runtime: `runtime-capture.json` (72 req), `runtime-capture2.json` (20), `runtime-ws-capture.json` (170 frame WS), `chess_state_logged_in.json` (session, TIDAK di-upload — berisi token)
