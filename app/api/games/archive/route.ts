/**
 * app/api/games/archive/route.ts (ticket S2-T2, G11)
 * GET /api/games/archive?filter=all|favorited|live|daily|bot|coach&page=1
 *
 * Arsip game milik user login (white/black), hanya status='finished'.
 * Delta rating dihitung dari snapshot kolom games.*_rating_before/after (S2-T2).
 * Response juga menyertakan counter per tab agar UI chess.com-style tab
 * (docs/design/sprint2.md §2) tidak perlu query terpisah.
 *
 * Auth FIX-1.2 (audit S8 F5): resolvePgUser memetakan sesi-pending →
 * 403 account_pending, rejected → 403 account_rejected, belum-login → 401 —
 * konsisten dengan endpoint S7 (courses/learn/practice), kontrak
 * lib/use-session.ts: 401 = belum login, 403 = pending/rejected.
 *
 * Guardrail: query selalu scoped ke session user — tidak ada leak game user lain.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";
import { matchOpening } from "@/lib/opening-book";

export const runtime = "nodejs";

const PAGE_SIZE = 20;
const FILTERS = new Set(["all", "favorited", "live", "daily", "bot", "coach"]);

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const userId = auth.user.pgId;

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "all";
  if (!FILTERS.has(filter)) {
    return NextResponse.json({ error: "filter harus all|favorited|live|daily|bot|coach.", retryable: false }, { status: 400 });
  }
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  // Filter SQL: favorited → kolom favorited; lainnya → game_type.
  const whereExtra = filter === "favorited" ? "AND g.favorited = TRUE" : filter === "all" ? "" : "AND g.game_type = $2";
  const params: (string | number)[] = [userId];
  if (filter !== "all" && filter !== "favorited") params.push(filter);

  const rows = await query(
    `SELECT g.id, g.white_user_id, g.black_user_id, g.result, g.time_control, g.game_type,
            g.favorited, g.ended_at, g.created_at,
            g.white_rating_before, g.white_rating_after,
            g.black_rating_before, g.black_rating_after,
            w.username AS white_username, w.rating AS white_rating,
            b.username AS black_username, b.rating AS black_rating
     FROM games g
     LEFT JOIN users w ON w.id = g.white_user_id
     LEFT JOIN users b ON b.id = g.black_user_id
     WHERE (g.white_user_id = $1 OR g.black_user_id = $1) AND g.status = 'finished' ${whereExtra}
     ORDER BY g.ended_at DESC NULLS LAST
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    params,
  );


  // Counter per tab dalam SATU query (FILTER aggregates) — untuk tab UI.
  const countRows = await query(
    `SELECT COUNT(*)::int AS all,
            COUNT(*) FILTER (WHERE favorited)::int AS favorited,
            COUNT(*) FILTER (WHERE game_type = 'live')::int AS live,
            COUNT(*) FILTER (WHERE game_type = 'daily')::int AS daily,
            COUNT(*) FILTER (WHERE game_type = 'bot')::int AS bot,
            COUNT(*) FILTER (WHERE game_type = 'coach')::int AS coach
     FROM games g
     WHERE (g.white_user_id = $1 OR g.black_user_id = $1) AND g.status = 'finished'`,
    [userId],
  );

  // T2 (WS-2.5): opening_name + duration_sec — batch satu query untuk semua
  // game halaman ini (tanpa N+1): moves per game dihitung di Node via matchOpening.
  const gameIds = rows.map((r) => String((r as Record<string, unknown>).id));
  const openingByName = new Map<string, string | null>();
  if (gameIds.length > 0) {
    const moveRows = await query<{ game_id: string; san: string }>(
      `SELECT game_id, san FROM game_moves WHERE game_id = ANY($1::uuid[]) ORDER BY game_id, move_number ASC`,
      [gameIds],
    );
    const sansByGame = new Map<string, string[]>();
    for (const m of moveRows) {
      const list = sansByGame.get(String(m.game_id)) ?? [];
      list.push(String(m.san));
      sansByGame.set(String(m.game_id), list);
    }
    for (const [gid, sans] of sansByGame) {
      const info = sans.length >= 4 ? matchOpening(sans) : null;
      openingByName.set(gid, info ? info.name : null);
    }
  }

  const games = rows.map((r) => {
    const g = r as Record<string, unknown>;
    const mineWhite = g.white_user_id === userId;
    const myBefore = Number(mineWhite ? g.white_rating_before : g.black_rating_before);
    const myAfter = Number(mineWhite ? g.white_rating_after : g.black_rating_after);
    return {
      id: String(g.id),
      color: mineWhite ? "white" : "black",
      opponent: {
        username: String((mineWhite ? g.black_username : g.white_username) ?? "?"),
        rating: Number((mineWhite ? g.black_rating : g.white_rating) ?? 0),
      },
      time_control: (g.time_control as string) ?? null,
      game_type: (g.game_type as string) ?? null,
      result: String(g.result ?? "*"),
      favorited: Boolean(g.favorited),
      ended_at: g.ended_at,
      // Delta rating dari snapshot; null bila game tanpa snapshot (mis. casual lama).
      rating_before: Number.isFinite(myBefore) ? myBefore : null,
      rating_after: Number.isFinite(myAfter) ? myAfter : null,
      rating_delta: Number.isFinite(myBefore) && Number.isFinite(myAfter) ? myAfter - myBefore : null,
      // T2: nama opening dari matchOpening (null bila <4 ply / tak cocok) + durasi.
      opening_name: openingByName.get(String(g.id)) ?? null,
      duration_sec:
        g.ended_at && g.created_at
          ? Math.max(0, Math.round((new Date(String(g.ended_at)).getTime() - new Date(String(g.created_at)).getTime()) / 1000))
          : null,
    };
  });

  const totalRow = countRows[0] as Record<string, number>;
  const total = filter === "favorited" ? totalRow.favorited : filter === "all" ? totalRow.all : totalRow[filter];

  return NextResponse.json({
    games,
    page,
    pageSize: PAGE_SIZE,
    total,
    counts: {
      all: totalRow.all,
      favorited: totalRow.favorited,
      live: totalRow.live,
      daily: totalRow.daily,
      bot: totalRow.bot,
      coach: totalRow.coach,
    },
  });
}
