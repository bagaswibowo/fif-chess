"use client";

/**
 * components/views/explorer-view.tsx (S6-T1 — docs/design/sprint6-flows.md §1)
 * Penjelajah Pembukaan di hash #/explorer.
 *
 * Kontrak (docs/contracts/sprint6.md §1.1, ADR-009 D1):
 * - Move tree dibangun di KLIEN: kandidat reply per posisi dari buku statis
 *   (lib/engines/opening-book.ts) + POST /api/opening { fen } per node
 *   (FenLookupResponse: opening?.name/eco + flag hasLessons bila server tandai).
 * - Win-rate per posisi = NEW GET /api/opening/win-rate?fen= — angka RIIL dari
 *   arsip games (no-mock). samples < 10 → kalimat sampel kecil, bukan %.
 * - Tab "Buah" = placeholder jujur (D1.4: tidak ada data buah di S6 — tidak
 *   memanggil endpoint mana pun, tanpa angka palsu).
 * - CTA "Materi" hanya tampil bila server menandai hasLessons (anti-slop:
 *   tidak ada tombol ke halaman kosong — link internal S7).
 * - A11y floor: status region sr-only + aria-live, node = button
 *   aria-expanded, papan read-only ber-aria-label konteks, stat selalu
 *   teks-angka berlabel (cue ganda, bukan warna saja).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Compass, BookOpen, ChevronRight, FlaskConical, Target } from "lucide-react";
import { OPENING_BOOK } from "@/lib/engines/opening-book";
import { loadStoredTimeControl, timeCategoryOf, type TimeCategory } from "@/lib/time-control";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Kandidat reply untuk FEN dari buku statis (semua kandidat, tidak acak). */
function allCandidatesFor(fen: string): string[] {
  const key = fen.trim().split(/\s+/).slice(0, 4).join(" ");
  const entry = OPENING_BOOK[key];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

function applyUci(fen: string, uci: string): string {
  try {
    const c = new Chess(fen);
    const m = c.move(uci);
    return m ? c.fen() : fen;
  } catch {
    return fen;
  }
}

function uciToSan(uci: string, fen: string): string {
  try {
    const c = new Chess(fen);
    const m = c.move(uci);
    return m ? m.san : uci;
  } catch {
    return uci;
  }
}

/** "1. e4 e5 2. Kf3 Nc6" dari list SAN (nomor baris tiap langkah Putih). */
function formatSanPath(sans: string[]): string {
  let out = "";
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) out += `${i / 2 + 1}.`;
    out += ` ${sans[i]}`;
  }
  return out.trim();
}

type WinRate = {
  fen: string;
  samples: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
};

type Node = {
  fen: string;
  /** Langkah UCI dari parent (null = root). */
  uci: string | null;
  /** Path SAN dari root (mis. ["e4","e5"]) — sumber nomor baris. */
  sans: string[];
  eco: string | null;
  name: string | null;
  hasLessons: boolean;
  children: Node[];
  /** true = anak sudah dimuat dari /api/opening. */
  loaded: boolean;
};

function makeNode(fen: string, uci: string | null, sans: string[]): Node {
  return { fen, uci, sans, eco: null, name: null, hasLessons: false, children: [], loaded: false };
}

type TabId = "garis" | "buah";

export function ExplorerView({ initialEco, onLoadFen }: {
  initialEco?: string | null;
  /** S6-T1 (spec §1.2–1.3): "Hasilkan di papan" — muat FEN node ke papan
   *  analisis/review (jalur keluar bermakna, pola S4-T5). */
  onLoadFen?: (fen: string) => void;
}) {
  const [root, setRoot] = useState<Node>(() => makeNode(START_FEN, null, []));
  const [selected, setSelected] = useState<Node>(root);
  const [tab, setTab] = useState<TabId>("garis");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ecoFilter, setEcoFilter] = useState("");
  const [ecoInput, setEcoInput] = useState(initialEco ?? "");
  const [winRate, setWinRate] = useState<WinRate | null>(null);
  const [wrLoading, setWrLoading] = useState(false);

  // F6 (TL-review finding): filter spec §1.2 yang dulu terlewat — SEMUA
  // client-side atas tree data lokal (ADR-009 D1.1: server tidak punya
  // parameter filter; hanya fen + hasil yang diketahui server).
  // - Sisi: giliran yang bermain di node (FEN field, riil dari posisi).
  // - Baris ke-: nomor baris (fullmove dari FEN, riil) yang ditampilkan.
  // - Kategori waktu: arsip tidak menyimpan kategori per garis, jadi chip
  //   ini adalah FILTER LOKAL: kategori diturunkan dari pilihan preset
  //   waktu lokal (localStorage.jev_tc_last) via timeCategoryOf — dilabeli
  //   jujur, tanpa angka/mock baru.
  const [sideFilter, setSideFilter] = useState<"w" | "b" | "both">("both");
  const [rowMax, setRowMax] = useState(20);
  const [timeFilter, setTimeFilter] = useState<TimeCategory | "all">("all");
  const localTc = useMemo(() => loadStoredTimeControl(), []);
  const localTcCategory = useMemo(() => timeCategoryOf(localTc), [localTc]);

  // Announce region (aria-live) untuk update filter — cue ganda teks,
  // bukan perubahan visual saja (floor §0.3).
  const filterAnnounce = useMemo(() => {
    const parts: string[] = [];
    if (sideFilter !== "both") parts.push(`Sisi: ${sideFilter === "w" ? "Putih" : "Hitam"}`);
    if (rowMax !== 20) parts.push(`Baris ke-${rowMax} ke bawah`);
    if (timeFilter !== "all") {
      parts.push(
        `Waktu: ${timeFilter === "bullet" ? "Bullet" : timeFilter === "blitz" ? "Blitz" : "Rapid"} (filter lokal dari waktu lokal ${localTc})`,
      );
    }
    return parts.length ? parts.join(" · ") : "";
  }, [sideFilter, rowMax, timeFilter, localTc]);

  /** Kategori waktu lokal aktif? Chip "Semua" selalu lolos; kategori lain
   *  hanya lolos bila sama dengan kategori waktu lokal — selain itu panel
   *  win-rate menampilkan empty-state jujur (tanpa angka). */
  const timeMatchesLocal = timeFilter === "all" || timeFilter === localTcCategory;

  /** Muat anak + label opening satu node (POST /api/opening untuk fen node
   *  saat ini — label ECO/nama baris RIIL, bukan placeholder). Idempoten:
   *  node sudah-loaded tidak diulang. Kegagalan fetch tidak memblokir —
   *  label ECO kosong, pohon tetap jalan. */
  const loadNode = useCallback(async (node: Node): Promise<Node> => {
    if (node.loaded) return node;
    const cand = allCandidatesFor(node.fen);
    let eco: string | null = null;
    let name: string | null = null;
    let hasLessons = false;
    try {
      const res = await fetch("/api/opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: node.fen }),
      });
      if (res.ok) {
        const d = (await res.json().catch(() => ({}))) as {
          opening?: { name?: string; eco?: string };
          hasLessons?: boolean;
        };
        eco = d.opening?.eco ?? null;
        name = d.opening?.name ?? null;
        hasLessons = Boolean(d.hasLessons);
      }
    } catch {
      // Buku statis tetap dipakai; label ECO/CTA Materi kosong — tidak memblokir.
    }
    const kids = cand.map((uci) => makeNode(applyUci(node.fen, uci), uci, [...node.sans, uciToSan(uci, node.fen)]));
    return { ...node, eco, name, hasLessons, children: kids, loaded: true };
  }, []);

  // Muat root saat mount.
  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      const r = await loadNode(root);
      if (!alive) return;
      setRoot(r);
      setSelected(r);
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Win-rate posisi terpilih (riil dari endpoint).
  useEffect(() => {
    let alive = true;
    setWinRate(null);
    setWrLoading(true);
    setError(null);
    fetch(`/api/opening/win-rate?fen=${encodeURIComponent(selected.fen)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            // Guest (tanpa session) — statistik tetap publik di data, tapi
            // endpoint guard FIX-1; copy spesifik tamu (spec §1.4, state-matrix).
            setError("Statistik per garis tidak tersedia untuk tamu.");
            return null;
          }
          if (res.status === 403) {
            setError("Statistik per garis tidak tersedia untuk akun yang belum disetujui admin.");
            return null;
          }
          if (res.status === 503) {
            setError("Server sedang sibuk. Coba beberapa saat lagi.");
            return null;
          }
          throw new Error("Gagal memuat penjelajah. Coba lagi.");
        }
        return (await res.json()) as WinRate;
      })
      .then((wr) => {
        if (!alive || !wr) return;
        setWinRate(wr);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Gagal memuat penjelajah. Coba lagi.");
      })
      .finally(() => {
        if (alive) setWrLoading(false);
      });
    return () => { alive = false; };
  }, [selected.fen]);

  /** Expand/muat anak satu node + seleksi ke situ. */
  const selectNode = useCallback(
    (node: Node) => {
      setSelected(node);
      void (async () => {
        const loaded = await loadNode(node);
        // Terapkan ke semua level yang mengandung node tsb.
        setRoot((r) => mergeLoaded(r, loaded));
        setSelected(loaded);
      })();
    },
    [loadNode],
  );

  // Filter ECO: string matching terhadap node-node yang sudah termuat.
  const matchesEco = useCallback(
    (n: Node): boolean => {
      const q = ecoFilter.trim().toUpperCase();
      if (!q) return true;
      if ((n.eco ?? "").toUpperCase().includes(q)) return true;
      return n.children.some((c) => matchesEco(c));
    },
    [ecoFilter],
  );

  const kids = ecoFilter.trim() || sideFilter !== "both" || rowMax !== 20
    ? filterKids(selected.children, ecoFilter.trim().toUpperCase(), sideFilter, rowMax)
    : selected.children;

  const wrPct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const turnLabel = useMemo(() => {
    try {
      const c = new Chess(START_FEN);
      c.load(selected.fen);
      return c.turn() === "w" ? "Putih" : "Hitam";
    } catch {
      return "Putih";
    }
  }, [selected.fen]);

  const sanPath = formatSanPath(selected.sans);

  return (
    <div className="view-root w-full max-w-5xl mx-auto">
      <div className="view-head flex items-center gap-2.5 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-drill)" }}>
        <Compass size={18} className="text-[var(--nav-accent-drill)] shrink-0" aria-hidden="true" />
        <h1 className="text-sm font-black text-white leading-tight shrink-0">Penjelajah Pembukaan</h1>
        <div className="flex-1" aria-hidden="true" />
        {/* Tab Tampilan: "Daftar garis" + "Buah" (placeholder jujur S6) */}
        <div className="flex bg-[var(--card)] p-0.5 rounded-lg border border-[var(--border)] shrink-0" role="tablist" aria-label="Tampilan penjelajah">
          {tabBtn("garis", tab, setTab, "Daftar garis")}
          {tabBtn("buah", tab, setTab, "Buah")}
        </div>
      </div>

      <div className="view-body" style={{ scrollbarWidth: "thin" }}>
        {tab === "buah" ? (
          <div className="panel p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center gap-2 text-sm font-bold text-neutral-300">
              <FlaskConical size={16} aria-hidden="true" />
              Buah
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              Data buah belum tersedia di sprint ini. Panel analisis pembukaan akan hadir menyusul — tanpa data, panel ini sengaja dibiarkan kosong.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-[minmax(0,1fr)_22rem] gap-3 items-start">
            {/* PAPAN — read-only, posisi node terpilih (Pola B: papan di kiri ≤ area konten) */}
            <div className="panel p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md w-full min-h-0">
              <div
                className="aspect-square w-full max-w-[min(100%,var(--board-cap))] rounded-xl overflow-hidden border border-[var(--border-strong)] bg-[var(--board-dark)]"
                aria-label={`Papan catur, ${selected.sans.length} langkah, giliran ${turnLabel}`}
              >
                <Chessboard
                  options={{
                    id: "explorer-board",
                    position: selected.fen,
                    boardOrientation: "white",
                    allowDragging: false,
                    allowDrawingArrows: false,
                    boardStyle: { width: "100%", height: "100%" },
                    lightSquareStyle: { backgroundColor: "var(--board-light, #ebecd0)" },
                    darkSquareStyle: { backgroundColor: "var(--board-dark, #739552)" },
                  }}
                />
              </div>
              <p className="font-mono text-xs text-neutral-300 mt-2 break-words min-h-[1.25rem]">
                {sanPath || "posisi awal — belum ada langkah"}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {onLoadFen && (
                  <button
                    onClick={() => onLoadFen(selected.fen)}
                    className="ctl ctl-xs inline-flex items-center gap-1.5"
                    aria-label="Hasilkan posisi ini di papan analisis"
                  >
                    <Target size={13} aria-hidden="true" />
                    Hasilkan di papan
                  </button>
                )}
                {selected.hasLessons && (
                  <a
                    href={`#/courses?opening=${encodeURIComponent(selected.eco ?? "")}`}
                    className="ctl ctl-xs inline-flex items-center gap-1.5"
                    aria-label={selected.name ? `Materi pembukaan ${selected.name}` : "Materi pembukaan"}
                  >
                    <BookOpen size={13} aria-hidden="true" />
                    Materi
                  </a>
                )}
              </div>
            </div>

            {/* PANEL — filter ECO + daftar garis + win-rate posisi terpilih */}
            <div className="panel p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md w-full min-h-0">
              {/* F6 (spec §1.2): filter Sisi + Baris ke- + Waktu (filter lokal,
                  ADR-009 D1.1) — client-side atas tree data lokal. */}
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <span className="label">Sisi</span>
                  <select
                    className="field mt-1"
                    aria-label="Sisi"
                    value={sideFilter}
                    onChange={(e) => setSideFilter(e.target.value as "w" | "b" | "both")}
                  >
                    <option value="both">Keduanya</option>
                    <option value="w">Putih</option>
                    <option value="b">Hitam</option>
                  </select>
                </div>
                <div>
                  <div className="label flex items-center gap-2">
                    <span>Baris ke-</span>
                    <input
                      id="explorer-row"
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={rowMax}
                      onChange={(e) => setRowMax(Number(e.target.value))}
                      className="w-28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                      style={{ accentColor: "var(--nav-accent-drill)" }}
                      aria-label={`Baris ke-${rowMax} — tampilkan garis sampai baris ${rowMax}`}
                    />
                    <output htmlFor="explorer-row" className="font-mono text-xs text-neutral-400">
                      {rowMax}
                    </output>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="label">Waktu (filter lokal)</span>
                  <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Kategori waktu">
                    {(
                      [
                        { value: "all", label: "Semua" },
                        { value: "bullet", label: "Bullet" },
                        { value: "blitz", label: "Blitz" },
                        { value: "rapid", label: "Rapid" },
                      ] as { value: TimeCategory | "all"; label: string }[]
                    ).map((opt) => {
                      const active = timeFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`ctl ctl-xs ctl-choice ${active ? "ctl-active" : ""}`}
                          aria-pressed={active}
                          aria-label={`Waktu: ${opt.label}${opt.value !== "all" ? " (filter lokal)" : ""}`}
                          onClick={() => setTimeFilter(opt.value as TimeCategory | "all")}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {timeFilter !== "all" && (
                <p className="mt-1 text-[11px] text-neutral-400">
                  Filter lokal: arsip tidak menyimpan kategori per garis — kategori
                  ini diturunkan dari waktu lokalmu ({localTc}).
                </p>
              )}

              {/* Announce region: semua perubahan filter dibacakan (floor §0.3) */}
              <p className="sr-only" role="status" aria-live="polite">
                {filterAnnounce}
              </p>

              <div className="mt-2 flex gap-1.5 items-center">
                <span className="label shrink-0">ECO</span>
                <input
                  className="field flex-1 min-w-0"
                  placeholder="mis. C33"
                  aria-label="Kode ECO"
                  value={ecoInput}
                  onChange={(e) => setEcoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEcoFilter(ecoInput.trim());
                  }}
                />
                <button className="ctl ctl-xs shrink-0" onClick={() => setEcoFilter(ecoInput.trim())} aria-label="Terapkan filter ECO">
                  Terapkan
                </button>
              </div>
              {ecoFilter && (
                <button
                  className="mt-1 text-[11px] font-bold text-[var(--accent)]"
                  onClick={() => {
                    setEcoFilter("");
                    setEcoInput("");
                  }}
                  aria-label="Hapus filter ECO"
                >
                  Hapus filter
                </button>
              )}

              {error && (
                <ErrorState message={error} className="mt-2 py-2 items-start text-left" />
              )}
              {wrLoading && (
                <p className="mt-2 text-xs text-neutral-400" role="status" aria-live="polite">
                  Mencari garis…
                </p>
              )}

              <div className="mt-2 flex flex-col gap-1" role="list" aria-label="Daftar garis pembukaan">
                {loading ? (
                  <LoadingState label="Mencari garis…" rows={4} className="items-start" />
                ) : kids.length === 0 ? (
                  <EmptyState
                    title={
                      sideFilter !== "both" || rowMax !== 20
                        ? "Tidak ada garis untuk kombinasi filter ini di tingkat saat ini."
                        : ecoFilter
                          ? "Tidak ada garis dengan filter ECO ini di tingkat saat ini."
                          : "Belum ada partai dengan garis ini di arsip."
                    }
                  />
                ) : (
                  kids.map((k) => (
                    <button
                      key={k.fen}
                      onClick={() => selectNode(k)}
                      aria-expanded={false}
                      className="text-left rounded-lg px-2.5 py-1.5 border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] min-h-[44px]"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <ChevronRight size={13} aria-hidden="true" />
                        {k.eco ?? "?"} {k.name ?? ""}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-400 block mt-0.5">
                        {formatSanPath([...k.sans])}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Win-rate — angka RIIL dari endpoint (teks, bukan bar warna).
                  Filter waktu LOKAL: bila kategori terpilih tak cocok dengan
                  kategori waktu lokal, angka disembunyikan (empty-state jujur,
                  tanpa angka palsu — prinsip global no-mock). */}
              {!wrLoading && !error && winRate && winRate.samples > 0 && timeMatchesLocal && (
                <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
                  <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">Hasil di posisi ini</p>
                  {winRate.samples < 10 ? (
                    <p className="text-xs text-neutral-300 mt-1" role="status">
                      {winRate.samples} partai — sampel terlalu kecil untuk persentase.
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-300 mt-1" role="status">
                      Putih {wrPct(winRate.wins, winRate.samples)}% · Remis {wrPct(winRate.draws, winRate.samples)}% · Hitam{" "}
                      {wrPct(winRate.losses, winRate.samples)}% · {winRate.samples} partai
                    </p>
                  )}
                </div>
              )}
              {!wrLoading && !error && winRate && winRate.samples === 0 && (
                <p className="mt-2 text-xs text-neutral-500" role="status">
                  Belum ada partai dengan garis ini di arsip.
                </p>
              )}
              {!wrLoading && !error && winRate && winRate.samples > 0 && !timeMatchesLocal && (
                <p className="mt-2 text-xs text-neutral-400" role="status">
                  Belum ada partai untuk filter waktu ini — arsip tidak menyimpan
                  kategori per garis (filter lokal dari {localTc}).
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── helper lokal ─────────────────────────────────────────────────────── */

function tabBtn(id: TabId, current: TabId, set: (t: TabId) => void, label: string) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={current === id}
      onClick={() => set(id)}
      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
        current === id ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {id === "buah" && <FlaskConical size={12} aria-hidden="true" />}
        {label}
      </span>
    </button>
  );
}

/** Saring anak node oleh side + baris ke- + prefix ECO — level-1 YAGNI
 *  (pola spec §1.2). Kategori waktu disengaja DI LUAR: tree berasal dari
 *  buku statis (tanpa data waktu), jadi waktu hanya memfilter win-rate
 *  panel — filter lokal, dilabeli jujur. */
function filterKids(kids: Node[], q: string, sideFilter: "w" | "b" | "both", rowMax: number): Node[] {
  return kids.filter((k) => {
    const eco = (k.eco ?? "").toUpperCase();
    if (q && !eco.includes(q)) return false;
    const turn = k.fen.trim().split(/\s+/)[1] ?? "w";
    if (sideFilter !== "both" && (turn === "b" ? "b" : "w") !== sideFilter) return false;
    const parts = k.fen.trim().split(/\s+/);
    const row = parts.length >= 6 ? Number(parts[5]) : k.sans.length / 2 + 1;
    if (row > rowMax) return false;
    return true;
  });
}

/** Ganti sub-node hasil load di tree root (rekursif, tanpa menimpa cabang lain). */
function mergeLoaded(root: Node, loaded: Node): Node {
  if (root.fen === loaded.fen) return loaded;
  return { ...root, children: root.children.map((c) => mergeLoaded(c, loaded)) };
}
