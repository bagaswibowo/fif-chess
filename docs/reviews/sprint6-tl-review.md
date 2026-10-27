# S6 TL Review — Tech-Lead Release Gate

**Reviewer:** tech lead (release gate) · **Date:** 2026-10-27
**Scope:** commit `6861d56` (backend S6-T1..T5) + `28f86156` (frontend S6 views/wiring), parent `849695e`, head reviewed at `d91e095`.
**Authority docs:** `docs/adr/ADR-009-sprint6-gameflow.md` (D1–D5), `docs/contracts/sprint6.md` (contract), `docs/design/sprint6-flows.md` (UX spec + dev_notes), `docs/db/sprint6.md` (live schema + mandatory indexes).
**Verdict: CHANGES_REQUIRED** — no push/deploy of `6861d56`/`28f86156` until findings below are fixed. Targeted re-verify after fixes (not a full re-review).

---

## 1. Build / type / test evidence (run at head d91e095)

| Gate | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit` | exit 0, clean |
| Build | `npx next build` | exit 0, all S6 routes compiled (`/api/opening/win-rate`, `/api/insights`, `/api/tournament`, `/api/tournament/[id]`, `/explorer`, `/insights`, `/tournaments`) |
| Tests | `npm test` at HEAD **and** at parent `849695e` | `echo "Error: no test specified" && exit 1` — the "test" script is a placeholder in both; **there is no test baseline to regress against**. No S6-introduced test failures (none exist). Pre-existing condition, not a defect of S6, but the team has no automated regression suite — regression gate relies on build + manual smoke (DevOps) after merge. |

## 2. Regression-first trace (views, auth guards, sibling flows)

- **Nav union & shell:** `components/game.tsx` `NavTab` and `components/shell/app-shell.tsx` both add `explorer | insights | tournaments`; `navTabFromHash` extends the `all` whitelist identically → **no existing view orphaned** (home/play/bots/coach/puzzles/review/scan/vision/drills/community/leaderboard/friends/archive/admin all still map). New items placed per spec §0.5 (Turnamen in group "Bermain", Penjelajah+Insight in group "Berlatih").
- **Deep links:** `#/insights/{user}` handled **before** the whitelist fallback (public, no login required) — correct; `#/explorer?eco=` likewise. Hash-sync effect mirrors both via refs (BUG-2 pattern from S5 honored).
- **Auth guards:** `/api/pvp` route gate unchanged (`currentUserId` → 401); the new `roomCreate` guard (pending/rejected → 403, D3.5) is **additive** — approved users pass exactly as before. `roomMove/roomLeave/roomOutcome` untouched apart from the documented abort behavior expansion on `leave` (finished room → 400, active+0-moves → `GameAborted` publish before delete). `draw-offer`/`draw-decline` reuse the existing `sideOf` token check (403 on invalid token).
- **Sibling flows:** challenge/seek/puzzle/review/spectate code paths untouched except: `challenge-card.tsx` (new optional `timeControl`/`rated` props — falls back to `controlLabel` when absent, no mock numbers), `game.tsx` challenge default TC now `loadStoredTimeControl()` (was hardcoded `"5+0"`), `game-over-modal` ELO badges replaced with real-optional `ratingDelta` (falls back to "Rating diperbarui" — no fake numbers), `leavePvpRoom` now sends `playerToken` (required by existing `sideOf` check). All safe/behavior-preserving.
- **WS union additive:** 5 new event types + `tournamentTopic` appended to `RealtimeEvent`; existing events untouched → old subscribers still render (gate §4.5 of the contract satisfied).

## 3. State / ID hygiene (realtime + sweeper + pvp abort)

- **Seek tickets:** `addSeek` = atomic `MULTI` (HSET+EXPIRE+SET user index+ZADD) — one round-trip; `REMOVE_LUA`/`MATCH_LUA` are single-Lua multi-key atomics (existing, TL C1/C2 patterns). No S6 code path writes Redis keys partially.
- **Sweeper (id-hygiene):** `tournamentSweepOnce` checks `getUserSeek` before `addSeek` → **no double ticket per user**; tickets have TTL 300s floor + MATCH_LUA removes both tickets on pairing + `DELETE /api/seek` removes on cancel → every increment has a decrement path. Flip is a single `UPDATE ... WHERE status='registration' AND start_at <= NOW() RETURNING` (atomic per arena, safe against overlapping sweeps); `running` flag prevents overlapping ticks in-process. Cancelled/never-started tournaments (`registration`, start_at past, 0 entrants) flip to `live` then immediately to `finished` on the same sweep with **no tickets created** → no ticket leak. `onSeekCreated` dedupes via `matcherState`.
- **Playing count:** `jev:playing` SREM on game finish remains in `/api/match-result` (unchanged) — no new increments in S6.
- **Counters:** no new monotonic counter introduced; win-rate/insights are derived SQL aggregates (stateless).
- **Abort:** `roomLeave` abort publishes `GameAborted` **before** `rooms.delete(code)` — opponent can't be stuck on a dead room.

## 4. Security / no-mock

- `/api/insights` public deep-link: pending target user (exists only in file-store) → **404 `user_not_found`** (not 403) — account-existence leak prevented as required; unknown PG username → 404. Own-session path keeps full FIX-1 guards (401/403 account_pending/rejected/missing/503).
- Win-rate & insights numbers: computed from `games`/`game_moves` real queries with `status='finished'` + `result IN (...)` filters → **NULL-tolerant** for the confirmed live quirk (99.99% NULL game_type/time_control, status='active'); no fallback constants. `byType` NULL bucket = `unknown` (documented).
- Tournament join: pending guest → 404 (anti-enumeration); rejected → 403; capacity check + `ON CONFLICT (tournament_id, user_id) DO NOTHING` idempotent join.
- **Credential hygiene:** both commits scanned — no DB passwords, no NetBird IPs committed. `scripts/verify-s6*.ts` are **untracked** (verified `git check-ignore`: .gitignore:57 `scripts/verify-s6*.ts`, commit `d91e095`) and are env-driven (`DATABASE_URL` from `process.env`), not source-committed. Clean.

## 5. Findings (numbered, blocking unless marked minor)

**F1 (backend, BLOCKING) — `/api/pvp` create drops the S6-T2 fields it should record.**
`app/api/pvp/route.ts` `roomCreate` (~L405–450): the `PvpRoom` object literal and `publicRoom` never set `timeControl`/`rated`, even though design spec §2.6 says "Room Pvp (`/api/pvp` create) menambah param `timeControl` + `rated` di request; `PvpRoom` menambah field `timeControl?: string` + `rated?: boolean`". Frontend `components/pvp-panel.tsx` (L231) sends both, and its "Waktu: {room.timeControl} · {rated ? 'Terbuka (rating)' : 'Casual'}" line (L275) is therefore **never rendered for rooms this server created** — the server silently discards the pairing choice.
Fix: in `roomCreate`, read `timeControl` (validate `^\d{1,3}\+\d{1,3}$`, `.slice(0, 10)`) and `rated` from the body, add `timeControl?: string; rated?: boolean` to the `PvpRoom` type and to `publicRoom`; store in the room object. Owner: backend.

**F2 (backend, BLOCKING) — dev-note §3.6 unmet: `/api/match-result` does not return `ratingDelta`, so the "real ratingDelta" fix never shows a number.**
`app/api/match-result/route.ts` returns `{ ok: true, learned: true, plies }` only; the S2-T3 snapshot block computes `whiteAfter/blackAfter` via `eloUpdate` but never puts either in the response. Frontend `components/game.tsx` (S6 commit) branches on `d.ratingDelta` — the field can never be present, so the game-over modal permanently shows "Rating diperbarui" without a number. The spec-permitted fallback (§3.3 "kalau belum tersedia… jangan angka palsu") is honored and the hardcoded ELO mock is gone — no regression — but the S6 commit's own stated purpose ("game-over ratingDelta real, fix ELO mock") is not met: the real numbers were never wired.
Fix: in the snapshot path, add `ratingDelta` to the response for the session user's side (`myAfter − myBefore`; `null` when the snapshot fails → frontend already degrades to "Rating diperbarui"). Owner: backend.

**F3 (backend, minor) — sweeper emits `entrants: 0` on the live flip.**
`lib/realtime/tournament-sweeper.ts` L86: `emitUpdated(t.id, "live", 0)` after the registration→live flip. If ≥1 entrant is joined at flip time, the live event reports 0, and a subscriber who only consumes WS (list view merges `entrants` into arena state, `tournaments-view.tsx` L130) will display a stale "Daftar: 0/{capacity}" on a live arena until the next poll. Not a correctness bug (GET always re-fetches on open), cosmetic race. Fix: count `tournament_players` joined rows in the `dueRows` loop before emitting. Owner: backend.

**F4 (backend, minor) — NULL time_control lands in the `bullet` filter bucket.**
`app/api/insights/route.ts` L69: `COALESCE(split_part(g.time_control, '+', 1)::int, 0)` → a `game_type=bullet` filter also matches games with `time_control=NULL` (99.99% of the live seed), while the aggregation side buckets the same rows as `unknown` (L254–256). Filter and bucket disagree on NULL rows. Acceptable given the seed data is NULL, but the behavior should be pinned deliberately: either make the category filter NULL-safe (exclude NULL tc) so filters only match real time controls, or document that "bullet" includes unknown-tc games. Owner: backend.

**F5 (frontend, minor) — comment cites "kontrak §2.6"; also copy typo.**
`components/pvp-panel.tsx` L44/L231 reference "(kontrak §2.6)" — the requirement actually lives in `docs/design/sprint6-flows.md` §2.6 (the API contract doc has no §2.6). Comment-only drift (behavior matches design). Also `components/challenge-card.tsx` L55 copy "mengundangnya" is a typo for "mengundangmu" (spec §2.3 just says the layer must show TC+mode; copy detail is owner's choice — flagging for polish). Owner: frontend.

**F6 (frontend, minor) — explorer view omits spec §1.2 filter controls.**
`components/views/explorer-view.tsx` ships ECO filter + tree + win-rate, but not the `Sisi [Putih|Hitam|Keduanya]`, `Baris ke- [slider 1–20]`, or `Waktu [Kilats|Blitz|Rapid]` controls from the wireframe (and no server-side support exists for them — D1.1 keeps everything client-side, so a side/time filter would need FEN-derived filtering). Not a regression gate (no dead CTA, honest empty states, a11y floor met: sr-only status regions, `aria-expanded` nodes, double-cue text). Defer to S6 polish ticket. Owner: frontend.

**Non-blocking verifications (passed, recorded):**
- insights guest 404-for-pending ✓ · win-rate NULL tolerance ✓ (verified `Math.round((wins/samples)*100)/100` yields 0..1 — matches contract §1.1 "0..1, 2 desimal") · sweeper ticket lifecycle ✓ · no secrets/NetBird-IP leaks in either commit ✓ · `.gitignore` covers `scripts/verify-s6*.ts` ✓ (commit d91e095) · migration SQL matches contract §1.5 DDL + adds the two MANDATORY `idx_games_white_ended`/`idx_games_black_ended` ✓ · tsc + build clean ✓ · no view orphaned by nav changes ✓ · challenge/review/spectate/puzzle flows intact ✓.

## 6. Re-review requirement & next steps

- **Targeted re-verify only** (no full re-review): after fixes for F1–F2 (blocking; F3–F6 optional minors), re-run `npx tsc --noEmit` + `npx next build`, spot-check: (a) `POST /api/pvp {action:"create"}` response now carries `timeControl`+`rated` and the panel "Waktu" line renders; (b) `POST /api/match-result` carries `ratingDelta` (null when snapshot fails → modal falls back to "Rating diperbarui" per spec §3.3); (c) `GET /api/opening/win-rate` + `GET /api/insights` `winRate` in 0..1. Then APPROVED and DevOps proceeds:
  1. Push `6861d56` + `28f86156` to GitHub main.
  2. On sxz-server: pull + rebuild + redeploy the app container (S6 migration already applied live — no re-run needed).
  3. Smoke: `GET /api/status` (or `/api/opening`) → 200; unauthenticated `POST /api/tournament` → 401; unauthenticated `GET /api/insights` (own) → 401; public URL `/` → 200.
