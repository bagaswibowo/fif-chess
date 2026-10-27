// lib/learn-store.ts (S7-T2, ADR-010 D2) — Store file untuk state belajar
// per user (bookmark lesson + lesson completion), saudara dari
// lib/auth-store.ts (`DATA_DIR/users.json` → `DATA_DIR/learn-state.json`).
//
// [NO-NEW-TABLE]: satu-satunya store baru di S7. Bookmark/completion =
// data kosmetik low-volume user-scoped — tabel pg butuh migrasi + guard
// hanya untuk dua array string (ditolak YAGNI, ADR-010 D2).
//
// Durability caveat (single-instance house style, sama users.json):
// load-modify-save di SATU proses. Multi-instance deploy belum aman
// (dua proses bisa saling menimpa) — untuk S7 cukup; bila perlu
// cross-instance, pindahkan ke tabel pg (rujukan ADR-010 D1/D2 +
// docs/db/sprint7.md §2). File hanya dibuat on-demand.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const DATA_DIR = process.env.JEV_DATA_DIR || path.join(process.cwd(), "data");
const LEARN_STATE_FILE = path.join(DATA_DIR, "learn-state.json");

/**
 * State belajar per username:
 * - bookmarks       = lesson id yang user bookmark (kosmetik).
 * - lessonsCompleted = lesson id yang user tandai selesai → menyuplai
 *                      progress step course kind "lesson" (D1) via SQL
 *                      course endpoint, bukan angka statis.
 */
export type LearnState = {
  [username: string]: {
    bookmarks: string[];
    lessonsCompleted: string[];
  };
};

function readJson(file: string, fallback: LearnState): LearnState {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (v && typeof v === "object" && !Array.isArray(v)) return v as LearnState;
    return fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: LearnState) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // tmp + rename atomik (pola auth-store.ts) — randomBytes per-call.
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1));
  fs.renameSync(tmp, file);
}

// Semua mutasi lewat sini. Load-modify-save tanpa lock membuat dua
// request bersamaan saling menimpa. Lock sinkron + reload DI DALAM lock
// menutup celah itu (pola auth-store.ts) — satu proses, satu lock.
// ponytail: satu proses, satu lock.
let locked = false;

export function mutateLearn<T>(fn: (state: LearnState) => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      const state = readJson(LEARN_STATE_FILE, {});
      const result = fn(state);
      writeJson(LEARN_STATE_FILE, state);
      resolve(result);
    };
    if (locked) {
      setTimeout(() => {
        if (locked) return mutateLearn(fn).then(resolve, reject);
        run();
      }, 5);
      return;
    }
    locked = true;
    try {
      run();
    } catch (e) {
      reject(e as Error);
    } finally {
      locked = false;
    }
  });
}

/** Baca state belajar untuk satu user (tanpa menulis). */
export function loadLearn(username: string): LearnState[string] {
  const state = readJson(LEARN_STATE_FILE, {});
  return state[username] ?? { bookmarks: [], lessonsCompleted: [] };
}

/** Ubah state satu user: bookmark / lesson completion upsert|hapus. */
export async function setLessonFlag(
  username: string,
  lessonId: string,
  lessonsCompletedOn: boolean,
  bookmarkOn: boolean | null, // null = jangan ubah bookmark
): Promise<{ bookmarks: string[]; lessonsCompleted: string[] }> {
  return mutateLearn((state) => {
    const cur = state[username] ?? { bookmarks: [], lessonsCompleted: [] };
    cur.bookmarks = cur.bookmarks ?? [];
    cur.lessonsCompleted = cur.lessonsCompleted ?? [];
    if (bookmarkOn === true && !cur.bookmarks.includes(lessonId)) cur.bookmarks.push(lessonId);
    if (bookmarkOn === false) cur.bookmarks = cur.bookmarks.filter((x) => x !== lessonId);
    if (lessonsCompletedOn && !cur.lessonsCompleted.includes(lessonId)) cur.lessonsCompleted.push(lessonId);
    if (!lessonsCompletedOn) cur.lessonsCompleted = cur.lessonsCompleted.filter((x) => x !== lessonId);
    state[username] = cur;
    return { bookmarks: cur.bookmarks, lessonsCompleted: cur.lessonsCompleted };
  });
}

/** Hapus seluruh state belajar satu user (untuk pembersihan / uji). */
export async function deleteLearn(username: string): Promise<void> {
  return mutateLearn((state) => {
    delete state[username];
    return undefined;
  });
}
