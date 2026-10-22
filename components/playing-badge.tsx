"use client";

/**
 * Badge nav realtime "Bermain N" (S1-T4). Konsumsi PlayingCountChanged dari
 * topik presence/<userId>. N=0 → disembunyikan; N>9 → "9+".
 */

export function PlayingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="playing-badge"
      aria-hidden="true"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
