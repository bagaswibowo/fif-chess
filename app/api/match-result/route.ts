import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { reinforceMatchDopamine, recordMatchExperience } from "@/lib/experience";
import { publishBusEvent } from "@/lib/realtime/bus.ts";
import { query } from "@/lib/db";
import { gameTopic, type GameEnded, type PlayingCountChanged } from "@/lib/realtime/events.ts";

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
      // ADR-002 §4: publish PlayingCountChanged untuk badge nav "Bermain N" (S1-T3).
      // Count = jumlah game berstatus active; fire-and-forget, kegagalan count
      // tidak menggagalkan response (tetap publish dengan count 0 dan log).
      try {
        const cnt = await query(`SELECT COUNT(*)::int AS n FROM games WHERE status = 'active'`);
        const count = Number((cnt[0] as { n: number }).n);
        const playingCount: PlayingCountChanged = { type: "playing_count_changed", count };
        publishBusEvent(gameTopic(ended.gameId), playingCount);
      } catch (countErr) {
        console.error("[match-result] PlayingCountChanged gagal:", countErr);
      }

      return NextResponse.json({ ok: true, learned: true, plies: history.length });
    }
    return NextResponse.json({ ok: true, learned: false });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
