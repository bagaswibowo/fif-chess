import { NextResponse } from "next/server";
import {
  ADMIN_USERNAME,
  clearSessionCookie,
  currentUser,
  findUser,
  hashPassword,
  loadUsers,
  mutateUsers,
  publicUser,
  sessionCookie,
  startSession,
  tokenFromRequest,
  endSession,
  verifyPassword,
  validateUsername,
} from "@/lib/auth-store";

export const runtime = "nodejs";

// Bounded per-IP throttle: 20 failed logins per 10 minutes.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_TRACKED = 5000;

function throttled(ip: string) {
  const now = Date.now();
  if (attempts.size > MAX_TRACKED) {
    for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  }
  const rec = attempts.get(ip);
  if (!rec || rec.until < now) return false;
  return rec.count >= 20;
}

function fail(ip: string) {
  const rec = attempts.get(ip);
  if (!rec || rec.until < Date.now()) attempts.set(ip, { count: 1, until: Date.now() + 600_000 });
  else rec.count += 1;
}

function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export async function GET(req: Request) {
  const users = loadUsers();
  const me = currentUser(req, users);
  return NextResponse.json({ success: true, user: me ? publicUser(me) : null });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (throttled(ip)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Kirim JSON yang valid." }, { status: 400 });
  }

  const action = String(body.action || "");
  const users = loadUsers();

  if (action === "register") {
    const username = validateUsername(body.username);
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim().slice(0, 60);
    const role = String(body.role || "Civitas Telkom University").trim().slice(0, 80);

    if (!username) {
      return NextResponse.json({ error: "Username 3-20 karakter: huruf, angka, titik, atau garis bawah." }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
    }
    const { salt, hash } = hashPassword(password);
    // Cek collision DI DALAM lock: dua pendaftaran username sama yang paralel
    // tidak boleh dua-duanya lolos.
    const created = await mutateUsers((users) => {
      if (username === ADMIN_USERNAME || findUser(users, username)) return null;
      const user = {
        id: "u-" + crypto.randomUUID().slice(0, 8),
        username,
        fullName,
        role,
        status: "pending" as const,
        isAdmin: false,
        elo: 1200,
        wins: 0,
        losses: 0,
        draws: 0,
        createdAt: new Date().toISOString(),
        passwordHash: hash,
        passwordSalt: salt,
      };
      users.push(user);
      return user;
    });
    if (!created) {
      return NextResponse.json({ error: "Username sudah dipakai. Pilih yang lain." }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      pending: true,
      user: publicUser(created),
      message: "Pendaftaran terkirim. Menunggu persetujuan Admin Komunitas sebelum bisa login.",
    });
  }

  if (action === "login") {
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = findUser(users, username);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      fail(ip);
      return NextResponse.json({ error: "Username atau kata sandi salah." }, { status: 401 });
    }
    if (user.status === "pending") {
      return NextResponse.json({ pending: true, error: "Akun masih menunggu persetujuan admin." }, { status: 403 });
    }
    if (user.status === "rejected") {
      return NextResponse.json({ error: "Pendaftaran akun ini ditolak admin." }, { status: 403 });
    }
    const { token, maxAge } = startSession(user.id);
    const res = NextResponse.json({ success: true, user: publicUser(user) });
    res.headers.set("Set-Cookie", sessionCookie(token, maxAge, req));
    return res;
  }

  if (action === "logout") {
    const token = tokenFromRequest(req);
    if (token) endSession(token);
    const res = NextResponse.json({ success: true });
    res.headers.set("Set-Cookie", clearSessionCookie());
    return res;
  }

  if (action === "updateProfile") {
    const me = currentUser(req, users);
    if (!me) return NextResponse.json({ error: "Belum login." }, { status: 401 });
    const fullName = String(body.fullName || "").trim().slice(0, 60);
    const role = String(body.role || "").trim().slice(0, 80);
    const updated = await mutateUsers((users2) => {
      const target = users2.find((u) => u.id === me.id);
      if (!target) return null;
      if (fullName) target.fullName = fullName;
      if (role) target.role = role;
      return target;
    });
    if (!updated) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ success: true, user: publicUser(updated) });
  }

  if (action === "list" || action === "approve" || action === "reject") {
    const me = currentUser(req, users);
    if (!me || !me.isAdmin) {
      return NextResponse.json({ error: "Hanya admin yang boleh melakukan ini." }, { status: 403 });
    }

    if (action === "list") {
      return NextResponse.json({
        success: true,
        users: users.map(publicUser).sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin)),
      });
    }

    const targetId = String(body.userId || "");
    const nextStatus = action === "approve" ? "approved" : "rejected";
    const updated = await mutateUsers((users2) => {
      const target = users2.find((u) => u.id === targetId);
      if (!target) return { error: "Pengguna tidak ditemukan." as const, status: 404 };
      if (target.isAdmin) return { error: "Akun admin tidak bisa diubah." as const, status: 400 };
      target.status = nextStatus;
      return { user: target };
    });
    if ("error" in updated) {
      return NextResponse.json({ error: updated.error }, { status: updated.status });
    }
    return NextResponse.json({ success: true, user: publicUser(updated.user) });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
