"use client";

// Panel PvP: undangan by username, atau gabung lewat kode kamar.
//
// Sisi yang dipilih pemain dipakai server sebagai sisi sebenarnya, jadi tidak
// ada lagi tombol "Mulai sebagai Putih" yang diam-diam memakai sisi yang
// tidak dipilih.

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/use-session";
import type { Side } from "@/lib/chess";

export type PvpRoom = {
  code: string;
  whiteUser: string | null;
  blackUser: string | null;
  creatorUser: string;
  creatorSide: "white" | "black";
  invitedUser: string | null;
  status: "waiting" | "active" | "finished";
  fen: string;
  moves: string[];
  winner: "white" | "black" | "draw" | null;
  outcomeKind?: string;
};

type Invite = { code: string; creatorUser: string; creatorSide: "white" | "black"; targeted: boolean; createdAt: number };
type Player = { username: string; fullName: string; elo: number; online: boolean };

type Props = {
  user: SessionUser | null;
  room: PvpRoom | null;
  yourSide: Side | null;
  token: string;
  onRoom: (room: PvpRoom, side: Side, token: string) => void;
  onLeave: () => void;
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/pvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Gagal.");
  return data as T;
}

export function PvpPanel({ user, room, yourSide, token, onRoom, onLeave }: Props) {
  const [inviteUser, setInviteUser] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [sideChoice, setSideChoice] = useState<"white" | "black" | "random">("white");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshInvites = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/pvp?user=${encodeURIComponent(user.username)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setInvites(data.invites ?? []);
        setPlayers(data.online ?? []);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    void refreshInvites();
    const t = setInterval(() => void refreshInvites(), 6000);
    return () => clearInterval(t);
  }, [refreshInvites]);

  if (!user) {
    return <p className="prose-note">Masuk dulu untuk bermain PvP: kamu perlu username agar lawan bisa mengundanganmu.</p>;
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const data = await call<{ room: PvpRoom; yourSide: Side; playerToken: string }>({
        action: "create",
        side: sideChoice,
        invitedUser: inviteUser.trim() || undefined,
      });
      onRoom(data.room, data.yourSide, data.playerToken);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join(code: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await call<{ room: PvpRoom; yourSide: Side; playerToken: string }>({ action: "join", code });
      onRoom(data.room, data.yourSide, data.playerToken);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (room) {
    const opponent = yourSide === "white" ? room.blackUser : room.whiteUser;
    return (
      <div className="stack-tight">
        <div className="row-between">
          <div className="min-w-0">
            <div className="label">Kamar {room.code}</div>
            <div className="font-bold truncate">
              Kamu: {yourSide === "white" ? "Putih" : "Hitam"} · Lawan: {opponent ?? (room.status === "waiting" ? "menunggu…" : "—")}
            </div>
          </div>
          <button className="ctl ctl-xs" onClick={onLeave}>
            Keluar
          </button>
        </div>

        {room.status === "waiting" && (
          <p className="prose-note">
            Bagikan kode <span className="clock">{room.code}</span> atau undangan ke @{room.invitedUser ?? "siapa pun"}.
            Sisi kamu sudah dikunci server.
          </p>
        )}

        <button className="ctl ctl-sm ctl-danger" onClick={onLeave}>
          Tinggalkan kamar
        </button>
      </div>
    );
  }

  const targeted = invites.filter((i) => i.targeted);
  const open = invites.filter((i) => !i.targeted);

  return (
    <div className="stack">
      {error && (
        <p className="panel p-2 prose-note" style={{ borderColor: "var(--destructive)" }} role="alert">
          {error}
        </p>
      )}

      <div>
        <div className="label" style={{ marginBottom: "0.35rem" }}>
          Sisi yang kamu pakai
        </div>
        <div className="row" style={{ gap: "0.5rem" }}>
          {(["white", "random", "black"] as const).map((s) => (
            <button
              key={s}
              className={`ctl ctl-sm ctl-choice ${sideChoice === s ? "ctl-active" : ""}`}
              aria-pressed={sideChoice === s}
              onClick={() => setSideChoice(s)}
            >
              {s === "white" ? "Putih" : s === "black" ? "Hitam" : "Acak"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label" style={{ marginBottom: "0.35rem" }}>
          Undang pemain (username)
        </div>
        <div className="row" style={{ gap: "0.5rem" }}>
          <input
            className="field"
            style={{ flex: "1 1 10rem" }}
            placeholder="@username"
            value={inviteUser}
            onChange={(e) => setInviteUser(e.target.value)}
            list="pvp-players"
          />
          <datalist id="pvp-players">
            {players.map((p) => (
              <option key={p.username} value={p.username}>
                {p.fullName}
              </option>
            ))}
          </datalist>
          <button className="ctl ctl-primary ctl-sm" onClick={() => void create()} disabled={busy}>
            Buat kamar
          </button>
        </div>
      </div>

      <div>
        <div className="label" style={{ marginBottom: "0.35rem" }}>
          Gabung dengan kode
        </div>
        <div className="row" style={{ gap: "0.5rem" }}>
          <input
            className="field"
            style={{ flex: "1 1 10rem" }}
            placeholder="FIF-XXXXXX"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          />
          <button className="ctl ctl-sm" onClick={() => void join(codeInput.trim())} disabled={busy || codeInput.trim().length < 4}>
            Gabung
          </button>
        </div>
      </div>

      {targeted.length > 0 && (
        <div className="panel p-2 stack-tight">
          <span className="label">Undangan untukmu</span>
          {targeted.map((i) => (
            <div key={i.code} className="row-between">
              <span className="prose-note">
                @{i.creatorUser} ({i.creatorSide === "white" ? "Putih" : "Hitam"})
              </span>
              <button className="ctl ctl-xs" onClick={() => void join(i.code)}>
                Terima
              </button>
            </div>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <div className="panel p-2 stack-tight">
          <span className="label">Kamar terbuka</span>
          {open.map((i) => (
            <div key={i.code} className="row-between">
              <span className="prose-note">
                @{i.creatorUser} ({i.creatorSide === "white" ? "Putih" : "Hitam"})
              </span>
              <button className="ctl ctl-xs" onClick={() => void join(i.code)}>
                Gabung
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
