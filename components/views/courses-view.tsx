"use client";

/**
 * components/views/courses-view.tsx (S7-T1 frontend)
 * Kursus di hash #/courses + detail #/courses/{id} (deep-link via onHash
 * game.tsx, prop courseDeepLinkId). Kontrak docs/contracts/sprint7.md §1.1:
 * GET /api/courses → { courses } (progress riil server; guest/pending →
 * progressPct null → UI "—"); GET /api/courses/{id} → { course, progress }.
 * Konten course dari lib/courses.ts (modul kurasi statis — pola
 * learning-hub, bukan fetch). Step domain routing (ADR D1):
 * puzzleTheme → Latihan Tema (puzzles?tab=themes), drillSet → drills,
 * opening → pelajaran pembukaan (#/learn/openings/{eco}), lesson → lesson.
 * Kartu/CTA mem-follow pola endgame-drills-view (baris-info, progress bar
 * role=progressbar, CTA Mulai/Lanjut/Ulangi) — tanpa fork komponen.
 */

import { useCallback, useEffect, useState } from "react";
import { Library, ChevronLeft, ChevronRight, Check, ArrowRight, Loader2 } from "lucide-react";
import { COURSES, courseById, type Course, type CourseStep } from "@/lib/courses";
import type { CourseProgress } from "./learn-shared";
import { authErrorPayload, authErrorText } from "@/lib/use-session";

export type CoursesAuthStatus = "guest" | "pending" | "approved" | null;

type CourseSummary = {
  id: string;
  title: string;
  progressPct: number | null;
  doneCount?: number | null;
};

function courseSummaryProgress(c: Course, summary?: CourseSummary): number | null {
  if (summary && typeof summary.progressPct === "number") return summary.progressPct;
  // Tanpa endpoint (belum ada backend / respons tak membawa progress) =
  // tidak ada angka riil → "—" (no-mock: jangan angka 0 yang menyamar).
  void c;
  return null;
}

export function CoursesView({
  authStatus,
  onNavigate,
  courseDeepLinkId,
}: {
  /** null = belum diketahui; "guest" / "pending" / "approved". */
  authStatus: CoursesAuthStatus;
  onNavigate: (hash: string) => void;
  /** Detail deep-link #/courses/{id} (diparse game.tsx dari hash). */
  courseDeepLinkId?: string | null;
}) {
  const [summaries, setSummaries] = useState<CourseSummary[] | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ course: Course; progress: CourseProgress | null; error: string | null } | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  // ── Detail mode: #/courses/{id} ──
  const openDetail = useCallback((id: string) => onNavigate(`#/courses/${id}`), [onNavigate]);

  useEffect(() => {
    if (!courseDeepLinkId) {
      setDetail(null);
      return;
    }
    const course = courseById(courseDeepLinkId);
    if (!course) {
      // 404 course tak dikenal — copy jujur, bukan CTA ke halaman kosong.
      setDetail({ course: COURSES[0], progress: null, error: "Kursus tidak ditemukan." });
      return;
    }
    let alive = true;
    setDetail({ course, progress: null, error: null });
    setStepIndex(0);
    (async () => {
      try {
        const res = await fetch(`/api/courses/${encodeURIComponent(courseDeepLinkId)}`, { cache: "no-store" });
        if (!res.ok) {
          if (!alive) return;
          setDetail({ course, progress: null, error: authErrorText(res.status, await authErrorPayload(res), "kursus") });
          return;
        }
        const data = await res.json();
        if (!alive) return;
        setDetail({ course, progress: (data.progress as CourseProgress) ?? null, error: null });
      } catch {
        if (alive) setDetail({ course, progress: null, error: "Gagal memuat kursus. Coba lagi." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseDeepLinkId]);

  // ── Daftar mode ──
  useEffect(() => {
    if (courseDeepLinkId) return;
    let alive = true;
    setListError(null);
    (async () => {
      try {
        const res = await fetch("/api/courses", { cache: "no-store" });
        if (res.status === 401) {
          // Guest: daftar tetap tampil; progress "—" (state-matrix §1.4).
          if (alive) setSummaries(COURSES.map((c) => ({ id: c.id, title: c.title, progressPct: null })));
          return;
        }
        if (!res.ok) {
          if (!alive) return;
          setListError(authErrorText(res.status, await authErrorPayload(res), "kursus"));
          setSummaries(null);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        // Respons boleh kuranga lengkap (field tambahan, regression gate) —
        // fallback ke kurasi lokal agar daftar tak pernah mati (konten statis).
        const rows: CourseSummary[] = Array.isArray(data.courses) && data.courses.length
          ? data.courses
          : COURSES.map((c) => ({ id: c.id, title: c.title, progressPct: null }));
        setSummaries(rows);
      } catch {
        if (alive) {
          setListError("Gagal memuat kursus. Coba lagi.");
          setSummaries(COURSES.map((c) => ({ id: c.id, title: c.title, progressPct: null })));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseDeepLinkId, retryKey]);

  // ── DETAIL MODE ──
  if (courseDeepLinkId) {
    return (
      <CoursesDetail
        state={detail}
        stepIndex={stepIndex}
        setStepIndex={setStepIndex}
        onBack={() => onNavigate("#/courses")}
        onStepAction={(step, idx) => {
          void idx;
          stepActionHash(step, onNavigate);
        }}
      />
    );
  }

  // ── DAFTAR MODE ──
  if (listError && !summaries) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="alert">
        <p className="text-sm font-bold text-neutral-300">{listError}</p>
        <button
          className="ctl ctl-sm"
          onClick={() => {
            setSummaries(null);
            setListError(null);
            setRetryKey((k) => k + 1);
          }}
        >
          Coba lagi
        </button>
      </div>
    );
  }
  if (!summaries) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
        <span className="flex items-center gap-2 text-sm font-bold text-neutral-400 animate-pulse">
          <Loader2 size={16} className="animate-spin" /> Mengambil kursus…
        </span>
      </div>
    );
  }

  const rows = COURSES.map((c) => {
    const match = summaries!.find((s) => s.id === c.id);
    return { course: c, pct: courseSummaryProgress(c, match) };
  });

  const authNote =
    authStatus === "pending"
      ? "Akun menunggu persetujuan admin."
      : authStatus === "guest"
        ? "Masuk untuk melihat progresmu"
        : null;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-3">
        <Library size={24} className="text-[var(--primary)]" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-black text-white">Kursus</h1>
          <p className="text-xs text-neutral-400">Jalur latihan terstruktur — tiap langkah mengarah ke materi dan drill yang sudah ada di jev-chess.</p>
        </div>
      </div>

      {authNote && (
        <p role="status" className="text-xs font-bold text-neutral-400">
          {authNote}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map(({ course, pct }) => {
          const done = pct !== null && pct >= 100;
          const cta = done ? "Ulangi" : pct !== null && pct > 0 ? "Lanjut" : "Mulai";
          const summary = summaries!.find((s) => s.id === course.id);
          return (
            <div
              key={course.id}
              className={`relative rounded-2xl border p-4 bg-[var(--card)] transition-all duration-150 ${
                done ? "border-[var(--primary)]/60" : "border-[var(--border)] hover:border-[var(--primary)]"
              }`}
            >
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Library size={16} aria-hidden="true" />
                {course.title}
              </h2>
              <p className="mt-1 text-xs text-neutral-400 line-clamp-2 min-h-8">{course.description}</p>
              {pct === null ? (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-[var(--muted)]" aria-hidden="true" />
                  <p className="mt-1.5 text-xs font-bold text-neutral-400">
                    <span aria-hidden="true">—</span> · progres {authStatus === "guest" ? "terkunci (masuk)" : "menunggu akun disetujui"}
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <div
                    className="h-2 rounded-full bg-[var(--muted)] overflow-hidden"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progress ${course.title} ${pct} persen`}
                  >
                    <div
                      className="h-full bg-[var(--primary)] transition-all duration-[var(--move-animation-duration)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs font-bold text-neutral-400 tabular-nums">
                    {typeof summary?.doneCount === "number" ? `${summary.doneCount} dari ${course.steps.length} selesai · ${pct}%` : `${pct}% selesai`}
                  </p>
                </div>
              )}
              <div className="mt-2 flex items-center justify-end">
                <button
                  className={`ctl ctl-sm inline-flex items-center gap-1.5 ${
                    done ? "" : "ctl-active"
                  }`}
                  aria-label={`${cta} kursus ${course.title}`}
                  onClick={() => openDetail(course.id)}
                >
                  {cta}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail course (step pagination — reuse pola learning-hub: select + Prev/Next) ──
function CoursesDetail({
  state,
  stepIndex,
  setStepIndex,
  onBack,
  onStepAction,
}: {
  state: { course: Course; progress: CourseProgress | null; error: string | null } | null;
  stepIndex: number;
  setStepIndex: (i: number) => void;
  onBack: () => void;
  onStepAction: (step: CourseStep, idx: number) => void;
}) {
  const course = state?.course ?? COURSES[0];
  const progress = state?.progress ?? null;
  const step = course.steps[stepIndex];
  const stepProgress = progress?.steps.find((s) => s.stepId === step?.id) ?? null;
  const done = Boolean(stepProgress?.complete);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button className="ctl ctl-sm flex items-center gap-1.5" onClick={onBack} aria-label="Kembali ke daftar kursus">
          <ChevronLeft size={15} aria-hidden="true" /> Kembali ke daftar
        </button>
        <span className="text-xs font-bold text-neutral-400 tabular-nums">
          {course.steps.length} langkah
        </span>
      </div>

      <h1 className="text-lg font-black text-white flex items-center gap-2">
        <Library size={20} className="text-[var(--primary)]" aria-hidden="true" />
        {course.title}
      </h1>
      <p className="text-xs text-neutral-400 -mt-2">{course.description}</p>

      {state?.error && (
        <p role="alert" className="text-xs font-bold text-[var(--destructive)]">
          {state.error}
        </p>
      )}

      {/* Tab-strip chip step (≤10 langkah — pola tab strip S6) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Langkah kursus">
        {course.steps.map((s, i) => {
          const sp = progress?.steps.find((x) => x.stepId === s.id);
          const active = i === stepIndex;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setStepIndex(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  const next = Math.min(course.steps.length - 1, i + 1);
                  setStepIndex(next);
                  (document.querySelector(`[role="tablist"] [role="tab"][aria-selected="true"]`) as HTMLElement)?.focus();
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const prev = Math.max(0, i - 1);
                  setStepIndex(prev);
                  (document.querySelector(`[role="tablist"] [role="tab"][aria-selected="true"]`) as HTMLElement)?.focus();
                }
              }}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-[var(--move-animation-duration)] ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/15 text-white"
                  : "border-[var(--border)] bg-[var(--card)] text-neutral-400 hover:text-white"
              }`}
            >
              {sp?.complete ? (
                <span className="inline-flex items-center gap-1">
                  <Check size={13} aria-hidden="true" /> {i + 1}
                </span>
              ) : (
                <span>{i + 1}</span>
              )}
              {sp?.complete ? " Selesai ✓" : ""}
            </button>
          );
        })}
      </div>

      {/* Panel langkah aktif */}
      {step ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-black text-white">
              STEP {stepIndex + 1} · {step.title}
            </h2>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 border border-[var(--border)] rounded px-1.5 py-0.5">
              {step.kind}
            </span>
          </div>
          <p className="text-xs text-neutral-300">
            {step.kind === "lesson"
              ? "Materi tertulis — buka pelajaran dan tandai selesai."
              : step.kind === "puzzleTheme"
                ? "Kerjakan pool teka-teki bertema; progres tercatat otomatis."
                : step.kind === "drillSet"
                  ? "Kerjakan set drill endgame; progres tercatat otomatis."
                  : "Kerjakan latihan pembukaan riil; progres tercatat otomatis."}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="ctl ctl-sm inline-flex items-center gap-1.5 ctl-active" onClick={() => onStepAction(step, stepIndex)} aria-label={`Buka langkah ${stepIndex + 1} ${step.title}`}>
              <ArrowRight size={14} aria-hidden="true" /> {stepKindActionLabel(step.kind)}
            </button>
            {stepIndex < course.steps.length - 1 && (
              <button className="ctl ctl-sm" onClick={() => setStepIndex(stepIndex + 1)}>
                Lanjut <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {stepProgress && (
            <p role="status" className="text-xs font-bold text-[var(--primary)] tabular-nums">
              Progres langkah: {stepProgress.solved}/{stepProgress.total} · {stepProgress.progressPct}%
            </p>
          )}
        </div>
      ) : (
        <p role="status" className="text-sm font-bold text-neutral-400">
          Kursus ini sedang dirombak — belum ada langkah yang bisa dibuka.
        </p>
      )}
    </div>
  );
}

/** CTA "Lakukan pada papan" → hash view tujuan per kind domain (ADR D1 routing). */
function stepActionHash(step: CourseStep, onNavigate: (hash: string) => void): void {
  switch (step.kind) {
    case "puzzleTheme":
      onNavigate(`#/puzzles?tab=themes&theme=${encodeURIComponent(step.ref)}`);
      break;
    case "drillSet":
      onNavigate(`#/drills/${encodeURIComponent(step.ref)}`);
      break;
    case "opening":
      onNavigate(`#/learn/openings/${encodeURIComponent(step.ref)}`);
      break;
    case "lesson":
      onNavigate(`#/learn/${encodeURIComponent(step.ref)}`);
      break;
  }
}

export function stepKindActionLabel(kind: CourseStep["kind"]): string {
  switch (kind) {
    case "puzzleTheme":
      return "Lakukan pada Latihan Tema";
    case "drillSet":
      return "Lakukan pada Drill Endgame";
    case "opening":
      return "Buka Pelajaran Pembukaan";
    case "lesson":
      return "Buka Pelajaran";
  }
}
