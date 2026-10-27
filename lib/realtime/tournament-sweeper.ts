/**
 * lib/realtime/tournament-sweeper.ts (S6-T5, ADR-009 D5.2)
 *
 * Scheduled-start sweep in-process 30s (pola setInterval sederhana; boot
 * dipanggil dari server.ts setelah WS gateway attach): flip arena due
 * `registration` → `live` dan (re-)buat seek ticket sementara per entrant
 * di seek pool existing (lib/realtime/seek-pool.ts) — matcher atomic-Lua
 * yang mem-pair & membuat games row + publish GameAdded/GameStarted
 * (event existing, REUSE). TIDAK ADA matching algorithm baru (YAGNI).
 *
 * Ronde 2: entrant yang belum ter-pair (ticket-nya habis TTL 5 menit)
 * di-seek ulang oleh sweep berikutnya — ADR-009 D5.2.
 *
 * Id-state hygiene (guardrail): tiap seek ticket yang dibuat di sini punya
 * decrement/cleanup path — MATCH_LUA hapus kedua ticket saat pairing,
 * removeUserSeek hapus saat cancel, TTL 300s sebagai batas bawah. Sweep
 * memeriksa getUserSeek() dulu sehingga tidak ada duplikat ticket per user.
 *
 * Creator map in-memory (tournamentId → { pgId, storeId }): tabel
 * tournaments tidak punya kolom creator (kontrak DDL otoritatif) — toast
 * notifikasi creator best-effort (hilang saat restart, data arena persist
 * di PG).
 */
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { loadUsers } from "@/lib/auth-store";
import { onSeekCreated } from "./matcher.ts";
import { addSeek, getUserSeek, type SeekTicket } from "./seek-pool.ts";
import { publishBusEvent } from "./bus.ts";
import { toastsTopic, tournamentTopic, type TournamentUpdated } from "./events.ts";

const SWEEP_INTERVAL_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** tournamentId → creator (untuk salinan toastsTopic, D5.1). */
const creators = new Map<string, { pgId: string; storeId: string | null }>();

export function setTournamentCreator(
  tournamentId: string,
  creator: { pgId: string; storeId: string | null },
): Promise<void> {
  creators.set(tournamentId, creator);
  return Promise.resolve();
}

/** Store id creator arena (untuk salinan toastsTopic di route join) — null bila tak tercatat. */
export function getTournamentCreatorStoreId(tournamentId: string): string | null {
  return creators.get(tournamentId)?.storeId ?? null;
}

function emitUpdated(id: string, status: "registration" | "live" | "finished", entrants: number): void {
  const ev: TournamentUpdated = { type: "tournament_updated", tournamentId: id, status, entrants };
  publishBusEvent(tournamentTopic(id), ev);
  const creator = creators.get(id);
  if (creator?.storeId) publishBusEvent(toastsTopic(creator.storeId), ev);
}

async function storeIdsForUsers(pgIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (pgIds.length === 0) return map;
  const rows = await query<{ id: string; username: string }>(
    `SELECT id, username FROM users WHERE id = ANY($1::uuid[])`,
    [pgIds],
  );
  let fileUsers: ReturnType<typeof loadUsers> = [];
  try {
    fileUsers = loadUsers();
  } catch {
    fileUsers = [];
  }
  for (const r of rows) map.set(String(r.id), fileUsers.find((u) => u.username === String(r.username))?.id ?? null);
  return map;
}

/** Satu sweep: flip due, re-seek entrants live, flip selesai. Idempoten
 *  (UPDATE ... WHERE status='X' atomic per arena — aman multi-sweep). */
export async function tournamentSweepOnce(): Promise<void> {
  // 1) Arena due: registration → live (atomic flip, hanya 1 instance menang).
  const dueRows = await query<{ id: string; time_control: string; rated: boolean }>(
    `UPDATE tournaments
     SET status = 'live'
     WHERE status = 'registration' AND start_at <= NOW()
     RETURNING id, time_control, rated`,
  );
  // TL F3: sebelum emit flip live, hitung entrant 'joined' RIIL di arena
  // tersebut — subscriber WS yang hanya merge `entrants` tidak lagi stuck di
  // "Daftar: 0/{capacity}" setelah flip live (0 adalah angka placeholder lama).
  for (const t of dueRows) {
    const cRows = await query<{ n: number | null }>(
      `SELECT COUNT(*)::int AS n FROM tournament_players WHERE tournament_id = $1 AND status = 'joined'`,
      [t.id],
    );
    const entrants = Number(cRows[0]?.n ?? 0);
    emitUpdated(t.id, "live", entrants);
  }

  // 2) Arena live: pastikan tiap entrant joined punya seek ticket aktif
  //    (ronde 2 untuk yang belum ter-pair; ronde 1 tepat setelah flip).
  const liveRows = await query<{ id: string; time_control: string; rated: boolean }>(
    `SELECT id, time_control, rated FROM tournaments WHERE status = 'live'`,
  );
  for (const t of liveRows) {
    const entrants = await query<{ user_id: string; rating: string }>(
      `SELECT tp.user_id, u.rating::text AS rating
       FROM tournament_players tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.tournament_id = $1 AND tp.status = 'joined'`,
      [t.id],
    );
    if (entrants.length === 0) {
      // Arena live tanpa partisipan: tidak ada yang akan ter-pair —
      // tutup sebagai finished (kondisi riil, bukan asumsi).
      await query(`UPDATE tournaments SET status = 'finished' WHERE id = $1 AND status = 'live'`, [t.id]);
      emitUpdated(t.id, "finished", 0);
      continue;
    }
    const mode = t.rated ? "rated" : "casual";
    const storeMap = await storeIdsForUsers(entrants.map((e) => String(e.user_id)));
    let activeTickets = 0;
    for (const e of entrants) {
      const userId = storeMap.get(String(e.user_id));
      const pgUserId = String(e.user_id);
      const rating = Number(e.rating) || 1200;
      // Idempoten: entrant yang SUDAH punya seek aktif tidak di-double-seek.
      const existing = userId ? await getUserSeek(userId).catch(() => null) : null;
      if (existing) {
        activeTickets += 1;
        continue;
      }
      if (!userId) continue; // drift pg↔file-store: skip (log, bukan fatal).
      const ticket: SeekTicket = {
        seekId: randomUUID(),
        userId,
        pgUserId,
        rating,
        tc: String(t.time_control).slice(0, 10),
        mode,
        createdAt: Date.now(),
      };
      await addSeek(ticket).catch((err: unknown) =>
        console.error("[tournament-sweeper] addSeek gagal:", t.id, err),
      );
      // Matcher dipicu langsung (pola api/seek — bukan cron per se).
      onSeekCreated(ticket);
      activeTickets += 1;
    }
    // Selesai: tidak ada lagi entrant di pool (semua ter-pair oleh
    // MATCH_LUA; entrant ganjil yang belum dapat lawan tetap re-seek di
    // sweep berikutnya — ronde 2, ADR-009 D5.2).
    if (activeTickets === 0) {
      await query(`UPDATE tournaments SET status = 'finished' WHERE id = $1 AND status = 'live'`, [t.id]);
      const count = entrants.length;
      emitUpdated(t.id, "finished", count);
    }
  }
}

/** Boot sweep loop (server.ts, setelah gateway attach). Interval 30s +
 *  sweep saat startup (arena yang due selama downtime ikut ter-flip). */
export function startTournamentSweeper(): void {
  if (timer) return;
  const tick = (): void => {
    if (running) return;
    running = true;
    void tournamentSweepOnce()
      .catch((err: unknown) => console.error("[tournament-sweeper] sweep gagal:", err))
      .finally(() => {
        running = false;
      });
  };
  timer = setInterval(tick, SWEEP_INTERVAL_MS);
  timer.unref?.();
  void tick(); // sweep saat startup
}

export function stopTournamentSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
