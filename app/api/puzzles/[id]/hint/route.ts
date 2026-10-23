/**
 * app/api/puzzles/[id]/hint/route.ts (S3-T1, design §1.3; P3 pm-puzzle-fix-plan.md)
 * GET ?level=1|2|3 (legacy: stage=1|2) & ?moveIndex=<index langkah user (0-based)>.
 * Level 1: kotak asal langkah solusi saat ini. Level 2: + arah (vektor delta),
 * tanpa kotak tujuan penuh. Level 3: panah penuh from→to dari solution[2*moveIndex]
 * (parity Lichess: index genap = langkah user).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolvePgUser } from "@/lib/puzzle-api";

export const runtime = "nodejs";

const FILES = "abcdefgh";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const stageNum = Number(params.get("stage")) || 0;
  const level = Math.min(3, Math.max(1, Number(params.get("level")) || stageNum || 1));
  const moveIndexRaw = Number(params.get("moveIndex"));
  const moveIndex = Number.isFinite(moveIndexRaw) && moveIndexRaw >= 0 ? Math.floor(moveIndexRaw) : 0;

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
  // Parity: langkah user = index genap. moveIndex = langkah user ke-i (0-based).
  const stepUci = moves[2 * moveIndex];
  const uci = typeof stepUci === "string" ? stepUci : (moves[0] as string);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);

  const hint: Record<string, unknown> = { stage: level, from };
  if (level >= 3) {
    // Panah penuh asal→tujuan (level tertinggi).
    hint.to = to;
    hint.caption = `Panah penuh: ${from} → ${to}.`;
  } else if (level >= 2) {
    // Arah tanpa target penuh: vektor delta files/ranks.
    const df = FILES.indexOf(to[0]) - FILES.indexOf(from[0]);
    const dr = Number(to[1]) - Number(from[1]);
    hint.direction = { files: df, ranks: dr };
    hint.caption = "Arah langkah terlihat — targetnya tetap rahasia.";
  }
  return NextResponse.json({ hint });
}
