/**
 * app/api/games/[id]/pgn/route.ts (ticket S2-T2, G11)
 * GET /api/games/[id]/pgn → PGN satu game, dirender server dari game_moves
 * (tanpa duplikat penyimpanan — guardrail ticket). Scoped ke pemilik game.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser, loadUsers } from "@/lib/auth-store";
import { buildPgn } from "@/lib/pgn";

export const runtime = "nodejs";

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

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const { id } = await ctx.params;

  const rows = await query(
    `SELECT g.id, g.white_user_id, g.black_user_id, g.result, g.time_control, g.game_type,
            g.started_at, g.ended_at,
            w.username AS white_username, b.username AS black_username
     FROM games g
     LEFT JOIN users w ON w.id = g.white_user_id
     LEFT JOIN users b ON b.id = g.black_user_id
     WHERE g.id = $1 AND (g.white_user_id = $2 OR g.black_user_id = $2)`,
    [id, userId],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Game tidak ditemukan / bukan milik Anda.", retryable: false }, { status: 404 });
  }
  const game = rows[0] as Record<string, unknown>;

  const moveRows = await query(
    `SELECT move_number, san FROM game_moves WHERE game_id = $1 ORDER BY move_number ASC`,
    [id],
  );
  const moves = (moveRows as { move_number: number; san: string }[]).map((m) => m.san);

  const pgn = buildPgn(
    {
      white: String(game.white_username ?? "?"),
      black: String(game.black_username ?? "?"),
      result: String(game.result ?? "*"),
      timeControl: (game.time_control as string) ?? null,
      gameType: (game.game_type as string) ?? null,
      endedAt: game.ended_at as string | null,
    },
    moves,
  );

  return new NextResponse(pgn, {
    status: 200,
    headers: {
      "Content-Type": "application/x-chess-pgn; charset=utf-8",
      "Content-Disposition": `attachment; filename="jev-chess-${id}.pgn"`,
    },
  });
}
