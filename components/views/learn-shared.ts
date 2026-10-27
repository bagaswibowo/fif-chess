/**
 * components/views/learn-shared.ts (S7 frontend)
 * Tipe respons endpoint S7 (shape defensif — sumber kontrak:
 * docs/contracts/sprint7.md §1/§2) + helper navigasi hash layer
 * belajar (#/courses/{id}, #/learn/{lessonId}, #/learn/openings/{eco},
 * #/practice, #/classroom, #/drills/{setId}).
 * Tipe di sini = pembaca (consuming) kontrak; backend owner mempublikasi
 * union event WS di lib/realtime/events.ts (S7 additive, paralel).
 */

// ── Kontrak S7 §1.1 (courses) ──────────────────────────────────────────
export interface CourseStepProgress {
  stepId: string;
  kind: "puzzleTheme" | "drillSet" | "opening" | "lesson";
  total: number;
  solved: number;
  progressPct: number;
  complete: boolean;
}
export interface CourseProgress {
  steps: CourseStepProgress[];
  progressPct: number;
}

// ── Kontrak S7 §1.5 (classroom / pvp additive) ────────────────────────
export interface RoomNote {
  id: string;
  author: string;
  text: string;
  moveCount: number;
  createdAt: number;
}
export type ClassroomSide = "white" | "black";

// ── Kontrak S7 §2.2 — event WS baru (topik gameTopic(code) REUSE).
//    union RealtimeEvent S7 masih ditambahkan backend paralel; view
//    classroom membaca payload via cast tipe lokal ini (kontrak §2.2).
export interface ClassroomJoinedEvent {
  type: "classroom_joined";
  gameId: string;
  user: string;
  side: ClassroomSide;
}
export interface ClassroomNoteEvent {
  type: "classroom_note";
  gameId: string;
  note: RoomNote;
}

// ── Kontrak S7 §1.4 (practice weekly) ─────────────────────────────────
export interface WeeklyTargetResponse {
  windowDays: 7;
  target: number;
  attempted: number;
  correct: number;
  onTrack: boolean;
}

// ── Kontrak S7 §1.6 (endgame leaderboard) ─────────────────────────────
export interface EndgameLeaderboardEntry {
  username: string;
  rating: number;
  solved: number;
}
export interface EndgameLeaderboardResponse {
  set: { id: string; title: string };
  limit: number;
  entries: EndgameLeaderboardEntry[];
}

// ── Helper navigasi hash (pola onHash game.tsx S6) ───────────────────
const COURSE_PREFIX = "courses/";
const OPENING_LEARN_PREFIX = "learn/openings/";

/** #/drills/{setId} — setId atau null. */
export function drillsSetIdFromHash(h: string): string | null {
  const t = h.replace(/^#\/?/, "");
  if (t === "drills") return null;
  if (t.startsWith(COURSE_PREFIX)) return null;
  if (t.startsWith("drills/")) return t.slice("drills/".length) || null;
  return null;
}

/** Detail #/learn/{lessonId} — bentuk "lesson:<id>" | "openings:<eco>" | null. */
export function learnDetailFromHash(h: string): string | null {
  const t = h.replace(/^#\/?/, "");
  if (t === "learn") return null;
  if (t.startsWith(OPENING_LEARN_PREFIX)) {
    const eco = t.slice(OPENING_LEARN_PREFIX.length);
    return eco ? `openings:${eco}` : null;
  }
  if (t.startsWith("learn/")) {
    const id = t.slice("learn/".length);
    return id ? `lesson:${id}` : null;
  }
  return null;
}

/** #/courses/{id} — courseId atau null. */
export function courseFromHash(h: string): string | null {
  const t = h.replace(/^#\/?/, "");
  if (t === "courses") return null;
  if (t.startsWith(COURSE_PREFIX)) return t.slice(COURSE_PREFIX.length) || null;
  return null;
}

export function learnDetailHash(detail: string): string {
  // detail: "lesson:<id>" | "openings:<eco>"
  const [kind, val] = detail.split(":", 2);
  return kind === "openings" ? `#/learn/openings/${encodeURIComponent(val)}` : `#/learn/${encodeURIComponent(val ?? "")}`;
}

export function courseHash(id: string): string {
  return `#/courses/${encodeURIComponent(id)}`;
}
