-- Sprint 4 migration — jev_chess
-- Idempotent. Safe to re-run. Verified against schema 2026-10-22.
-- Context: ticket S4-T3 (friends). Leaderboard (S4-T2/S4-T3) & home dashboard
-- TIDAK butuh kolom baru: solvedToday dari puzzle_attempts, game aktif dari
-- games (status='active'), leaderboard dari users.rating (+ games rating snapshot).

BEGIN;

-- friends: hubungan dua arah disimpan sebagai satu row per arah (lookup O(1)
-- per user tanpa UNION; idempoten via UNIQUE pair; self-friend diblokir).
CREATE TABLE IF NOT EXISTS friends (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friends_pkey PRIMARY KEY (id),
  CONSTRAINT friends_different_users CHECK (user_id <> friend_user_id),
  CONSTRAINT friends_unique_pair UNIQUE (user_id, friend_user_id)
);

-- Lookup list teman per user (baik outgoing maupun incoming request).
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends (user_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend_user ON friends (friend_user_id, status);

COMMIT;
