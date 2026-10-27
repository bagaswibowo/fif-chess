"use client";

/**
 * components/views/insights-view.tsx (S6-T4 — docs/design/sprint6-flows.md §4)
 * Insight pemain di #/insights (diri sendiri) & #/insights/{username} (publik).
 *
 * Kontrak (docs/contracts/sprint6.md §1.4, ADR-009 D4): GET /api/insights
 * ?user=&window=&game_type=&color= → InsightsResponse. Semua angka RIIL dari
 * endpoint (no-mock). 403 account_pending (diri sendiri pending) dan 404
 * (user tak ada) punya copy spesifik di spec.
 *
 * Tampilan 5 mode (Semua/Warna/Buah/Pemain/Performa Lampau) — S6 hanya
 * render tab yang punya data riil (D4.3: "Buah" tidak punya data →
 * disembunyikan, bukan tab kosong — anti-slop). Mode "Pemain" memakai
 * recentGames (hanya untuk perspektif sendiri; deep-link publik recentGames
 * kosong → tab "Pemain" hanya tampil saat data ada).
 *
 * A11y floor: tablist role=tab + aria-selected, grafik role="img" ber-
 * aria-label + tabel sr-only per titik, filter update lewat role="status",
 * prefers-reduced-motion → transisi chip/grafik mati (token
 * --move-animation-duration dari app/realtime.css).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart, Trophy, History } from "lucide-react";

/** Bentuk respons GET /api/insights (kontrak §1.4 — satu sumber tipe:
 *  di-definisikan lokal mengikuti kontrak; tidak di-restate di komponen
 *  lain karena kontrak tidak menyediakan tipe TS shared terpisah). */
type RecentGame = {
  id: string;
  myResult: "win" | "loss" | "draw";
  opponent: { username: string; rating: number };
  timeControl: string;
  gameType: string;
  endedAt: string;
};
type InsightsResponse = {
  user: { username: string; rating: number | null };
  window: "30" | "90" | "365" | "all";
  gameType: "bullet" | "blitz" | "rapid" | null;
  color: "w" | "b" | null;
  totals: { wins: number; losses: number; draws: number; games: number; winRate: number | null };
  byType: Record<string, { wins: number; losses: number; draws: number; total: number }>;
  ratingGraph: { date: string | null; gameId: string; gameType: string | null; rating: number | null }[];
  ratingDelta: number | null;
  recentGames: RecentGame[];
};

type ViewMode = "all" | "warna" | "pemain" | "performa";
type GameTypeFilter = "" | "bullet" | "blitz" | "rapid";
type WindowFilter = "30" | "90" | "365" | "all";

const RESULT_ICON: Record<RecentGame["myResult"], string> = { win: "M", loss: "K", draw: "R" };

/** Kunci `byType` = kategori waktu (bukan warna — kontrak §1.4: agregasi
 *  SQL-side dari kolom time_control, pola api/leaderboard). */
const BY_TYPE_LABEL: Record<string, string> = {
  bullet: "Kilat",
  blitz: "Blitz",
  rapid: "Rapid",
  unknown: "Tanpa kategori",
};

export function InsightsView({ username, isSelf, onOpenLeaderboard, onOpenArchive }: {
  username: string; // username target ("" = diri sendiri)
  isSelf: boolean;
  onOpenLeaderboard?: () => void;
  onOpenArchive?: () => void;
}) {
  const target = username || "kamu";
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState(false);
  const [gameType, setGameType] = useState<GameTypeFilter>("");
  const [windowF, setWindowF] = useState<WindowFilter>("30");
  const [mode, setMode] = useState<ViewMode>("all");
  const [statusMsg, setStatusMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(null);
    setPendingAuth(false);
    try {
      const qs = new URLSearchParams();
      if (isSelf) {
        // ?user=<session> di-handle server (isOwn) — tanpa param user = sesi sendiri.
      } else {
        qs.set("user", username);
      }
      qs.set("window", windowF);
      if (gameType) qs.set("game_type", gameType);
      const res = await fetch(`/api/insights?${qs.toString()}`, { cache: "no-store" });
      if (res.status === 403) {
        const d = await res.json().catch(() => ({}));
        if (d?.code === "account_pending") {
          setPendingAuth(true);
        } else {
          setNotFound("Gagal memuat Insight. Coba lagi.");
        }
        return;
      }
      if (res.status === 404) {
        setNotFound(`Pemain ${username} tidak ditemukan.`);
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setNotFound(d?.code === "service_unavailable" ? "Server sedang sibuk." : "Gagal memuat Insight. Coba lagi.");
        return;
      }
      setData((await res.json()) as InsightsResponse);
    } catch {
      setNotFound("Gagal memuat Insight. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [username, isSelf, gameType, windowF]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tab yang punya data riil (anti-slop — tanpa data, tab disembunyikan).
  // "warna" bisa dihitung server (param color) selama ada partai; "pemain"
  // & "performa" butuh recentGames / ratingGraph (hanya perspektif sendiri).
  const availableModes = useMemo(() => {
    const ms: ViewMode[] = ["all"];
    if (!data) return ms;
    if (data.totals.games > 0) ms.push("warna");
    if (data.recentGames.length > 0) ms.push("pemain");
    if (data.ratingGraph.filter((g) => g.rating != null).length >= 2) ms.push("performa");
    return ms;
  }, [data]);

  const activeMode: ViewMode = availableModes.includes(mode) ? mode : "all";
  const t = data?.totals;

  // Mode "warna": agregasi per-warna dari SERVER (param color kontrak §1.4,
  // SQL-side — no client-side-filter). Dua fetch paralel ?color=w / ?color=b
  // dijalankan hanya saat mode ini aktif (YAGNI: tidak membebani default).
  const [colorData, setColorData] = useState<{
    w: { wins: number; total: number } | null;
    b: { wins: number; total: number } | null;
    loading: boolean;
  }>({ w: null, b: null, loading: false });
  useEffect(() => {
    if (activeMode !== "warna" || !data) return;
    let cancelled = false;
    setColorData((p) => ({ ...p, loading: true }));
    const fetchColor = async (c: "w" | "b") => {
      const qs = new URLSearchParams();
      if (!isSelf) qs.set("user", username);
      qs.set("window", windowF);
      if (gameType) qs.set("game_type", gameType);
      qs.set("color", c);
      try {
        const res = await fetch(`/api/insights?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) return null;
        const d = (await res.json()) as InsightsResponse;
        return { wins: d.totals.wins, total: d.totals.games };
      } catch {
        return null;
      }
    };
    void Promise.all([fetchColor("w"), fetchColor("b")]).then(([w, b]) => {
      if (cancelled) return;
      setColorData({
        w: w ? { wins: w.wins, total: w.total } : null,
        b: b ? { wins: b.wins, total: b.total } : null,
        loading: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [activeMode, data, username, isSelf, windowF, gameType]);

  const graph = data?.ratingGraph ?? [];
  const graphPts = graph.filter((g) => typeof g.rating === "number");
  const graphLabel = useMemo(() => {
    if (graphPts.length === 0) return "Grafik rating (belum ada data)";
    const first = graphPts[0];
    const last = graphPts[graphPts.length - 1];
    return `Grafik rating ${data?.user.username ?? target}, dari ${first.rating} ke ${last.rating}, ${graphPts.length} partai`;
  }, [graphPts, data, target]);

  const pickMode = (m: ViewMode) => {
    setMode(m);
    setStatusMsg(`Tampilan sekarang: ${MODE_LABEL[m]}.`);
  };
  const pickGameType = (g: GameTypeFilter) => {
    setGameType(g);
    setStatusMsg(g ? `Filter kategori waktu: ${GTYPE_LABEL[g]}.` : "Semua kategori waktu.");
  };
  const pickWindow = (w: WindowFilter) => {
    setWindowF(w);
    setStatusMsg(`Periode: ${WINDOW_LABEL[w]}.`);
  };

  if (pendingAuth) {
    return (
      <InsightShell username={target} isSelf={isSelf} onOpenLeaderboard={onOpenLeaderboard} onOpenArchive={onOpenArchive}>
        <div className="panel p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]" role="status">
          <p className="text-sm font-bold text-neutral-200">Akun menunggu persetujuan admin.</p>
          <p className="text-xs text-neutral-400 mt-1">Insight tampil setelah akun disetujui.</p>
        </div>
      </InsightShell>
    );
  }

  if (notFound) {
    return (
      <InsightShell username={target} isSelf={isSelf} onOpenLeaderboard={onOpenLeaderboard} onOpenArchive={onOpenArchive}>
        <div className="panel p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]" role="alert">
          <p className="text-sm font-bold text-neutral-200">{notFound}</p>
          {isSelf ? (
            <button className="ctl ctl-sm mt-3" onClick={() => void load()}>Coba lagi</button>
          ) : (
            <button className="ctl ctl-sm mt-3" onClick={onOpenLeaderboard}>
              Papan Peringkat
            </button>
          )}
        </div>
      </InsightShell>
    );
  }

  if (loading) {
    return (
      <InsightShell username={target} isSelf={isSelf} onOpenLeaderboard={onOpenLeaderboard} onOpenArchive={onOpenArchive}>
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <span className="text-sm font-bold text-neutral-400 animate-pulse">Menghitung tren…</span>
        </div>
      </InsightShell>
    );
  }

  return (
    <InsightShell username={target} isSelf={isSelf} onOpenLeaderboard={onOpenLeaderboard} onOpenArchive={onOpenArchive}>
      {/* Ringkas kartu: angka sebagai teks berlabel (tanpa badge marketing) */}
      <div className="panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)]" role="status">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Stat label="Partai" value={String(t?.games ?? 0)} />
          <Stat label="Menang" value={String(t?.wins ?? 0)} tone="var(--success)" />
          <Stat label="Kalah" value={String(t?.losses ?? 0)} tone="var(--destructive)" />
          <Stat label="Remis" value={String(t?.draws ?? 0)} />
          <Stat label="Rating" value={data?.user.rating != null ? String(data.user.rating) : "—"} />
          {data?.ratingDelta != null && data.ratingDelta !== 0 && (
            <Stat label="Δ rating" value={`${data.ratingDelta > 0 ? "+" : ""}${data.ratingDelta}`} />
          )}
        </div>
      </div>

      {/* Filter: kategori waktu + periode */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-[var(--card)] p-1 rounded-xl border border-[var(--border)]" role="tablist" aria-label="Jenis partai">
          {(Object.keys(GTYPE_LABEL) as GameTypeFilter[]).map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={gameType === g}
              onClick={() => pickGameType(g)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                gameType === g ? "bg-[var(--primary)] text-white" : "text-neutral-400 hover:text-white"
              }`}
              style={{ transitionDuration: "var(--move-animation-duration)" }}
            >
              {GTYPE_LABEL[g]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[var(--card)] p-1 rounded-xl border border-[var(--border)]" role="tablist" aria-label="Periode">
          {(Object.keys(WINDOW_LABEL) as WindowFilter[]).map((w) => (
            <button
              key={w}
              role="tab"
              aria-selected={windowF === w}
              onClick={() => pickWindow(w)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                windowF === w ? "bg-[var(--primary)] text-white" : "text-neutral-400 hover:text-white"
              }`}
              style={{ transitionDuration: "var(--move-animation-duration)" }}
            >
              {WINDOW_LABEL[w]}
            </button>
          ))}
        </div>
      </div>

      {/* Tampilan: tab hanya yang punya data riil */}
      <div className="flex gap-1 bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] max-w-md" role="tablist" aria-label="Tampilan insight">
        {availableModes.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={activeMode === m}
            onClick={() => pickMode(m)}
            className={`flex-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeMode === m ? "bg-[var(--primary)] text-white" : "text-neutral-400 hover:text-white"
            }`}
            style={{ transitionDuration: "var(--move-animation-duration)" }}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{statusMsg}</p>

      {(t?.games ?? 0) === 0 ? (
        <div className="panel p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]" role="status">
          <p className="text-sm text-neutral-300">
            {isSelf ? "Belum ada partai selesai untuk filter ini." : `@${target} belum punya partai selesai.`}
          </p>
          {(gameType || windowF !== "30") && (
            <button
              className="ctl ctl-sm mt-2"
              onClick={() => {
                setGameType("");
                setWindowF("30");
              }}
            >
              Reset filter
            </button>
          )}
        </div>
      ) : (
        <div className="panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {activeMode === "all" && <AllPane data={data!} target={target} />}
          {activeMode === "warna" && <ColorPane colorData={colorData} totalGames={t?.games ?? 0} />}
          {activeMode === "pemain" && <OpponentsPane data={data!} />}
          {activeMode === "performa" && <PerformaPane data={data!} />}
        </div>
      )}

      {/* Grafik rating: bentuk titik berbeda per hasil (aman color-blind) */}
      {graphPts.length >= 2 && (
        <div className="panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Grafik rating</p>
          <svg
            viewBox="0 0 400 90"
            className="w-full h-20"
            role="img"
            aria-label={graphLabel}
          >
            <RatingLine points={graphPts.map((p) => p.rating!)} />
          </svg>
          {/* Tabel data sr-only — SR tidak harus "melihat" garis */}
          <table className="sr-only">
            <caption>Detail grafik rating {target}</caption>
            <thead>
              <tr>
                <th>Partai</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {graphPts.map((p) => (
                <tr key={p.gameId}>
                  <td>{p.date ?? p.gameId}</td>
                  <td>{p.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </InsightShell>
  );
}

/* ── pane per mode ─────────────────────────────────────────────────────── */

function AllPane({ data, target }: { data: InsightsResponse; target: string }) {
  const byType = Object.entries(data.byType ?? {});
  return (
    <div className="text-xs text-neutral-300 space-y-2">
      <p>
        {data.totals.games} partai periode {WINDOW_LABEL[data.window]}. Win rate{" "}
        {data.totals.winRate != null ? `${Math.round(data.totals.winRate * 100)}%` : "belum cukup data"}.
      </p>
      {byType.length > 0 && (
        <div>
          <p className="font-bold text-neutral-400 uppercase tracking-wide mb-1">Per kategori waktu</p>
          {byType.map(([k, v]) => (
            <p key={k}>
              {BY_TYPE_LABEL[k] ?? k}: {v.wins}M {v.losses}K {v.draws}R ({v.total} partai)
            </p>
          ))}
        </div>
      )}
      {data.recentGames.length === 0 && target !== "kamu" && (
        <p className="text-neutral-500">Detail partai terakhir tersedia saat melihat insight sendiri.</p>
      )}
    </div>
  );
}

function ColorPane({
  colorData,
  totalGames,
}: {
  colorData: {
    w: { wins: number; total: number } | null;
    b: { wins: number; total: number } | null;
    loading: boolean;
  };
  totalGames: number;
}) {
  if (colorData.loading) {
    return <p className="text-xs text-neutral-400" role="status">Menghitung per warna…</p>;
  }
  const pct = (s: { wins: number; total: number } | null) =>
    s && s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
  const w = colorData.w;
  const b = colorData.b;
  if (!w && !b) {
    return <p className="text-xs text-neutral-500">Belum ada partai untuk filter ini.</p>;
  }
  return (
    <div className="text-xs text-neutral-300 space-y-1.5" role="status" aria-live="polite">
      <p>
        Putih {pct(w)}% menang ({w?.total ?? 0} partai) · Hitam {pct(b)}% menang ({b?.total ?? 0} partai)
      </p>
      <p className="text-neutral-500">Total {totalGames} partai dalam filter — angka per warna riil dari server.</p>
    </div>
  );
}

function OpponentsPane({ data }: { data: InsightsResponse }) {
  const map = new Map<string, { w: number; l: number; d: number; n: number; rating: number | null }>();
  for (const g of data.recentGames) {
    const u = g.opponent.username;
    const cur = map.get(u) ?? { w: 0, l: 0, d: 0, n: 0, rating: g.opponent.rating || null };
    cur.n += 1;
    if (g.myResult === "win") cur.w += 1;
    else if (g.myResult === "loss") cur.l += 1;
    else cur.d += 1;
    map.set(u, cur);
  }
  const rows = [...map.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  if (rows.length === 0) {
    return <p className="text-xs text-neutral-500">Belum ada partai untuk filter ini.</p>;
  }
  return (
    <div className="space-y-1.5">
      {rows.map(([u, s]) => (
        <p key={u} className="text-xs text-neutral-300">
          @{u}
          {s.rating != null ? ` (${s.rating})` : ""} — {s.w}M {s.l}K {s.d}R ({s.n} partai)
        </p>
      ))}
    </div>
  );
}

function PerformaPane({ data }: { data: InsightsResponse }) {
  const last10 = data.recentGames.slice(0, 10);
  if (last10.length === 0) {
    return <p className="text-xs text-neutral-500">Belum ada partai untuk filter ini.</p>;
  }
  return (
    <div className="text-xs text-neutral-300 space-y-1.5">
      <p className="font-bold text-neutral-400 uppercase tracking-wide">10 partai terakhir</p>
      <div className="flex flex-wrap gap-1.5">
        {last10.map((g) => (
          <span
            key={g.id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] font-mono font-bold"
          >
            {RESULT_ICON[g.myResult]}
            <span className="sr-only">
              {g.myResult === "win" ? "Menang" : g.myResult === "loss" ? "Kalah" : "Remis"} vs @{g.opponent.username}
            </span>
          </span>
        ))}
      </div>
      <p className="text-neutral-500">
        {last10.filter((g) => g.myResult === "win").length} Menang ·{" "}
        {last10.filter((g) => g.myResult === "loss").length} Kalah ·{" "}
        {last10.filter((g) => g.myResult === "draw").length} Remis
      </p>
    </div>
  );
}

/* ── shell + util ─────────────────────────────────────────────────────── */

function InsightShell({
  username,
  isSelf,
  onOpenLeaderboard,
  onOpenArchive,
  children,
}: {
  username: string;
  isSelf: boolean;
  onOpenLeaderboard?: () => void;
  onOpenArchive?: () => void;
  children: React.ReactNode;
}) {
  return (
    /* S8 Pola C (spec §3): .view-root + .view-head 44px (judul + shortcut, aksen
       --nav-accent-social section Statistik/Insight) + .view-cols: konten
       detail .view-body kiri + sidebar meta .view-body kanan (angka ringkas +
       grafik rating — 2 column detail). Filter/tablist stay di head. */
    <div className="view-root w-full max-w-4xl mx-auto">
      <div className="view-head flex items-center justify-between gap-2 shrink-0 px-1" style={{ borderLeft: "3px solid var(--nav-accent-social)" }}>
        <div className="flex items-center gap-2">
          <LineChart size={18} className="text-[var(--primary)]" aria-hidden="true" />
          <h2 className="text-sm font-black text-white m-0">
            Insight: {isSelf ? "Kamu" : `@${username}`}
          </h2>
        </div>
        <div className="flex gap-1.5">
          <button className="ctl ctl-xs inline-flex items-center gap-1" onClick={onOpenLeaderboard}>
            <Trophy size={13} aria-hidden="true" />
            Papan Peringkat
          </button>
          <button className="ctl ctl-xs inline-flex items-center gap-1" onClick={onOpenArchive}>
            <History size={13} aria-hidden="true" />
            Arsip
          </button>
        </div>
      </div>
      <div className="view-body space-y-3 min-h-0 pb-2" style={{ scrollbarWidth: "thin" }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-base font-black text-white tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      <span className="text-[10px] text-neutral-400">{label}</span>
    </div>
  );
}

/** SVG satu garis stroke --accent + titik per hasil (bentuk berbeda, aman
 *  color-blind): titik kecil seragam, tanpa area-fill. */
function RatingLine({ points }: { points: number[] }) {
  const W = 400;
  const H = 90;
  const pad = 8;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <g>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
      {points.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill="var(--accent)" opacity={0.85} />
      ))}
    </g>
  );
}

const GTYPE_LABEL: Record<GameTypeFilter, string> = {
  "": "Semua",
  bullet: "Kilat",
  blitz: "Blitz",
  rapid: "Rapid",
};
const WINDOW_LABEL: Record<WindowFilter, string> = {
  "30": "30 hari",
  "90": "90 hari",
  "365": "1 tahun",
  all: "Semua",
};
const MODE_LABEL: Record<ViewMode, string> = {
  all: "Semua",
  warna: "Warna",
  pemain: "Pemain",
  performa: "Performa",
};
