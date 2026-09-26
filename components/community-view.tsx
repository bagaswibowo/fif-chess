"use client";

// Komunitas: papan diskusi + direktori pemain. Semua data dari server, tidak
// ada placeholder. Penulisan requires login; moderasi (hapus) hanya admin.

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/use-session";

export type CommunityPost = {
  id: string;
  authorUsername: string;
  authorName: string;
  authorRole: string;
  title: string;
  content: string;
  category: string;
  likes: number;
  createdAt: string;
};

export type PlayerRow = { username: string; fullName: string; elo: number; online: boolean };

type Props = { user: SessionUser | null; lang?: "id" | "en" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Gagal memuat data.");
  return data as T;
}

export function CommunityView({ user, lang = "id" }: Props) {
  const [tab, setTab] = useState<"feed" | "players">("feed");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, d] = await Promise.all([
        api<{ posts: CommunityPost[] }>("/api/community"),
        api<{ players: PlayerRow[] }>("/api/pvp?directory=1"),
      ]);
      setPosts(p.posts);
      setPlayers(d.players);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const key = user?.id ?? "anon";
    if (loadedFor === key) return;
    setLoadedFor(key);
    void load();
  }, [loadedFor, user?.id, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/community", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          authorUsername: user.username,
          authorName: user.fullName,
          authorRole: user.role,
          title,
          content,
        }),
      });
      setTitle("");
      setContent("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function like(id: string) {
    if (!user) return;
    try {
      await api("/api/community", { method: "POST", body: JSON.stringify({ action: "like", postId: id }) });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    if (!user?.isAdmin) return;
    try {
      await api("/api/community", { method: "POST", body: JSON.stringify({ action: "delete", postId: id }) });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
      <div className="row-between">
        <h2 className="section-title">{lang === "id" ? "Komunitas FIF" : "FIF Community"}</h2>
        <div className="row" style={{ gap: "0.5rem" }}>
          <button className={`ctl ctl-sm ${tab === "feed" ? "ctl-active" : ""}`} onClick={() => setTab("feed")}>
            Diskusi
          </button>
          <button className={`ctl ctl-sm ${tab === "players" ? "ctl-active" : ""}`} onClick={() => setTab("players")}>
            Pemain
          </button>
        </div>
      </div>

      {error && (
        <p className="panel p-2 prose-note" style={{ borderColor: "var(--destructive)" }} role="alert">
          {error}
        </p>
      )}

      {tab === "feed" ? (
        <>
          {user ? (
            <form className="panel p-3 stack-tight" onSubmit={submit}>
              <div className="label">Tulis diskusi</div>
              <input
                className="field"
                placeholder="Judul"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
              <textarea
                className="field"
                placeholder="Isi diskusi"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                maxLength={2000}
                required
                style={{ paddingTop: "0.5rem", height: "auto" }}
              />
              <button className="ctl ctl-primary ctl-sm" disabled={busy} type="submit">
                {busy ? "Mengirim…" : "Kirim"}
              </button>
            </form>
          ) : (
            <p className="panel p-3 prose-note">Masuk dulu untuk ikut berdiskusi dan menantang teman.</p>
          )}

          {posts.length === 0 ? (
            <p className="prose-note">Belum ada diskusi.</p>
          ) : (
            <ul className="stack-tight" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {posts.map((p) => (
                <li key={p.id} className="panel p-3 stack-tight">
                  <div className="row-between">
                    <div className="min-w-0">
                      <div className="font-bold wrap-anywhere">{p.title}</div>
                      <div className="prose-note" style={{ fontSize: "var(--text-xs)" }}>
                        @{p.authorUsername} · {p.authorName} · {new Date(p.createdAt).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <span className="ctl ctl-xs shrink-0">{p.category}</span>
                  </div>
                  <p className="prose-note wrap-anywhere" style={{ whiteSpace: "pre-wrap" }}>
                    {p.content}
                  </p>
                  <div className="row" style={{ gap: "0.5rem" }}>
                    <button className="ctl ctl-xs" onClick={() => void like(p.id)} disabled={!user}>
                      Suka · {p.likes}
                    </button>
                    {user?.isAdmin && (
                      <button className="ctl ctl-xs ctl-danger" onClick={() => void remove(p.id)}>
                        Hapus
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Pemain</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.username}>
                    <td className="wrap-anywhere">
                      {p.fullName} <span className="prose-note">@{p.username}</span>
                    </td>
                    <td className="num">{p.elo}</td>
                    <td style={{ color: p.online ? "var(--primary)" : "var(--muted-foreground)" }}>
                      {p.online ? "Membuat kamar" : "Offline"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
