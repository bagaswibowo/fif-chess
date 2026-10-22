/**
 * lib/rating.ts (ticket S2-T3)
 * Elo sederhana K=20 untuk snapshot rating di games (S2-T2 kolom
 * white/black_rating_before/after). Ini SATU-SATUNYA perhitungan rating —
 * sistem yang sudah ada (users.rating, statis sejak registrasi) tidak punya
 * update path, jadi snapshot ini yang menjadi sumber delta arsip & stats.
 */
export const K_FACTOR = 20;

/** Expected score sisi A (0..1) dari rating A vs B. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Rating baru kedua sisi. score 1 = white menang, 0 = black menang, 0.5 = draw.
 */
export function eloUpdate(
  whiteRating: number,
  blackRating: number,
  score: number,
  k: number = K_FACTOR,
): { whiteAfter: number; blackAfter: number } {
  const expWhite = expectedScore(whiteRating, blackRating);
  const expBlack = 1 - expWhite;
  return {
    whiteAfter: Math.round(whiteRating + k * (score - expWhite)),
    blackAfter: Math.round(blackRating + k * (1 - score - expBlack)),
  };
}
