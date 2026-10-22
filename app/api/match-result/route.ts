import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { reinforceMatchDopamine, recordMatchExperience } from "@/lib/experience";
import { publishBusEvent } from "@/lib/realtime/bus.ts";
import { query } from "@/lib/db";
import { loadUsers } from "@/lib/auth-store";
import { eloUpdate } from "@/lib/rating";
import { gameTopic, type GameEnded, type PlayingCountChanged } from "@/lib/realtime/events.ts";
import { clearPlaying } from "@/lib/realtime/playing-count.ts";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { history, winner } = body;
    if (Array.isArray(history) && history.length > 0) {
      // 1. Simpan setiap langkah pertandingan ke basis pengetahuan experience.json
      const replay = new Chess();
      for (const m of history) {
        const fenBefore = replay.fen();
        const applied = replay.move(m);
        if (!applied) break;
        const uci = applied.lan || (applied.from + applied.to + (applied.promotion || ""));
        // Simpan posisi per langkah agar dipelajari permanen
        recordMatchExperience(fenBefore, uci, winner === applied.color ? 150 : winner === "draw" ? 50 : -50);
      }

      // 2. Terapkan dopamin PAM (+350) & aversi PPL1 (-300) jika ada pemenang
      if (winner === "white" || winner === "black") {
        reinforceMatchDopamine(history, winner);
      }
      // S1-T1: result tersimpan -> publish GameEnded ke topik game (fire-and-forget).
      const ended: GameEnded = { type: "game_ended", gameId: String(body.gameId ?? "local"), result: String(winner ?? "draw") };
      publishBusEvent(gameTopic(ended.gameId), ended);

      // TL review C5: jev:playing harus di-SREM saat game selesai — badge
      // "Bermain N" tidak boleh monoton naik. Ambil kedua pemain dari row
      // game, petakan pg uuid -> store userId (join key username — lihat
      // docs/db/sprint1.md §Migration), lalu SREM + publish PlayingCountChanged
      // ke topik presence (global) setelah count benar-benar turun.
      void (async () => {
        try {
          const gameId = ended.gameId;
          const rows = await query(
            `SELECT white_user_id, black_user_id FROM games WHERE id = $1 AND status = 'active'`,
            [gameId],
          );
          if (rows.length === 0) return; // bukan game DB (mis. vs bot) atau sudah di-update
          // S2-T3 rating snapshot: sebelum UPDATE finished, hitung delta elo
          // (K=20, lib/rating.ts) dari users.rating kedua pemain dan simpan
          // before/after di games — sumber arsip delta + stats graph.
          try {
            const pgIdsSnap = [String((rows[0] as { white_user_id: string }).white_user_id), String((rows[0] as { black_user_id: string }).black_user_id)];
            const ratingRows = await query(
              `SELECT id, rating FROM users WHERE id = ANY($1::uuid[]) ORDER BY array_position($1::uuid[], id)`,
              [pgIdsSnap],
            );
            if (ratingRows.length === 2) {
              const [wR, bR] = ratingRows as { id: string; rating: number }[];
              const whiteBefore = Number(wR.rating) || 1200;
              const blackBefore = Number(bR.rating) || 1200;
              const score = winner === "white" ? 1 : winner === "black" ? 0 : 0.5;
              const { whiteAfter, blackAfter } = eloUpdate(whiteBefore, blackBefore, score);
              await query(
                `UPDATE games SET status = 'finished', ended_at = NOW(),
                        white_rating_before = $2, white_rating_after = $3,
                        black_rating_before = $4, black_rating_after = $5
                 WHERE id = $1`,
                [gameId, whiteBefore, whiteAfter, blackBefore, blackAfter],
              );
              await query(
                `UPDATE users SET rating = v.new_rating, updated_at = NOW()
                 FROM (VALUES ($1::uuid, $2::int), ($3::uuid, $4::int)) AS v(id, new_rating)
                 WHERE users.id = v.id`,
                [pgIdsSnap[0], whiteAfter, pgIdsSnap[1], blackAfter],
              );
            } else {
              await query(`UPDATE games SET status = 'finished', ended_at = NOW() WHERE id = $1`, [gameId]);
            }
          } catch (snapErr) {
            console.error("[match-result] rating snapshot gagal (game tetap finished):", snapErr);
            await query(`UPDATE games SET status = 'finished', ended_at = NOW() WHERE id = $1`, [gameId]);
          }
          const pgIds = [String((rows[0] as { white_user_id: string }).white_user_id), String((rows[0] as { black_user_id: string }).black_user_id)];
          const pgRows = await query(`SELECT id, username FROM users WHERE id = ANY($1::uuid[])`, [pgIds]);
          const usernameByPg = new Map(pgRows.map((r) => [String((r as { id: string }).id), String((r as { username: string }).username)]));
          const users = await loadUsers();
          const storeIds = pgIds
            .map((pid) => users.find((u) => u.username === usernameByPg.get(pid))?.id)
            .filter((x): x is string => Boolean(x));
          await clearPlaying(storeIds);
          const cnt = await query(`SELECT COUNT(*)::int AS n FROM games WHERE status = 'active'`);
          const count = Number((cnt[0] as { n: number }).n);
          const ev: PlayingCountChanged = { type: "playing_count_changed", count };
          publishBusEvent("presence", ev);
        } catch (err) {
          console.error("[match-result] SREM playing / count gagal:", err);
        }
      })();

      return NextResponse.json({ ok: true, learned: true, plies: history.length });
    }
    return NextResponse.json({ ok: true, learned: false });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
