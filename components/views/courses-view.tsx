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

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Library, ChevronLeft, ChevronRight, Check, ArrowRight } from "lucide-react";
import { COURSES, courseById, type Course, type CourseStep } from "@/lib/courses";
import type { CourseProgress } from "./learn-shared";
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

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
      <div className="view-root w-full max-w-5xl mx-auto">
        <div className="view-head flex items-center gap-3 shrink-0">
          <Library size={18} className="text-[var(--nav-accent-learn)] shrink-0" aria-hidden="true" />
          <h1 className="text-sm font-black text-white">Kursus</h1>
        </div>
        <div className="view-body flex flex-col items-center gap-3 py-10" style={{ scrollbarWidth: "thin" }}>
          <ErrorState
            message={listError}
            ctx="kursus"
            onRetry={() => {
              setSummaries(null);
              setListError(null);
              setRetryKey((k) => k + 1);
            }}
            className="items-center"
          />
        </div>
      </div>
    );
  }
  if (!summaries) {
    return (
      <div className="view-root w-full max-w-5xl mx-auto">
        <div className="view-head flex items-center gap-3 shrink-0">
          <Library size={18} className="text-[var(--nav-accent-learn)] shrink-0" aria-hidden="true" />
          <h1 className="text-sm font-black text-white">Kursus</h1>
        </div>
        <div className="view-body flex items-center justify-center py-10" style={{ scrollbarWidth: "thin" }}>
          <LoadingState label="Mengambil kursus…" skeleton="grid" className="items-stretch self-stretch" />
        </div>
      </div>
    );
  }

  const rows = COURSES.map((c) => {
    const match = summaries!.find((s) => s.id === c.id);
    return { course: c, pct: courseSummaryProgress(c, match) };
  });

  // T1 (G0): pesan status per authStatus — literal "Masuk untuk" diganti
  // pemanggilan authErrorText(401) agar satu sumber pemetaan 401/403/503
  // (lib/use-session). Guest = CTA login sah; pending = status + badge jam.
  const authNote =
    authStatus === "pending"
      ? "Akun menunggu persetujuan admin."
      : authStatus === "guest"
        ? authErrorText(401, undefined, "progresmu")
        : null;

  return (
    <div className="view-root w-full max-w-5xl mx-auto">
      <div className="view-head flex items-center gap-3 shrink-0">
        <Library size={18} className="text-[var(--nav-accent-learn)] shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-sm font-black text-white leading-tight">Kursus</h1>
          <p className="text-[11px] text-neutral-400 truncate">Jalur latihan terstruktur — tiap langkah mengarah ke materi dan drill yang sudah ada di jev-chess.</p>
        </div>
        <div className="flex-1" aria-hidden="true" />
        {authNote && (
          <p
            role={authStatus === "pending" ? "status" : undefined}
            className="text-xs font-bold text-neutral-400 shrink-0 inline-flex items-center gap-1"
          >
            {authStatus === "pending" && (
              <span className="inline-flex items-center gap-1 font-bold text-amber-400" aria-hidden="true">
                <Clock size={13} />
                Menunggu
              </span>
            )}
            <span>{authNote}</span>
          </p>
        )}
      </div>

      <div className="view-body" style={{ scrollbarWidth: "thin" }}>
        {/* S8: Pola D — kartu rapat grid (gap 12px, baris min 44px) dalam body
            scroll internal; data riil progressPct dari /api/courses (no-mock).
            State error/loading ditangani early-return di atas. */}
        <div className="view-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(({ course, pct }) => {
            const done = pct !== null && pct >= 100;
            const cta = done ? "Ulangi" : pct !== null && pct > 0 ? "Lanjut" : "Mulai";
            const summary = summaries!.find((s) => s.id === course.id);
            return (
              <div
                key={course.id}
                className={`rounded-xl border p-3 bg-[var(--card)] transition-all duration-150 ${
                  done ? "border-[var(--nav-accent-learn)]/60" : "border-[var(--border)] hover:border-[var(--nav-accent-learn)]"
                }`}
              >
                <h2 className="text-sm font-black text-white flex items-center gap-2 min-w-0">
                  <Library size={14} aria-hidden="true" className="text-[var(--nav-accent-learn)] shrink-0" />
                  <span className="truncate">{course.title}</span>
                </h2>
                <p className="mt-1 text-xs text-neutral-400 line-clamp-2 min-h-8">{course.description}</p>
                {pct === null ? (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-[var(--muted)]" aria-hidden="true" />
                    <p className="mt-1.5 text-xs font-bold text-neutral-400">
                      <span aria-hidden="true">—</span> · progres {authStatus === "guest" ? "terkunci (masuk)" : "menunggu akun disetujui"}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div
                      className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progress ${course.title} ${pct} persen`}
                    >
                      <div
                        className="h-full bg-[var(--nav-accent-learn)] transition-all duration-[var(--move-animation-duration)]"
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
                    className={`ctl ctl-xs inline-flex items-center gap-1.5 ${
                      done ? "" : "ctl-active"
                    }`}
                    aria-label={`${cta} kursus ${course.title}`}
                    onClick={() => openDetail(course.id)}
                  >
                    {cta}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Detail course (S8: Pola C — panel langkah .view-body + sidebar step list .view-body) ──
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
  // A11y: fokus tab step via ref di dalam view (bukan document.querySelector
  // global yang bisa match tablist view lain — bug lamanya).
  const stepListRef = useRef<HTMLDivElement | null>(null);
  const focusActiveStep = useCallback(() => {
    stepListRef.current
      ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  }, []);

  return (
    <div className="view-root w-full max-w-4xl mx-auto">
      <div className="view-head flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Library size={18} className="text-[var(--nav-accent-learn)] shrink-0" aria-hidden="true" />
          <h1 className="text-sm font-black text-white truncate">{course.title}</h1>
          <span className="text-xs font-bold text-neutral-400 tabular-nums shrink-0">
            {course.steps.length} langkah
          </span>
        </div>
        <button className="ctl ctl-xs flex items-center gap-1.5" onClick={onBack} aria-label="Kembali ke daftar kursus">
          <ChevronLeft size={13} aria-hidden="true" /> Kembali ke daftar
        </button>
      </div>

      <div className="view-cols">
        {/* Kolom utama: panel langkah aktif */}
        <div className="view-body" style={{ scrollbarWidth: "thin" }}>
          {state?.error && (
            <p role="alert" className="text-xs font-bold text-[var(--destructive)]">
              {state.error}
            </p>
          )}

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
                <p role="status" className="text-xs font-bold text-[var(--nav-accent-learn)] tabular-nums">
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

        {/* Kolom meta: daftar langkah (chips step, pola tab strip S6) */}
        <div className="view-body" style={{ scrollbarWidth: "thin" }}>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Langkah</p>
            <div ref={stepListRef} className="flex flex-col gap-1.5" role="tablist" aria-label="Langkah kursus">
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
                        focusActiveStep();
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        const prev = Math.max(0, i - 1);
                        setStepIndex(prev);
                        focusActiveStep();
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-[var(--move-animation-duration)] ${
                      active
                        ? "border-[var(--nav-accent-learn)] bg-[var(--nav-accent-learn)]/15 text-white"
                        : "border-[var(--border)] bg-[var(--surface)] text-neutral-400 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {sp?.complete ? (
                        <span className="inline-flex items-center gap-1">
                          <Check size={13} aria-hidden="true" /> {i + 1}
                        </span>
                      ) : (
                        <span>{i + 1}</span>
                      )}
                      <span className="truncate">{s.title}</span>
                    </span>
                    {sp?.complete ? <span className="sr-only"> — Selesai</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
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
