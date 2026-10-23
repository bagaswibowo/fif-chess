"use client";

// Client-side session: satu sumber kebenaran untuk UI. Semua yang butuh
// identitas (nama untuk history, admin badge, PvP) membaca dari sini.
import { useCallback, useEffect, useState } from "react";

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: string;
};

const KEY = "jev_chess_user";

export function readCachedUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch {}
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, data };
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      const data = await res.json();
      const next = (data?.user as SessionUser | null) ?? null;
      setUser(next);
      cacheUser(next);
    } catch {
      const cached = readCachedUser();
      setUser(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const { ok, data } = await post({ action: "login", username, password });
    if (ok && data.user) {
      setUser(data.user as SessionUser);
      cacheUser(data.user);
    }
    return data;
  }, []);

  const register = useCallback(async (username: string, password: string, fullName: string, role: string) => {
    const { data } = await post({ action: "register", username, password, fullName, role });
    return data;
  }, []);

  const logout = useCallback(async () => {
    await post({ action: "logout" });
    setUser(null);
    cacheUser(null);
  }, []);

  const saveProfile = useCallback(async (fullName: string, role: string) => {
    const { ok, data } = await post({ action: "updateProfile", fullName, role });
    if (ok && data.user) {
      setUser(data.user as SessionUser);
      cacheUser(data.user);
    }
    return data;
  }, []);

  return { user, loading, login, register, logout, saveProfile, refresh };
}


/** FIX-1.2: pemetaan status HTTP -> pesan UI yang jujur.
 *  401 = benar-benar belum login (CTA login sah); 403 = login tapi status
 *  akun pending/rejected — BUKAN CTA login; 503 = gangguan layanan. */
export function authErrorText(status: number, data?: { code?: string; error?: string }, ctx?: string): string {
  const what = ctx ? ` ${ctx}` : "";
  if (status === 401) return `Masuk untuk melihat${what}.`;
  if (status === 403) {
    if (data?.code === "account_pending") return "Akun menunggu persetujuan admin.";
    if (data?.code === "account_rejected") return "Akun Anda ditolak admin.";
    if (data?.code === "account_missing") return "Akun belum tersinkron dengan database. Coba lagi nanti.";
    return data?.error ?? "Akses ditolak.";
  }
  if (status === 503) return "Layanan sedang gangguan. Coba lagi nanti.";
  return data?.error ?? "Gagal memuat data. Coba lagi nanti.";
}

/** Ambil { code, error } dari response fetch untuk authErrorText. */
export async function authErrorPayload(res: Response): Promise<{ code?: string; error?: string }> {
  try {
    const d = await res.json();
    return { code: d?.code, error: d?.error };
  } catch {
    return {};
  }
}
