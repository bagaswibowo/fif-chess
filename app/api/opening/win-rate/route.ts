/**
 * app/api/opening/win-rate/route.ts (S6-T1, ADR-009 D1.2)
 * GET /api/opening/win-rate?fen=<FEN>
 *
 * Win-rate per posisi DARI DATA RIIL (no-mock): agregasi SQL-side
 * game_moves.fen × games (hanya status='finished' + result valid).
 * "Sisi yang bergerak" = field turn di FEN; win dihitung dari games.result
 * (warna pemenang) terhadap warna mover — losses = samples - wins - draws
 * (baris finished selalu satu dari tiga). FEN di-match per 4 field pertama
 * (board, turn, castling, en-passant) — pola kunci lib/engines/opening-book.ts
 * (split(\s+).slice(0,4)); halfmove/fullmove clock tidak memecah sampel.
 * Toleran skema live (docs/db/sprint6.md §1): 99,99% baris games
 * status='active' → filter status='finished' wajib, tidak asumsikan.
 * Auth standar FIX-1 (kontrak §1.1: 401 / 403 account_pending / 503).
 * Caching route-level (Map FEN→row, TTL 60s) — volume query tree expansion
 * berulang (ADR-009 D1.2, detail implementasi).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";
import { validateFen } from "chess.js";

export const runtime = "nodejs";

export interface WinRateResponse {
  fen: string;
  samples: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
}

const TTL_MS = 60_000;
type CacheEntry = { at: number; data: Omit<WinRateResponse, "fen"> };
const cache = new Map<string, CacheEntry>();

function fenKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(" ");
}

export async function GET(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;

  const fen = new URL(request.url).searchParams.get("fen") ?? "";
  const trimmed = fen.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "Query param fen wajib.", code: "missing_fen", retryable: false },
      { status: 400 },
    );
  }
  const fenCheck = validateFen(trimmed);
  if (!fenCheck.ok) {
    return NextResponse.json(
      { error: fenCheck.error ?? "FEN tidak valid.", code: "invalid_fen", retryable: false },
      { status: 400 },
    );
  }
  const fields = trimmed.split(/\s+/);
  const key = fields.slice(0, 4).join(" ");

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ fen: key, ...hit.data });
  }

  let rows: Record<string, unknown>[];
  try {
    rows = await query<Record<string, unknown>>(
      `SELECT count(*)::int AS samples,
               count(*) FILTER (
                 WHERE (split_part(gm.fen, ' ', 2) = 'w' AND g.result = 'white')
                    OR (split_part(gm.fen, ' ', 2) = 'b' AND g.result = 'black')
               )::int AS wins,
               count(*) FILTER (WHERE g.result = 'draw')::int AS draws
       FROM game_moves gm
       JOIN games g ON g.id = gm.game_id
       WHERE g.status = 'finished'
         AND g.result IN ('white', 'black', 'draw')
         AND g.white_user_id <> g.black_user_id
         AND split_part(gm.fen, ' ', 1) = $1
         AND split_part(gm.fen, ' ', 2) = $2
         AND split_part(gm.fen, ' ', 3) = $3
         AND split_part(gm.fen, ' ', 4) = $4`,
      [fields[0], fields[1] ?? "", fields[2] ?? "", fields[3] ?? ""],
    );
  } catch (err) {
    console.error("[opening/win-rate] query gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }

  const r = rows[0] ?? {};
  const samples = Number(r.samples ?? 0);
  const wins = Number(r.wins ?? 0);
  const draws = Number(r.draws ?? 0);
  const data: Omit<WinRateResponse, "fen"> = {
    samples,
    wins,
    losses: samples - wins - draws,
    draws,
    winRate: samples === 0 ? null : Math.round((wins / samples) * 100) / 100,
  };
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 500) cache.clear();

  return NextResponse.json({ fen: key, ...data } satisfies WinRateResponse);
}
