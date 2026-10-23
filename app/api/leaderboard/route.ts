/**
 * app/api/leaderboard/route.ts (ticket S4-T3)
 * GET /api/leaderboard?scope=global|friends
 * Global: top 50 users.rating (SQL-side ORDER BY + LIMIT, tanpa kolom baru —
 * docs/db/sprint4.md #3). Friends: join tabel friends, hanya teman accepted.
 * Selalu menyertakan posisi + rating user sendiri (bila tidak masuk top 50).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

type Row = { id: string; username: string; rating: number; games: string; rank: string };

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "friends" ? "friends" : "global";

  // jumlah game per user dari games (semua status) — subquery terindeks idx_games_white/black.
  const base = (friendFilter: string) => `
    SELECT u.id, u.username, u.rating,
           (SELECT count(*) FROM games g WHERE g.white_user_id = u.id OR g.black_user_id = u.id) AS games,
           row_number() OVER (ORDER BY u.rating DESC, u.username ASC) AS rank
    FROM users u
    ${friendFilter}
    ORDER BY rank ASC
    LIMIT 50`;

  const friendFilter =
    scope === "friends"
      ? `WHERE u.id IN (
           SELECT CASE WHEN f.user_id = $1::uuid THEN f.friend_user_id ELSE f.user_id END
           FROM friends f
           WHERE (f.user_id = $1::uuid OR f.friend_user_id = $1::uuid) AND f.status = 'accepted'
         )`
      : "";
  const params = scope === "friends" ? [me.pgId] : [];

  const rows = await query<Row>(base(friendFilter), params);
  const entries = rows.map((r) => ({
    rank: Number(r.rank),
    username: r.username,
    rating: Number(r.rating),
    games: Number(r.games),
    isMe: r.id === me.pgId,
  }));

  // Posisi sendiri bila tidak masuk 50 besar (global) — SQL-side count.
  let meEntry = entries.find((e) => e.isMe) ?? null;
  if (!meEntry) {
    const countFilter =
      scope === "friends"
        ? `AND u.id IN (
             SELECT CASE WHEN f.user_id = $2::uuid THEN f.friend_user_id ELSE f.user_id END
             FROM friends f
             WHERE (f.user_id = $2::uuid OR f.friend_user_id = $2::uuid) AND f.status = 'accepted'
           )`
        : "";
    const meRows = await query<Row>(
      `SELECT u.id, u.username, u.rating,
              (SELECT count(*) FROM games g WHERE g.white_user_id = u.id OR g.black_user_id = u.id) AS games,
              (SELECT count(*) + 1 FROM users u2 WHERE u2.rating > u.rating ${countFilter}) AS rank
       FROM users u WHERE u.id = $1::uuid`,
      scope === "friends" ? [me.pgId, me.pgId] : [me.pgId],
    );
    if (meRows.length > 0) {
      const r = meRows[0];
      meEntry = {
        rank: Number(r.rank),
        username: r.username,
        rating: Number(r.rating),
        games: Number(r.games),
        isMe: true,
      };
    }
  }

  return NextResponse.json({ scope, entries, me: meEntry });
}
