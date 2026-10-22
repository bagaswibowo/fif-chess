/**
 * app/api/stats/summary/route.ts (ticket S2-T3, G15)
 * GET /api/stats/summary?window=90|30|365|all
 *
 * Derive murni dari games (tanpa tabel baru — keputusan YAGNI tercatat di
 * docs/db/sprint2.md): win/loss/draw, rating graph (rating_after per game),
 * breakdown per game_type. Hanya game finished milik user session.
 * Window filter di SQL (guardrail ticket), bukan di client.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser, loadUsers } from "@/lib/auth-store";

export const runtime = "nodejs";

const WINDOWS: Record<string, string> = {
  "30": "30 days",
  "90": "90 days",
  "365": "365 days",
  all: "",
};

async function currentUserId(request: Request): Promise<string | null> {
  try {
    const users = await loadUsers();
    const me = currentUser(request, users);
    if (!me) return null;
    // users.json id (u-*) bukan Postgres uuid — petakan via username (sprint1 §Migration).
    const pgRows = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [me.username]);
    if (pgRows.length === 0) return null;
    return String((pgRows[0] as { id: string }).id);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }

  const url = new URL(request.url);
  const window = url.searchParams.get("window") ?? "90";
  if (!(window in WINDOWS)) {
    return NextResponse.json({ error: "window harus 30|90|365|all.", retryable: false }, { status: 400 });
  }
  const interval = WINDOWS[window];

  const whereTime = interval ? "AND g.ended_at > NOW() - $2::interval" : "";
  const params: string[] = interval ? [userId, interval] : [userId];
  const p = (n: number) => `$${n}`;

  const rows = await query(
    `SELECT g.id, g.white_user_id, g.black_user_id, g.result, g.game_type, g.ended_at,
            g.white_rating_before, g.white_rating_after,
            g.black_rating_before, g.black_rating_after
     FROM games g
     WHERE (g.white_user_id = ${p(1)} OR g.black_user_id = ${p(1)})
       AND g.status = 'finished' ${whereTime}
     ORDER BY g.ended_at ASC NULLS LAST`,
    params,
  );

  let wins = 0;
  let losses = 0;
  let draws = 0;
  const byType: Record<string, { wins: number; losses: number; draws: number; total: number }> = {};
  const ratingGraph: { date: string; gameId: string; gameType: string | null; rating: number | null }[] = [];

  for (const r of rows as Record<string, unknown>[]) {
    const mineWhite = r.white_user_id === userId;
    const result = String(r.result ?? "");
    if (result === "draw") draws += 1;
    else if ((result === "white") === mineWhite) wins += 1;
    else losses += 1;

    const type = String(r.game_type ?? "unknown");
    const bt = (byType[type] ??= { wins: 0, losses: 0, draws: 0, total: 0 });
    if (result === "draw") bt.draws += 1;
    else if ((result === "white") === mineWhite) bt.wins += 1;
    else bt.losses += 1;
    bt.total += 1;

    // Rating graph: rating_after per game (warna kita), null bila tanpa snapshot.
    const after = Number(mineWhite ? r.white_rating_after : r.black_rating_after);
    ratingGraph.push({
      date: r.ended_at ? new Date(r.ended_at as string).toISOString() : null as unknown as string,
      gameId: String(r.id),
      gameType: (r.game_type as string) ?? null,
      rating: Number.isFinite(after) ? after : null,
    });
  }

  const withRating = ratingGraph.filter((pt) => pt.rating !== null);
  const latest = withRating.at(-1)?.rating ?? null;
  const earliest = withRating[0]?.rating ?? null;

  return NextResponse.json({
    window,
    totals: { wins, losses, draws, games: rows.length },
    currentRating: latest,
    ratingDelta: latest !== null && earliest !== null ? latest - earliest : null,
    byType,
    ratingGraph,
  });
}
