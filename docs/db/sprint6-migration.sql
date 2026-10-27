-- Sprint 6 migration — jev_chess
-- Idempotent. Safe to re-run. Pattern: sprint4-migration.sql.
-- Sumber DDL: docs/contracts/sprint6.md §1.5 (OTORITAS) + dua index games
-- MANDATORY dari docs/db/sprint6.md §3/§4.4 (bukti EXPLAIN ANALYZE §4.1).
--
-- Catatan naming: tabel join = `tournament_players` (bukan
-- `tournament_joiners` dari draft awal docs/db/sprint6.md §2.2 — naming
-- diselaraskan ke kontrak docs/contracts/sprint6.md).
--
-- Catatan prod: dua CREATE INDEX di games (200k+ baris) build singkat
-- (~detik, docs/db/sprint6.md §6); di production besar gunakan
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS di luar transaksi.
-- Jalankan setelah backup pg_dump (pola sprint4).

BEGIN;

-- 1. tournaments: arena S6-T5 (D5.1 — persist agar scheduled start
-- bertahan restart process; status registration|live|finished).
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

-- 2. tournament_players: register/join idempoten + hitung kursi.
--    PK (tournament_id, user_id) → ON CONFLICT DO NOTHING.
CREATE TABLE IF NOT EXISTS tournament_players (
    tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        varchar(20) NOT NULL DEFAULT 'joined',
    joined_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tournament_id, user_id)
);

-- 3. Sweep scheduled-start (lib/realtime/tournament-sweeper.ts 30s):
--    lookup arena due/aktif per status.
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments (status, start_at);

-- 4. Count joiners per arena (entrants) + list per user.
CREATE INDEX IF NOT EXISTS idx_tournament_players_t ON tournament_players (tournament_id, status);

-- 5. MANDATORY for S6-T4 Insights (bukti docs/db/sprint6.md §4.1/§4.4):
--    per-user last-N O(limit) saat satu user menguasai ratusan ribu baris
--    (seed live 200.582 baris untuk satu pasangan).
CREATE INDEX IF NOT EXISTS idx_games_white_ended
  ON games (white_user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_black_ended
  ON games (black_user_id, ended_at DESC);

COMMIT;
