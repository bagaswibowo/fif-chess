/**
 * app/api/tournament/[id]/route.ts (S6-T5, ADR-009 D5 — kontrak §1.5)
 *
 * GET  /api/tournament/[id]  [publik] detail arena + entrants (bootstrap):
 *      { arena: TournamentArena (dengan currentPlayers saat live), entrants:
 *        TournamentPlayer[] }. 404 bila tidak ada; 503 DB down.
 * POST /api/tournament/[id]  [auth]  join (body { user? } opsional —
 *      username guest-join; tanpa = sesi sendiri). 201 { ok, tournamentId }.
 *      404 arena tidak ada / sudah live/finished (join hanya saat
 *      registration); 403 bila penuh / status akun bermasalah.
 *
 * currentPlayers saat live = entrants joined yang masih punya seek ticket
 * aktif di pool seek Redis (riil dari getUserSeek, no-mock) — proxy
 * "siapa yang masih menunggu dipair" sebelum ronde-2 sweep berikutnya.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loadUsers, type UserProfile } from "@/lib/auth-store";
import { resolvePgUser } from "@/lib/puzzle-api";
import { publishBusEvent } from "@/lib/realtime/bus.ts";
import {
  toastsTopic,
  tournamentTopic,
  type TournamentUpdated,
} from "@/lib/realtime/events.ts";
import { getUserSeek } from "@/lib/realtime/seek-pool.ts";
import type { TournamentArena, TournamentPlayer } from "@/lib/tournament-types.ts";

export const runtime = "nodejs";

type ArenaDetailRow = {
  id: string;
  name: string;
  time_control: string;
  rated: boolean;
  status: string;
  start_at: Date | string;
  capacity: number;
};

type EntrantRow = {
  username: string;
  rating: string | number;
  joined_at: Date | string;
};

async function fetchArena(id: string): Promise<ArenaDetailRow | null> {
  const rows = await query<ArenaDetailRow>(
    `SELECT id, name, time_control, rated, status, start_at, capacity
     FROM tournaments WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let arena: ArenaDetailRow | null;
  try {
    arena = await fetchArena(id);
  } catch (err) {
    console.error("[tournament] detail query gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }
  if (!arena || arena.id !== id) {
    return NextResponse.json({ error: "Arena tidak ditemukan.", code: "tournament_not_found", retryable: false }, { status: 404 });
  }

  const entrantRows = await query<EntrantRow>(
    `SELECT u.username, u.rating::text AS rating, tp.joined_at
     FROM tournament_players tp
     JOIN users u ON u.id = tp.user_id
     WHERE tp.tournament_id = $1 AND tp.status = 'joined'
     ORDER BY tp.joined_at ASC`,
    [id],
  );
  const entrants: TournamentPlayer[] = entrantRows.map((r) => ({
    username: String(r.username),
    rating: Number(r.rating) || 0,
    joinedAt: new Date(r.joined_at).getTime(),
  }));

  let currentPlayers: number | undefined;
  if (arena.status === "live") {
    // Riil: entrant joined yang MASIH punya seek ticket aktif (belum
    // ter-pair oleh MATCH_LUA). Omit field saat bukan live.
    let pending = 0;
    for (const e of entrantRows) {
      const store = storeIdForUsername(String(e.username));
      if (store && (await getUserSeek(store))) pending += 1;
    }
    currentPlayers = pending;
  }

  const arenaDto: TournamentArena = {
    id: arena.id,
    name: String(arena.name),
    timeControl: String(arena.time_control),
    rated: Boolean(arena.rated),
    status: (["registration", "live", "finished"].includes(arena.status) ? arena.status : "registration") as TournamentArena["status"],
    startAt: new Date(arena.start_at).getTime(),
    capacity: Number(arena.capacity ?? 8),
    entrants: entrants.length,
    ...(currentPlayers !== undefined ? { currentPlayers } : {}),
  };
  return NextResponse.json({ arena: arenaDto, entrants });
}

function storeIdForUsername(username: string): string | null {
  try {
    const users = loadUsers();
    return users.find((u) => u.username === username)?.id ?? null;
  } catch {
    return null;
  }
}

/** Join arena (auth). body { user? } — username guest-join; tanpa = sesi. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {}; // body opsional — join sesi sendiri
  }
  const guestUsername = typeof body.user === "string" && body.user.trim() ? body.user.trim().toLowerCase() : null;

  // Target join: guest by username (di-verifikasi) ATAU sesi sendiri.
  const targetUsername = guestUsername ?? auth.user.username;
  let target: { pgId: string; status: UserProfile["status"] } | null;
  if (guestUsername) {
    const fileUsers = await loadUsers();
    const f = fileUsers.find((u) => u.username === guestUsername);
    if (!f) {
      // 404 generik — anti username enumeration (pola lookupByUsername).
      return NextResponse.json({ error: "User tidak ditemukan.", code: "user_not_found", retryable: false }, { status: 404 });
    }
    if (f.status === "pending") {
      // Jangan bocorkan keberadaan akun pending (kontrak FIX-1).
      return NextResponse.json({ error: "User tidak ditemukan.", code: "user_not_found", retryable: false }, { status: 404 });
    }
    let rows: { id: string }[];
    try {
      rows = await query<{ id: string }>(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [guestUsername]);
    } catch (err) {
      console.error("[tournament] resolve guest gagal:", err);
      return NextResponse.json(
        { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
        { status: 503 },
      );
    }
    target = rows.length > 0 ? { pgId: String(rows[0].id), status: f.status } : null;
    if (!target) {
      return NextResponse.json({ error: "User tidak ditemukan.", code: "user_not_found", retryable: false }, { status: 404 });
    }
    if (target.status === "rejected") {
      return NextResponse.json({ error: "Akun ditolak admin.", code: "account_rejected", retryable: false }, { status: 403 });
    }
  } else {
    target = { pgId: auth.user.pgId, status: "approved" }; // resolvePgUser sudah lolos pending/rejected
  }

  let arena: ArenaDetailRow | null;
  try {
    arena = await fetchArena(id);
  } catch (err) {
    console.error("[tournament] join: fetch arena gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }
  if (!arena || arena.id !== id) {
    return NextResponse.json({ error: "Arena tidak ditemukan.", code: "tournament_not_found", retryable: false }, { status: 404 });
  }
  if (arena.status !== "registration") {
    return NextResponse.json(
      { error: "Registrasi arena sudah ditutup (status: " + arena.status + ").", code: "tournament_closed", retryable: false },
      { status: 404 },
    );
  }

  // Kapasitas + insert idempoten (PRIMARY KEY pair — ON CONFLICT DO NOTHING).
  let entrants: number;
  try {
    const countRows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM tournament_players
       WHERE tournament_id = $1::uuid AND status = 'joined'`,
      [id],
    );
    entrants = Number(countRows[0]?.n ?? 0);
    if (entrants >= Number(arena.capacity ?? 8)) {
      return NextResponse.json(
        { error: "Arena sudah penuh.", code: "tournament_full", retryable: false },
        { status: 403 },
      );
    }
    await query(
      `INSERT INTO tournament_players (tournament_id, user_id, status, joined_at)
       VALUES ($1::uuid, $2::uuid, 'joined', NOW())
       ON CONFLICT (tournament_id, user_id) DO NOTHING`,
      [id, target.pgId],
    );
    entrants += 1;
  } catch (err) {
    console.error("[tournament] join gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }

  const ev: TournamentUpdated = {
    type: "tournament_updated",
    tournamentId: id,
    status: "registration",
    entrants,
  };
  publishBusEvent(tournamentTopic(id), ev);
  // Salinan toasts creator (D5.1) — best-effort lewat sweeper creator map.
  import("@/lib/realtime/tournament-sweeper.ts")
    .then((m) => m.getTournamentCreatorStoreId(id))
    .then((creatorStore) => {
      if (creatorStore) publishBusEvent(toastsTopic(creatorStore), ev);
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, tournamentId: id }, { status: 201 });
}
