/**
 * app/api/games/archive/pgn/route.ts (ticket S2-T2, G11)
 * GET /api/games/archive/pgn?ids=a,b,c → satu file PGN multi-game
 * (gabungan di server, bukan zip — sesuai desain §2.1).
 * Guardrail: hanya game milik user session yang ikut dalam output.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveSessionUser } from "@/lib/puzzle-api";
import { buildPgn } from "@/lib/pgn";

export const runtime = "nodejs";

async function currentUserId(request: Request): Promise<string | Response> {
  // S9-T1 (G0.1): guard sesi via resolveSessionUser — pending/rejected dapat
  // 403 account_pending/account_rejected (bukan 401).
  const me = await resolveSessionUser(request);
  if (!me.ok) return me.response;
  // users.json id (u-*) bukan Postgres uuid — petakan via username (sprint1 §Migration).
  try {
    const pgRows = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [me.user.username]);
    if (pgRows.length === 0) {
      // Drift R4: sesi valid approved tapi username tak ada di PG → 403 akun belum tersinkron.
      return NextResponse.json({ error: "Akun belum tersinkron dengan database. Coba lagi nanti.", code: "account_missing", retryable: true }, { status: 403 });
    }
    return String((pgRows[0] as { id: string }).id);
  } catch (err) {
    console.error("[games/archive/pgn] DB gagal saat map user PG:", err);
    return NextResponse.json({ error: "Layanan sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true }, { status: 503 });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const userId = await currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }

  const url = new URL(request.url);
  const idsRaw = url.searchParams.get("ids") ?? "";
  const ids = idsRaw.split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s));
  if (ids.length === 0) {
    return NextResponse.json({ error: "Parameter ids wajib (comma-separated uuid).", retryable: false }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: "Maksimal 100 game per unduhan.", retryable: false }, { status: 400 });
  }

  // = ANY($1::uuid[]) + filter pemilik — satu query, tanpa loop per id.
  const rows = await query(
    `SELECT g.id, g.white_user_id, g.black_user_id, g.result, g.time_control, g.game_type, g.ended_at,
            w.username AS white_username, b.username AS black_username
     FROM games g
     LEFT JOIN users w ON w.id = g.white_user_id
     LEFT JOIN users b ON b.id = g.black_user_id
     WHERE g.id = ANY($1::uuid[]) AND (g.white_user_id = $2 OR g.black_user_id = $2)
     ORDER BY g.ended_at DESC NULLS LAST`,
    [ids, userId],
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada game valid / bukan milik Anda.", retryable: false }, { status: 404 });
  }

  const moveRows = await query(
    `SELECT game_id, san FROM game_moves WHERE game_id = ANY($1::uuid[]) ORDER BY game_id, move_number ASC`,
    [rows.map((r) => String((r as { id: string }).id))],
  );
  const movesByGame = new Map<string, string[]>();
  for (const m of moveRows as { game_id: string; san: string }[]) {
    const list = movesByGame.get(m.game_id) ?? [];
    list.push(m.san);
    movesByGame.set(m.game_id, list);
  }

  const pgns = rows.map((r) => {
    const g = r as Record<string, unknown>;
    return buildPgn(
      {
        white: String(g.white_username ?? "?"),
        black: String(g.black_username ?? "?"),
        result: String(g.result ?? "*"),
        timeControl: (g.time_control as string) ?? null,
        gameType: (g.game_type as string) ?? null,
        endedAt: g.ended_at as string | null,
      },
      movesByGame.get(String(g.id)) ?? [],
    );
  });

  return new NextResponse(pgns.join("\n\n"), {
    status: 200,
    headers: {
      "Content-Type": "application/x-chess-pgn; charset=utf-8",
      "Content-Disposition": `attachment; filename="jev-chess-archive-${ids.length}games.pgn"`,
    },
  });
}
