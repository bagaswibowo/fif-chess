/**
 * components/views/missed-puzzles-view.tsx (W2 — tab Koreksi)
 * Review kesalahan: daftar puzzle gagal dari GET /api/puzzles/missed
 * (puzzle_attempts correct=false, unik, window 7-30 hari). Klik item →
 * solve mode PuzzleSolver (kontrak sama dgn view lain); solved di sini
 * (attempt correct=true via submitAttempt standar) menghapus puzzle dari
 * daftar. Guest → StateMessage rapi + CTA masuk (401), bukan error kasar.
 * Auth error via authErrorText (FIX-1: 401/403/503 semantics).
 */
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { useCallback, useEffect, useState } from "react";
import { PuzzleSolver } from "@/components/puzzle-solver";
import { Button } from "@/components/ui/button";
import type { PuzzleDto } from "@/lib/puzzle-solve";

type MissedItem = PuzzleDto & { lastFailedAt?: string | null };

type HintPayload = { from: string; to?: string; direction?: { files: number; ranks: number } } | null;

export function MissedPuzzlesView({ lang = "id" }: { lang?: "id" | "en" }) {
  const [items, setItems] = useState<MissedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [active, setActive] = useState<MissedItem | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMissed = useCallback(async (): Promise<MissedItem[]> => {
    try {
      const res = await fetch("/api/puzzles/missed", { cache: "no-store" });
      if (res.status === 401) {
        setGuest(true);
        setError(null);
        return [];
      }
      if (!res.ok) {
        setGuest(false);
        setError(authErrorText(res.status, await authErrorPayload(res), "daftar koreksi"));
        return [];
      }
      setGuest(false);
      setError(null);
      const data = await res.json();
      setStreak(typeof data.streak === "number" ? data.streak : 0);
      return (Array.isArray(data.missed) ? data.missed : []) as MissedItem[];
    } catch {
      setError("Gagal memuat daftar koreksi.");
      return [];
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await loadMissed();
    setItems(next);
    setLoading(false);
  }, [loadMissed]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHint = useCallback(
    async (level: 1 | 2 | 3, moveIndex: number): Promise<HintPayload> => {
      if (!active) return null;
      try {
        const res = await fetch(`/api/puzzles/${active.id}/hint?level=${level}&moveIndex=${moveIndex}`, { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        return (data.hint as HintPayload) ?? null;
      } catch {
        return null;
      }
    },
    [active],
  );

  // Attempt standar (POST /api/puzzles/[id]/attempt) — solved menghapus dari daftar.
  const submitAttempt = useCallback(
    async (p: { correct: boolean; timeSpentSec: number }): Promise<number | null> => {
      if (!active) return null;
      try {
        const res = await fetch(`/api/puzzles/${active.id}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correct: p.correct, time_spent_sec: p.timeSpentSec }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data.streak === "number") setStreak(data.streak);
        return data.streak ?? null;
      } catch {
        return null;
      }
    },
    [active],
  );

  // ===== Solve mode =====
  if (active) {
    // S8 Pola A (spec §3): .view-head 44px (judul koreksi + kembali, aksen
    // --nav-accent-puzzle) + .view-grid-board (PuzzleSolver papan kiri ≤540px
    // + panel .view-body scroll internal kanan).
    return (
      <div className="view-root w-full min-h-0">
        <div className="view-head flex items-center justify-between gap-2 shrink-0 px-1">
          <h2 className="text-sm font-black text-white truncate m-0">
            Koreksi: {active.title || "Teka-teki"}
            <span className="ml-2 text-xs font-bold text-neutral-400">Rating {active.rating}</span>
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActive(null);
              void refresh();
            }}
            aria-label="Kembali ke daftar koreksi"
          >
            Kembali
          </Button>
        </div>
        <div className="view-grid-board flex-1 min-h-0 mt-1.5">
          <div className="min-h-0">
            <PuzzleSolver
              lang={lang}
              puzzle={active}
              loading={loading}
              initialStreak={streak}
              fetchHint={fetchHint}
              submitAttempt={submitAttempt}
              onSolved={() => void refresh()}
            />
          </div>
          <div className="view-body pr-1 custom-scrollbar min-h-0" />
        </div>
      </div>
    );
  }

  // ===== Guest fallback rapi (bukan error kasar) =====
  if (guest) {
    return (
      <div className="view-root w-full max-w-xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0">
          <h2 className="text-sm font-black text-white m-0">Koreksi Teka-Teki</h2>
        </div>
        <div className="view-body flex flex-col items-center gap-3 py-10 text-center" style={{ scrollbarWidth: "thin" }}>
          <p className="text-sm text-neutral-400">
            Masuk untuk melihat daftar teka-teki yang pernah gagal Anda kerjakan.
          </p>
          <Button
            onClick={() => (window.location.hash = "#/auth")}
          >
            Masuk
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-root w-full max-w-2xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0">
          <h2 className="text-sm font-black text-white m-0">Koreksi</h2>
        </div>
        <div className="view-body flex flex-col items-center gap-3 py-10" role="status" aria-live="polite" style={{ scrollbarWidth: "thin" }}>
          <p className="text-sm text-neutral-300">{error}</p>
          <Button variant="outline" onClick={() => void refresh()}>Coba Lagi</Button>
        </div>
      </div>
    );
  }

  if (!items || loading) {
    return (
      <div className="view-root w-full max-w-2xl mx-auto">
        <div className="view-head flex items-center gap-2 shrink-0">
          <h2 className="text-sm font-black text-white m-0">Koreksi</h2>
        </div>
        <div className="view-body flex items-center justify-center py-16" role="status" aria-live="polite">
          <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat daftar koreksi…</span>
        </div>
      </div>
    );
  }

  // ===== Daftar — S8 Pola B (spec §3): .view-head 44px + .view-body list =====
  return (
    <div className="view-root w-full max-w-3xl mx-auto">
      <div className="view-head flex items-center justify-between gap-2 flex-wrap shrink-0 px-1">
        <h2 className="text-sm font-black text-white m-0">Koreksi</h2>
        <p className="text-xs font-bold text-neutral-400 m-0">
          {items.length === 0
            ? "Tidak ada teka-teki yang perlu dikoreksi — mantap."
            : `${items.length} teka-teki gagal 30 hari terakhir — klik untuk mengulang.`}
        </p>
      </div>
      <div className="view-body space-y-3 pb-4" style={{ scrollbarWidth: "thin" }}>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center" role="status">
            <p className="text-sm font-bold text-neutral-300">
              Belum ada teka-teki gagal dalam 30 hari terakhir.
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Teka-teki yang salah akan muncul di sini untuk diulang.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Daftar teka-teki gagal">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setActive(m)}
                  className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 flex items-center justify-between gap-3 hover:border-[var(--primary)] transition-colors"
                  aria-label={`Ulangi teka-teki ${m.title || m.id}, rating ${m.rating}`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-white truncate">
                      {m.title || "Teka-teki"} <span aria-hidden="true">✕</span>
                    </span>
                    <span className="text-xs text-neutral-400 truncate">
                      Rating {m.rating} · {m.moveCount} langkah
                      {m.themes[0] ? ` · ${m.themes[0]}` : ""}
                      {m.lastFailedAt ? ` · gagal ${new Date(String(m.lastFailedAt)).toLocaleDateString("id-ID")}` : ""}
                    </span>
                  </span>
                  <span className="text-xs font-black text-[var(--primary)] shrink-0">Ulangi →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
