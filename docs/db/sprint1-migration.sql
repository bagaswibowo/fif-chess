-- Migration Sprint 1 (TL review S1-T2 C3 + S1-T4 C9) — dijalankan manual via psql di container jev-postgres, DB jev_chess.
-- 1. UNIQUE(username): username adalah join key auth-store -> pg (FK games/challenges) sampai konsolidasi identitas (docs/db/sprint1.md §Migration). Constraint sudah ada dari init container: users_username_key. Statement ini idempoten.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;

-- 2. Tabel challenges (model Challenge, docs/db/sprint1.md §2 — field, indeks, status enum persis doc).
--    Catatan tipe: id/from/to/game_id pakai UUID (tipe native di schema pg ini — users.id & games.id uuid),
--    bukan TEXT seperti cuplikan Prisma §3; struktur kolom & indeks tetap persis §2.
CREATE TABLE IF NOT EXISTS challenges (
  id            UUID PRIMARY KEY,
  from_user_id  UUID NOT NULL REFERENCES users(id),
  to_user_id    UUID NOT NULL REFERENCES users(id),
  time_control  TEXT NOT NULL,
  rated         BOOLEAN NOT NULL DEFAULT false,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | cancelled | expired
  game_id       UUID REFERENCES games(id),
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at    TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS challenges_to_user_id_status_idx   ON challenges(to_user_id, status);
CREATE INDEX IF NOT EXISTS challenges_from_user_id_status_idx ON challenges(from_user_id, status);
