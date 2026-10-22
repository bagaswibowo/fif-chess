/**
 * migrate-json-to-pg.ts
 * Migrate existing JSON data to PostgreSQL schema. Non-redundant: users stored once,
 * relations via FK. Game/puzzle IDs auto-generated as UUIDs.
 */

import { readFileSync } from "node:fs";
import { query } from "@/lib/db";

async function main() {
  console.log("[migrate] Starting JSON → PostgreSQL migration...");

  // ---------- USERS ----------
  const usersRaw = readFileSync("data/users.json", "utf8");
  const users: Array<{
    username: string;
    email?: string;
    elo?: number;
    createdAt?: string;
    passwordHash: string;
  }> = JSON.parse(usersRaw);

  console.log(`[migrate] Found ${users.length} users in JSON`);

  const userUuidMap = new Map<string, string>();

  for (const u of users) {
    const email = u.email || `${u.username}@jev-chess.local`;
    const rows = await query(
      `INSERT INTO users (username, email, password_hash, rating, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [u.username, email, u.passwordHash, u.elo ?? 1200, u.createdAt ?? new Date().toISOString()]
    );
    const row = rows[0] as { id: string };
    userUuidMap.set(u.username, row.id);
  }
  console.log(`[migrate] Users inserted: ${users.length}`);

  // ---------- SESSIONS → extra_security_sessions ----------
  const sessionsRaw = readFileSync("data/sessions.json", "utf8");
  const sessions: Record<string, { userId: string; exp: number }> = JSON.parse(sessionsRaw);

  console.log(`[migrate] Found ${Object.keys(sessions).length} sessions in JSON`);

  const now = Date.now();
  let inserted = 0;
  for (const [token, s] of Object.entries(sessions)) {
    if (s.exp * 1000 <= now) continue; // skip expired
    const userUuid = userUuidMap.get(s.userId);
    if (!userUuid) continue;
    await query(
      `INSERT INTO extra_security_sessions (id, user_id, token, expires_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, to_timestamp($3), $4)
       ON CONFLICT (token) DO NOTHING`,
      [userUuid, token, s.exp / 1000, new Date().toISOString()]
    );
    inserted++;
  }
  console.log(`[migrate] Sessions inserted (active only): ${inserted}`);

  // ---------- EXPERIENCE → games / game_moves ----------
  const expRaw = readFileSync("data/experience.json", "utf8");
  const experience: any = JSON.parse(expRaw);

  console.log(`[migrate] Experience JSON keys:`, Object.keys(experience).slice(0, 10));

  let gamesMigrated = 0;
  let movesMigrated = 0;

  const expEntries = Array.isArray(experience) ? experience : Object.entries(experience);

  for (const entry of expEntries) {
    const record = Array.isArray(experience) ? entry : entry[1];
    if (!record || typeof record !== "object") continue;

    const whiteUser = record.whiteUserId || record.white || "admin-bagas";
    const blackUser = record.blackUserId || record.black || "u-6d92988b";
    const result = record.result || record.winner || "*";
    const status = record.status || (result === "*" ? "active" : "finished");
    const startedAt = record.startedAt || record.createdAt || new Date().toISOString();
    const endedAt = record.endedAt || record.completedAt || null;

    // Ensure users exist
    await query(
      `INSERT INTO users (username, email, password_hash, rating, created_at, updated_at)
       VALUES ($1, $2, $3, 1200, $4, $4)
       ON CONFLICT (username) DO NOTHING`,
      [whiteUser, `${whiteUser}@jev-chess.local`, "migrated", startedAt]
    );
    await query(
      `INSERT INTO users (username, email, password_hash, rating, created_at, updated_at)
       VALUES ($1, $2, $3, 1200, $4, $4)
       ON CONFLICT (username) DO NOTHING`,
      [blackUser, `${blackUser}@jev-chess.local`, "migrated", startedAt]
    );

    // Look up UUIDs
    const wRows = await query("SELECT id FROM users WHERE username = $1 LIMIT 1", [whiteUser]);
    const bRows = await query("SELECT id FROM users WHERE username = $1 LIMIT 1", [blackUser]);
    if (wRows.length === 0 || bRows.length === 0) continue;
    const whiteUuid = (wRows[0] as { id: string }).id;
    const blackUuid = (bRows[0] as { id: string }).id;

    const gameId = genUuid();
    await query(
      `INSERT INTO games (id, white_user_id, black_user_id, status, result, started_at, ended_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $6)
       ON CONFLICT (id) DO NOTHING`,
      [gameId, whiteUuid, blackUuid, status, result, startedAt, endedAt]
    );

    // Moves
    const moves = record.moves || record.gameMoves || [];
    for (let i = 0; i < moves.length; i++) {
      const mv = moves[i];
      await query(
        `INSERT INTO game_moves (id, game_id, move_number, san, fen, played_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         ON CONFLICT (game_id, move_number) DO NOTHING`,
        [gameId, i + 1, mv.san || mv.uci || "", mv.fen || "", mv.playedAt || startedAt]
      );
      movesMigrated++;
    }
    gamesMigrated++;
  }
  console.log(`[migrate] Games: ${gamesMigrated}, Moves: ${movesMigrated}`);

  // ---------- PUZZLES ----------
  console.log("[migrate] Migration complete.");
  console.log(`[migrate] Summary: ${users.length} users, ${inserted} sessions, ${gamesMigrated} games, ${movesMigrated} moves`);
}

function genUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

main().catch((err) => {
  console.error("[migrate] FATAL:", err);
  process.exit(1);
});
