-- Sprint 2 migration — jev_chess
-- PM decisions: favorited, time_control, game_type, rating snapshots.
-- UNIQUE analysis_results.game_id already exists (analysis_results_game_id_key) — nothing to do.
-- Idempotent: safe to re-run.

-- 1. favorited
ALTER TABLE games ADD COLUMN IF NOT EXISTS favorited BOOLEAN NOT NULL DEFAULT false;

-- 2. time_control + game_type
ALTER TABLE games ADD COLUMN IF NOT EXISTS time_control VARCHAR(10);
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_type VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_game_type_check'
  ) THEN
    ALTER TABLE games ADD CONSTRAINT games_game_type_check
      CHECK (game_type IN ('live','daily','bot','coach'));
  END IF;
END $$;

-- 3. rating snapshots (nullable)
ALTER TABLE games ADD COLUMN IF NOT EXISTS white_rating_before INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS white_rating_after INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS black_rating_before INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS black_rating_after INTEGER;
