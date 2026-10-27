/**
 * lib/rematch.ts (S6-T3, ADR-009 D3.2 — ekstrak `sendRematch` dari
 * components/views/archive-view.tsx jadi satu util bersama game-over-modal +
 * archive-view. TIDAK ada endpoint baru: rematch = challenge biasa
 * (POST /api/challenge { toUserId, timeControl, rated: true }) + lookup
 * /api/auth/lookupByUsername — pola exact yang sudah dipakai archive-view.
 * Event WS kontekstual: `RematchRequested` [NEW] di-publish route
 * /api/challenge ke matcher/<target> (di atas ChallengeReceived existing)
 * agar modal game-over menampilkan "rematch dari partai X".
 */
import type { RematchRequested } from "@/lib/realtime/events.ts";

export interface RematchGame {
  /** Id game sumber (pg uuid saat challenge/seek; FIF-code saat room in-memory). */
  gameId: string;
  /** Username lawan (lookup target). */
  opponent: string;
  /** Time control sumber; fallback "3+2" bila tak tercatat. */
  timeControl?: string | null;
}

/**
 * Kirim challenge rematch: lookup store id lawan → POST /api/challenge.
 * Return { ok, challengeId?, error? } — caller (UI) menampilkan
 * challengeId untuk event RematchRequested / ChallengeReceived yang masuk.
 */
export async function sendRematchRequest(
  game: RematchGame,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; challengeId?: string; error?: string }> {
  // Lawan tanpa username manusia (bot/coach) — tidak bisa rematch.
  if (!game.opponent || game.opponent === "?") {
    return { ok: false, error: "Rematch tidak tersedia." };
  }
  const lookRes = await fetchFn(
    `/api/auth/lookupByUsername?username=${encodeURIComponent(game.opponent)}`,
    { cache: "no-store" },
  );
  if (!lookRes.ok) return { ok: false, error: "Lawan tidak ditemukan." };
  const look = (await lookRes.json().catch(() => ({}))) as { id?: string };
  const toUserId = look?.id;
  if (!toUserId) return { ok: false, error: "Lawan tidak ditemukan." };

  const chRes = await fetchFn("/api/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toUserId,
      timeControl: game.timeControl ?? "3+2",
      rated: true,
      // Konteks rematch (S6-T3 D3.2) — route /api/challenge publish
      // RematchRequested bila flag ini ada (opt-in, challenge biasa tak berubah).
      rematchFrom: game.gameId,
    }),
  });
  const chData = (await chRes.json().catch(() => ({}))) as { ok?: boolean; challengeId?: string; error?: string };
  if (!chRes.ok || !chData?.ok) return { ok: false, error: chData?.error ?? "Gagal mengirim challenge." };
  return { ok: true, challengeId: chData.challengeId };
}

/** Bentuk event (export untuk caller yang ingin memverifikasi payload WS). */
export type { RematchRequested };
