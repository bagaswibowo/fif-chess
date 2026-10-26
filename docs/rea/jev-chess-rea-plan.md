# Jev-Chess × REA chess.com — Sintesis & Rencana Penerapan

**Tanggal:** 2026-10-22 · **Basis:** REA lengkap chess.com (static APK 4.10.20 + runtime web authenticated + UI/UX 14 halaman + menu map 50 item) vs codebase jev-chess现有 (FIF Chess Arena).

---

## 1. Yang Sudah Dimiliki jev-chess (gap positif)

| Kapabilitas | Bukti di repo |
|---|---|
| Play vs Bot (Stockfish 19 NNUE lokal, MultiPV 3, fallback Jev API) | `lib/stockfish.ts`, `api/engine-move`, `api/engine-uci` |
| Bot personas + chat | `bot-personas.ts`, `api/bot-chat` |
| PvP | `api/pvp` |
| Analysis + threats + opening book | `api/analysis`, `api/threats`, `api/opening`, `threat-detection.ts`, `opening-book.ts` |
| Puzzle + attempts | `puzzle-data.ts`, `api/... Puzzle model` |
| Game history + record | `game-history.ts`, `Game/GameMove models` |
| Post-game analysis | `post-game-analysis.ts` |
| Auth + gate + security | `auth-store.ts`, `user-auth.ts`, `gate.ts`, `hmac.ts` |
| Clock | `use-chess-clock.ts` |
| Tema visual chess.com-style (charcoal #312e2b, hijau #81b64c, papan wood) | `chess-themes.ts` |

## 2. Gap vs chess.com (dari REA) — yang BELUM ada

**Protokol/infra:**
- G1. Realtime pubsub server (WS) — chess.com: opcode subscribe/ack/data + Redis-stream offset. jev-chess: polling via API routes (tidak ada WS server).
- G2. Matching/seek pool live (matcher tickets, GameAdded/Removed events).
- G3. Presence + realtime badge nav ("Bermain N").

**Fitur UX:**
- G4. Inline challenge dual-button [Tolak|Terima] di semua permukaan.
- G5. Auto-redirect end-game → Game Review (coach audio toggle).
- G6. 3 kartu task harian di home.
- G7. Paste-PGN/FEN fast path di analysis (ada analysis, belum ada fast-path input).
- G8. Progress % per tema puzzle (26 tema) — PuzzleAttempt ada, agregasi per tema belum.
- G9. Puzzle Rush (3-strike survival) + Battle 1v1.
- G10. Daily puzzle (navigasi tanggal ←→) — puzzle ada, daily-rotation belum.
- G11. Game archive UI (filter tabs + bulk analyze/download + delta rating).
- G12. Leaderboard global.
- G13. Friends + profile status.
- G14. Endgame drills + Vision drill (koordinat/blind) + Solo Chess.
- G15. Stats page (rating graph per kategori waktu, filter 90 hari).

## 3. Rencana Penerapan — 4 Sprint

### Sprint 1 — Fondasi Realtime + Flow inti (G1, G2, G3, G4)
- WS gateway (ws + Redis stream offset) meniru protokol pubsub REA: topik `game/<id>/moves`, `matcher/<userId>`, `presence/<userId>`, `toasts/<userId>`.
- Seek pool: POST seek → matcher → publish `GameAdded`; challenge inline component (dual-button) dipasang di home + play.
- Nav badge realtime konsumen topik yang sama.
- **Seam tunggal:** `RealtimeBus` interface (publish/subscribe) — server & klien share satu tipe event (dari REA frame schema).

### Sprint 2 — Gameplay completion (G5, G11, G15, G7)
- End-game flow: modal hasil → auto-redirect `/analysis/[gameId]?tab=review` + coach audio (commentary.ts sudah ada — tinggal wiring).
- Archive page: filter [Semua|Favorit|Live|Daily|Bot|Coach] + bulk download PGN + delta rating.
- Stats page: rating history chart per kategori + filter window.
- Analysis fast-path: textarea paste PGN/FEN di atas 6 kartu (tulis ulang sesuai fitur jev-chess, bukan 6 kartu chess.com).

### Sprint 3 — Puzzle engagement (G8, G9, G10)
- Daily puzzle rotation (date-keyed, navigasi ±hari, attempts per date).
- Puzzle Rush: 3-strike, timer 3/5/endless, kesulitan adaptif dari PuzzleAttempt history.
- Progress per tema: agregasi PuzzleAttempt → % mastery per tema; UI tema-grid dengan progress bar.
- (Battle 1v1 menunggu Sprint 1 realtime — masuk Sprint 4.)

### Sprint 4 — Sosial + latihan (G12, G13, G14)
- Leaderboard (aggregate dari Game results + puzzle rating).
- Friends + status + challenge-from-profile.
- Endgame drills (tablebase sederhana / kurasi), Vision drill (koordinat timer, blind mode), Solo Chess (pure client-side, chess.js).
- Puzzle Battle 1v1 via RealtimeBus.

## 4. Keputusan Arsitektur (dari bukti REA)

1. **Protokol WS meniru chess.com pubsub** (opcode framing, topic naming, offset stream) — terbukti di runtime, memudahkan reuse client code patterns. TAPI pakai JSON biasa, bukan opcode biner, untuk kesederhanaan — framing semantics tetap.
2. **Board kiri / panel kanan** tetap pola layout; mobile = bottom-sheet (sudah sesuai).
3. **Satu CSS var `--move-animation-duration`** untuk semua animasi bidak (chess.com pakai 180ms).
4. **Deep-link publik per user** (`/member/[username]/stats`) — shareable.
5. Upsell/promo hanya idle-contextual — tidak ada modal-blocking (tidak relevan untuk jev-chess yang free).
6. Rating system per kategori waktu (blitz/rapid/bullet terpisah) — Chess rating sederhana (Elo internal).
7. A11y floor: skip-link, aria-label icon buttons, focus-visible — sudah jadi kebiasaan chess.com, murah ditiru.

## 5. Out of Scope
Variants 4-player, Vote Chess, ChessTV/streaming, marketplace coach, ads/paywall, kompresi binary WS.

## 6. Risiko
- WS di deploy Heroku/Dokploy — pastikan sticky session / satu instance dulu (YAGNI: tanpa Redis cluster; Redis single + stream offset cukup).
- Stockfish MultiPV + WS bersamaan di 1 dyno — monitor RAM (benchmark log repo: 30–64MB engine).
