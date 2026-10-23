/**
 * components/views/tier-ladder.tsx (W3 — progression tier rating)
 * Pemilih level tier 800..2200: tier terbuka → klik untuk main di rentang itu
 * (panggil onPickTier → parent memuat /api/puzzles/next?minRating=&maxRating=);
 * tier terkunci → ikon gembok + TEKS syarat (akurasi ≥60% dari ≥10 puzzle di
 * tier sebelumnya) — bukan warna saja (DHH a11y). Progress tier ditarik dari
 * GET /api/puzzles/tiers.
 */
import { useCallback, useEffect, useState } from "react";
import { IconLock3D } from "@/components/icons3d";

type Tier = { tier: number; solved: number; attempted: number; accuracy: number; unlocked: boolean };

export function TierLadder({
  lang = "id",
  onPickTier,
  selectedTier,
}: {
  lang?: "id" | "en";
  onPickTier?: (tier: number) => void;
  selectedTier?: number | null;
}) {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [rules, setRules] = useState({ acc: 60, min: 10 });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/puzzles/tiers", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      if (Array.isArray(d.tiers)) setTiers(d.tiers);
      setRules({
        acc: typeof d.unlockAccuracyPct === "number" ? d.unlockAccuracyPct : 60,
        min: typeof d.unlockMinSolved === "number" ? d.unlockMinSolved : 10,
      });
    } catch {
      /* ladder tetap kosong */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tiers) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 flex gap-2 overflow-x-auto" role="status" aria-busy="true">
        {tiers === null ? <span className="text-xs text-neutral-400 animate-pulse">Memuat tier…</span> : null}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 flex gap-2 overflow-x-auto"
      role="radiogroup"
      aria-label={lang === "id" ? "Tier rating teka-teki" : "Puzzle rating tiers"}
    >
      {tiers.map((t) => {
        const selected = selectedTier === t.tier;
        return (
          <button
            key={t.tier}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!t.unlocked}
            onClick={() => onPickTier?.(t.tier)}
            title={
              t.unlocked
                ? `${t.tier}–${t.tier + 199}`
                : lang === "id"
                  ? `Terkunci — butuh akurasi ≥${rules.acc}% dari ≥${rules.min} teka-teki di tier ${t.tier - 200}`
                  : `Locked — needs ≥${rules.acc}% accuracy over ≥${rules.min} puzzles in tier ${t.tier - 200}`
            }
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-black border flex flex-col items-center min-w-[4.5rem] ${
              selected
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : t.unlocked
                  ? "border-[var(--border)] text-white hover:border-[var(--primary)]/60"
                  : "border-[var(--border)] text-neutral-500 cursor-not-allowed"
            }`}
          >
            <span className="flex items-center gap-1" aria-hidden="true">
              {!t.unlocked ? <IconLock3D size={12} /> : null}
              {t.tier}
            </span>
            <span className="text-[10px] font-bold text-neutral-400" aria-hidden="true">
              {t.attempted > 0 ? `${t.accuracy}% · ${t.solved}/${t.attempted}` : "0/0"}
            </span>
            {!t.unlocked ? (
              <span className="sr-only">
                {lang === "id"
                  ? `Terkunci — butuh akurasi minimal ${rules.acc} persen dari minimal ${rules.min} teka-teki di tier ${t.tier - 200}`
                  : `Locked — needs at least ${rules.acc} percent accuracy over ${rules.min} puzzles in tier ${t.tier - 200}`}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
