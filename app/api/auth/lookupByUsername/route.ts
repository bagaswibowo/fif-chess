/**
 * app/api/auth/lookupByUsername/route.ts (S4-fix — TL review f6aac28b)
 * GET /api/auth/lookupByUsername?username=<u> → { id } (id store user, bukan
 * pg uuid — kontrak /api/challenge toUserId). Untuk challenge nyata dari
 * FriendsView: onChallenge kini mengirim POST /api/challenge sungguhan,
 * bukan toast misleading. Ekspos minimal: hanya id — tanpa email/hash/role.
 * 404 tanpa detail (anti username enumeration).
 */
import { NextResponse } from "next/server";
import { loadUsers } from "@/lib/auth-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = (url.searchParams.get("username") ?? "").trim();
  if (!username || username.length > 64) {
    return NextResponse.json({ error: "username wajib diisi.", retryable: false }, { status: 400 });
  }
  try {
    const users = await loadUsers();
    const found = users.find((u) => u.username === username);
    if (!found) {
      return NextResponse.json({ error: "Permintaan tidak dapat diproses.", retryable: false }, { status: 404 });
    }
    return NextResponse.json({ id: found.id });
  } catch {
    return NextResponse.json({ error: "Gagal memuat data user.", retryable: false }, { status: 500 });
  }
}
