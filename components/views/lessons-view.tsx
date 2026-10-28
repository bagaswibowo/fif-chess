"use client";

/**
 * components/views/lessons-view.tsx (S7-T2 frontend, ADR-010 D2/D3)
 * Katalog pelajaran di hash #/learn (navTab "learn" baru — tidak mengganti
 * "vision"). Upgrade view "Materi Belajar": tambah seksi tab "Pelajaran".
 * Konten = lib/lessons.ts (modul kurasi statis, pola learning-hub). Bookmark
 * + lesson completion dari /api/learn/bookmarks (file store, REUSE pattern
 * users.json) — tidak dari localStorage (ADR D2). Guest/pending: katalog
 * tetap tampil, aksi tulis login-wall (design §0.3/§2.4).
 *
 * Detail routing: prop `detail` dari game.tsx onHash:
 *   null → katalog; "lesson:<id>" → LessonDetail; "openings:<eco>" →
 *   OpeningsLessonsView (3-mode ADR D3). Cross-link Explorer "Materi" →
 *   #/learn/openings/{eco}.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, NotebookText, Search, Star } from "lucide-react";
import { LESSONS, lessonById, type Lesson } from "@/lib/lessons";
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import type { CoursesAuthStatus } from "./courses-view";
import { OpeningsLessonsView } from "./openings-view";
import { LessonDetail } from "./lessons-detail";

type ModuleKey = "all" | Lesson["module"];

const MODULES: { id: ModuleKey; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "tactics", label: "Taktik" },
  { id: "openings", label: "Pembukaan" },
  { id: "endgames", label: "Akhir" },
  { id: "rules", label: "Aturan" },
];

export function LessonsView({
  authStatus,
  onNavigate,
  detail,
  initialModule,
}: {
  authStatus: CoursesAuthStatus;
  onNavigate: (hash: string) => void;
  /** "lesson:<id>" | "openings:<eco>" | null (null = katalog). */
  detail: string | null;
  /** S7-T3 → #/learn?cat=<modul>: filter katalog awal (chip praktik hub §3.2). */
  initialModule?: string | null;
}) {
  // Routing: opening sub-view & lesson detail (deep-link #/learn/... via onHash).
  const openingsEco = detail?.startsWith("openings:") ? detail.slice("openings:".length) : null;
  const lessonId = detail?.startsWith("lesson:") ? detail.slice("lesson:".length) : null;

  if (openingsEco) {
    return <OpeningsLessonsView eco={openingsEco} authStatus={authStatus} onNavigate={onNavigate} />;
  }
  if (lessonId) {
    return (
      <LessonDetail
        lesson={lessonById(lessonId)}
        authStatus={authStatus}
        onNavigate={onNavigate}
      />
    );
  }
  return <LessonCatalog authStatus={authStatus} onNavigate={onNavigate} initialModule={initialModule} />;
}

/* ── Katalog: tab "Pelajaran" + chip filter modul + list baris (pola S6-T5) ── */
function LessonCatalog({ authStatus, onNavigate, initialModule }: { authStatus: CoursesAuthStatus; onNavigate: (hash: string) => void; initialModule?: string | null }) {
  const [module, setModule] = useState<ModuleKey>(
    initialModule && initialModule !== "all" && initialModule !== "" ? (initialModule as ModuleKey) : "all",
  );
  const [query, setQuery] = useState("");
  const [bookmarks, setBookmarks] = useState<string[] | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [bkError, setBkError] = useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);

  // Bootstrap bookmark/completion (file store). Guest/pending = daftar tetap
  // tampil; state bookmark kosong + CTA login-wall (design §2.4).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/learn/bookmarks", { cache: "no-store" });
        if (!res.ok) {
          if (alive) {
            setBkError(authErrorText(res.status, await authErrorPayload(res), "pelajaran"));
            setBookmarks([]);
          }
          return;
        }
        const data = await res.json();
        if (!alive) return;
        setBookmarks(Array.isArray(data.bookmarks) ? data.bookmarks : []);
        setCompleted(Array.isArray(data.lessonsCompleted) ? data.lessonsCompleted : []);
      } catch {
        if (alive) {
          setBkError("Gagal memuat bookmark. Coba lagi.");
          setBookmarks([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggleBookmark = useCallback(
    async (lessonId: string, on: boolean) => {
      setToggleBusy(lessonId);
      try {
        const res = await fetch("/api/learn/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: lessonId, kind: "lesson", on }),
        });
        if (!res.ok) {
          setBkError(authErrorText(res.status, await authErrorPayload(res), "bookmark"));
          setBookmarks([]);
          return;
        }
        const data = await res.json();
        setBookmarks(Array.isArray(data.bookmarks) ? data.bookmarks : []);
        setCompleted(Array.isArray(data.lessonsCompleted) ? data.lessonsCompleted : []);
        setBkError(null);
      } catch {
        setBkError("Gagal memperbarui bookmark.");
      } finally {
        setToggleBusy(null);
      }
    },
    [],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LESSONS.filter((l) => {
      if (module !== "all" && l.module !== module) return false;
      if (q && !l.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [module, query]);

  const isBookmarked = (id: string) => (bookmarks ?? []).includes(id);
  const isCompleted = (id: string) => completed.includes(id);

  const authNote =
    authStatus === "guest"
      ? "Masuk untuk menyimpan pelajaran"
      : authStatus === "pending"
        ? "Akun menunggu persetujuan admin — bookmark tampil setelah disetujui."
        : null;

  return (
    <div className="view-root w-full max-w-4xl mx-auto">
      <div className="view-head flex items-center gap-2 shrink-0 flex-wrap">
        <NotebookText size={18} className="text-[var(--nav-accent-learn)] shrink-0" aria-hidden="true" />
        <h1 className="text-sm font-black text-white leading-tight shrink-0">Pelajaran</h1>
        <div className="flex-1" aria-hidden="true" />
        <div className="flex flex-wrap gap-1 shrink-0" role="group" aria-label="Filter kategori pelajaran">
          {MODULES.map((m) => {
            const active = module === m.id;
            const count = m.id === "all" ? LESSONS.length : LESSONS.filter((l) => l.module === m.id).length;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => setModule(m.id)}
                className={`ctl ctl-xs ctl-choice ${active ? "ctl-active" : ""}`}
              >
                {m.label}
                <span className="ml-1 text-[10px] text-neutral-500 tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
          <input
            className="field pl-8 py-1"
            placeholder="Cari materi…"
            aria-label="Cari pelajaran"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="view-body" style={{ scrollbarWidth: "thin" }}>
        {(authNote || bkError) && (
          <p role="status" className="text-xs font-bold text-neutral-400 py-1">
            {bkError ?? authNote}
          </p>
        )}

        <p className="sr-only" role="status" aria-live="polite">
          {list.length} pelajaran untuk {MODULES.find((m) => m.id === module)?.label ?? "semua"}
        </p>

        {/* List 1 kolom — lesson = bacaan, bukan grid scan (design §2.2).
            Baris ≤44px (S8 Pola B). */}
        {list.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
            <p className="text-sm font-bold text-neutral-300">Belum ada materi di kategori ini.</p>
            {module !== "all" && (
              <button className="ctl ctl-sm mt-2" onClick={() => setModule("all")}>
                Tampilkan semua
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" role="list" aria-label="Daftar pelajaran">
            {list.map((l) => {
              const marked = isBookmarked(l.id);
              const done = isCompleted(l.id);
              const busy = toggleBusy === l.id;
              return (
                <div
                  key={l.id}
                  role="listitem"
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 flex items-center gap-3 hover:border-[var(--nav-accent-learn)] transition-all duration-[var(--move-animation-duration)] min-h-[44px]"
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                    onClick={() => onNavigate(`#/learn/${l.id}`)}
                    aria-label={`Buka pelajaran ${l.title}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-sm font-black text-white truncate">{l.title}</h2>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 border border-[var(--border)] rounded px-1.5 py-0.5 shrink-0">
                        {l.module}
                      </span>
                      {done && (
                        <span className="text-[10px] font-bold text-[var(--nav-accent-learn)] shrink-0">Selesai ✓</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">{l.openingEco ? `${l.openingEco} · ` : ""}Materi tertulis — tanpa video.</p>
                  </button>
                  <button
                    type="button"
                    aria-pressed={marked}
                    aria-label={`Pelajaran ${l.title}, ${marked ? "tersimpan" : "belum disimpan"}`}
                    onClick={() => void toggleBookmark(l.id, !marked)}
                    disabled={busy}
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--nav-accent-learn)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] shrink-0"
                  >
                    <Star size={16} className={marked ? "text-[var(--nav-accent-learn)] fill-[var(--nav-accent-learn)]" : "text-neutral-400"} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
