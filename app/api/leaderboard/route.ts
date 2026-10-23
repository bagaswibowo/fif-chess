/**
 * app/api/leaderboard/route.ts (ticket S4-T3 + T3 WS-2.5)
 * GET /api/leaderboard?scope=global|friends&game_type=bullet|blitz|rapid
 * Global: top 50 users.rating (SQL-side ORDER BY + LIMIT, tanpa kolom baru —
 * docs/db/sprint4.md #3). Friends: join tabel friends, hanya teman accepted.
 * Selalu menyertakan posisi + rating user sendiri (bila tidak masuk top 50).
 *
 * T3 (WS-2.5): param game_type opsional (bullet <3, blitz <10, rapid ≥10 menit,
 * konsisten ui-flow-spec §3) — aggregate game_type='live' + derive kategori dari
 * time_control; winRate per entry (FILTER aggregate, backward-compat: tanpa param
 * → agregat lama, hanya kolom winRate baru). Param invalid → 400.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

type Row = { id: string; username: string; rating: number; games: string; rank: string; games_gt: string; wins: string };

const GAME_TYPES = new Set(["bullet", "blitz", "rapid"]);

/** Kategori waktu dari time_control '<menit>+<inkremen>' (ui-flow-spec §3).
 *  bullet: <3 menit; blitz: 3..<10; rapid: >=10. Hanya game_type='live'. */
function timeCategorySql(tcCol: string, gtCol: string, gameType: string): string {
  const min = `split_part(${tcCol}, '+', 1)::int`;
  if (gameType === "bullet") return `(${gtCol} = 'live' AND ${min} < 3)`;
  if (gameType === "blitz") return `(${gtCol} = 'live' AND ${min} >= 3 AND ${min} < 10)`;
  return `(${gtCol} = 'live' AND ${min} >= 10)`;
}

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const me = auth.user;
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "friends" ? "friends" : "global";

  // T3: game_type opsional; nilai selain bullet|blitz|rapid → 400.
  const gameTypeRaw = url.searchParams.get("game_type");
  if (gameTypeRaw !== null && !GAME_TYPES.has(gameTypeRaw)) {
    return NextResponse.json(
      { error: "game_type harus bullet, blitz, atau rapid.", retryable: false },
      { status: 400 },
    );
  }
  const gameType = gameTypeRaw && GAME_TYPES.has(gameTypeRaw) ? gameTypeRaw : null;

  const timeCtl = "g.time_control";
  const gameTypeCol = "g.game_type";

  // Jumlah game per user dari games (semua status) — subquery terindeks
  // idx_games_white/black. games_gt/wins: agregat per kategori (T3, scalar subquery).
  const catFilter = gameType ? timeCategorySql(timeCtl, gameTypeCol, gameType) : null;
  const statsSub = (whereCat: string | null, col: "n" | "w") =>
    `SELECT ${col === "n" ? "count(*)" : "count(*) FILTER (WHERE (result = 'white' AND white_user_id = u.id) OR (result = 'black' AND black_user_id = u.id))"}
     FROM games g WHERE (g.white_user_id = u.id OR g.black_user_id = u.id)${whereCat ? ` AND ${whereCat}` : ""}`;

  const base = (friendFilter: string) => `
    SELECT u.id, u.username, u.rating,
           (${statsSub(null, "n")}) AS games,
           (${statsSub(catFilter, "n")}) AS games_gt,
           (${statsSub(catFilter, "w")}) AS wins,
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
  const winRateOf = (gamesT: number, wins: number) =>
    Math.round((wins / Math.max(gamesT, 1)) * 100) / 100;
  const entries = rows.map((r) => ({
    rank: Number(r.rank),
    username: r.username,
    rating: Number(r.rating),
    games: Number(r.games),
    winRate: winRateOf(Number(r.games_gt), Number(r.wins)),
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
              (SELECT count(*) FROM games g WHERE (g.white_user_id = u.id OR g.black_user_id = u.id)${catFilter ? ` AND ${catFilter}` : ""}) AS games_gt,
              (SELECT count(*) FILTER (WHERE (result = 'white' AND white_user_id = u.id) OR (result = 'black' AND black_user_id = u.id)) FROM games g WHERE (g.white_user_id = u.id OR g.black_user_id = u.id)${catFilter ? ` AND ${catFilter}` : ""}) AS wins,
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
        winRate: winRateOf(Number(r.games_gt), Number(r.wins)),
        isMe: true,
      };
    }
  }

  return NextResponse.json({ scope, gameType, entries, me: meEntry });
}
