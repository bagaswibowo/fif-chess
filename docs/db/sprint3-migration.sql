-- Sprint 3 migration — jev_chess
-- Idempotent. Safe to re-run. Verified against schema 2026-10-22.
-- Context: tickets S3-T1 (import Lichess 50k), S3-T3 (rush leaderboard), S3-T4 (mastery per tema).

BEGIN;

-- 1. puzzles.themes: multi-value theme (S3-T1/T4 keputusan: TEXT[] over junction table — YAGNI,
--    SQL unnest cukup untuk agregasi mastery per tema).
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS themes TEXT[];

-- Backfill dari kolom lama theme (single value) bila themes kosong.
UPDATE puzzles SET themes = ARRAY[theme]
WHERE themes IS NULL AND theme IS NOT NULL;

-- 2. puzzles.external_id: Lichess PuzzleId untuk idempotent import (skip id yang sudah ada).
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_puzzles_external_id
  ON puzzles (external_id) WHERE external_id IS NOT NULL;

-- 3. GIN index untuk filter ?theme= (S3-T1 GET next) — bermanfaat begitu import berjalan.
CREATE INDEX IF NOT EXISTS idx_puzzles_themes_gin ON puzzles USING GIN (themes);

-- 4. Rating-range lookup (GET next ±150/±400, daily 1200–1800, rush adaptif 800–2200).
CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles (rating);

-- 5. users.rush_best / rush_best_at (S3-T3 leaderboard — 2 kolom, bukan tabel rush_scores).
ALTER TABLE users ADD COLUMN IF NOT EXISTS rush_best INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rush_best_at TIMESTAMPTZ;

COMMIT;
