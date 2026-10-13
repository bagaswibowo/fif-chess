"use client";

// Panel admin: daftar pendaftar dan persetujuan. Hanya admin yang bisa
// memanggil action ini — server memeriksa ulang, bukan sekadar menyembunyikan UI.

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/use-session";

type Member = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
  elo: number;
  createdAt: string;
};

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Gagal.");
  return data as { users?: Member[]; user?: Member };
}

export function AdminPanel({ user }: { user: SessionUser | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.isAdmin) return;
    try {
      const data = await call({ action: "list" });
      setMembers(data.users ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [user?.isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user?.isAdmin) return null;

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      await call({ action, userId: id });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const pending = members.filter((m) => m.status === "pending");
  const approved = members.filter((m) => m.status === "approved");

  const table = (rows: Member[]) => (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Pengguna</th>
            <th scope="col">Keterangan</th>
            <th scope="col">Status</th>
            <th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="wrap-anywhere">
                {m.fullName} <span className="prose-note">@{m.username}</span>
              </td>
              <td className="wrap-anywhere prose-note">{m.role}</td>
              <td>{m.status}</td>
              <td>
                {m.isAdmin ? (
                  <span className="prose-note">akun admin</span>
                ) : m.status === "pending" ? (
                  <span className="row" style={{ gap: "0.35rem" }}>
                    <button className="ctl ctl-xs ctl-primary" disabled={busyId === m.id} onClick={() => void decide(m.id, "approve")}>
                      Setujui
                    </button>
                    <button className="ctl ctl-xs ctl-danger" disabled={busyId === m.id} onClick={() => void decide(m.id, "reject")}>
                      Tolak
                    </button>
                  </span>
                ) : m.status === "approved" ? (
                  <button className="ctl ctl-xs ctl-danger" disabled={busyId === m.id} onClick={() => void decide(m.id, "reject")}>
                    Cabut akses
                  </button>
                ) : (
                  <button className="ctl ctl-xs" disabled={busyId === m.id} onClick={() => void decide(m.id, "approve")}>
                    Setujui lagi
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="stack">
      <h2 className="section-title">Admin · Persetujuan</h2>
      {error && (
        <p className="panel p-2 prose-note" style={{ borderColor: "var(--destructive)" }} role="alert">
          {error}
        </p>
      )}

      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="row-between" style={{ padding: "0.75rem 1rem" }}>
          <span className="label">Menunggu persetujuan ({pending.length})</span>
        </div>
        {pending.length ? table(pending) : <p className="prose-note" style={{ padding: "0 1rem 1rem" }}>Tidak ada pendaftar baru.</p>}
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="row-between" style={{ padding: "0.75rem 1rem" }}>
          <span className="label">Anggota ({approved.length})</span>
        </div>
        {table(approved)}
      </div>
    </div>
  );
}
