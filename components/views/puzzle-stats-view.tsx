/**
 * components/views/puzzle-stats-view.tsx (W4 — tab Statistik)
 * Statistik latihan dari GET /api/puzzles/stats: akurasi 7/30 hari, rating
 * delta, top tema lemah. Angka sebagai TEKS berlabel (bukan warna saja).
 * Guest → fallback rapi StateMessage-style + CTA masuk (bukan error kasar).
 */
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconTarget3D } from "@/components/icons3d";

type WindowStat = { total: number; correct: number; accuracyPct: number | null };
type Stats = {
  days7: WindowStat;
  days30: WindowStat;
  ratingNow: number;
  avgPuzzleRating30d: number | null;
  ratingDelta: number | null;
  solvedPuzzles30d: number;
  weakThemes: { theme: string; total: number; correct: number; accuracyPct: number }[];
};

const pct = (v: number | null | undefined) => (typeof v === "number" ? `${v}%` : "—");

function StatCell({ value, label }: { value: string | number; label: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-base font-black text-white tabular-nums">{value}</span>
      <span className="text-[10px] text-neutral-400">{label}</span>
    </span>
  );
}

export function PuzzleStatsView({ lang = "id" }: { lang?: "id" | "en" }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/puzzles/stats", { cache: "no-store" });
      if (res.status === 401) {
        setGuest(true);
        return;
      }
      if (!res.ok) {
        setError(authErrorText(res.status, await authErrorPayload(res), "statistik latihan"));
        return;
      }
      setGuest(false);
      setStats((await res.json()) as Stats);
    } catch {
      setError("Gagal memuat statistik.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (guest) {
    return (
      <div className="view-root w-full max-w-xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-puzzle)" }}>
          <IconTarget3D size={18} aria-hidden="true" />
          <h2 className="text-sm font-black text-white m-0">Statistik Latihan</h2>
        </div>
        <div className="view-body flex flex-col items-center gap-3 py-10 text-center" role="status" aria-live="polite" style={{ scrollbarWidth: "thin" }}>
          <p className="text-sm text-neutral-400">
            Masuk untuk melihat akurasi, perkembangan rating, dan tema yang perlu dilatih.
          </p>
          <Button onClick={() => (window.location.hash = "#/auth")}>
            Masuk
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-root w-full max-w-2xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-puzzle)" }}>
          <h2 className="text-sm font-black text-white m-0">Statistik Latihan</h2>
        </div>
        <div className="view-body flex flex-col items-center gap-3 py-10" role="status" aria-live="polite" style={{ scrollbarWidth: "thin" }}>
          <p className="text-sm text-neutral-300">{error}</p>
          <Button variant="outline" onClick={() => void load()}>Coba Lagi</Button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="view-root w-full max-w-2xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-puzzle)" }}>
          <h2 className="text-sm font-black text-white m-0">Statistik Latihan</h2>
        </div>
        <div className="view-body flex items-center justify-center py-16" role="status" aria-live="polite">
          <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat statistik…</span>
        </div>
      </div>
    );
  }

  // S8 Pola D (spec §3): .view-root + .view-head 44px + .view-body berisi
  // .view-cards (grid kartu rapat auto-rows-min, total tinggi ≤ area konten
  // 1360×768 tanpa scroll; .view-body tetap jadi satu-satunya region scroll
  // bila data 30 hari memuai).
  return (
    <div className="view-root w-full max-w-3xl mx-auto">
      <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-puzzle)" }}>
        <IconTarget3D size={18} aria-hidden="true" />
        <h2 className="text-sm font-black text-white m-0">Statistik Latihan</h2>
      </div>
      <div className="view-body" style={{ scrollbarWidth: "thin" }}>
        <div className="view-cards grid grid-cols-1 gap-3 auto-rows-min pb-4">
          {/* Akurasi window + rating — angka teks berlabel */}
          <div
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3"
            role="status"
            aria-label="Ringkasan statistik teka-teki"
          >
            <StatCell value={pct(stats.days7.accuracyPct)} label="Akurasi 7 hari" />
            <StatCell value={pct(stats.days30.accuracyPct)} label="Akurasi 30 hari" />
            <StatCell value={stats.ratingNow} label="Rating puzzle saat ini" />
            <StatCell
              value={stats.ratingDelta != null ? (stats.ratingDelta > 0 ? `+${stats.ratingDelta}` : stats.ratingDelta) : "—"}
              label={lang === "id" ? "Delta vs rating puzzle 30 hari" : "Delta vs puzzle rating 30d"}
            />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
            <p className="text-xs text-neutral-400 m-0">
              {stats.days30.total} attempt dalam 30 hari ({stats.days30.correct} benar) ·{" "}
              {stats.solvedPuzzles30d} puzzle unik selesai
              {stats.avgPuzzleRating30d != null ? ` · rata-rata rating puzzle ${stats.avgPuzzleRating30d}` : ""}
            </p>
          </div>

          {/* Top tema lemah */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="text-sm font-black text-white mb-2">Tema yang perlu dilatih (akurasi terendah)</h3>
            {stats.weakThemes.length === 0 ? (
              <p className="text-xs text-neutral-400">
                Belum cukup data — kerjakan minimal 3 attempt per tema dalam 30 hari.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 m-0 p-0" aria-label="Daftar tema lemah">
                {stats.weakThemes.map((t) => (
                  <li key={t.theme} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white w-32 truncate">{t.theme}</span>
                    <span
                      role="progressbar"
                      aria-valuenow={t.accuracyPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Akurasi tema ${t.theme}`}
                      className="flex-1 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden"
                    >
                      <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${t.accuracyPct}%` }} />
                    </span>
                    <span className="text-xs text-neutral-300 tabular-nums w-24 text-right">
                      {t.accuracyPct}% ({t.correct}/{t.total})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
