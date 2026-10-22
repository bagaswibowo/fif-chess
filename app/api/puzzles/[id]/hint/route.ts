/**
 * app/api/puzzles/[id]/hint/route.ts (S3-T1, design §1.3)
 * GET ?stage=1|2 — hint tanpa membocorkan langkah penuh.
 * Stage 1: kotak asal langkah pertama solusi. Stage 2: + arah (vektor delta),
 * tanpa kotak tujuan penuh.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentPgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

const FILES = "abcdefgh";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentPgUser(request);
  if (!me) {
    return NextResponse.json({ error: "Authentication required.", retryable: false }, { status: 401 });
  }
  const { id } = await ctx.params;
  const stage = Math.min(2, Math.max(1, Number(new URL(request.url).searchParams.get("stage")) || 1));

  const rows = await query<{ solution_moves: unknown }>(
    "SELECT solution_moves FROM puzzles WHERE id = $1::uuid LIMIT 1",
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Puzzle tidak ditemukan.", retryable: false }, { status: 404 });
  }
  const moves = rows[0].solution_moves;
  if (!Array.isArray(moves) || moves.length === 0 || typeof moves[0] !== "string") {
    return NextResponse.json({ error: "Solusi puzzle tidak tersedia.", retryable: false }, { status: 409 });
  }
  const first = moves[0] as string;
  const from = first.slice(0, 2);
  const to = first.slice(2, 4);

  const hint: Record<string, unknown> = { stage, from };
  if (stage >= 2) {
    // Arah tanpa target penuh: vektor delta files/ranks.
    const df = FILES.indexOf(to[0]) - FILES.indexOf(from[0]);
    const dr = Number(to[1]) - Number(from[1]);
    hint.direction = { files: df, ranks: dr };
    hint.caption = "Arah langkah terlihat — targetnya tetap rahasia.";
  }
  return NextResponse.json({ hint });
}
