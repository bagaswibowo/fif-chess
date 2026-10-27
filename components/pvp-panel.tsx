"use client";

// Panel PvP: undangan by username, atau gabung lewat kode kamar.
//
// Sisi yang dipilih pemain dipakai server sebagai sisi sebenarnya, jadi tidak
// ada lagi tombol "Mulai sebagai Putih" yang diam-diam memakai sisi yang
// tidak dipilih.

import { useCallback, useEffect, useState } from "react";
import { Flag, Handshake, X } from "lucide-react";
import type { SessionUser } from "@/lib/use-session";
import type { Side } from "@/lib/chess";
import { isValidTimeControl, loadStoredTimeControl, saveStoredTimeControl } from "@/lib/time-control";
import { useRealtime } from "@/lib/use-realtime";
import { gameTopic, type DrawOffered, type DrawDeclined, type GameAborted } from "@/lib/realtime/events";

/**
 * S6-T2 (docs/design/sprint6-flows.md §2, ADR-009 D2): preset clock 6 chip +
 * custom. Konstanta FRONTEND-only — format tunggal "<menit>+<inkremen>",
 * kategori TIDAK dikirim (diturunkan server dari menit). Default 3+2
 * (spec §2.2); pilihan terakhir per user di localStorage.jev_tc_last.
 */
const CLOCK_PRESETS: { label: string; tc: string; tooltip: string }[] = [
  { label: "1+0", tc: "1+0", tooltip: "1 menit tanpa tambahan" },
  { label: "3+0", tc: "3+0", tooltip: "3 menit tanpa tambahan" },
  { label: "3+2", tc: "3+2", tooltip: "3 menit + 2 detik tambahan" },
  { label: "5+0", tc: "5+0", tooltip: "5 menit tanpa tambahan" },
  { label: "10+0", tc: "10+0", tooltip: "10 menit tanpa tambahan" },
  { label: "15+10", tc: "15+10", tooltip: "15 menit + 10 detik tambahan" },
];

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
  /** S6-T2: field baru opsional (docs/design/sprint6-flows.md §2.6; aturan
   *  format TC di docs/contracts/sprint6.md §1.2 + ADR-009 D2) —
   *  room lama tidak punya. */
  timeControl?: string;
  rated?: boolean;
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

  // S6-T2: preset clock + mode (rated/casual) + custom — pilihan terakhir per
  // user disimpan (lib/time-control.ts: jev_tc_last), default awal 3+2 (spec §2.2).
  const [tc, setTc] = useState<string>(() => loadStoredTimeControl());
  const [rated, setRated] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customBase, setCustomBase] = useState("5");
  const [customInc, setCustomInc] = useState("0");
  const [customErr, setCustomErr] = useState<string | null>(null);

  const persistTc = (value: string) => {
    setTc(value);
    setCustomOpen(false);
    setCustomErr(null);
    saveStoredTimeControl(value);
  };

  const applyCustom = () => {
    const candidate = `${customBase.trim()}+${customInc.trim()}`;
    if (!isValidTimeControl(candidate)) {
      setCustomErr("Format: menit + detik (contoh: 5+0).");
      return;
    }
    persistTc(candidate);
  };

  // S6-T3: offer-draw + abort di panel kamar aktif (kontrak §1.3).
  const [drawState, setDrawState] = useState<"idle" | "offered" | "accepted" | "declined" | "no-answer">("idle");
  const [resignConfirm, setResignConfirm] = useState(false);
  const [abortNote, setAbortNote] = useState<string | null>(null);
  const [incomingDraw, setIncomingDraw] = useState<{ fromUser: string } | null>(null);

  const roomActive = Boolean(room);
  const roomCode = room?.code ?? "";

  // GameAborted: lawan (atau server) membatalkan kamar → keluar rapi.
  useRealtime({
    topics: roomCode ? [gameTopic(roomCode)] : [],
    enabled: roomActive,
    onEvent: (ev) => {
      const g = ev as GameAborted | DrawOffered | DrawDeclined;
      if (g.type === "game_aborted") {
        setAbortNote("Kamar dibatalkan. Lawan telah diberitahu.");
        onLeave();
      } else if (g.type === "draw_offered") {
        setIncomingDraw({ fromUser: (g as DrawOffered).fromUser });
        setDrawState("idle");
      } else if (g.type === "draw_declined") {
        setIncomingDraw(null);
        setDrawState("declined");
      }
    },
  });

  useEffect(() => {
    if (drawState === "offered") {
      const t = setTimeout(() => setDrawState((s) => (s === "offered" ? "no-answer" : s)), 30000);
      return () => clearTimeout(t);
    }
  }, [drawState]);

  const offerDraw = useCallback(async () => {
    if (!roomCode || !token) return;
    setDrawState("offered");
    try {
      await call({ action: "draw-offer", code: roomCode, playerToken: token });
    } catch (e) {
      setDrawState("idle");
      setError((e as Error).message);
    }
  }, [roomCode, token]);

  const acceptDraw = useCallback(async () => {
    if (!roomCode || !token) return;
    setIncomingDraw(null);
    setDrawState("accepted");
    try {
      await call({ action: "draw", code: roomCode, playerToken: token });
    } catch (e) {
      setDrawState("idle");
      setError((e as Error).message);
    }
  }, [roomCode, token]);

  const declineDraw = useCallback(async () => {
    if (!roomCode || !token) return;
    setIncomingDraw(null);
    setDrawState("declined");
    try {
      await call({ action: "draw-decline", code: roomCode, playerToken: token });
    } catch (e) {
      setDrawState("idle");
      setError((e as Error).message);
    }
  }, [roomCode, token]);

  const resignNow = useCallback(async () => {
    setResignConfirm(false);
    if (!roomCode || !token) return;
    try {
      await call({ action: "resign", code: roomCode, playerToken: token });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [roomCode, token]);

  const leaveRoom = useCallback(async () => {
    // S6-T3 (D3.1): leave = abort saat 0 langkah — server menutup room
    // outcomeKind "aborted" + publish GameAborted (event di atas).
    if (room?.status === "waiting") {
      setAbortNote("Kamar dibatalkan. Lawan telah diberitahu.");
    }
    onLeave();
  }, [room, onLeave]);

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
  if (user.status === "pending") {
    return <p className="prose-note" role="status">Akun menunggu persetujuan admin — fitur PvP belum tersedia.</p>;
  }
  if (user.status === "rejected") {
    return <p className="prose-note" role="status">Akun Anda ditolak admin.</p>;
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const data = await call<{ room: PvpRoom; yourSide: Side; playerToken: string }>({
        action: "create",
        side: sideChoice,
        invitedUser: inviteUser.trim() || undefined,
        // S6-T2 (docs/design/sprint6-flows.md §2.6; aturan TC
        // docs/contracts/sprint6.md §1.2): timeControl + rated di-request
        // create; PvpRoom menambah field opsional tsb agar panel bisa
        // menampilkannya.
        timeControl: tc,
        rated,
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
    const waiting = room.status === "waiting";
    const active = room.status === "active";
    return (
      <div className="stack-tight">
        <div className="row-between">
          <div className="min-w-0">
            <div className="label">Kamar {room.code}</div>
            <div className="font-bold truncate">
              Kamu: {yourSide === "white" ? "Putih" : "Hitam"} · Lawan: {opponent ?? (waiting ? "menunggu…" : "—")}
            </div>
          </div>
          <button className="ctl ctl-xs" onClick={() => void leaveRoom()}>
            Keluar
          </button>
        </div>

        {room.timeControl && (
          <p className="prose-note">
            Waktu: {room.timeControl} · {room.rated ? "Terbuka (rating)" : "Casual"} · Sisi: {yourSide === "white" ? "Putih" : "Hitam"}
          </p>
        )}

        {waiting && (
          <p className="prose-note">
            Bagikan kode <span className="clock">{room.code}</span> atau undangan ke @{room.invitedUser ?? "siapa pun"}.
            Sisi kamu sudah dikunci server.
          </p>
        )}

        {/* S6-T3: tawarkan remis (aktif) — lawan dapat WS draw_offered */}
        {active && (
          <div className="panel p-2.5 stack-tight" role="status" aria-live="polite">
            <span className="label">Tindakan partai</span>
            {resignConfirm ? (
            <div className="row" style={{ gap: "0.5rem" }}>
              <button
                className="ctl ctl-xs"
                autoFocus
                onClick={() => setResignConfirm(false)}
                aria-label="Batalkan konfirmasi menyerah"
              >
                Batalkan
              </button>
              <button className="ctl ctl-sm ctl-danger" onClick={() => void resignNow()}>
                Ya, Menyerah
              </button>
            </div>
            ) : (
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                className="ctl ctl-sm ctl-choice"
                aria-pressed={drawState === "offered"}
                onClick={() => void offerDraw()}
                disabled={drawState === "offered" || drawState === "accepted"}
              >
                <Handshake size={14} aria-hidden="true" /> Remis
              </button>
              <button className="ctl ctl-sm ctl-danger" onClick={() => setResignConfirm(true)}>
                <Flag size={14} aria-hidden="true" /> Menyerah
              </button>
            </div>
            )}
            {resignConfirm && (
              <p className="prose-note">Yakin menyerah? Partai dicatat sebagai kalah.</p>
            )}
            {drawState === "offered" && <p className="prose-note">Menawarkan remis…</p>}
            {drawState === "accepted" && <p className="prose-note" style={{ color: "var(--success)" }}>Remis diterima.</p>}
            {drawState === "declined" && <p className="prose-note">Remis ditolak.</p>}
            {drawState === "no-answer" && <p className="prose-note">Tidak ada jawaban.</p>}
          </div>
        )}

        {/* S6-T3: lawan menawarkan remis → terima / tolak */}
        {incomingDraw && (
          <div className="panel p-2.5 stack-tight" role="alert" aria-live="assertive">
            <p className="prose-note font-bold">Lawan menawarkan remis.</p>
            <div className="row" style={{ gap: "0.5rem" }}>
              <button className="ctl ctl-xs ctl-primary" onClick={() => void acceptDraw()}>
                Terima
              </button>
              <button className="ctl ctl-xs" onClick={() => void declineDraw()}>
                <X size={13} aria-hidden="true" /> Tolak
              </button>
            </div>
          </div>
        )}

        <button className="ctl ctl-sm ctl-danger" onClick={() => void leaveRoom()}>
          Tinggalkan kamar
        </button>
      </div>
    );
  }

  const targeted = invites.filter((i) => i.targeted);
  const openList = invites.filter((i) => !i.targeted);

  return (
    <div className="stack">
      {error && (
        <p className="panel p-2 prose-note" style={{ borderColor: "var(--destructive)" }} role="alert">
          {error}
        </p>
      )}

      {/* S6-T3: setelah GameAborted (lawan/server batalkan kamar) — pesan
          bermakna di panel awal, bukan dead-end. */}
      {abortNote && (
        <p className="panel p-2 prose-note" role="status" aria-live="polite">
          {abortNote}
        </p>
      )}

      {/* S6-T2: grup Waktu — 6 chip preset + custom (spec §2.2). Default 3+2. */}
      <fieldset className="panel p-2.5 stack-tight" style={{ margin: 0, border: "none", padding: "0.625rem" }} aria-label="Waktu">
        <legend className="label" style={{ marginBottom: "0.35rem" }}>Waktu</legend>
        <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }} role="group" aria-label="Preset waktu">
          {CLOCK_PRESETS.map((p) => (
            <button
              key={p.tc}
              className={`ctl ctl-xs ctl-choice ${tc === p.tc ? "ctl-active" : ""}`}
              aria-pressed={tc === p.tc}
              title={p.tooltip}
              onClick={() => persistTc(p.tc)}
            >
              {p.label}
            </button>
          ))}
          <button
            className={`ctl ctl-xs ${customOpen ? "ctl-active" : ""}`}
            aria-pressed={customOpen}
            onClick={() => setCustomOpen((v) => !v)}
          >
            Lainnya…
          </button>
        </div>
        {customOpen && (
          <div className="row stack-tight" style={{ gap: "0.4rem" }}>
            <label className="prose-note flex items-center gap-1">
              <span>Menit</span>
              <input
                className="field"
                style={{ width: "3.5rem" }}
                inputMode="numeric"
                aria-label="Menit"
                placeholder="mnt"
                value={customBase}
                onChange={(e) => setCustomBase(e.target.value)}
              />
            </label>
            <label className="prose-note flex items-center gap-1">
              <span>Detik</span>
              <input
                className="field"
                style={{ width: "3.5rem" }}
                inputMode="numeric"
                aria-label="Detik"
                placeholder="dtk"
                value={customInc}
                onChange={(e) => setCustomInc(e.target.value)}
              />
            </label>
            <button className="ctl ctl-xs ctl-primary" onClick={applyCustom} disabled={!isValidTimeControl(`${customBase}+${customInc}`)}>
              Pakai
            </button>
            <button className="ctl ctl-xs" onClick={() => setCustomOpen(false)}>
              Batal
            </button>
            {customErr && (
              <p className="prose-note" role="alert" style={{ color: "var(--destructive)", width: "100%" }}>
                {customErr}
              </p>
            )}
          </div>
        )}
        {/* Mode: Terbuka (rating) / Casual (spec §2.2) */}
        <div className="row" style={{ gap: "0.4rem" }} role="group" aria-label="Mode">
          <button
            className={`ctl ctl-xs ctl-choice ${rated ? "ctl-active" : ""}`}
            aria-pressed={rated}
            onClick={() => setRated(true)}
          >
            Terbuka (rating)
          </button>
          <button
            className={`ctl ctl-xs ctl-choice ${!rated ? "ctl-active" : ""}`}
            aria-pressed={!rated}
            onClick={() => setRated(false)}
          >
            Casual
          </button>
        </div>
        {rated && <p className="prose-note">Rating Anda berubah.</p>}
      </fieldset>

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

      {openList.length > 0 && (
        <div className="panel p-2 stack-tight">
          <span className="label">Kamar terbuka</span>
          {openList.map((i) => (
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
