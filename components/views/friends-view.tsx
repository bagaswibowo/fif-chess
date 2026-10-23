"use client";

/**
 * components/views/friends-view.tsx (ticket S4-T3 — Sprint 4)
 * Teman: permintaan masuk dual-button Terima/Tolak, daftar teman dengan
 * presence dot + sr-only, Tantangan inline via /api/challenge (S1-T4),
 * Tambah Teman modal kecil, Hapus Teman dengan modal konfirmasi.
 * API: GET/POST/DELETE /api/friends, POST /api/friends/[id]/respond.
 */

import { useCallback, useEffect, useState } from "react";
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { IconFriends3D, IconClose3D } from "@/components/icons3d";

type Person = { id?: string; username: string; rating: number; since?: string; online?: boolean };
type FriendsPayload = { friends: Person[]; incoming: Person[]; outgoing: Person[] };

type Props = {
  onChallenge?: (username: string) => Promise<boolean> | boolean;
  onOpenProfile?: (username: string) => void;
};

export function FriendsView({ onChallenge, onOpenProfile }: Props) {
  const [data, setData] = useState<FriendsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Person | null>(null);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/friends", { cache: "no-store" });
      if (!res.ok) {
        setError(authErrorText(res.status, await authErrorPayload(res), "daftar teman"));
        return;
      }
      setData((await res.json()) as FriendsPayload);
      setError(null);
    } catch {
      setError("Gagal memuat daftar teman.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = useCallback(async (person: Person, action: "accept" | "decline") => {
    if (!person.id) {
      flash("id permintaan tidak tersedia.");
      return;
    }
    try {
      const res = await fetch(`/api/friends/${person.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        flash(d?.error ?? "Gagal memproses permintaan.");
        return;
      }
      flash(action === "accept" ? `@${person.username} ditambahkan sebagai teman.` : `Permintaan @${person.username} ditolak.`);
      await load();
    } catch {
      flash("Gagal memproses permintaan.");
    }
  }, [flash, load]);

  const removeFriend = useCallback(async (person: Person) => {
    if (!person.id) {
      flash("id relasi tidak tersedia.");
      return;
    }
    try {
      const res = await fetch(`/api/friends?id=${encodeURIComponent(person.id)}`, { method: "DELETE" });
      if (!res.ok) {
        flash("Gagal menghapus teman.");
        return;
      }
      flash(`@${person.username} dihapus dari daftar teman.`);
      setConfirmRemove(null);
      await load();
    } catch {
      flash("Gagal menghapus teman.");
    }
  }, [flash, load]);

  const addFriend = useCallback(async () => {
    const username = addName.trim().replace(/^@/, "");
    if (!username) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(d?.error ?? "Gagal mengirim permintaan.");
        return;
      }
      flash(`Permintaan pertemanan ke @${username} terkirim.`);
      setAddOpen(false);
      setAddName("");
      await load();
    } catch {
      setAddError("Gagal mengirim permintaan.");
    } finally {
      setAdding(false);
    }
  }, [addName, flash, load]);

  const challenge = useCallback(
    async (username: string) => {
      // Challenge nyata dikirim oleh parent via /api/challenge (S1-T4);
      // hasil (boolean) menentukan feedback jujur — bukan toast misleading.
      if (!onChallenge) {
        flash("Tantangan belum tersedia.");
        return;
      }
      const ok = await onChallenge(username);
      if (ok) {
        setSentTo(username);
        flash(`Tantangan terkirim ke @${username}.`);
      } else {
        flash("Gagal mengirim tantangan.");
      }
    },
    [onChallenge, flash],
  );

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="status">
        <p className="text-sm text-neutral-300">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
        <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat daftar teman…</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <IconFriends3D size={28} aria-hidden="true" />
          <h1 className="text-xl font-black text-white">Teman</h1>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          aria-label="Tambah teman baru"
          className="bg-[var(--primary)] text-black font-black hover:bg-[var(--primary)]/90 shadow-[0_4px_0_#45753c]"
        >
          + Tambah Teman
        </Button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">{notice}</div>

      {/* Permintaan Masuk */}
      {data.incoming.length > 0 && (
        <section aria-labelledby="friends-incoming">
          <h2 id="friends-incoming" className="text-sm font-black uppercase tracking-wide text-neutral-400 mb-2">
            Permintaan Masuk ({data.incoming.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {data.incoming.map((p) => (
              <li key={p.username} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 animate-in fade-in duration-150">
                <span className="flex-1 min-w-0 text-sm truncate">
                  <span className="font-bold text-white">@{p.username}</span>{" "}
                  <span className="text-neutral-400">({p.rating})</span>
                </span>
                <span className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => void respond(p, "accept")}
                    aria-label={`Terima permintaan dari ${p.username}`}
                    className="bg-[var(--primary)] text-black font-black hover:bg-[var(--primary)]/90 shadow-[0_4px_0_#45753c]"
                  >
                    Terima
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void respond(p, "decline")} aria-label={`Tolak permintaan dari ${p.username}`}>
                    Tolak
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Daftar Teman */}
      <section aria-labelledby="friends-list">
        <h2 id="friends-list" className="text-sm font-black uppercase tracking-wide text-neutral-400 mb-2">
          Daftar Teman ({data.friends.length})
        </h2>
        {data.friends.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
            <p className="text-sm font-bold text-neutral-300">Belum punya teman — tambahkan dengan username.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.friends.map((p) => (
              <li key={p.username} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    aria-hidden="true"
                    className={`w-2.5 h-2.5 rounded-full ${p.online ? "bg-[var(--primary)] animate-pulse" : "bg-neutral-600"}`}
                  />
                  <span className="sr-only">{p.online ? "online" : "offline"}</span>
                </span>
                <span className="flex-1 min-w-0 text-sm truncate">
                  <button
                    onClick={() => onOpenProfile?.(p.username)}
                    className="font-bold text-white hover:text-[var(--primary)]"
                    aria-label={`Profil @${p.username}`}
                  >
                    @{p.username}
                  </button>{" "}
                  <span className="text-neutral-400">({p.rating})</span>
                  {!p.online && <span className="text-neutral-500"> · offline</span>}
                </span>
                <span className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    disabled={sentTo === p.username}
                    onClick={() => void challenge(p.username)}
                    aria-label={`Tantang ${p.username} bermain`}
                    className={sentTo === p.username ? "" : "bg-[var(--primary)] text-black font-black hover:bg-[var(--primary)]/90 shadow-[0_4px_0_#45753c]"}
                  >
                    {sentTo === p.username ? "Terkirim" : "Tantangan"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(p)} aria-label={`Hapus teman ${p.username}`}>
                    ⋯
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal Tambah Teman */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="add-friend-title" className="w-full max-w-sm rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 id="add-friend-title" className="text-base font-black text-white">Tambah Teman</h2>
              <button onClick={() => setAddOpen(false)} aria-label="Tutup" className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[var(--surface)]">
                <IconClose3D size={18} />
              </button>
            </div>
            <label htmlFor="add-friend-input" className="text-xs font-bold text-neutral-400">Username</label>
            <input
              id="add-friend-input"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addFriend()}
              placeholder="mis. budi"
              className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-white placeholder-neutral-500 outline-none focus:border-[var(--primary)]"
            />
            {addError && <p className="mt-2 text-xs font-bold text-red-400" role="alert">{addError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
              <Button
                disabled={adding || !addName.trim()}
                onClick={() => void addFriend()}
                className="bg-[var(--primary)] text-black font-black hover:bg-[var(--primary)]/90 shadow-[0_4px_0_#45753c]"
              >
                Kirim
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi hapus */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmRemove(null);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="remove-friend-title" className="w-full max-w-sm rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4 shadow-2xl">
            <h2 id="remove-friend-title" className="text-base font-black text-white">
              Hapus {confirmRemove.username} dari daftar teman?
            </h2>
            <p className="mt-1 text-xs text-neutral-400">Tindakan ini berlaku dua arah dan tidak bisa dibatalkan.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmRemove(null)}>Batal</Button>
              <Button variant="destructive" onClick={() => void removeFriend(confirmRemove)}>Hapus</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
