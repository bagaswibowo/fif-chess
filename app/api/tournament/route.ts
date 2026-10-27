/**
 * app/api/tournament/route.ts (S6-T5, ADR-009 D5 — kontrak docs/contracts/sprint6.md §1.5)
 *
 * GET  /api/tournament            [publik] daftar arena: { arenas: TournamentArena[] }
 * POST /api/tournament            [auth]  buat arena → 201 { ok, tournamentId }
 *
 * Matching arena = REUSE seek pool existing (D5.2) — TANPA algorithm baru:
 * sweeper in-process (`lib/realtime/tournament-sweeper.ts`, boot di server.ts)
 * mem-flip arena due → live dan membuat seek ticket sementara per entrant;
 * matcher atomic-Lua (lib/realtime/seek-pool.ts) yang mem-pair & membuat
 * games row + publish GameAdded/GameStarted (event existing, REUSE).
 *
 * Auth (kontrak §1.5): create → 401 tanpa session, 403 account_pending
 * (pola resolvePgUser), 503 DB down. GET publik → 404/503 saja.
 * Error shape: { error, code?, retryable } (pola lib/puzzle-api.ts).
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loadUsers } from "@/lib/auth-store";
import { resolvePgUser } from "@/lib/puzzle-api";
import { publishBusEvent } from "@/lib/realtime/bus.ts";
import {
  toastsTopic,
  tournamentTopic,
  type TournamentUpdated,
} from "@/lib/realtime/events.ts";
import type { TournamentArena, TournamentPlayer } from "@/lib/tournament-types.ts";
import { isValidTimeControl } from "@/lib/time-control";
import { setTournamentCreator } from "@/lib/realtime/tournament-sweeper.ts";

export const runtime = "nodejs";

type ArenaRow = {
  id: string;
  name: string;
  time_control: string;
  rated: boolean;
  status: string;
  start_at: Date | string;
  capacity: number;
  entrants: string;
};

function mapArena(r: ArenaRow): TournamentArena {
  const entrants = Number(r.entrants ?? 0);
  // currentPlayers (opsional, kontrak §1.5): hanya dimengerti saat live =
  // entrants yang sudah ter-pair matcher (masih ada seek ticket di pool).
  // Dihitung riil di GET [id] via pool seek Redis; list ringkas mengomits
  // field opsional tsb (YAGNI).
  return {
    id: String(r.id),
    name: String(r.name),
    timeControl: String(r.time_control),
    rated: Boolean(r.rated),
    status: (["registration", "live", "finished"].includes(r.status) ? r.status : "registration") as TournamentArena["status"],
    startAt: new Date(r.start_at).getTime(),
    capacity: Number(r.capacity ?? 8),
    entrants,
  };
}

const LIST_SQL = `
  SELECT t.id, t.name, t.time_control, t.rated, t.status, t.start_at, t.capacity,
         (SELECT count(*)::text FROM tournament_players tp
           WHERE tp.tournament_id = t.id AND tp.status = 'joined') AS entrants
  FROM tournaments t
  ORDER BY (t.status = 'live') DESC, (t.status = 'registration') DESC, t.start_at ASC
  LIMIT 100`;

export async function GET() {
  let rows: ArenaRow[];
  try {
    rows = await query<ArenaRow>(LIST_SQL);
  } catch (err) {
    console.error("[tournament] list query gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }
  const arenas = rows.map(mapArena);
  return NextResponse.json({ arenas });
}

/** Buat arena. Auth FIX-1 (401/403/503). Body: { name?, timeControl, rated?, startAt?, capacity? }. */
export async function POST(request: Request) {
  const auth = await resolvePgUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body harus JSON.", code: "bad_json", retryable: false }, { status: 400 });
  }

  // S6-T2: timeControl format tunggal \d{1,3}+\d{1,3} (lib/time-control.ts).
  const timeControl = typeof body.timeControl === "string" ? body.timeControl.trim() : "";
  if (!isValidTimeControl(timeControl)) {
    return NextResponse.json(
      { error: "timeControl harus format '<menit>+<inkremen>' (mis. '10+0').", code: "invalid_time_control", retryable: false },
      { status: 400 },
    );
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : `Arena ${timeControl}`;
  const rated = body.rated === true;
  // startAt default = now + 30 menit (kontrak §1.5); capacity default 8.
  const startAtMs =
    typeof body.startAt === "number" && Number.isFinite(body.startAt)
      ? body.startAt
      : Date.now() + 30 * 60_000;
  const capacity =
    typeof body.capacity === "number" && Number.isInteger(body.capacity) && body.capacity >= 2 && body.capacity <= 64
      ? body.capacity
      : 8;

  let tournamentId: string;
  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO tournaments (name, time_control, rated, status, start_at, capacity, created_at)
       VALUES ($1, $2, $3, 'registration', to_timestamp($4 / 1000.0), $5, NOW())
       RETURNING id`,
      [name, timeControl, rated, startAtMs, capacity],
    );
    tournamentId = String(rows[0].id);
  } catch (err) {
    console.error("[tournament] create gagal:", err);
    return NextResponse.json(
      { error: "Layanan database sedang gangguan. Coba lagi nanti.", code: "service_unavailable", retryable: true },
      { status: 503 },
    );
  }

  // Toast notifikasi creator (tab lain, D5.1) + event ke topik arena.
  // Creator dipetakan in-memory oleh sweeper (tabel tidak menyimpan creator
  // — YAGNI; setelah restart toast best-effort hilang, data arena tetap).
  setTournamentCreator(tournamentId, { pgId: auth.user.pgId, storeId: creatorStoreId(auth.user.username) }).catch(
    (err: unknown) => console.error("[tournament] simpan creator gagal:", err),
  );
  const ev: TournamentUpdated = { type: "tournament_updated", tournamentId, status: "registration", entrants: 0 };
  publishBusEvent(tournamentTopic(tournamentId), ev);
  const storeId = creatorStoreId(auth.user.username);
  if (storeId) publishBusEvent(toastsTopic(storeId), ev);

  return NextResponse.json({ ok: true, tournamentId }, { status: 201 });
}

/** Petakan username → store id (auth) untuk toastsTopic; null bila tak ada. */
function creatorStoreId(username: string): string | null {
  try {
    const users = loadUsers();
    return users.find((u) => u.username === username)?.id ?? null;
  } catch {
    return null;
  }
}

export type { TournamentArena, TournamentPlayer };
