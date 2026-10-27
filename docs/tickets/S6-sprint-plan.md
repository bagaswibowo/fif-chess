# Sprint Plan — Chess.com Full Parity (S6–S10)

**Role**: PM · **Date**: 2026-10-26 · **Repo**: `~/projects/active/jev-chess` (sxz-server, canon `main`).
**Prinsip global** (binding utk semua tiket): anti-slop, no-mock data (angka stat selalu riil dari API),
YAGNI, minimal diff, a11y floor (skip-link, aria-label, focus-visible), satu CSS var utk motion
(`--move-animation-duration`), aset/teks/font/ikon HANYA pola — tidak ada yang disalin dari
chess.com (referensi deskriptif), padanan dibuat original (token CSS + SVG lucide + copy ID).

## Baseline (sudah ada, JANGAN double-implement)
Realtime WS (presence/seek/challenge/broadcast), puzzle ecosystem (unlimited/daily/rush/themes/
missed/stats/tiers/endgame-drills, P1–P4 fix), V1–V8 polish (board chrome, player bars, hint arrows,
feedback langkah, Web Audio cue, PWA-lite, sidebar 6-grup), auth 401/403/503 (FIX-1), game archive,
leaderboard, friends, endgame auto-review, paste-PGN fast path, stats summary, versus-bots,
coach-mode, scan-board, spectator, community, vision-drill, opening-book + `api/opening`.

## Referensi
- `docs/rea/chess-web-menu-feature-map.md` — peta 7 grup menu, 50 item, prioritas P0–P3.
- `docs/design/chesscom-parity-audit.md` — matriks fitur×akses + gap G0–G7.
- `docs/rea/chess-web-member-area-capture.md` — capture member-area live.

---

## S6 — Game-Flow Core + Play (P0, batch 1 = EKSEKUSI SESI INI)
Tikik batch-1 (executed by role subagents, contract-first, tech-lead gated):
- **S6-T1 Opening Explorer view** (`/explorer`) — `api/opening` sudah ada; build view move-tree +
  win-rate per posisi + cross-link kursus. (frontend)
- **S6-T2 Clock Presets di Pairing** (gap G2.1) — picker chip 1+0/3+0/3+2/5+0/10+0/15+10/custom +
  rated/casual + pilihan warna; wiring ke `challenge`/`seek`. (backend + frontend)
- **S6-T3 Abort / Rematch / Offer Draw** di game-over (gap G2.2) — flow quick-pairing; rematch
  satu-klik + offer draw di modal. (backend + frontend)
- **S6-T4 Insights** (`/insights` + deep-link `/insights/<user>` publik) — tren pemain: filter
  rating-type, kategori waktu, tampilan [Semua|Warna|Buah|Pemain|Performa Lampau]. (backend + frontend)
- **S6-T5 Tournaments Arena** (`/play/online/tournaments`) — list arena live + register. (backend + frontend)

Tiket tersisa S6 (queued): G2.3 challenge list in/out w/ countdown, G2.4 board-controls
confirmation 2-tahap resign.

## S7 — Learn Layer (queued)
- S7-T1 Courses (`/courses` + `/courses/train/<uuid>`) — jalur terstruktur.
- S7-T2 Lessons interaktif + Openings lessons (`/lessons/learn-the-openings`).
- S7-T3 Practice drill (`/practice`).
- S7-T4 Classroom collab (`/classroom` room-ID).
- S7-T5 Endgame `/endgames` multi-filter + leaderboard (view drill sudah ada; perlu filter+lb).

## S8 — Watch Layer (queued)
- S8-T1 Events/Ajang (`/events` tabs Terkini/Akan Datang/Terdahulu + format chips).
- S8-T2 ChessTV (`/tv` jadwal locale-aware + share).
- S8-T3 Streamers (`/streamers` direktori).
- S8-T4 Spectate Live Games (`/play/online/watch` filter tipe + search).

## S9 — Community Layer (queued)
- S9-T1 Clubs (`/clubs` join + geosearch), S9-T2 Members directory (`/members`),
- S9-T3 Coaches marketplace (`/coaches`), S9-T4 Titled Players (`/players`),
- S9-T5 Ratings resmi multi-filter (`/ratings`), S9-T6 Chess Today (`/today` digest),
- S9-T7 News/Articles/Blog/Forum (katalog + mark-read).

## S10 — Tools & Account (queued)
- S10-T1 Collections (`/analysis/collections`), S10-T2 Master Database (`/games`),
- S10-T3 Terms glossary (`/terms`), S10-T4 Rules interaktif (`/learn-how-to-play-chess`),
- S10-T5 Vote Chess (`/votechess`), S10-T6 Solo Chess (`/solo-chess`),
- S10-T7 Computer Chess Championship, S10-T8 Resources (`/resources`),
- S10-T9 Messages inbox (`/messages`), S10-T10 Board Settings (`/settings/board`).

## P3 / Skip (tidak di-port)
Variants 4-player, Kejuaraan Komputer, Aimchess/Shop/ChessKid partner, ads/paywall (→ model sendiri).

## Gate order (per batch)
PM tiket → [Architect ADR jika keputusan struktural baru] → [DB design jika ada perubahan schema]
→ Designer spec (flow/wireframe/copy) → Backend ∥ Frontend (contract-first, satu modul typed
shared) → Tech Lead review (regression-first: semua view lama tetap render, auth guard hidup,
sibling flow intact; build dijalankan TL sendiri) → APPROVED → DevOps push + rebuild Docker +
redeploy + smoke (health 200, protected route 401, public URL) → QA release matrix.
