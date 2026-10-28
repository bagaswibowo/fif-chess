"use client";

/**
 * components/views/classroom-view.tsx (S7-T4 frontend, ADR-010 D5)
 * Ruang Kelas di hash #/classroom — collab 2-pemain: join-by-room-code +
 * papan bersama + catatan bersama (in-memory, tanpa persistensi).
 *
 * Mekanik = REUSE op room /api/pvp (kontrak sprint7 §1.5 — design doc §4.6
 * versi lama menyebut `purpose`/`/api/classroom/notes`; kontrak menang):
 *   create { action:"create", classroom:true, side? } → { room, yourSide, playerToken }
 *   join   { action:"join", code } → { room, yourSide, playerToken }
 *   move   { action:"move", code, from, to, promotion?, playerToken }
 *   leave  { action:"leave", code, playerToken }
 *   note   { action:"note", code, playerToken, text } → { notes } (cap 50, 500 char)
 * Sync real-time = useRealtime topik gameTopic(code) REUSE — event NEW
 * ClassroomJoined/ClassroomNote + MoveMade/GameEnded REUSE (diimpor dari
 * lib/realtime/events.ts, TIDAK di-restatement).
 *
 * Notice ADR D5 (in-memory, tanpa tabel): "Sesi sementara — hilang saat
 * restart server / 30 menit tidak aktif".
 * Anti-slop: angka/nama pemain semua dari payload endpoint/WS.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  ArrowLeft, ArrowRight, Copy, Loader2, LogOut, MessageSquare, Presentation,
  Send, X,
} from "lucide-react";
import { useChessTheme } from "@/lib/chess-themes";
import { useRealtime } from "@/lib/use-realtime";
import { EmptyState } from "@/components/ui/empty-state";
import {
  gameTopic,
  type ClassroomJoined,
  type ClassroomNote,
  type MoveMade,
  type GameEnded,
  type RoomNote,
} from "@/lib/realtime/events";
import { authErrorPayload, authErrorText } from "@/lib/use-session";
import type { PvpRoom } from "@/components/pvp-panel";
import type { Side } from "@/lib/chess";
import type { CoursesAuthStatus } from "./courses-view";

type RoomPhase = "lobby" | "connecting" | "active" | "finished";

async function pvpCall<T>(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch("/api/pvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export function ClassroomView({ authStatus }: { authStatus: CoursesAuthStatus }) {
  const { customPieces, boardTheme } = useChessTheme();
  const [phase, setPhase] = useState<RoomPhase>("lobby");
  const [room, setRoom] = useState<PvpRoom | null>(null);
  const [yourSide, setYourSide] = useState<Side>("white");
  const [token, setToken] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [wsLost, setWsLost] = useState(false);

  // Lawan diisi dari event WS classroom_joined (slot room putih/hitam saat
  // create masih null — sumber riil tunggal nama lawan = event join).
  const [opponent, setOpponent] = useState<string | null>(null);

  // Papan collab: FEN dari room (source = WS MoveMade + response op), klik
  // asal → klik tujuan utk melangkah (op move REUSE — server validasi giliran).
  const [fen, setFen] = useState(room?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selected, setSelected] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  // Catatan (in-memory pada room; cap 50 newest — sumber = room.notes + WS).
  const [notes, setNotes] = useState<RoomNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const notesRef = useRef<HTMLDivElement | null>(null);

  // Live region: satu pengumuman per event (throttle, floor §4.5).
  const [announce, setAnnounce] = useState("");

  const roomCode = room?.code ?? "";
  const yourUsername = useMemo(() => {
    if (!room) return null;
    return yourSide === "white" ? room.whiteUser : room.blackUser;
  }, [room, yourSide]);
  // Nama lawan: slot room terisi (join) → pakai slot; kalau belum (creator
  // masih menunggu) → nama dari event WS classroom_joined (sumber riil).
  const roomSlotOther = useMemo(() => {
    if (!room) return null;
    return yourSide === "white" ? room.blackUser : room.whiteUser;
  }, [room, yourSide]);
  const opponentName = roomSlotOther ?? opponent ?? null;

  // ── WS: topik gameTopic(code) REUSE; event S7 NEW + S6 REUSE (kontrak §2) ──
  // Deteksi koneksi putus (kopling §4.3): hook useRealtime auto-resume; klien
  // menandai "Koneksi terputus" bila room aktif namun event apa pun tak datang
  // >90 detik, lalu status dikembalikan setelah event baru tiba.
  const lastWsEventRef = useRef(Date.now());

  useRealtime({
    topics: roomCode ? [gameTopic(roomCode)] : [],
    enabled: Boolean(roomCode) && phase !== "lobby",
    onEvent: (ev) => {
      lastWsEventRef.current = Date.now();
      setWsLost(false);
      if (ev.type === "move_made") {
        const m = ev as MoveMade;
        if (m.gameId !== roomCode) return;
        setFen(m.fen);
        setSelected(null);
        setAnnounce(`Langkah ${m.san} (giliran berikutnya).`);
      } else if (ev.type === "classroom_joined") {
        const j = ev as ClassroomJoined;
        if (j.gameId !== roomCode) return;
        setPhase("active");
        // Lawan = username joiner (slot room belum terisi saat create).
        setOpponent(j.user);
        setAnnounce(`${j.user} bergabung (${j.side === "white" ? "Putih" : "Hitam"}).`);
      } else if (ev.type === "classroom_note") {
        const n = ev as ClassroomNote;
        if (n.gameId !== roomCode) return;
        setNotes((prev) => [...prev, n.note].slice(-50));
        setAnnounce(`Catatan ${n.note.author}: "${n.note.text}"`);
      } else if (ev.type === "game_ended") {
        const g = ev as GameEnded;
        if (g.gameId !== roomCode) return;
        setPhase("finished");
        setAnnounce(`Ruang selesai (${g.result}).`);
      }
    },
  });

  useEffect(() => {
    if (phase !== "active" && phase !== "connecting") return;
    const t = setInterval(() => {
      if (Date.now() - lastWsEventRef.current > 90_000) setWsLost(true);
    }, 15_000);
    return () => clearInterval(t);
  }, [phase]);

  // ── Aksi lobby: buat / gabung ──
  const createRoom = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { ok, status, data } = await pvpCall<{ room?: PvpRoom; yourSide?: Side; playerToken?: string }>({
      action: "create",
      classroom: true,
    });
    setBusy(false);
    if (!ok) {
      setError(status === 403 ? authErrorText(403, data, "ruang kelas") : data.error ?? "Gagal membuat ruang.");
      return;
    }
    enterRoom(data.room, data.yourSide ?? "white", data.playerToken ?? "");
  }, []);

  const joinRoom = useCallback(async (code: string) => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError("Kode ruang terlalu pendek.");
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, status, data } = await pvpCall<{ room?: PvpRoom; yourSide?: Side; playerToken?: string }>({
      action: "join",
      code: c,
    });
    setBusy(false);
    if (!ok) {
      setError(
        status === 404
          ? `Ruang ${c} tidak ditemukan.`
          : status === 400
            ? "Penuh — ruang kelas maksimal 2 pemain."
            : status === 403
              ? authErrorText(403, data, "ruang kelas")
              : data.error ?? `Ruang ${c} tidak ditemukan.`,
      );
      return;
    }
    enterRoom(data.room, data.yourSide ?? "white", data.playerToken ?? "");
  }, []);

  function enterRoom(r: PvpRoom | undefined, side: Side, t: string) {
    if (!r) return;
    setRoom(r);
    setYourSide(side);
    setToken(t);
    setFen(r.fen);
    setNotes(Array.isArray(r.notes) ? r.notes : []);
    setFlipped(side === "black");
    setPhase(r.status === "active" ? "active" : "connecting");
    setCodeInput("");
    setWsLost(false);
    setAnnounce(`Ruang ${r.code} — menunggu lawan bergabung.`);
  }

  const leaveRoom = useCallback(async () => {
    setConfirmLeave(false);
    if (roomCode) {
      void pvpCall({ action: "leave", code: roomCode, playerToken: token });
    }
    setRoom(null);
    setToken("");
    setOpponent(null);
    setNotes([]);
    setSelected(null);
    setPhase("lobby");
    setError(null);
    setWsLost(false);
  }, [roomCode, token]);

  // ── Move: klik-klik (op move REUSE; server validasi giliran/keilegalan) ──
  // Giliran diturunkan dari FEN room (kontrak: status = waiting/active/finished;
  // "turn" tidak ada di PvpRoom — FEN adalah source of truth move).
  const toMove: "white" | "black" = useMemo(() => {
    const side = fen.split(" ")[1] ?? "w";
    return side === "w" ? "white" : "black";
  }, [fen]);
  const myTurn = phase === "active" && toMove === yourSide;

  const sendMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      const chess = new Chess(fen);
      let legal = false;
      try {
        // Validasi lokal dulu (pola S4-S6): legalitas dicek chess.js dari FEN
        // saat ini; server tetap yang memvalidasi & mencatat (op move REUSE).
        const m = chess.move({ from, to, ...(promotion ? { promotion } : {}) });
        legal = Boolean(m);
      } catch {
        legal = false;
      }
      if (!legal) {
        setSelected(null);
        return;
      }
      const { ok, data } = await pvpCall<{ room?: PvpRoom }>({
        action: "move",
        code: roomCode,
        from,
        to,
        ...(promotion ? { promotion } : {}),
        playerToken: token,
      });
      if (ok && data.room) {
        setFen(data.room.fen);
        setRoom(data.room);
      } else if (!ok) {
        setAnnounce(data.error ?? "Gagal mengirim langkah.");
      }
      setSelected(null);
    },
    [fen, roomCode, token],
  );

  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (!myTurn) return;
      if (!selected) {
        try {
          const c = new Chess(fen);
          const piece = c.get(square as Parameters<typeof c.get>[0]);
          if (piece && (piece.color === yourSide[0] as "w" | "b")) setSelected(square);
        } catch {
          /* FEN tak valid */
        }
        return;
      }
      if (selected === square) {
        setSelected(null);
        return;
      }
      // Deteksi promosi pion lokal; 'q' = pilihan sederhana (YAGNI §4.2 —
      // tanpa dialog promosi; server tetap memvalidasi).
      let isPromotion = false;
      try {
        const c = new Chess(fen);
        const mv = c.move({ from: selected, to: square });
        isPromotion = Boolean(mv && mv.promotion);
      } catch {
        isPromotion = false;
      }
      void sendMove(selected, square, isPromotion ? "q" : undefined);
    },
    [myTurn, selected, fen, yourSide, sendMove],
  );

  // ── Catatan: kirim op note REUSE (server publish ClassroomNote WS) ──
  const sendNote = useCallback(async () => {
    const text = noteText.trim();
    if (!text) return;
    if (text.length > 500) {
      setNoteError("Catatan terlalu panjang (maks 500).");
      return;
    }
    setNoteError(null);
    const { ok, status, data } = await pvpCall<{ notes?: RoomNote[] }>({
      action: "note",
      code: roomCode,
      playerToken: token,
      text,
    });
    if (ok && Array.isArray(data.notes)) {
      setNotes(data.notes);
      setNoteText("");
      notesRef.current?.scrollTo({ top: notesRef.current.scrollHeight });
    } else if (!ok) {
      setNoteError(
        status === 400 ? (data.error ?? "Catatan ditolak.") : status === 404 ? "Ruang tidak ditemukan." : authErrorText(status, data, "catatan"),
      );
    }
  }, [noteText, roomCode, token]);

  const copyCode = () => {
    if (!roomCode) return;
    void navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Pending auth: tidak boleh bikin/gabung (op guard FIX-1 S6 D3.5) ──
  if (authStatus === "pending") {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 py-10">
        <header className="flex items-center gap-3">
          <Presentation size={22} className="text-[var(--primary)]" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-black text-white">Ruang Kelas</h1>
            <p className="text-xs text-neutral-400">Jelaskan langkah bersama — 2 pemain, papan dan catatan bersama.</p>
          </div>
        </header>
        <p role="status" className="text-sm font-bold text-neutral-300">
          Akun menunggu persetujuan admin — ruang kelas belum tersedia.
        </p>
      </div>
    );
  }

  // ── LOBBY ──
  if (phase === "lobby") {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 py-4">
        <header className="flex items-center gap-3">
          <Presentation size={22} className="text-[var(--primary)]" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-black text-white">Ruang Kelas</h1>
            <p className="text-xs text-neutral-400">
              Jelaskan langkah bersama — 2 pemain, papan dan catatan bersama. Tanpa rekaman: catatan hilang saat ruang tutup.
            </p>
          </div>
        </header>

        <p role="status" className="text-[11px] font-bold text-neutral-500">
          Sesi sementara — hilang saat restart server / 30 menit tidak aktif.
        </p>

        {/* Gabung via kode */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <label htmlFor="classroom-code" className="label">Kode ruang</label>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              id="classroom-code"
              className="field flex-1 min-w-[10rem] uppercase"
              placeholder="mis. FIF-AB12CD"
              value={codeInput}
              maxLength={16}
              inputMode="text"
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void joinRoom(codeInput);
              }}
            />
            <button
              className="ctl ctl-sm ctl-active"
              onClick={() => void joinRoom(codeInput)}
              disabled={busy || codeInput.trim().length < 4}
              aria-label="Coba kode ruang"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : null} Coba
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs font-bold text-[var(--destructive)]">
              {error}
            </p>
          )}
        </div>

        {/* Status ruang (lobby: belum ada room user) — EmptyState S9-T3 */}
        <EmptyState
          title="Tidak ada yang bergabung."
          hint={"Buat ruang baru — memunculkan kode {code} yang bisa dibagikan."}
          ctaLabel="Buat ruang baru"
          onCta={() => void createRoom()}
        />
      </div>
    );
  }

  // ── ROOM AKTIF / MENUNGGU ──
  const playerName = (s: Side) => (yourSide === s ? `@${yourUsername ?? "kamu"}` : `@${opponentName ?? "…"}`);
  const turnLabel = myTurn ? "Giliranmu" : `Giliran ${toMove === "white" ? "Putih" : "Hitam"}`;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 pb-4">
      {/* Header room */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Presentation size={20} className="text-[var(--primary)] shrink-0" aria-hidden="true" />
          <button
            type="button"
            className="font-mono text-sm font-black text-white rounded-lg border border-[var(--border)] px-2 py-1 hover:border-[var(--primary)] flex items-center gap-1.5"
            onClick={copyCode}
            aria-label={`Salin kode ruang ${roomCode}`}
          >
            {roomCode}
            <Copy size={12} className={copied ? "text-[var(--primary)]" : "text-neutral-400"} aria-hidden="true" />
            <span className="sr-only">{copied ? "tersalin" : ""}</span>
          </button>
          <span className="text-xs font-bold text-neutral-300 truncate">
            {playerName("white")} vs {playerName("black")}
          </span>
          <button
            className="ctl ctl-sm inline-flex items-center gap-1.5"
            onClick={() => setConfirmLeave(true)}
            aria-label="Tinggalkan ruang kelas"
          >
            <LogOut size={13} aria-hidden="true" /> Tinggalkan
          </button>
        </div>
        {wsLost && (
          <p role="alert" className="text-xs font-bold text-[var(--destructive)]">
            Koneksi terputus. Ruang mungkin sudah ditutup.
          </p>
        )}
      </div>

      <p className="text-[11px] font-bold text-neutral-500" role="status">
        Sesi sementara — hilang saat restart server / 30 menit tidak aktif.
      </p>

      {/* Status pemain */}
      <div className="flex items-center gap-2" role="status" aria-live="polite">
        <span
          className={`w-2.5 h-2.5 rounded-full inline-block ${
            phase === "active" ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
          }`}
          aria-hidden="true"
        />
        {phase === "connecting" ? (
          <span className="text-xs font-bold text-neutral-300">1 bergabung (1/2).</span>
        ) : phase === "active" ? (
          <span className="text-xs font-bold text-neutral-300">2 bergabung (2/2).</span>
        ) : (
          <span className="text-xs font-bold text-neutral-300">Ruang selesai.</span>
        )}
        {phase === "active" && (
          <span className="text-xs font-bold text-[var(--primary)]">· {turnLabel}</span>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      {/* Papan + panel catatan (mobile: catatan di bawah — pola sheet S1) */}
      <div className="grid md:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
        <div className="rounded-2xl p-2.5 bg-[var(--card)] border border-[var(--border)] shadow-xl w-full flex flex-col items-center">
          <div
            className="aspect-square w-full max-w-[min(100%,calc(100dvh-260px))] rounded-xl overflow-hidden border-2 border-[var(--board-dark)] relative"
            style={{ backgroundColor: boardTheme.dark }}
            aria-label={`Papan ruang kelas ${roomCode}, giliran ${turnLabel}`}
          >
            <Chessboard
              key={`classroom-${roomCode}-${fen}`}
              options={{
                id: `classroom-board-${roomCode}`,
                position: fen,
                boardOrientation: flipped ? "black" : "white",
                allowDragging: false,
                allowDrawingArrows: false,
                onSquareClick,
                squareStyles: selected ? { [selected]: { boxShadow: "inset 0 0 0 3px var(--primary)" } } : undefined,
                boardStyle: { backgroundColor: boardTheme.dark, width: "100%", height: "100%" },
                lightSquareStyle: { backgroundColor: boardTheme.light },
                darkSquareStyle: { backgroundColor: boardTheme.dark },
                pieces: customPieces,
                animationDurationInMs: 200,
              }}
            />
          </div>
          {/* Kontrol move: [Balik] + info giliran (server room forward-only —
              tidak ada op undo; YAGNI, tanpa fitur palsu). */}
          <div className="mt-2 flex items-center gap-2 w-full">
            <button
              className="ctl ctl-sm flex-1 flex items-center justify-center gap-1.5"
              onClick={() => setFlipped((v) => !v)}
              aria-label="Balik papan"
            >
              <ArrowRight size={13} aria-hidden="true" /> Balik
            </button>
            <span className="text-[11px] font-mono text-neutral-400" role="status">{turnLabel}</span>
          </div>
          {phase === "connecting" && (
            <p className="mt-1 text-[11px] font-bold text-neutral-400 flex items-center gap-1.5" role="status">
              <Loader2 size={12} className="animate-spin" /> Menunggu lawan… bagikan kode {roomCode}
            </p>
          )}
        </div>

        {/* Panel catatan (300px) — list + input 1 baris (pola chat ringan) */}
        <div className="panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md w-full flex flex-col min-h-[16rem]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
            <MessageSquare size={15} className="text-[var(--primary)]" aria-hidden="true" />
            <span className="text-sm font-black text-white">Catatan</span>
            <span className="text-[10px] text-neutral-500">bertahan hanya selama room aktif</span>
          </div>
          <div
            ref={notesRef}
            className="flex-1 overflow-y-auto custom-scrollbar mt-2 space-y-2 min-h-[6rem]"
            aria-label="Daftar catatan ruang"
          >
            {notes.length === 0 ? (
              <p className="text-xs text-neutral-400" role="status">Catatan belum ada.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="text-xs">
                  <span className="font-black text-[var(--primary)]">
                    @{n.author === yourUsername ? "kamu" : n.author}
                  </span>{" "}
                  <span className="text-neutral-300">"{n.text}"</span>
                  <span className="text-neutral-500 block text-[10px] mt-0.5">
                    {new Date(n.createdAt).toLocaleTimeString("id-ID")} · posisi langkah {n.moveCount}
                  </span>
                </div>
              ))
            )}
          </div>
          {noteError && (
            <p role="alert" className="mt-2 text-[11px] font-bold text-[var(--destructive)]">{noteError}</p>
          )}
          <div className="mt-2 flex gap-1.5">
            <input
              className="field flex-1 min-w-0"
              placeholder={opponentName ? `Tulis catatan untuk @${opponentName}…` : "Tulis catatan…"}
              aria-label={`Tulis catatan untuk ${opponentName ?? "lawan"}`}
              value={noteText}
              maxLength={500}
              disabled={phase === "finished"}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendNote();
              }}
            />
            <button
              className="ctl ctl-sm ctl-active"
              onClick={() => void sendNote()}
              disabled={!noteText.trim() || phase === "finished"}
              aria-label="Kirim catatan"
            >
              <Send size={13} aria-hidden="true" /> Kirim
            </button>
          </div>
        </div>
      </div>

      {/* Modal konfirmasi tinggalkan — fokus awal "Tetap" (default aman, S6 §3.5) */}
      {confirmLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Tinggalkan ruang?"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmLeave(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl">
            <h2 className="text-sm font-black text-white">Tinggalkan ruang?</h2>
            <p className="mt-1 text-xs text-neutral-400">Catatan & posisi hilang saat ruang ditutup (tanpa rekaman).</p>
            <div className="mt-3 flex gap-2 justify-end">
              <button
                className="ctl ctl-sm"
                onClick={() => setConfirmLeave(false)}
                autoFocus
                aria-label="Tetap di ruang"
              >
                <X size={13} aria-hidden="true" /> Tetap
              </button>
              <button
                className="ctl ctl-sm ctl-danger"
                onClick={() => void leaveRoom()}
                aria-label="Tinggalkan ruang"
              >
                <ArrowLeft size={13} aria-hidden="true" /> Tinggalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
