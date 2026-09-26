"use client";

// Riwayat permainan: dua tab.
//  - Riwayat: tabel yang bisa diurutkan (terlama/terbaru, hasil, jumlah langkah).
//  - Review: playback papan + rekomendasi engine untuk satu permainan.
//
// Satu sumber data: satu fungsi sorting dan satu formatter tanggal dipakai
// kedua tab, supaya tidak mungkin tampilnya berbeda.

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
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
    // Tiebreak by waktu supaya urutannya stabil dan tidak berganti sendiri.
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

type Props = {
  history: GameRecord[];
  onBackToPlay: () => void;
  lang?: "id" | "en";
};

type Engine = "jev" | "fly" | "stockfish";
type AiEval = { bestUci: string; bestSan: string; scoreCp: number | null; depth?: number };

export function GameReview({ history, onBackToPlay, lang = "id" }: Props) {
  const [tab, setTab] = useState<"list" | "review">("list");
  const [sortKey, setSortKey] = useState<SortKey>("when");
  const [dir, setDir] = useState<Dir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [engine, setEngine] = useState<Engine>("jev");
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

  useEffect(() => {
    if (!currentFen) return;
    const key = `${engine}:${currentFen}`;
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
      body: JSON.stringify({ fen: currentFen, engine, depth: 12 }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.uci && d?.san) {
          const v: AiEval = { bestUci: d.uci, bestSan: d.san, scoreCp: d.scoreCp ?? null, depth: d.depth ?? 12 };
          cache.current.set(key, v);
          setEvalResult(v);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingEval(false);
      });
    return () => ctrl.abort();
  }, [currentFen, engine]);

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
            ? "Selesaikan satuandingan di menu Bermain, lalu riwayatnya muncul di sini lengkap dengan jam dan tanggal."
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
    <div className="stack" style={{ maxWidth: "72rem", margin: "0 auto" }}>
      <div className="row-between">
        <h2 className="section-title">{lang === "id" ? "Riwayat & Review" : "History & Review"}</h2>
        <button className="ctl ctl-sm" onClick={onBackToPlay}>
          {lang === "id" ? "Bermain" : "Play"}
        </button>
      </div>

      <div className="row" role="tablist" aria-label="Tab riwayat">
        <button role="tab" aria-selected={tab === "list"} className={`ctl ctl-choice ${tab === "list" ? "ctl-active" : ""}`} onClick={() => setTab("list")}>
          {lang === "id" ? `Riwayat (${history.length})` : `History (${history.length})`}
        </button>
        <button role="tab" aria-selected={tab === "review"} className={`ctl ctl-choice ${tab === "review" ? "ctl-active" : ""}`} onClick={() => setTab("review")}>
          {lang === "id" ? "Review papan" : "Board review"}
        </button>
      </div>

      {tab === "list" ? (
        <div className="panel p-0" style={{ overflow: "hidden" }}>
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
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {formatWhen(g.playedAt)}
                      </td>
                      <td className="wrap-anywhere">{g.opponent}</td>
                      <td>{g.humanSide === "white" ? "Putih" : "Hitam"}</td>
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
                      <td className="num">{Math.ceil(g.moves.length / 2)}</td>
                      <td>
                        <button
                          className="ctl ctl-xs"
                          onClick={() => {
                            setSelectedId(g.id);
                            setTab("review");
                          }}
                        >
                          {lang === "id" ? "Review" : "Review"}
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
          <div className="stack">
            <div className="panel p-3 row" style={{ gap: "0.5rem" }}>
              <label className="label" htmlFor="sel-game">
                Permainan
              </label>
              <select
                id="sel-game"
                className="field"
                style={{ maxWidth: "22rem" }}
                value={active.id}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {sorted.map((g) => (
                  <option key={g.id} value={g.id}>
                    {formatWhen(g.playedAt)} · {g.opponent}
                  </option>
                ))}
              </select>
              <select className="field" style={{ maxWidth: "14rem" }} value={engine} onChange={(e) => setEngine(e.target.value as Engine)} aria-label="Engine review">
                <option value="jev">Jev + FlyBrain</option>
                <option value="fly">FlyBrain</option>
                <option value="stockfish">Stockfish 15</option>
              </select>
            </div>

            <div className="row" style={{ gap: "0.5rem" }}>
              <button className="ctl ctl-sm" onClick={() => { setPlaying((p) => !p); if (moveIndex >= fenList.length - 1) setMoveIndex(0); }}>
                {playing ? "Jeda" : "Putar"}
              </button>
              <button className="ctl ctl-sm" onClick={() => { setPlaying(false); setMoveIndex(0); }} disabled={moveIndex === 0}>
                Awal
              </button>
              <button className="ctl ctl-sm" onClick={() => { setPlaying(false); setMoveIndex((i) => Math.max(0, i - 1)); }} disabled={moveIndex === 0}>
                Mundur
              </button>
              <button className="ctl ctl-sm" onClick={() => { setPlaying(false); setMoveIndex((i) => Math.min(fenList.length - 1, i + 1)); }} disabled={moveIndex >= fenList.length - 1}>
                Maju
              </button>
              <button className="ctl ctl-sm" onClick={() => setSpeed((s) => (s === 1200 ? 600 : s === 600 ? 2000 : 1200))}>
                {speed === 2000 ? "Lambat" : speed === 600 ? "Cepat" : "Normal"}
              </button>
              <span className="prose-note clock" style={{ marginLeft: "auto" }}>
                {moveIndex}/{active.moves.length}
              </span>
            </div>

            <div className="row" style={{ gap: "var(--gap-2)", alignItems: "flex-start" }}>
              <div className="panel p-2 stack-tight" style={{ flex: "1 1 22rem" }}>
                <div className="board-frame" style={{ width: "100%" }}>
                  <div className="aspect-square" style={{ borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)" }}>
                    <Chessboard
                      options={{
                        id: `review-${active.id}`,
                        position: currentFen,
                        boardOrientation: active.humanSide,
                        allowDragging: false,
                        darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                        lightSquareStyle: { backgroundColor: "var(--board-light)" },
                        arrows: [
                          ...(playedNow ? [{ startSquare: playedNow.from, endSquare: playedNow.to, color: "var(--ring)" }] : []),
                          ...(evalResult && evalResult.bestUci.length >= 4 && (!playedNow || evalResult.bestUci.slice(0, 4) !== playedNow.from + playedNow.to)
                            ? [{ startSquare: evalResult.bestUci.slice(0, 2), endSquare: evalResult.bestUci.slice(2, 4), color: "var(--accent)" }]
                            : []),
                        ],
                      }}
                    />
                  </div>
                </div>
                <p className="prose-note" style={{ fontSize: "var(--text-xs)" }}>
                  Kuning: langkahmu. Biru: saran engine.
                </p>
              </div>

              <div className="panel p-3 stack-tight" style={{ flex: "1 1 16rem" }}>
                <div className="label">Langkah #{Math.max(1, moveIndex)}</div>
                <div className="row" style={{ gap: "0.5rem" }}>
                  <span className="clock" style={{ color: "var(--primary)" }}>{playedNow?.san ?? "—"}</span>
                  <span className="clock" style={{ color: "var(--accent)" }}>
                    {loadingEval ? "…" : (evalResult?.bestSan ?? "—")}
                  </span>
                </div>
                <p className="prose-note">
                  {moveIndex === 0
                    ? "Posisi awal. Tekan Maju untuk mulai menganalisis."
                    : playedNow?.san === evalResult?.bestSan
                      ? "Langkahmu sama dengan saran engine — pilihan akurat."
                      : `Engine lebih memilih ${evalResult?.bestSan ?? "…"}. Bandingkan keduanya di papan.`}
                </p>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
