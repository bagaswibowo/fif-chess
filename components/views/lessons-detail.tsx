"use client";

/**
 * components/views/lessons-detail.tsx (S7-T2 frontend, ADR-010 D2)
 * Detail pelajaran #/learn/{id}: layout papan kiri + panel materi kanan
 * (reuse PERSIS pola learning-hub `grid lg:grid-cols-[1fr_380px]` — tanpa
 * fork komponen). "Materi tertulis — tanpa video" = sub-judul permanen di
 * panel (honest, anti-slop; jangan player palsu).
 *
 * Latihan per lesson (kontrak §1.2, sumber REUSE):
 *   - dbPuzzle   → teka-teki riil pool /api/puzzles/next (PuzzleSolver),
 *                  catatan via POST /api/puzzles/[id]/attempt.
 *   - bookMove   → papan interaktif + validasi KLIEN terhadap kandidat
 *                  lib/engines/opening-book (tanpa pencatatan server —
 *                  label jujur "tidak tercatat").
 *   - themeDrill → drill riil /api/puzzles/next?theme= (count soal).
 * Bookmark + "Tandai selesai" → POST /api/learn/bookmarks (file store).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  BookOpen, Check, ChevronLeft, ClipboardList, CornerUpRight, Loader2,
  RotateCcw, Star, Swords, Target,
} from "lucide-react";
import { type Lesson } from "@/lib/lessons";
import { COURSES } from "@/lib/courses";
import { OPENING_BOOK } from "@/lib/engines/opening-book";
import { useChessTheme } from "@/lib/chess-themes";
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { themeLabel } from "@/lib/puzzle-themes";
import { SinglePuzzleCard, ThemeDrillCard, BookMoveCard } from "./lessons-exercises";
import type { CoursesAuthStatus } from "./courses-view";

type HintPayload = { from: string; to?: string; direction?: { files: number; ranks: number } } | null;

/** Map modul lesson → tema puzzle default utk teka-teki dbPuzzle/riil. */
const MODULE_THEME: Record<Lesson["module"], string> = {
  tactics: "mateIn1",
  endgames: "endgame",
  openings: "opening",
  rules: "promotion",
};

export function LessonDetail({
  lesson,
  authStatus,
  onNavigate,
}: {
  lesson: Lesson | null;
  authStatus: CoursesAuthStatus;
  onNavigate: (hash: string) => void;
}) {
  const { customPieces, notationStyles, boardTheme } = useChessTheme();
  const [bookmarked, setBookmarked] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [flagBusy, setFlagBusy] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  // 404 / lesson id tak dikenal (deep-link rusak) — copy jujur, bukan blank.
  if (!lesson) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="alert">
        <p className="text-sm font-bold text-neutral-300">Pelajaran tidak ditemukan.</p>
        <button className="ctl ctl-sm" onClick={() => onNavigate("#/learn")}>
          <ChevronLeft size={15} aria-hidden="true" /> Kembali ke daftar
        </button>
      </div>
    );
  }

  // CTA "Masukkan ke kursus" HANYA bila lesson memang step course (anti-slop:
  // tidak ada tombol ke halaman kosong — design §2.1).
  const parentCourse = COURSES.find((c) => c.steps.some((s) => s.kind === "lesson" && s.ref === lesson.id)) ?? null;

  // Bootstrap flag per lesson (file store). Guest/pending: catalog tampil,
  // flag kosong + login-wall (design §2.4).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/learn/bookmarks", { cache: "no-store" });
        if (!res.ok) {
          if (alive) setFlagError(authErrorText(res.status, await authErrorPayload(res), "pelajaran"));
          return;
        }
        const data = await res.json();
        if (!alive) return;
        const bks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
        const comp = Array.isArray(data.lessonsCompleted) ? data.lessonsCompleted : [];
        setBookmarked(bks.includes(lesson.id));
        setCompleted(comp.includes(lesson.id));
      } catch {
        if (alive) setFlagError("Gagal memuat status pelajaran.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [lesson.id]);

  const setFlag = useCallback(
    async (on: boolean) => {
      setFlagBusy(true);
      setFlagError(null);
      try {
        const res = await fetch("/api/learn/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: lesson.id, kind: "lesson", on }),
        });
        if (!res.ok) {
          setFlagError(authErrorText(res.status, await authErrorPayload(res), "pelajaran"));
          return;
        }
        const data = await res.json();
        const bks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
        const comp = Array.isArray(data.lessonsCompleted) ? data.lessonsCompleted : [];
        setBookmarked(bks.includes(lesson.id));
        setCompleted(on ? true : comp.includes(lesson.id));
      } catch {
        setFlagError("Gagal memperbarui status pelajaran.");
      } finally {
        setFlagBusy(false);
      }
    },
    [lesson.id],
  );

  // Tema utk teka-teki dbPuzzle: ambil tema themeDrill lesson bila ada,
  // selain itu default modul (teka-teki riil, tercatat otomatis).
  const defaultTheme =
    (lesson.exercises.find((e) => e.kind === "themeDrill") as { theme?: string } | undefined)?.theme ??
    MODULE_THEME[lesson.module];

  const illustrationFen =
    lesson.boardFen ??
    (lesson.openingEco ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" : null);

  const guestWall = authStatus === "guest";
  const pendingWall = authStatus === "pending";

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 pb-4">
      {/* Header: judul + CTA */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          className="ctl ctl-sm flex items-center gap-1.5"
          onClick={() => onNavigate("#/learn")}
          aria-label="Kembali ke daftar pelajaran"
        >
          <ChevronLeft size={15} aria-hidden="true" /> Kembali ke daftar
        </button>
        <div className="flex items-center gap-1.5">
          <button
            className={`ctl ctl-sm inline-flex items-center gap-1.5 ${bookmarked ? "ctl-active" : ""}`}
            aria-pressed={bookmarked}
            aria-label={`Pelajaran ${lesson.title}, ${bookmarked ? "tersimpan" : "belum disimpan"}`}
            disabled={flagBusy}
            onClick={() => void setFlag(bookmarked ? false : true)}
          >
            <Star size={14} className={bookmarked ? "fill-[var(--primary)] text-[var(--primary)]" : ""} aria-hidden="true" />
            {bookmarked ? "Tersimpan" : "Simpan"}
          </button>
          <button
            className="ctl ctl-sm"
            aria-label="Tandai pelajaran selesai"
            disabled={flagBusy}
            onClick={() => void setFlag(!completed)}
          >
            <Check size={14} aria-hidden="true" /> {completed ? "Selesai ✓" : "Tandai selesai"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <BookOpen size={22} className="text-[var(--primary)] shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-black text-white leading-tight">{lesson.title}</h1>
          <p className="text-xs text-neutral-400">
            {lesson.openingEco ? `${lesson.openingEco} · ` : ""}Materi tertulis — tanpa video.
          </p>
        </div>
      </div>

      {(flagError || (guestWall && !bookmarked)) && (
        <p role="status" className="text-xs font-bold text-neutral-400">
          {flagError ??
            (guestWall
              ? "Masuk untuk menyimpan & menandai selesai pelajaran ini."
              : pendingWall
                ? "Akun menunggu persetujuan admin — flag tampil setelah disetujui."
                : null)}
        </p>
      )}

      {/* Papan ilustrasi kiri + panel materi kanan (reuse layout learning-hub) */}
      <div className="grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-3 items-start w-full">
        <div className="rounded-2xl p-2.5 bg-[var(--card)] border border-[var(--border)] shadow-xl w-full flex flex-col items-center">
          <div
            className="aspect-square w-full max-w-[min(100%,calc(100dvh-260px))] rounded-xl overflow-hidden border-2 border-[var(--board-dark)] relative"
            style={{ backgroundColor: boardTheme.dark }}
            aria-label={`Ilustrasi papan pelajaran ${lesson.title}`}
          >
            <Chessboard
              key={`lesson-ill-${lesson.id}`}
              options={{
                id: `lesson-board-${lesson.id}`,
                position: illustrationFen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                boardOrientation: "white",
                allowDragging: false,
                allowDrawingArrows: false,
                boardStyle: { backgroundColor: boardTheme.dark, width: "100%", height: "100%" },
                lightSquareStyle: { backgroundColor: boardTheme.light },
                darkSquareStyle: { backgroundColor: boardTheme.dark },
                pieces: customPieces,
                ...notationStyles,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-neutral-500 w-full text-center">
            Ilustrasi posisi {illustrationFen ? "" : "awal"} — materi tertulis, bukan video.
          </p>
        </div>

        <div className="panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md w-full min-h-0">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <ClipboardList size={15} className="text-[var(--primary)]" aria-hidden="true" /> Materi
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                "Materi tertulis — tanpa video. Ilustrasi di papan mengikuti materi."
              </p>
            </div>
          </div>
          <div className="mt-2 max-h-[40dvh] overflow-y-auto custom-scrollbar text-xs text-neutral-300 leading-relaxed">
            <LessonBody text={lesson.body} />
          </div>

          {parentCourse && (
            <button
              className="ctl ctl-sm mt-3 inline-flex items-center gap-1.5"
              onClick={() => onNavigate(`#/courses/${parentCourse.id}`)}
              aria-label={`Masukkan ke kursus ${parentCourse.title}`}
            >
              Masukkan ke kursus "{parentCourse.title}" <CornerUpRight size={13} aria-hidden="true" />
            </button>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              className="ctl ctl-sm inline-flex items-center gap-1.5 ctl-active"
              onClick={() => onNavigate("#/practice")}
              aria-label="Terus berlatih di Pusat Latihan"
            >
              <Target size={14} aria-hidden="true" /> Terus berlatih
            </button>
          </div>
        </div>
      </div>

      {/* Latihan */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-black text-white flex items-center gap-2">
          <Swords size={16} className="text-[var(--primary)]" aria-hidden="true" /> Latihan
        </h2>
        {lesson.exercises.length === 0 ? (
          <p className="text-xs text-neutral-400" role="status">
            Pelajaran ini belum punya latihan interaktif — mulai dari jalur Terangkan dulu.
          </p>
        ) : (
          lesson.exercises.map((ex, i) => {
            if (ex.kind === "dbPuzzle") {
              return (
                <SinglePuzzleCard
                  key={`db-${i}`}
                  label="Teka-teki riil dari pool"
                  theme={defaultTheme}
                />
              );
            }
            if (ex.kind === "bookMove") {
              return <BookMoveCard key={`bm-${i}`} fen={ex.fen} />;
            }
            return (
              <ThemeDrillCard
                key={`td-${i}`}
                theme={ex.theme}
                count={ex.count}
                authStatus={authStatus}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/** Body markdown-ish ringan: **tebal** → <strong>; paragraf dipisah \n\n. */
function LessonBody({ text }: { text: string }) {
  const paragraphs = useMemo(() => text.split(/\n{2,}/).filter(Boolean), [text]);
  const renderInline = (s: string, key: number) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={key} className="mb-2 last:mb-0">
        {parts.map((p, i) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={i} className="text-white">
              {p.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </p>
    );
  };
  return <div>{paragraphs.map((p, i) => renderInline(p, i))}</div>;
}

export { LessonBody };
