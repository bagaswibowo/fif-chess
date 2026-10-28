"use client";

/**
 * components/views/archive-view.tsx (S4-fix + T5 WS-2.5)
 * View arsip partai: reuse GET /api/games/archive (S2-T2) + unduh PGN
 * via /api/games/archive/pgn?ids=... Navigasi ke tab review via onGoReview.
 * T5: badge W/L/D ikon+teks, opening, durasi, delta rating dgn panah,
 * aksi Analisis/Share/Rematch/Favorit per row, pagination dgn fokus management.
 */
import { authErrorText } from "@/lib/use-session";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

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
  opening_name: string | null;
  duration_sec: number | null;
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

function resultLabel(result: string, mine: "white" | "black"): { text: string; icon: string } {
  if (result === "draw") return { text: "Remis", icon: "½" };
  if (result === mine) return { text: "Menang", icon: "✓" };
  if (result === "white" || result === "black") return { text: "Kalah", icon: "✕" };
  return { text: result || "*", icon: "•" };
}

function formatDuration(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return "-";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function relativeDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "-";
  const diffDays = Math.floor((Date.now() - d) / 86_400_000);
  if (diffDays <= 0) return "hari ini";
  if (diffDays === 1) return "kemarin";
  if (diffDays < 30) return `${diffDays} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID");
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
  const [liveMessage, setLiveMessage] = useState("");
  // Rematch: gameId → "Menunggu…" | pesan error inline.
  const [rematchState, setRematchState] = useState<Record<string, string>>({});
  const listTopRef = useRef<HTMLDivElement | null>(null);
  const prevPageRef = useRef(page);

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
    }
  }, []);

  useEffect(() => {
    void load(filter, page);
  }, [filter, page, load]);

  // Fokus management pagination: fokus pindah ke atas list saat ganti halaman.
  useEffect(() => {
    if (prevPageRef.current !== page) {
      prevPageRef.current = page;
      listTopRef.current?.focus();
    }
  }, [page]);

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

  const toggleFavorite = useCallback(async (g: ArchiveGame) => {
    try {
      const res = await fetch(`/api/games/${g.id}/favorite`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLiveMessage(authErrorText(res.status, data, "favorit"));
        return;
      }
      setGames((gs) => gs.map((x) => (x.id === g.id ? { ...x, favorited: Boolean(data.favorited) } : x)));
      setLiveMessage(data.favorited ? "Ditambahkan ke favorit." : "Dihapus dari favorit.");
    } catch {
      setLiveMessage("Gagal mengubah favorit.");
    }
  }, []);

  const shareGame = useCallback(async (g: ArchiveGame) => {
    const url = `${window.location.origin}/review/${g.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLiveMessage("Tautan analisis disalin ke clipboard.");
    } catch {
      // Clipboard gagal (mis. tanpa HTTPS): unduh PGN satu game sebagai fallback.
      try {
        const res = await fetch(`/api/games/${g.id}/pgn`);
        if (res.ok) {
          const blob = await res.blob();
          const u = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = u;
          a.download = `jev-chess-${g.id}.pgn`;
          a.click();
          URL.revokeObjectURL(u);
          setLiveMessage("PGN satu game diunduh.");
        } else {
          setLiveMessage("Gagal membagikan partai.");
        }
      } catch {
        setLiveMessage("Gagal membagikan partai.");
      }
    }
  }, []);

  const sendRematch = useCallback(async (g: ArchiveGame) => {
    // Game vs bot/coach tanpa lawan manusia — tidak bisa rematch.
    if (!g.opponent?.username || g.opponent.username === "?") return;
    setRematchState((s) => ({ ...s, [g.id]: "Menunggu…" }));
    try {
      // Cari store id lawan via /api/auth/lookupByUsername (id publik, S4-fix).
      const lookRes = await fetch(`/api/auth/lookupByUsername?username=${encodeURIComponent(g.opponent.username)}`, { cache: "no-store" });
      if (!lookRes.ok) {
        setRematchState((s) => ({ ...s, [g.id]: "Lawan tidak ditemukan." }));
        return;
      }
      const look = await lookRes.json().catch(() => ({}));
      const toUserId = look?.id as string | undefined;
      if (!toUserId) {
        setRematchState((s) => ({ ...s, [g.id]: "Lawan tidak ditemukan." }));
        return;
      }
      const chRes = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, timeControl: g.time_control ?? "3+2", rated: true }),
      });
      const chData = await chRes.json().catch(() => ({}));
      if (!chRes.ok) {
        setRematchState((s) => ({ ...s, [g.id]: chData?.error ?? "Gagal mengirim challenge." }));
        return;
      }
      setLiveMessage("Challenge rematch terkirim.");
    } catch {
      setRematchState((s) => ({ ...s, [g.id]: "Gagal mengirim challenge." }));
    }
  }, []);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="view-root w-full max-w-3xl mx-auto">
      <div className="view-head flex items-center gap-2 shrink-0">
        <h2 className="text-sm font-black text-white shrink-0">Arsip Partai</h2>
        <div className="flex-1" aria-hidden="true" />
        <div className="flex flex-wrap gap-1 shrink-0" role="tablist" aria-label="Filter arsip">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => { setFilter(f.id); setPage(1); }}
              className={`px-2 py-0.5 rounded-md text-xs font-semibold border transition-colors ${
                filter === f.id
                  ? "bg-[var(--nav-accent-watch)] text-black border-[var(--nav-accent-watch)]"
                  : "bg-[var(--card)] text-neutral-300 border-[var(--border)] hover:text-white"
              }`}
            >
              {f.labelId}{typeof counts[f.id] === "number" ? ` (${counts[f.id]})` : ""}
            </button>
          ))}
        </div>
        {onGoReview && (
          <Button variant="outline" size="sm" onClick={onGoReview} className="shrink-0">
            Ulas Partai
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={downloading || games.length === 0}
          onClick={() => void downloadPgn(games.map((g) => g.id))}
          className="shrink-0"
        >
          {downloading ? "Mengunduh…" : "Unduh PGN"}
        </Button>
      </div>

      {/* aria-live: pesan aksi (share/favorit/rematch) */}
      <p role="status" aria-live="polite" className="sr-only">{liveMessage}</p>

      <div className="view-body" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <LoadingState label="Memuat…" />
        ) : error ? (
          <ErrorState message={error} ctx="arsip partai" onRetry={() => void load(filter, page)} />
        ) : games.length === 0 ? (
          <EmptyState
            title="Belum ada partai"
            hint="Main partai untuk memunculkannya di arsip ini."
            ctaLabel="Main Online"
            onCta={() => (window.location.hash = "#/play")}
          />
        ) : (
          <div ref={listTopRef} tabIndex={-1} className="outline-none">
            <ul className="flex flex-col gap-1.5">
              {games.map((g) => {
                const rl = resultLabel(g.result, g.color);
                const hasOpponent = Boolean(g.opponent?.username) && g.opponent.username !== "?";
                const rmState = rematchState[g.id];
                return (
                  <li
                    key={g.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 min-h-[44px]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate flex items-center gap-2">
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded ${
                            g.result === "draw"
                              ? "bg-neutral-700 text-neutral-200"
                              : g.result === g.color
                                ? "bg-emerald-600/20 text-emerald-400"
                                : "bg-red-600/20 text-red-400"
                          }`}
                        >
                          <span aria-hidden="true">{rl.icon}</span>
                          {rl.text}
                        </span>
                        vs @{g.opponent.username} <span className="text-neutral-400 font-normal">({g.opponent.rating})</span>
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {g.color === "white" ? "Putih" : "Hitam"} · {g.opening_name ?? "Opening tidak tercatat"} · {g.time_control ?? "Casual"} · {formatDuration(g.duration_sec)} · {relativeDate(g.ended_at)}
                        {typeof g.rating_delta === "number" ? (
                          <span className={g.rating_delta >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                            {" "}<span aria-hidden="true">{g.rating_delta >= 0 ? "▲" : "▼"}</span> {g.rating_delta >= 0 ? "+" : ""}{g.rating_delta}
                          </span>
                        ) : (
                          <span className="text-neutral-500"> · tanpa perubahan rating</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {onGoReview && (
                        <button
                          onClick={() => { window.location.hash = `#/review/${g.id}`; onGoReview(); }}
                          aria-label={`Analisis partai vs ${g.opponent.username}`}
                          title="Analisis"
                          className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-[var(--surface-hover)]"
                        >
                          <span aria-hidden="true">🔍</span>
                        </button>
                      )}
                      <button
                        onClick={() => void shareGame(g)}
                        aria-label={`Bagikan partai vs ${g.opponent.username}`}
                        title="Share"
                        className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-[var(--surface-hover)]"
                      >
                        <span aria-hidden="true">🔗</span>
                      </button>
                      <button
                        onClick={() => void sendRematch(g)}
                        disabled={!hasOpponent || rmState === "Menunggu…"}
                        aria-label={hasOpponent ? `Tanding ulang vs ${g.opponent.username} ${g.time_control ?? ""}` : "Rematch tidak tersedia untuk partai vs bot"}
                        title={hasOpponent ? "Rematch" : "Rematch tidak tersedia (vs bot)"}
                        className={`p-1.5 rounded-lg ${hasOpponent && rmState !== "Menunggu…" ? "text-neutral-300 hover:text-white hover:bg-[var(--surface-hover)]" : "text-neutral-600 cursor-not-allowed"}`}
                      >
                        <span aria-hidden="true">⚔️</span>
                      </button>
                      <button
                        onClick={() => void toggleFavorite(g)}
                        aria-label={`${g.favorited ? "Hapus dari" : "Tambahkan ke"} favorit: partai vs ${g.opponent.username}`}
                        title="Favorit"
                        aria-pressed={g.favorited}
                        className={`p-1.5 rounded-lg hover:bg-[var(--surface-hover)] ${g.favorited ? "text-yellow-400" : "text-neutral-300 hover:text-white"}`}
                      >
                        <span aria-hidden="true">{g.favorited ? "★" : "☆"}</span>
                      </button>
                      {rmState && (
                        <span className="text-xs text-neutral-300">{rmState}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {totalPages > 1 && !loading && !error && (
          <div className="flex items-center justify-center gap-3 py-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Sebelumnya
            </Button>
            <span className="text-xs text-neutral-400" aria-live="polite">Halaman {page} dari {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Berikutnya
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
