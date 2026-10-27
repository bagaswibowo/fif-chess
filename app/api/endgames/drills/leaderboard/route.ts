/**
 * app/api/endgames/drills/leaderboard/route.ts (S7-T5, ADR-010 D6)
 * GET /api/endgames/drills/leaderboard?set=<setId>&limit=<n>
 *
 * PUBLIK (pola api/leaderboard: username+rating sudah publik, tanpa PII
 * baru) — TIDAK ada guard auth, TIDAK bisa 401/403.
 *
 * Agregasi SQL-side dari tabel riil `puzzle_attempts` (no-mock,
 * NO-NEW-TABLE):
 *   - default / "all" = count(DISTINCT puzzle_id) attempt benar per user
 *     SELURUH 6 drill tema (query + tie-break docs/db/sprint7.md §4,
 *     filter tema via GIN idx_puzzles_themes_gin — $1::text[] && p.themes).
 *   - ?set=<setId> = count(DISTINCT puzzle_id) attempt benar per user
 *     dalam puzzleIds set tsb (= ANY($1::uuid[]), set kurasi statis
 *     lib/endgame-drills.ts).
 *   - tie-break deterministik: ORDER BY solved DESC, u.id ASC (user_id).
 *   - limit default 20, cap 50 (<1 atau >50 → 400).
 *
 * Error: 400 (limit invalid) / 404 (set tak dikenal) / 503 (DB down).
 * No-mock: user yang tidak tercantum = tidak ada attempt benar di set tsb
 * (entries bisa [] — UI pakai copy empty, jangan isi angka statis).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { DRILL_SETS, drillSetById, type DrillSet } from "@/lib/endgame-drills";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
/** 6 tema drill endgame (field DrillSet.theme, D6.1 — sumber psql live). */
const ALL_DRILL_THEMES: string[] = DRILL_SETS.map((s) => s.theme);

interface EndgameLeaderboardEntry {
  username: string;
  rating: number;
  solved: number;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const setParam = url.searchParams.get("set");
  const limitParam = url.searchParams.get("limit");

  // ?set=<setId> opsional; default "all". 404 set tak dikenal (kontrak D6).
  const setId = setParam ?? "all";
  let set: DrillSet | null = null;
  if (setId !== "all") {
    set = drillSetById(setId);
    if (!set) {
      return NextResponse.json(
        { error: `Set drill "${setId}" tidak dikenal.`, code: "set_not_found", retryable: false },
        { status: 404 },
      );
    }
  }

  // ?limit default 20, cap 50; <1 atau >50 → 400.
  let limit = DEFAULT_LIMIT;
  if (limitParam !== null && limitParam !== "") {
    if (!/^\d+$/.test(limitParam)) {
      return NextResponse.json({ error: "limit harus integer.", code: "invalid_limit", retryable: false }, { status: 400 });
    }
    const n = Number(limitParam);
    if (n < 1 || n > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit harus 1..${MAX_LIMIT}.`, code: "invalid_limit", retryable: false },
        { status: 400 },
      );
    }
    limit = n;
  }

  let rows: { username: string; rating: number; solved: string }[];
  try {
    if (setId === "all") {
      // docs/db/sprint7.md §4: seluruh 6 drill tema (GIN && themes).
      rows = await query(
        `SELECT u.username, u.rating,
                count(DISTINCT a.puzzle_id)::text AS solved
         FROM puzzle_attempts a
         JOIN puzzles p ON p.id = a.puzzle_id
         JOIN users u ON u.id = a.user_id
         WHERE a.correct = true
           AND $1::text[] && p.themes
         GROUP BY u.id, u.username, u.rating
         ORDER BY solved DESC, u.id ASC
         LIMIT $2`,
        [ALL_DRILL_THEMES, limit],
      );
    } else {
      // ?set=<setId>: hanya puzzle di dalam set tsb (kurasi statis).
      rows = await query(
        `SELECT u.username, u.rating,
                count(DISTINCT a.puzzle_id)::text AS solved
         FROM puzzle_attempts a
         JOIN users u ON u.id = a.user_id
         WHERE a.correct = true
           AND a.puzzle_id = ANY($1::uuid[])
         GROUP BY u.id, u.username, u.rating
         ORDER BY solved DESC, u.id ASC
         LIMIT $2`,
        [set!.puzzleIds, limit],
      );
    }
  } catch (err) {
    console.error("[endgames/drills/leaderboard] DB gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }

  const entries: EndgameLeaderboardEntry[] = rows.map((r) => ({
    username: String(r.username),
    rating: Number(r.rating) || 1200,
    solved: Number(r.solved),
  }));

  return NextResponse.json({
    set: setId === "all"
      ? { id: "all", title: "Semua drill" }
      : { id: set!.id, title: set!.title },
    limit,
    entries,
  });
}
