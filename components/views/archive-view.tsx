"use client";

/**
 * components/views/archive-view.tsx (S4-fix — TL review b003cffa #1)
 * View arsip partai: reuse GET /api/games/archive (S2-T2) + unduh PGN
 * via /api/games/archive/pgn?ids=... Navigasi ke tab review via onGoReview.
 */
import { authErrorText } from "@/lib/use-session";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ArchiveGame = {
  id: string;
  color: "white" | "black";
  opponent: { username: string; rating: number };
  time_control: string | null;
  game_type: string | null;
  result: string;
  favorited: boolean;
  ended_at: string | null;
  rating_delta: number | null;
};

type Counts = Record<string, number>;
type Props = { onGoReview?: () => void };

const FILTERS: { id: string; labelId: string }[] = [
  { id: "all", labelId: "Semua" },
  { id: "favorited", labelId: "Favorit" },
  { id: "live", labelId: "Live" },
  { id: "daily", labelId: "Harian" },
  { id: "bot", labelId: "Bot" },
  { id: "coach", labelId: "Coach" },
];

function resultLabel(result: string, mine: "white" | "black"): string {
  if (result === "draw") return "Remis";
  if (result === mine) return "Menang";
  if (result === "white" || result === "black") return "Kalah";
  return result || "*";
}

export function ArchiveView({ onGoReview }: Props) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [games, setGames] = useState<ArchiveGame[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async (f: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/archive?filter=${encodeURIComponent(f)}&page=${p}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(authErrorText(res.status, data, "arsip partai"));
        setGames([]);
        return;
      }
      setGames((data.games ?? []) as ArchiveGame[]);
      setCounts((data.counts ?? {}) as Counts);
      setTotal(Number(data.total ?? 0));
    } catch {
      setError("Gagal memuat arsip.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter, page);
  }, [filter, page, load]);

  const downloadPgn = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/games/archive/pgn?ids=${ids.join(",")}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jev-chess-arsip.pgn";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, []);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <h2 className="text-base font-bold">Arsip Partai</h2>
        <div className="flex gap-2">
          {onGoReview && (
            <Button variant="outline" size="sm" onClick={onGoReview}>
              Ulas Partai
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={downloading || games.length === 0}
            onClick={() => void downloadPgn(games.map((g) => g.id))}
          >
            {downloading ? "Mengunduh…" : "Unduh PGN"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter arsip">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => { setFilter(f.id); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              filter === f.id
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "bg-[var(--card)] text-neutral-300 border-[var(--border)] hover:text-white"
            }`}
          >
            {f.labelId}{typeof counts[f.id] === "number" ? ` (${counts[f.id]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-400" role="status" aria-live="polite">Memuat…</div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-neutral-300" role="status">{error}</div>
      ) : games.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400" role="status">
          Belum ada partai selesai pada filter ini.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  vs @{g.opponent.username} <span className="text-neutral-400 font-normal">({g.opponent.rating})</span>
                </p>
                <p className="text-xs text-neutral-400">
                  {g.color === "white" ? "Putih" : "Hitam"} · {g.game_type ?? "-"} · {g.time_control ?? "-"}
                  {g.ended_at ? ` · ${new Date(g.ended_at).toLocaleDateString("id-ID")}` : ""}
                  {typeof g.rating_delta === "number" ? ` · ${g.rating_delta >= 0 ? "+" : ""}${g.rating_delta}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-md ${
                  g.result === "draw"
                    ? "bg-neutral-700 text-neutral-200"
                    : g.result === g.color
                      ? "bg-emerald-600/20 text-emerald-400"
                      : "bg-red-600/20 text-red-400"
                }`}
              >
                {resultLabel(g.result, g.color)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && !loading && !error && (
        <div className="flex items-center justify-center gap-3 shrink-0">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Sebelumnya
          </Button>
          <span className="text-xs text-neutral-400">Halaman {page}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  );
}
