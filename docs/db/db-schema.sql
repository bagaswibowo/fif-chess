-- ============================================================================
-- jev-chess — canonical DB schema (PostgreSQL 15)
-- db-schema.sql — audit 2026-10-23 (docs/db/db-audit.md)
--
-- Bagian A: DDL kanonis (state target lengkap: skema, indeks, FK).
-- Bagian B: migrasi idempotent untuk gap yang ditemukan audit.
-- Semua migrasi aman dijalankan berulang (IF NOT EXISTS / DO-block guard).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- BAGIAN A — DDL KANONIS (STATE TARGET)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username      varchar(50)  NOT NULL UNIQUE,
    email         varchar(255) UNIQUE,          -- partial unique (WHERE email IS NOT NULL), lihat indeks
    password_hash varchar(255) NOT NULL,
    rating        integer      NOT NULL DEFAULT 1200,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    rush_best     integer      NOT NULL DEFAULT 0,
    rush_best_at  timestamptz,
    -- Audit: konsolidasi identity — users PG jadi single source of truth;
    -- legacy_store_id menyimpan id 'u-xxxxxxxx' dari users.json (file store) lama.
    legacy_store_id varchar(64)                -- UNIQUE (partial), lihat indeks
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
    ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_legacy_store_id_key
    ON users (legacy_store_id) WHERE legacy_store_id IS NOT NULL;
-- Leaderboard rush: ORDER BY rush_best DESC (hot query rush/leaderboard).
CREATE INDEX IF NOT EXISTS idx_users_rush_best
    ON users (rush_best DESC, rush_best_at ASC NULLS LAST)
    WHERE rush_best > 0;
CREATE INDEX IF NOT EXISTS idx_users_rating_desc ON users (rating DESC);

CREATE TABLE IF NOT EXISTS games (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    white_user_id       uuid NOT NULL REFERENCES users(id),
    black_user_id       uuid NOT NULL REFERENCES users(id),
    status              varchar(20) NOT NULL DEFAULT 'active',
    result              varchar(20),
    started_at          timestamptz NOT NULL DEFAULT now(),
    ended_at            timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    favorited           boolean     NOT NULL DEFAULT false,
    time_control        varchar(10),
    game_type           varchar(10),
    white_rating_before integer,
    white_rating_after  integer,
    black_rating_before integer,
    black_rating_after  integer,
    CONSTRAINT games_different_players CHECK (white_user_id <> black_user_id),
    CONSTRAINT games_game_type_check
        CHECK (game_type::text = ANY (ARRAY['live','daily','bot','coach']::text[]))
);

-- Audit indeks (lihat db-audit.md): composite (user, ended_at) untuk query
-- histori per user; ended_at untuk window agregat; partial active-games.
CREATE INDEX IF NOT EXISTS idx_games_white
    ON games (white_user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_black
    ON games (black_user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_ended_at ON games (ended_at)
    WHERE ended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_active
    ON games (white_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_games_active_black
    ON games (black_user_id) WHERE status = 'active';
-- winRate leaderboard: filter game_type='live' + derive kategori dari
-- time_control. Kategori SQL dihitung dari split_part — indeks expression
-- mempercepat agregat per kategori (bullet <3, blitz 3..<10, rapid >=10).
CREATE INDEX IF NOT EXISTS idx_games_live_tc_minutes
    ON games (white_user_id, (split_part(time_control, '+', 1)::int))
    WHERE game_type = 'live';
CREATE INDEX IF NOT EXISTS idx_games_live_tc_minutes_black
    ON games (black_user_id, (split_part(time_control, '+', 1)::int))
    WHERE game_type = 'live';

CREATE TABLE IF NOT EXISTS game_moves (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id     uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    move_number integer NOT NULL,
    san         varchar(20) NOT NULL,
    fen         text NOT NULL,
    played_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT game_moves_game_id_move_number_key UNIQUE (game_id, move_number)
);
CREATE INDEX IF NOT EXISTS idx_game_moves_game ON game_moves (game_id);

CREATE TABLE IF NOT EXISTS puzzles (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title          varchar(100) NOT NULL,
    fen            text NOT NULL,
    solution_moves jsonb NOT NULL,
    rating         integer NOT NULL DEFAULT 1200,
    theme          varchar(50),
    created_at     timestamptz NOT NULL DEFAULT now(),
    themes         text[],
    external_id    text
);
CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles (rating);
CREATE INDEX IF NOT EXISTS idx_puzzles_themes_gin ON puzzles USING gin (themes);
CREATE UNIQUE INDEX IF NOT EXISTS uq_puzzles_external_id
    ON puzzles (external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS puzzle_attempts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    puzzle_id      uuid NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    correct        boolean NOT NULL,
    time_spent_sec integer NOT NULL,
    attempted_at   timestamptz NOT NULL DEFAULT now()
);
-- Hot query: stats (user_id + window attempted_at), missed (user_id, correct,
-- attempted_at), streak (user_id ORDER BY attempted_at DESC).
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user_time
    ON puzzle_attempts (user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user_correct_time
    ON puzzle_attempts (user_id, correct, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_puzzle ON puzzle_attempts (puzzle_id);

CREATE TABLE IF NOT EXISTS challenges (
    id           uuid PRIMARY KEY,
    from_user_id uuid NOT NULL REFERENCES users(id),
    to_user_id   uuid NOT NULL REFERENCES users(id),
    time_control text NOT NULL,
    rated        boolean NOT NULL DEFAULT false,
    status       text NOT NULL DEFAULT 'pending',
    game_id      uuid REFERENCES games(id),
    created_at   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at   timestamp(3)
);
CREATE INDEX IF NOT EXISTS challenges_from_user_id_status_idx
    ON challenges (from_user_id, status);
CREATE INDEX IF NOT EXISTS challenges_to_user_id_status_idx
    ON challenges (to_user_id, status);
-- Global scan status='pending' (polling matcher/lobby).
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges (status)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS friends (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status         text NOT NULL DEFAULT 'pending',
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT friends_different_users CHECK (user_id <> friend_user_id),
    CONSTRAINT friends_unique_pair UNIQUE (user_id, friend_user_id),
    CONSTRAINT friends_status_check CHECK (status = ANY (ARRAY['pending','accepted']::text[]))
);
CREATE INDEX IF NOT EXISTS idx_friends_user         ON friends (user_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend_user  ON friends (friend_user_id, status);

CREATE TABLE IF NOT EXISTS analysis_results (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id   uuid NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
    engine    varchar(50) NOT NULL,
    depth     integer NOT NULL,
    score     numeric NOT NULL,
    best_move varchar(20) NOT NULL,
    evaluation text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extra_security_sessions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      varchar(255) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extra_security_user ON extra_security_sessions (user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier    varchar(255) NOT NULL,
    endpoint      varchar(255) NOT NULL,
    request_count integer NOT NULL DEFAULT 0,
    window_start  timestamptz NOT NULL,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rate_limits_identifier_endpoint_key UNIQUE (identifier, endpoint)
);

-- ============================================================================
-- BAGIAN B — MIGRASI IDEMPOTENT (GAP HASIL AUDIT)
-- Jalankan berulang aman; tiap blok guard IF NOT EXISTS / catalog check.
-- ============================================================================

-- B1. Konsolidasi identity: users PG = single source of truth.
--     Kolom legacy_store_id menyimpan id users.json ('u-xxxxxxxx') agar
--     backfill/migrasi app bisa memetakan session lama tanpa dual-identity.
--     App tetap resolvePgUser(username -> PG id); legacy id hanya referensi.
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_store_id varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS users_legacy_store_id_key
    ON users (legacy_store_id) WHERE legacy_store_id IS NOT NULL;

-- B2. Backfill legacy_store_id dari users.json (side load CSV/JSON oleh
--     operator; contoh mapping username -> legacy_id). Idempotent: hanya isi
--     yang masih NULL.
--     UPDATE users u SET legacy_store_id = j.legacy_id
--     FROM (VALUES ('s5fix_a','u-811f8c4a'), ...) AS j(username, legacy_id)
--     WHERE u.username = j.username AND u.legacy_store_id IS NULL;

-- B3. Indeks query panas games (200k baris):
--     histori per user + window ended_at; leaderboard per kategori live.
CREATE INDEX IF NOT EXISTS idx_games_white_ended ON games (white_user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_black_ended ON games (black_user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_ended_at ON games (ended_at) WHERE ended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_live_tc_minutes_white
    ON games (white_user_id, (split_part(time_control, '+', 1)::int)) WHERE game_type = 'live';
CREATE INDEX IF NOT EXISTS idx_games_live_tc_minutes_black
    ON games (black_user_id, (split_part(time_control, '+', 1)::int)) WHERE game_type = 'live';

-- B4. Indeks puzzle_attempts composite (stats/missed/streak hot path).
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user_time
    ON puzzle_attempts (user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user_correct_time
    ON puzzle_attempts (user_id, correct, attempted_at DESC);

-- B5. Challenges by status (global pending poll).
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges (status) WHERE status = 'pending';

-- B6. Rush leaderboard: ganti sort-file scan dengan indeks.
CREATE INDEX IF NOT EXISTS idx_users_rush_best
    ON users (rush_best DESC, rush_best_at ASC NULLS LAST) WHERE rush_best > 0;

-- B7. users rating DESC (leaderboard global ORDER BY rating).
CREATE INDEX IF NOT EXISTS idx_users_rating_desc ON users (rating DESC);

-- B8. Type inconsistency: challenges.created_at/decided_at memakai
--     timestamp(3) tanpa tz sementara seluruh tabel lain timestamptz.
--     Migrasi opsional (butuh lock singkat; jalankan di maintenance window):
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.columns
--              WHERE table_name='challenges' AND column_name='created_at'
--                AND data_type='timestamp without time zone') THEN
--     ALTER TABLE challenges
--       ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
--       ALTER COLUMN decided_at  TYPE timestamptz USING decided_at  AT TIME ZONE 'UTC';
--   END IF;
-- END $$;

-- B9. Sessions (hash(token) di sessions.json file store) belum ada tabel PG —
--     phase-2 konsolidasi identity sebaiknya pindah ke tabel:
-- CREATE TABLE IF NOT EXISTS sessions (
--     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--     user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     token_hash  varchar(64) NOT NULL UNIQUE,   -- HMAC sha256 hex
--     expires_at  timestamptz NOT NULL,
--     created_at  timestamptz NOT NULL DEFAULT now()
-- );
-- CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
