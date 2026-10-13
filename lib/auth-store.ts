// Penyimpanan pengguna bersama: satu file JSON, ditulis atomik (tmp+rename).
// Sesi: sessions.json menyimpan { hash(token): { userId, exp } } — token asli
// tidak pernah menyentuh disk, dan pencocokan memakai HMAC.
import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const DATA_DIR = process.env.JEV_DATA_DIR || path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

export type UserStatus = "pending" | "approved" | "rejected";

export type UserProfile = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: UserStatus;
  isAdmin: boolean;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: string;
  passwordHash: string;
  passwordSalt: string;
};

export type PublicUser = Omit<UserProfile, "passwordHash" | "passwordSalt">;

export const ADMIN_USERNAME = "bagaswibowo";
export const SESSION_COOKIE = "jev_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;

// Di production key WAJIB ada. Key tetap yang tidak diset berarti siapa pun
// yang tahu skrip ini bisa memalsukan hash token — lebih baik app gagal start
// daripada diam-diam memakai kunci hardcoded.
function hmacKey(): string {
  const key = process.env.SITE_HMAC_KEY;
  if (key) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SITE_HMAC_KEY wajib diset di production.");
  }
  return "jev-dev-key";
}
const sign = (v: string) => createHmac("sha256", hmacKey()).update(v).digest("hex");

type Session = { userId: string; exp: number };

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

export function verifyPassword(password: string, salt: string, expected: string) {
  const actual = scryptSync(password, salt, 64);
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // PID saja tidak unik: dua write dalam satu proses menabrak tmp yang sama
  // dan rename mempublikasikan isi writer lain. randomBytes per-call.
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1));
  fs.renameSync(tmp, file);
}

// Semua mutasi users.json lewat sini. Load-modify-save tanpa lock membuat dua
// request bersamaan saling menimpa: registrasi kedua menghapus akun pertama.
// Lock sinkron + reload DI DALAM lock menutup celah itu, dan karena handler
// selalu await mutateUsers, tidak ada dua muatan yang tumpang tindih.
// ponytail: satu proses, satu lock. Pindah ke SQLite saat butuh multi-instance.
let locked = false;

export function mutateUsers<T>(fn: (users: UserProfile[]) => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      const users = readJson<UserProfile[] | null>(USERS_FILE, null) ?? [];
      const result = fn(users);
      writeJson(USERS_FILE, users);
      resolve(result);
    };
    if (locked) {
      // Menunggu giliran: setTimeout membuat request yang sedang jalan sempat
      // selesai sebelum lock dilepas.
      // ponytail: backoff 5ms. Kalau antrean panjang, ganti dengan queue.
      setTimeout(() => {
        if (locked) return mutateUsers(fn).then(resolve, reject);
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

export function loadUsers(): UserProfile[] {
  const users = readJson<UserProfile[] | null>(USERS_FILE, null);
  if (users && users.length) return users;
  // File ada tapi rusak: JANGAN seed di atasnya, itu menghapus semua akun.
  if (fs.existsSync(USERS_FILE)) {
    console.error(`[auth] ${USERS_FILE} tidak bisa dibaca; akun tidak diubah.`);
    return [];
  }
  const seeded = seedUsers();
  writeJson(USERS_FILE, seeded);
  return seeded;
}

function seedUsers(): UserProfile[] {
  // Akun admin Pak Bagas. Password TIDAK pernah punya fallback di production:
  // tanpa ADMIN_PASSWORD, app menolak start daripada membuka jalan dengan
  // password yang sudah ada di git.
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD wajib diset sebelum seeding akun admin.");
  }
  if (!adminPassword || adminPassword.length < 8) {
    throw new Error("ADMIN_PASSWORD minimal 8 karakter.");
  }
  const { salt, hash } = hashPassword(adminPassword);
  return [
    {
      id: "admin-bagas",
      username: ADMIN_USERNAME,
      fullName: "Pak Bagas Wibowo",
      role: "Dosen TI Tel-U (KK SEAL) & Admin Komunitas",
      status: "approved",
      isAdmin: true,
      elo: 1650,
      wins: 28,
      losses: 4,
      draws: 6,
      createdAt: new Date().toISOString(),
      passwordHash: hash,
      passwordSalt: salt,
    },
  ];
}

export function publicUser(u: UserProfile): PublicUser {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = u;
  return rest;
}

/** Cari_user by username saja. Sengaja TIDAK menerima id: ?id= tanpa session
 *  akan jadi oracle untuk menebak user mana yang ada. */
export function findUser(users: UserProfile[], username: string) {
  const key = username.trim().toLowerCase();
  return users.find((u) => u.username === key);
}

function loadSessions(): Record<string, Session> {
  return readJson<Record<string, Session>>(SESSIONS_FILE, {});
}

export function startSession(userId: string) {
  const token = randomUUID();
  const sessions = loadSessions();
  const now = Date.now();
  for (const [k, v] of Object.entries(sessions)) if (v.exp < now) delete sessions[k];
  sessions[sign(token)] = { userId, exp: now + SESSION_SECONDS * 1000 };
  writeJson(SESSIONS_FILE, sessions);
  return { token, maxAge: SESSION_SECONDS };
}

export function endSession(token: string) {
  const sessions = loadSessions();
  delete sessions[sign(token)];
  writeJson(SESSIONS_FILE, sessions);
}

export function userForToken(token: string | undefined, users: UserProfile[]) {
  if (!token) return null;
  const session = loadSessions()[sign(token)];
  if (!session || session.exp < Date.now()) return null;
  // Hanya status approved yang punya akses. Tanpa cek ini, user yang ditolak
  // admin masih bebas 30 hari memakai session lamanya.
  const user = users.find((u) => u.id === session.userId);
  return user && user.status === "approved" ? user : null;
}

export function tokenFromRequest(req: Request): string | undefined {
  const cookie = req.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(SESSION_COOKIE.length + 1));
      } catch {
        return undefined; // cookie rusak = belum login, bukan 500
      }
    }
  }
  return undefined;
}

export function currentUser(req: Request, users: UserProfile[]) {
  return userForToken(tokenFromRequest(req), users);
}

// Secure hanya kalau request-nya memang HTTPS. Behind Cloudflare Tunnel scheme
// datang lewat X-Forwarded-Proto, bukan dari NODE_ENV.
export function isHttps(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookie(token: string, maxAge: number, req?: Request) {
  const secure = req && isHttps(req) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function validateUsername(raw: unknown): string | null {
  const username = String(raw ?? "").trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
  return username.length >= 3 && username.length <= 20 ? username : null;
}
