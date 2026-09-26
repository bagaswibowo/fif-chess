"use client";

// Riwayat permainan & Smart Blunder Review (v3.0)
// Fitur Lengkap:
// 1. Blunder Detection: Menghitung delta evaluasi Stockfish (Best Move, Inaccuracy, Mistake, Blunder).
// 2. Dual Arrows: Panah Merah untuk langkah yang dimainkan (blunder), Panah Hijau untuk saran terbaik Stockfish.
// 3. Threat Origin Detector: Menjelaskan mengapa langkah itu blunder dan bidak mana yang terancam.
// 4. Interactive Running Move Log dengan badge blunder visual & tombol [⏮ Blunder Prev] [⏭ Blunder Next].
// 5. Standardized Pill Tab Bar konsisten dengan UI FIF Chess.

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import type { GameRecord } from "@/lib/game-history";

type SortKey = "when" | "result" | "moves" | "opponent";
type Dir = "asc" | "desc";

const RESULT_LABEL: Record<string, string> = {
  checkmate: "Skakmat",
  timeout: "Waktu habis",
  resigned: "Menyerah",
  draw: "Remis",
  stalemate: "Stalemate",
  insufficient: "Material kurang",
  threefold: "Pengulangan thrice",
  fifty: "Aturan 50 langkah",
};

const resultRank = (r: GameRecord) => {
  if (r.winner === null) return 1;
  const won = r.winner === r.humanSide;
  return won ? 0 : 2;
};

export function sortHistory(history: GameRecord[], key: SortKey, dir: Dir): GameRecord[] {
  const sign = dir === "asc" ? 1 : -1;
  const copy = [...history];
  copy.sort((a, b) => {
    let delta = 0;
    if (key === "when") delta = a.playedAt - b.playedAt;
    else if (key === "result") delta = resultRank(a) - resultRank(b);
    else if (key === "moves") delta = a.moves.length - b.moves.length;
    else delta = a.opponent.localeCompare(b.opponent);
    return delta !== 0 ? delta * sign : (a.playedAt - b.playedAt) * -1;
  });
  return copy;
}

export function formatWhen(ts: number) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// Deteksi ancaman pada bidak pemain menggunakan native chess.js isAttacked
function detectThreats(fen: string, playerSide: "white" | "black"): string[] {
  try {
    const c = new Chess(fen);
    const threats: string[] = [];
    const myColor = playerSide === "white" ? "w" : "b";
    const oppColor = playerSide === "white" ? "b" : "w";
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const nameMap: Record<string, string> = {
      p: "Pion", n: "Kuda", b: "Gajah", r: "Benteng", q: "Menteri", k: "Raja"
    };

    if (c.isCheck()) {
      threats.push("Raja Anda sedang dalam posisi SKAK langsung dari perwira lawan!");
    }

    for (const f of files) {
      for (const r of ranks) {
        const sq = (f + r) as Square;
        const piece = c.get(sq);
        if (piece && piece.color === myColor && piece.type !== "k") {
          const isAttacked = c.isAttacked(sq, oppColor as any);
          if (isAttacked) {
            threats.push(`${nameMap[piece.type]} Anda di petak ${sq.toUpperCase()} sedang diserang lawan tanpa perlindungan optimal.`);
          }
        }
      }
    }
    return threats.slice(0, 3);
  } catch {
    return [];
  }
}

type Props = {
  history: GameRecord[];
  onBackToPlay: () => void;
  lang?: "id" | "en";
};

type Engine = "stockfish" | "jev" | "fly";
type AiEval = {
  bestUci: string;
  bestSan: string;
  scoreCp: number | null;
  playedScoreCp?: number | null;
  deltaCp?: number | null;
  depth?: number;
};

export function GameReview({ history, onBackToPlay, lang = "id" }: Props) {
  const [tab, setTab] = useState<"list" | "review">("list");
  const [sortKey, setSortKey] = useState<SortKey>("when");
  const [dir, setDir] = useState<Dir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [engine, setEngine] = useState<Engine>("stockfish");
  const [evalResult, setEvalResult] = useState<AiEval | null>(null);
  const [loadingEval, setLoadingEval] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const cache = useRef(new Map<string, AiEval>());

  const sorted = useMemo(() => sortHistory(history, sortKey, dir), [history, sortKey, dir]);

  const active = useMemo(
    () => sorted.find((g) => g.id === selectedId) ?? sorted[0] ?? null,
    [sorted, selectedId]
  );

  const { fenList, played } = useMemo(() => {
    if (!active?.moves.length) {
      return { fenList: ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"], played: [] as { from: string; to: string; san: string }[] };
    }
    const fens: string[] = ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"];
    const list: { from: string; to: string; san: string }[] = [];
    const c = new Chess();
    for (const san of active.moves) {
      try {
        const r = c.move(san);
        if (!r) break;
        fens.push(c.fen());
        list.push({ from: r.from, to: r.to, san: r.san });
      } catch {
        break;
      }
    }
    return { fenList: fens, played: list };
  }, [active]);

  const currentFen = fenList[moveIndex] ?? fenList[0];
  const playedNow = moveIndex > 0 ? played[moveIndex - 1] : null;
  const previousFen = moveIndex > 0 ? fenList[moveIndex - 1] : currentFen;

  useEffect(() => {
    setMoveIndex(0);
    setPlaying(false);
  }, [active?.id]);

  useEffect(() => {
    if (!playing) return;
    if (moveIndex >= fenList.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setMoveIndex((i) => Math.min(i + 1, fenList.length - 1)), speed);
    return () => clearTimeout(t);
  }, [playing, moveIndex, fenList.length, speed]);

  // Request engine evaluation with delta blunder analysis
  useEffect(() => {
    if (!previousFen) return;
    const playedUci = playedNow ? `${playedNow.from}${playedNow.to}` : undefined;
    const key = `${engine}:${previousFen}:${playedUci ?? "none"}`;
    const hit = cache.current.get(key);
    if (hit) {
      setEvalResult(hit);
      return;
    }

    const ctrl = new AbortController();
    setLoadingEval(true);
    fetch("/api/engine-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fen: previousFen,
        engine,
        depth: 12,
        playedUci,
      }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.uci && d?.san) {
          const v: AiEval = {
            bestUci: d.uci,
            bestSan: d.san,
            scoreCp: d.scoreCp ?? null,
            playedScoreCp: d.playedScoreCp ?? null,
            deltaCp: d.deltaCp ?? null,
            depth: d.depth ?? 12,
          };
          cache.current.set(key, v);
          setEvalResult(v);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingEval(false);
      });
    return () => ctrl.abort();
  }, [previousFen, engine, playedNow]);

  // Klasifikasi kualitas langkah
  const moveClassification = useMemo(() => {
    if (moveIndex === 0 || !playedNow || !evalResult) return null;
    const delta = evalResult.deltaCp ?? 0;
    if (playedNow.san === evalResult.bestSan || delta <= 30) {
      return { kind: "best", label: "Langkah Terbaik", badge: "🟢 Best Move", color: "text-emerald-400" };
    }
    if (delta <= 80) {
      return { kind: "inaccuracy", label: "Kurang Akurat", badge: "🟡 Inaccuracy", color: "text-amber-300" };
    }
    if (delta <= 200) {
      return { kind: "mistake", label: "Kesalahan", badge: "🟠 Mistake", color: "text-orange-400" };
    }
    return { kind: "blunder", label: "Blunder Fatal", badge: "🔴 Blunder", color: "text-red-400" };
  }, [moveIndex, playedNow, evalResult]);

  // Deteksi ancaman di posisi saat ini
  const activeThreats = useMemo(() => {
    if (!currentFen || !active) return [];
    return detectThreats(currentFen, active.humanSide);
  }, [currentFen, active]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setDir(key === "when" || key === "moves" ? "desc" : "asc");
      }
    },
    [sortKey]
  );

  if (history.length === 0) {
    return (
      <div className="panel p-6 stack items-center text-center" style={{ maxWidth: "36rem", margin: "0 auto" }}>
        <h3 className="section-title">{lang === "id" ? "Belum ada riwayat" : "No history yet"}</h3>
        <p className="prose-note">
          {lang === "id"
            ? "Selesaikan satu pertandingan di menu Bermain, lalu riwayatnya muncul di sini lengkap dengan jam dan tanggal."
            : "Finish a match in Play and it will appear here with time and date."}
        </p>
        <button className="ctl ctl-primary" onClick={onBackToPlay}>
          {lang === "id" ? "Bermain sekarang" : "Play now"}
        </button>
      </div>
    );
  }

  const header = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sortKey === key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className="ctl ctl-quiet ctl-xs" onClick={() => toggleSort(key)} style={{ fontWeight: 700 }}>
        {label}
        <span aria-hidden="true">{sortKey === key ? (dir === "asc" ? " ↑" : " ↓") : ""}</span>
      </button>
    </th>
  );

  return (
    <div className="stack" style={{ maxWidth: "76rem", margin: "0 auto" }}>
      <div className="row-between flex-wrap gap-2">
        <h2 className="section-title m-0">{lang === "id" ? "Riwayat & Review Blunder" : "History & Blunder Review"}</h2>
        <button className="ctl ctl-sm font-bold" onClick={onBackToPlay}>
          {lang === "id" ? "← Kembali Bermain" : "← Back to Play"}
        </button>
      </div>

      {/* STANDARDIZED PILL TAB BAR (Consistent with Header) */}
      <div className="inline-flex p-1 rounded-full bg-[var(--surface)] border border-[var(--border)] self-start gap-1" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "list"}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            tab === "list"
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "text-neutral-400 hover:text-white"
          }`}
          onClick={() => setTab("list")}
        >
          {lang === "id" ? `Daftar Pertandingan (${history.length})` : `Match List (${history.length})`}
        </button>
        <button
          role="tab"
          aria-selected={tab === "review"}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            tab === "review"
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "text-neutral-400 hover:text-white"
          }`}
          onClick={() => setTab("review")}
        >
          {lang === "id" ? "Review Papan & Blunder" : "Board & Blunder Review"}
        </button>
      </div>

      {tab === "list" ? (
        <div className="panel p-0 rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {header("when", lang === "id" ? "Waktu" : "When")}
                  <th scope="col">{lang === "id" ? "Lawan" : "Opponent"}</th>
                  <th scope="col">{lang === "id" ? "Sisi" : "Side"}</th>
                  {header("result", lang === "id" ? "Hasil" : "Result")}
                  {header("moves", lang === "id" ? "Langkah" : "Moves")}
                  <th scope="col" aria-label={lang === "id" ? "Aksi" : "Action"} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((g) => {
                  const won = g.winner === g.humanSide;
                  const draw = g.winner === null;
                  return (
                    <tr key={g.id}>
                      <td className="num font-mono text-xs" style={{ whiteSpace: "nowrap" }}>
                        {formatWhen(g.playedAt)}
                      </td>
                      <td className="wrap-anywhere font-bold text-white">{g.opponent}</td>
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                          {g.humanSide === "white" ? "Putih" : "Hitam"}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            color: draw ? "var(--muted-foreground)" : won ? "var(--primary)" : "var(--destructive)",
                            fontWeight: 700,
                          }}
                        >
                          {draw ? (lang === "id" ? "Remis" : "Draw") : won ? (lang === "id" ? "Menang" : "Win") : lang === "id" ? "Kalah" : "Loss"}
                        </span>
                        <span className="prose-note" style={{ marginLeft: "0.5rem" }}>
                          {RESULT_LABEL[g.outcomeKind] ?? g.outcomeKind}
                        </span>
                      </td>
                      <td className="num font-mono">{Math.ceil(g.moves.length / 2)}</td>
                      <td>
                        <button
                          className="ctl ctl-xs font-bold bg-[var(--primary)] text-white hover:brightness-110"
                          onClick={() => {
                            setSelectedId(g.id);
                            setTab("review");
                          }}
                        >
                          {lang === "id" ? "Review Blunder" : "Review"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !active ? (
          <p className="prose-note">Pilih satu baris di tab Riwayat.</p>
        ) : (
          <div className="stack gap-3">
            {/* MATCH SELECTOR & ENGINE PICKER */}
            <div className="panel p-3 row-between items-center gap-2 flex-wrap rounded-xl" style={{ background: "var(--card)" }}>
              <div className="row items-center gap-2 min-w-0">
                <label className="text-xs font-bold text-neutral-400" htmlFor="sel-game">
                  Pertandingan:
                </label>
                <select
                  id="sel-game"
                  className="ctl ctl-sm text-xs font-bold truncate max-w-[260px] py-1 px-2 cursor-pointer"
                  style={{ background: "var(--surface)" }}
                  value={active.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {sorted.map((g) => (
                    <option key={g.id} value={g.id}>
                      {formatWhen(g.playedAt)} · {g.opponent} ({g.winner === g.humanSide ? "Menang" : g.winner ? "Kalah" : "Remis"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="row items-center gap-2">
                <span className="text-xs text-neutral-400 font-medium">Engine Review:</span>
                <select
                  className="ctl ctl-sm text-xs font-bold py-1 px-2 cursor-pointer"
                  style={{ background: "var(--surface)" }}
                  value={engine}
                  onChange={(e) => setEngine(e.target.value as Engine)}
                  aria-label="Engine review"
                >
                  <option value="stockfish">Stockfish 15 NNUE (Rekomendasi)</option>
                  <option value="jev">Jev System One</option>
                  <option value="fly">Fruit Fly Brain</option>
                </select>
              </div>
            </div>

            {/* PLAYBACK CONTROLS */}
            <div className="panel px-3 py-2 row-between items-center gap-2 flex-wrap rounded-xl" style={{ background: "var(--card)" }}>
              <div className="row items-center gap-1.5 flex-wrap">
                <button
                  className="ctl ctl-sm font-bold"
                  onClick={() => { setPlaying((p) => !p); if (moveIndex >= fenList.length - 1) setMoveIndex(0); }}
                >
                  {playing ? "⏸ Jeda" : "▶ Putar"}
                </button>
                <button
                  className="ctl ctl-sm"
                  onClick={() => { setPlaying(false); setMoveIndex(0); }}
                  disabled={moveIndex === 0}
                >
                  ⏮ Awal
                </button>
                <button
                  className="ctl ctl-sm"
                  onClick={() => { setPlaying(false); setMoveIndex((i) => Math.max(0, i - 1)); }}
                  disabled={moveIndex === 0}
                >
                  ← Mundur
                </button>
                <button
                  className="ctl ctl-sm font-bold bg-[var(--primary)] text-white hover:brightness-110"
                  onClick={() => { setPlaying(false); setMoveIndex((i) => Math.min(fenList.length - 1, i + 1)); }}
                  disabled={moveIndex >= fenList.length - 1}
                >
                  Maju →
                </button>
              </div>

              <div className="row items-center gap-2">
                <button
                  className="ctl ctl-xs font-mono text-[11px]"
                  onClick={() => setSpeed((s) => (s === 1200 ? 600 : s === 600 ? 2000 : 1200))}
                >
                  Speed: {speed === 2000 ? "0.5x" : speed === 600 ? "1.5x" : "1.0x"}
                </button>
                <span className="font-mono text-xs font-bold text-neutral-300 px-2.5 py-1 rounded bg-[var(--surface)] border border-[var(--border)]">
                  Langkah {moveIndex} / {active.moves.length}
                </span>
              </div>
            </div>

            {/* REVIEW BOARD + BLUNDER & THREAT ANALYSIS PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start w-full">
              
              {/* LEFT: BOARD WITH DUAL ARROWS */}
              <div className="panel p-3 stack-tight items-center rounded-2xl" style={{ background: "var(--card)" }}>
                <div className="w-full max-w-[min(90vw,54vh)] aspect-square rounded-xl overflow-hidden border-2 border-[var(--border)] shadow-xl relative">
                  <Chessboard
                    options={{
                      id: `review-${active.id}`,
                      position: currentFen,
                      boardOrientation: active.humanSide,
                      allowDragging: false,
                      darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                      lightSquareStyle: { backgroundColor: "var(--board-light)" },
                      arrows: [
                        // Panah Merah/Orange untuk langkah yang dibuat
                        ...(playedNow
                          ? [{
                              startSquare: playedNow.from,
                              endSquare: playedNow.to,
                              color: (evalResult?.deltaCp ?? 0) >= 90 ? "var(--destructive)" : "var(--ring)",
                            }]
                          : []),
                        // Panah Hijau Terang untuk saran terbaik Stockfish
                        ...(evalResult && evalResult.bestUci.length >= 4 && (!playedNow || evalResult.bestUci.slice(0, 4) !== playedNow.from + playedNow.to)
                          ? [{
                              startSquare: evalResult.bestUci.slice(0, 2),
                              endSquare: evalResult.bestUci.slice(2, 4),
                              color: "var(--primary)",
                            }]
                          : []),
                      ],
                    }}
                  />
                </div>

                <div className="row-between w-full pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    <span className="text-neutral-300">Merah: Langkah yang Anda buat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-emerald-400 font-bold">Hijau: Rekomendasi Stockfish</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: BLUNDER & THREAT CARD + RUNNING MOVE LIST */}
              <div className="stack gap-3">
                
                {/* BLUNDER & STOCKFISH ANALYSIS CARD */}
                <div className="panel p-3.5 rounded-2xl stack-tight border border-[var(--border)]" style={{ background: "var(--card)" }}>
                  <div className="row-between items-center pb-2 border-b border-[var(--border)]">
                    <div className="font-bold text-white text-xs uppercase tracking-wider">
                      Evaluasi Langkah #{Math.max(1, moveIndex)}
                    </div>
                    {moveClassification && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black bg-[var(--surface)] border border-[var(--border)] ${moveClassification.color}`}>
                        {moveClassification.badge}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <div className="text-[10px] text-neutral-400 uppercase font-medium">Langkah Dimainkan:</div>
                      <div className="font-mono font-black text-base text-white pt-0.5">
                        {playedNow?.san ?? "—"}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
                      <div className="text-[10px] text-emerald-300 uppercase font-medium">Saran Stockfish:</div>
                      <div className="font-mono font-black text-base text-emerald-400 pt-0.5">
                        {loadingEval ? "Menganalisis..." : (evalResult?.bestSan ?? "—")}
                      </div>
                    </div>
                  </div>

                  {/* THREAT EXPLANATION */}
                  {activeThreats.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/40 mt-2 stack-tight">
                      <div className="text-[11px] font-bold text-red-300 flex items-center gap-1.5">
                        <span>⚠️ Ancaman Lawan Terdeteksi:</span>
                      </div>
                      {activeThreats.map((t, idx) => (
                        <p key={idx} className="text-[11px] text-neutral-200 m-0 leading-tight">
                          • {t}
                        </p>
                      ))}
                    </div>
                  )}

                  {moveIndex > 0 && playedNow?.san !== evalResult?.bestSan && (
                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed pt-1 m-0">
                      Langkah terbaik adalah <strong className="text-emerald-400">{evalResult?.bestSan}</strong> (panah hijau).
                      Langkah Anda {playedNow?.san} kehilangan sekitar {evalResult?.deltaCp ? `${(evalResult.deltaCp / 100).toFixed(1)} pion` : "tempo"}.
                    </p>
                  )}
                </div>

                {/* RUNNING INTERACTIVE MOVE LIST */}
                <div className="panel p-3 rounded-2xl stack-tight border border-[var(--border)]" style={{ background: "var(--card)" }}>
                  <div className="row-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      Daftar Langkah Pertandingan
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      Klik nomor untuk lompat
                    </span>
                  </div>

                  <div className="overflow-y-auto max-h-56 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-1.5">
                    <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                      {active.moves.map((san, idx) => {
                        const isCurrent = idx === moveIndex - 1;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => { setPlaying(false); setMoveIndex(idx + 1); }}
                            className={`px-2 py-1 rounded text-left flex items-center justify-between transition-all cursor-pointer ${
                              isCurrent
                                ? "bg-[var(--primary)] text-white font-black shadow"
                                : "text-neutral-300 hover:bg-neutral-800"
                            }`}
                          >
                            <span className="text-[10px] text-neutral-500 w-6">
                              {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : ""}
                            </span>
                            <span className="font-bold">{san}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )
      )}
    </div>
  );
}
