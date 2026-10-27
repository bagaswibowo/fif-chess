/**
 * lib/courses.ts (S7-T1, ADR-010 D1) — Kurasi statis 3 course.
 *
 * Copy 100% orisinal (aturan hard S7: tidak ada material berhak cipta
 * chess.com; nama pembuka + kode ECO = fakta). Tiap step HANYA
 * mereferensikan konten yang sudah ada di jev-chess (YAGNI D1.1):
 *   - kind "puzzleTheme" → key tema lib/puzzle-themes.ts
 *   - kind "drillSet"    → set id lib/endgame-drills.ts
 *   - kind "opening"     → ECO lib/engines/opening-book.ts (step = drill
 *                          riil tema puzzle "opening" D3.2)
 *   - kind "lesson"      → lesson id lib/lessons.ts
 *
 * Progress course = SQL-derived riil dari puzzle_attempts (pola
 * api/puzzles/themes + api/endgames/drills) + lesson completion dari
 * file store lib/learn-store.ts (D2). Lihat app/api/courses/route.ts.
 * [NO-NEW-TABLE] — tidak ada write path progress di modul ini.
 */

export type CourseStepKind = "puzzleTheme" | "drillSet" | "opening" | "lesson";

export interface CourseStep {
  /** "courseId-stepN" (unik global, dipakai kunci progress). */
  id: string;
  kind: CourseStepKind;
  /**
   * puzzleTheme → key tema lib/puzzle-themes.ts;
   * drillSet → set id lib/endgame-drills.ts;
   * opening → kode ECO lib/engines/opening-book.ts;
   * lesson → lesson id lib/lessons.ts.
   */
  ref: string;
  /** Label ID orisinal (copy, bukan judul materi pihak ketiga). */
  title: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  steps: CourseStep[];
}

export const COURSES: Course[] = [
  {
    id: "taktik-dasar",
    title: "Taktik Dasar",
    description:
      "Jalur motif taktikal fundamental: pin, garpu, dan skakmat baris belakang — langsung dikerjakan dari pool puzzle riil jev-chess.",
    steps: [
      {
        id: "taktik-dasar-step1",
        kind: "puzzleTheme",
        ref: "pin",
        title: "Kenali Pin — kunci motif taktikal paling sering muncul",
      },
      {
        id: "taktik-dasar-step2",
        kind: "puzzleTheme",
        ref: "fork",
        title: "Garpu — satu langkah, dua bidak terancam",
      },
      {
        id: "taktik-dasar-step3",
        kind: "puzzleTheme",
        ref: "backRankMate",
        title: "Skakmat Baris Belakang — jaga baris raja",
      },
      {
        id: "taktik-dasar-step4",
        kind: "lesson",
        ref: "tactics-pin",
        title: "Pelajaran: Membedakan Pin, Garpu, dan Serangan Tersembunyi",
      },
    ],
  },
  {
    id: "endgame-esensial",
    title: "Permainan Akhir Esensial",
    description:
      "Dasar endgame: aktifkan raja, selesaikan set drill benteng vs bidak dan pion akhir, lalu pahami raja aktif.",
    steps: [
      {
        id: "endgame-esensial-step1",
        kind: "lesson",
        ref: "endgame-raja-aktif",
        title: "Pelajaran: Aktivitas Raja di Permainan Akhir",
      },
      {
        id: "endgame-esensial-step2",
        kind: "drillSet",
        ref: "rook-endgame",
        title: "Drill: Benteng vs Bidak",
      },
      {
        id: "endgame-esensial-step3",
        kind: "drillSet",
        ref: "pawn-endgame",
        title: "Drill: Pion Akhir",
      },
      {
        id: "endgame-esensial-step4",
        kind: "puzzleTheme",
        ref: "endgame",
        title: "Kerjakan Pool Puzzle Tema Permainan Akhir",
      },
    ],
  },
  {
    id: "pembukaan-teori",
    title: "Pembukaan & Teori",
    description:
      "Pelajari jalur Ruy Lopez dari buku pembukaan lokal, lalu kuasai tema pembukaan lewat drill riil.",
    steps: [
      {
        id: "pembukaan-teori-step1",
        kind: "lesson",
        ref: "openings-ruy-lopez",
        title: "Pelajaran: Ruy Lopez (C60)",
      },
      {
        id: "pembukaan-teori-step2",
        kind: "lesson",
        ref: "openings-kuda-raja",
        title: "Pelajaran: Kuda Raja (C30)",
      },
      {
        id: "pembukaan-teori-step3",
        kind: "opening",
        ref: "C60",
        title: "Latihan Riil: Tema Pembukaan (drill puzzle)",
      },
    ],
  },
];

export function courseById(id: string): Course | null {
  return COURSES.find((c) => c.id === id) ?? null;
}
