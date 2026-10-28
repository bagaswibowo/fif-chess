"use client";

/**
 * components/views/tournaments-view.tsx (S6-T5 — docs/design/sprint6-flows.md §5)
 * Arena Turnamen di hash #/tournaments.
 *
 * Kontrak (docs/contracts/sprint6.md §1.5, ADR-009 D5):
 * - GET /api/tournament (publik) → { arenas: TournamentArena[] }.
 * - POST /api/tournament/[id] (join, body { user } opsional) → 201 ok.
 * - GET /api/tournament/[id] → detail arena + entrants.
 * - WS NEW TournamentUpdated (topic tournamentTopic(id)) — update live
 *   status/entrants di view detail tanpa polling.
 * Semua angka (kuota, status, start) RIIL dari endpoint — no-mock.
 * Kartu arena = baris scannable (bukan card besar ber-gradasi), CTA "Daftar"
 * terpisah dari link detail (anti nested interactive). Status penuh = teks
 * "Penuh", bukan tombol mati.
 * A11y: countdown teks di live region (throttle 5 dtk), tabel papan hasil
 * ber-caption sr-only, status selalu teks eksplisit.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy, Timer, Users, ArrowLeft, CircleSlash, Clock } from "lucide-react";
import { useRealtime } from "@/lib/use-realtime";
import { tournamentTopic, type TournamentUpdated } from "@/lib/realtime/events";
import type { TournamentArena, TournamentPlayer, TournamentStatus } from "@/lib/tournament-types";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

type Props = {
  username?: string; // username sesi ("" = guest)
};

export function TournamentsView({ username = "" }: Props) {
  const [arenas, setArenas] = useState<TournamentArena[] | null>(null);
  const [active, setActive] = useState<TournamentArena | null>(null);
  const [entrants, setEntrants] = useState<TournamentPlayer[] | null>(null);
  const [filter, setFilter] = useState<"semua" | "tersedia">("semua");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinBusy, setJoinBusy] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [authNote, setAuthNote] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tournament", { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(res.status === 503 ? "Server sedang sibuk." : d?.error ?? "Gagal memuat arena. Coba lagi.");
        return;
      }
      const d = (await res.json()) as { arenas?: TournamentArena[] };
      setArenas(d.arenas ?? []);
    } catch {
      setError("Gagal memuat arena. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Buka detail arena + muat entrants (bootstrap GET /api/tournament/[id]).
  const openArena = useCallback((a: TournamentArena) => {
    setEntrants(null);
    setActive(a);
    void (async () => {
      try {
        const res = await fetch(`/api/tournament/${encodeURIComponent(a.id)}`, { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { arena?: TournamentArena; entrants?: TournamentPlayer[] };
        if (d.arena) setActive(d.arena);
        if (d.entrants) setEntrants(d.entrants);
      } catch {
        /* detail fallback: pakai data list */
      }
    })();
  }, []);

  const join = useCallback(
    async (a: TournamentArena) => {
      if (joined.has(a.id)) {
        // Berhenti daftar (DELETE tidak ada di kontrak S6 — join op = insert
        // tournament_players; "Berhenti daftar" didefer: tampilkan status).
        setAuthNote("Batal daftar belum tersedia di sprint ini.");
        return;
      }
      if (!username) {
        setAuthNote("Masuk untuk daftar.");
        return;
      }
      setJoinBusy(a.id);
      setAuthNote(null);
      try {
        const res = await fetch(`/api/tournament/${encodeURIComponent(a.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) setAuthNote("Masuk untuk daftar.");
          else if (res.status === 403 && d?.code === "capacity") setAuthNote("Arena penuh — coba yang lain.");
          else if (res.status === 403) setAuthNote("Akun menunggu persetujuan admin.");
          else if (res.status === 404) setAuthNote("Arena sudah mulai atau selesai.");
          else setAuthNote(d?.error ?? "Gagal mendaftar. Coba lagi.");
          return;
        }
        setJoined((s) => new Set(s).add(a.id));
        setToast(`Terdaftar di ${a.name}.`);
      } catch {
        setAuthNote("Gagal mendaftar. Coba lagi.");
      } finally {
        setJoinBusy(null);
      }
    },
    [joined, username],
  );

  // WS live update arena aktif (D5: TournamentUpdated ke topic tournament/<id>).
  useRealtime({
    topics: active ? [tournamentTopic(active.id)] : [],
    enabled: Boolean(active),
    onEvent: (ev) => {
      const t = ev as TournamentUpdated;
      if (t.type !== "tournament_updated") return;
      setArenas((list) => (list ? list.map((a) => (a.id === t.tournamentId ? { ...a, status: t.status, entrants: t.entrants } : a)) : list));
      setActive((cur) => (cur && cur.id === t.tournamentId ? { ...cur, status: t.status, entrants: t.entrants } : cur));
      if (active && active.id === t.tournamentId) {
        setToast(`Status arena diperbarui: ${STATUS_LABEL[t.status]} (${t.entrants} peserta).`);
      }
    },
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = useMemo(() => {
    if (!arenas) return [];
    if (filter === "tersedia") return arenas.filter((a) => a.status === "registration" && a.entrants < a.capacity);
    return arenas;
  }, [arenas, filter]);

  if (active) {
    return (
      <ArenaDetail
        arena={active}
        entrants={entrants}
        isSelf={joined.has(active.id)}
        onBack={() => {
          setActive(null);
          setEntrants(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="view-root w-full max-w-3xl mx-auto">
      <div className="view-head flex items-center gap-2 shrink-0 flex-wrap">
        <Trophy size={18} className="text-[var(--nav-accent-play)] shrink-0" aria-hidden="true" />
        <h1 className="text-sm font-black text-white leading-tight shrink-0">Turnamen</h1>
        <div className="flex-1" aria-hidden="true" />
        <div className="flex gap-1 bg-[var(--card)] p-0.5 rounded-lg border border-[var(--border)] shrink-0" role="tablist" aria-label="Filter arena">
          <FilterChip active={filter === "semua"} onClick={() => setFilter("semua")} label="Semua" />
          <FilterChip active={filter === "tersedia"} onClick={() => setFilter("tersedia")} label="Tersedia" />
        </div>
      </div>

      <div className="view-body" style={{ scrollbarWidth: "thin" }}>
        {toast && (
          <p className="text-xs font-bold text-[var(--nav-accent-play)]" role="status" aria-live="polite">
            {toast}
          </p>
        )}
        {authNote && (
          <ErrorState message={authNote} className="py-3" />
        )}

        {error && (
          <ErrorState
            message={error}
            ctx="arena turnamen"
            onRetry={() => void load()}
            className="panel rounded-2xl border bg-[var(--card)] p-3"
          />
        )}

        {loading && !error && (
          <LoadingState label="Mengambil arena…" skeleton="grid" className="items-stretch self-stretch" />
        )}

        {!loading && !error && visible.length === 0 && (
          <EmptyState
            title={filter === "tersedia" ? "Tidak ada arena tersedia saat ini." : "Belum ada turnamen terjadwal."}
          />
        )}

        <div className="flex flex-col gap-1.5">
          {visible.map((a) => (
            <ArenaCard
              key={a.id}
              arena={a}
              isSelf={joined.has(a.id)}
              joinBusy={joinBusy === a.id}
              hasUser={Boolean(username)}
              onOpen={() => openArena(a)}
              onJoin={() => void join(a)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── kartu arena (baris scannable — info kritis 1 baris, CTA terpisah) ── */

function ArenaCard({
  arena,
  isSelf,
  joinBusy,
  hasUser,
  onOpen,
  onJoin,
}: {
  arena: TournamentArena;
  isSelf: boolean;
  joinBusy: boolean;
  hasUser: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const full = arena.entrants >= arena.capacity;
  const startLabel = formatStartAt(arena.startAt);
  const statusText = isSelf ? "Terdaftar" : full ? "Penuh" : arena.status === "registration" ? "Pendaftaran terbuka" : STATUS_LABEL[arena.status];
  // Baris scannable ≤44px: info kritis 1 baris + subbaris, CTA terpisah.
  return (
    <div className="panel rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 flex items-center gap-3 min-h-[44px]">
      <button
        onClick={onOpen}
        className="text-left min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        aria-label={`Buka detail arena ${arena.name}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Timer size={14} className="text-[var(--nav-accent-play)] shrink-0" aria-hidden="true" />
          <span className="text-sm font-black text-white truncate">
            {arena.timeControl} {arena.rated ? "(Terbuka)" : "(Casual)"}
          </span>
          <span className="text-xs text-neutral-300 truncate shrink-0">"{arena.name}"</span>
        </div>
        <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
          <span className="inline-flex items-center gap-1">
            <Users size={10} aria-hidden="true" /> Daftar: {arena.entrants}/{arena.capacity}
          </span>
          {" · "}
          <span className="inline-flex items-center gap-1">
            <Clock size={10} aria-hidden="true" /> Mulai: {startLabel}
          </span>
        </p>
      </button>
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-neutral-400">{statusText}</span>
        {(arena.status === "registration" && !full && !isSelf && (
          <button
            className="ctl ctl-xs ctl-primary"
            onClick={onJoin}
            disabled={joinBusy}
            aria-label={hasUser ? `Daftar arena ${arena.name}` : "Masuk untuk daftar"}
          >
            {joinBusy ? "…" : hasUser ? "Daftar" : "Masuk untuk daftar"}
          </button>
        ))}
        {full && !isSelf && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--warning)" }}>
            <CircleSlash size={12} aria-hidden="true" /> Penuh
          </span>
        )}
        {isSelf && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--success)" }}>
            Terdaftar
          </span>
        )}
      </div>
    </div>
  );
}

/* ── view detail arena + entrants + WS live ───────────────────────────── */

function ArenaDetail({
  arena,
  entrants,
  isSelf,
  onBack,
}: {
  arena: TournamentArena;
  entrants: TournamentPlayer[] | null;
  isSelf: boolean;
  onBack: () => void;
}) {
  const [countdown, setCountdown] = useState<string>("");
  const startAt = arena.startAt;

  // Countdown teks: throttle 5 detik di live region (a11y §5.5 — tidak spam
  // screen reader; ticker visual opsional dimatikan di reduced-motion).
  useEffect(() => {
    if (arena.status !== "registration") {
      setCountdown("");
      return;
    }
    const tick = () => {
      const ms = startAt - Date.now();
      if (ms <= 0) {
        setCountdown("Mulai segera");
        return;
      }
      const s = Math.ceil(ms / 1000);
      setCountdown(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => clearInterval(iv);
  }, [arena.status, startAt]);

  const startLabel = formatStartAt(startAt);
  // S8: Pola C — detail 2-kolom: konten utama .view-body + sidebar meta .view-body.
  return (
    <div className="view-root w-full max-w-5xl mx-auto">
      <div className="view-head flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Trophy size={20} className="text-[var(--nav-accent-play)] shrink-0" aria-hidden="true" />
          <h1 className="text-sm font-black text-white truncate">{arena.name}</h1>
          <span className="text-xs text-neutral-400 shrink-0">{arena.timeControl}</span>
        </div>
        <button className="ctl ctl-xs inline-flex items-center gap-1" onClick={onBack}>
          <ArrowLeft size={13} aria-hidden="true" />
          Keluar arena
        </button>
      </div>

      <div className="view-cols">
        {/* Kolom utama: papan peserta + WS live */}
        <div className="view-body" style={{ scrollbarWidth: "thin" }}>
          <div className="panel p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Peserta</p>
            {entrants === null ? (
              <p className="text-xs text-neutral-400 mt-2" role="status">Memuat peserta…</p>
            ) : entrants.length === 0 ? (
              <p className="text-xs text-neutral-400 mt-2" role="status">
                Belum ada peserta terdaftar.
              </p>
            ) : (
              <table className="w-full mt-2 text-xs" role="table">
                <caption className="sr-only">Peserta {arena.name}</caption>
                <thead>
                  <tr className="text-left text-neutral-400">
                    <th scope="col" className="pb-1.5 font-bold">Pemain</th>
                    <th scope="col" className="pb-1.5 font-bold text-right">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {entrants.map((p) => (
                    <tr key={p.username} className="border-t border-[var(--border)]">
                      <td className="py-1.5 text-neutral-200 font-bold">@{p.username}</td>
                      <td className="py-1.5 text-right text-neutral-400 tabular-nums">{p.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Kolom meta: status arena (countdown live) */}
        <div className="view-body" style={{ scrollbarWidth: "thin" }}>
          {/* Status arena — teks eksplisit (bukan chip warna saja) */}
          <div className="panel p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Status</p>
            <p className="text-sm text-neutral-200 mt-1" role="status" aria-live="polite">
              {STATUS_LABEL[arena.status]} · Daftar: {arena.entrants}/{arena.capacity} · Mulai: {startLabel}
            </p>
            {arena.status === "registration" && countdown && (
              <p className="text-xs text-neutral-400 mt-1" role="status" aria-live="polite">
                Menunggu mulai berikutnya: {countdown}
              </p>
            )}
            {isSelf ? (
              <p className="text-xs font-bold mt-2" style={{ color: "var(--success)" }}>
                Kamu terdaftar di arena ini.
              </p>
            ) : arena.status === "registration" ? (
              <p className="text-xs text-neutral-400 mt-2">
                {arena.entrants >= arena.capacity ? "Arena penuh — coba yang lain." : "Matching otomatis saat start tiba."}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── util ─────────────────────────────────────────────────────────────── */

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition-colors ${
        active ? "bg-[var(--nav-accent-play)] text-black" : "text-neutral-400 hover:text-white"
      }`}
      style={{ transitionDuration: "var(--move-animation-duration)" }}
    >
      {label}
    </button>
  );
}

function formatStartAt(ts: number): string {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

const STATUS_LABEL: Record<TournamentStatus, string> = {
  registration: "Pendaftaran terbuka",
  live: "Berlangsung",
  finished: "Selesai",
};
