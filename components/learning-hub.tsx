"use client";

// Belajar & Quest.
//
// Keputusan item 8: teka-teki yang SAMA dengan Bank Teka-Teki. Kalau seorang
// siswa menyelesaikan bab Quest, teka-teki itu langsung ditandai selesai di
// Bank juga, karena keduanya membaca daftar dan progres yang sama. Yang tetap
// terpisah: bab Quest punya urutan & kunci, Bank Teka-Teki tidak punya urutan
// dan bisa disaring. Satu sumber data, dua cara belajar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { QUEST_CHAPTERS, type Puzzle } from "@/lib/puzzle-data";
import { useSavedPuzzles } from "@/lib/puzzle-store";

const KEY = "jev_chess_quest_progress";

type Progress = { completed: string[]; xp: number };

function loadProgress(): Progress {
  if (typeof window === "undefined") return { completed: [], xp: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { completed: [], xp: 0 };
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      xp: typeof parsed.xp === "number" ? parsed.xp : 0,
    };
  } catch {
    return { completed: [], xp: 0 };
  }
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function useQuestProgress() {
  const [progress, setProgress] = useState<Progress>({ completed: [], xp: 0 });
  useEffect(() => {
    setProgress(loadProgress());
  }, []);
  const complete = useCallback((id: string, xp: number) => {
    setProgress((prev) => {
      if (prev.completed.includes(id)) return prev;
      const next = { completed: [...prev.completed, id], xp: prev.xp + xp };
      saveProgress(next);
      return next;
    });
  }, []);
  return { progress, complete };
}

type Props = { lang?: "id" | "en" };

export function LearningHub({ lang = "id" }: Props) {
  const { progress, complete } = useQuestProgress();
  const { saved } = useSavedPuzzles();
  const [activeId, setActiveId] = useState<string>(QUEST_CHAPTERS[0]?.id ?? "");
  const [fen, setFen] = useState(QUEST_CHAPTERS[0]?.fen ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"unsolved" | "correct" | "wrong">("unsolved");
  const [hint, setHint] = useState(0);
  const [playAsBlack, setPlayAsBlack] = useState(false);

  // Bab Quest adalah subset dari bank; teka-teki live yang disimpan pemain
  // ditampilkan sebagai bab tambahan supaya tidak ada materi yang tersembunyi.
  const chapters = useMemo<Puzzle[]>(() => {
    const seen = new Set(QUEST_CHAPTERS.map((c) => c.id));
    const live = saved
      .filter((s) => !seen.has(s.id))
      .map((s) => ({ ...s, id: s.id, track: "quest" as const }));
    return [...QUEST_CHAPTERS, ...live];
  }, [saved]);

  const chapter = useMemo(
    () => chapters.find((c) => c.id === activeId) ?? chapters[0],
    [chapters, activeId]
  );

  // Mode sisi: soal selalu played by side yang giliran di FEN; toggle hanya
  // membalik tampilan papan supaya pemain bisa latihan dari sisi yang jarang.
  const boardSide = playAsBlack ? (chapter?.turn === "w" ? "black" : "white") : chapter?.turn === "w" ? "white" : "black";

  const load = useCallback((c: Puzzle | undefined) => {
    if (!c) return;
    setFen(c.fen);
    setSelected(null);
    setStatus("unsolved");
    setHint(0);
  }, []);

  useEffect(() => {
    load(chapter);
  }, [chapter?.id, load]);

  const onSquareClick = ({ square }: { square: string }) => {
    if (!chapter || status === "correct") return;
    const c = new Chess(fen);
    const sq = square.toLowerCase() as Square;

    if (!selected) {
      const p = c.get(sq);
      if (p && p.color === chapter.turn) setSelected(square);
      return;
    }
    if (selected.toLowerCase() === sq) {
      setSelected(null);
      return;
    }
    const target = c.get(sq);
    if (target && target.color === chapter.turn) {
      setSelected(square);
      return;
    }

    const from = selected.toLowerCase() as Square;
    let m = null;
    try {
      m = c.move({ from, to: sq, promotion: chapter.solutionUci[4] || "q" });
    } catch {
      m = null;
    }
    if (!m) {
      setSelected(null);
      return;
    }
    if (m.san === chapter.solutionSan) {
      setFen(c.fen());
      setStatus("correct");
      setSelected(null);
      complete(chapter.id, chapter.xp);
    } else {
      setStatus("wrong");
      setSelected(null);
    }
  };

  if (!chapter) return <p className="prose-note">Belum ada bab.</p>;

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selected) squareStyles[selected] = { boxShadow: "inset 0 0 0 3px var(--board-mark)" };
  const from = chapter.solutionUci.slice(0, 2);
  const to = chapter.solutionUci.slice(2, 4);
  if (hint >= 1 && status === "unsolved") squareStyles[from] = { boxShadow: "inset 0 0 0 3px var(--accent)" };
  if (hint >= 2 && status === "unsolved") squareStyles[to] = { boxShadow: "inset 0 0 0 3px var(--primary)" };
  if (status === "correct") {
    squareStyles[from] = { backgroundColor: "color-mix(in srgb, var(--primary) 35%, transparent)" };
    squareStyles[to] = { backgroundColor: "color-mix(in srgb, var(--primary) 55%, transparent)" };
  }

  const doneCount = chapters.filter((c) => progress.completed.includes(c.id)).length;

  return (
    <div className="stack" style={{ maxWidth: "70rem", margin: "0 auto" }}>
      {/* MASTERCLASS GIUOCO PIANO (ITALIAN GAME C50-C54) */}
      <div className="panel p-3 stack" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
        <div className="row-between flex-wrap gap-2">
          <div className="row items-center gap-2">
            <span style={{ fontSize: "1.25rem" }}>🏛</span>
            <div>
              <div className="font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)" }}>
                {lang === "id" ? "Tips & Trik Taktik Italia: Masterclass Giuoco Piano (C50-C54)" : "Italian Game Tactics: Giuoco Piano Masterclass"}
              </div>
              <div className="prose-note" style={{ fontSize: "var(--text-xs)" }}>
                {lang === "id" ? "Berdasarkan studi arsip Gioachino Greco (1619) & Formasi Idealzentrum" : "Based on Gioachino Greco (1619) manuscripts & Ideal Centre strategy"}
              </div>
            </div>
          </div>
          <span className="label" style={{ padding: "0.15rem 0.5rem", background: "var(--surface)", border: "1px solid var(--border)" }}>
            C50–C54
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1" style={{ fontSize: "var(--text-xs)" }}>
          <div className="panel p-2 stack-tight" style={{ background: "var(--surface)" }}>
            <div className="font-bold text-amber-400">1. Titik Lemah Abadi f7 (Greco Motif)</div>
            <p className="prose-note m-0" style={{ fontSize: "var(--text-xs)" }}>
              Sebelum Raja Hitam rokade, petak f7 adalah petak paling rentan karena hanya dikawal oleh Raja.
              Gajah c4 dan Kuda g5 dapat melancarkan kombinasi serangan garpu atau pengorbanan langsung untuk merusak hak rokade lawan.
            </p>
          </div>

          <div className="panel p-2 stack-tight" style={{ background: "var(--surface)" }}>
            <div className="font-bold text-blue-400">2. Idealzentrum: Formasi d4 + e4</div>
            <p className="prose-note m-0" style={{ fontSize: "var(--text-xs)" }}>
              Langkah 4. c3 disiapkan untuk mendirikan dua pion sentral berdampingan (d4 & e4). Formasi ini mendominasi petak pusat c5, d5, e5, f5 dan memaksa perwira hitam mundur tanpa ruang gerak.
            </p>
          </div>

          <div className="panel p-2 stack-tight" style={{ background: "var(--surface)" }}>
            <div className="font-bold text-emerald-400">3. Evans Gambit (C51 - 4. b4!?)</div>
            <p className="prose-note m-0" style={{ fontSize: "var(--text-xs)" }}>
              Pengorbanan pion sayap b4 untuk mengalihkan Gajah Hitam dari diagonal aktif, memenangkan dua tempo pengembangan lewat c3 dan d4, serta membuka diagonal serang Ba3 menekan sayap raja.
            </p>
          </div>

          <div className="panel p-2 stack-tight" style={{ background: "var(--surface)" }}>
            <div className="font-bold text-purple-400">4. Filosofi Bidak Bebas (Free Pieces)</div>
            <p className="prose-note m-0" style={{ fontSize: "var(--text-xs)" }}>
              Dikutip dari catatan taktik Italia kuno: "Free pieces will win: free diagonals for the bishops, free files for the rooks!" Jangan takut mengorbankan 1-2 pion asalkan perwira memiliki lajur terbuka bebas.
            </p>
          </div>
        </div>
      </div>

      <div className="row-between">
        <h2 className="section-title">{lang === "id" ? "Belajar & Quest" : "Learn & Quest"}</h2>
        <span className="prose-note clock">
          {doneCount}/{chapters.length} bab · {progress.xp} XP
        </span>
      </div>

      <div className="row" style={{ gap: "0.5rem" }}>
        {chapters.map((c, i) => {
          const done = progress.completed.includes(c.id);
          return (
            <button
              key={c.id}
              className={`ctl ctl-sm ${chapter.id === c.id ? "ctl-active" : ""}`}
              onClick={() => setActiveId(c.id)}
              aria-current={chapter.id === c.id}
            >
              {done ? "✓ " : ""}Bab {i + 1}
            </button>
          );
        })}
      </div>

      <div className="row" style={{ gap: "var(--gap-2)", alignItems: "flex-start" }}>
        <div className="panel p-2" style={{ flex: "1 1 22rem", maxWidth: "36rem" }}>
          <div className="aspect-square" style={{ borderRadius: "var(--radius)", overflow: "hidden" }}>
            <Chessboard
              options={{
                id: `quest-${chapter.id}`,
                position: fen,
                boardOrientation: boardSide,
                allowDragging: false,
                squareStyles,
                onSquareClick,
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
              }}
            />
          </div>
        </div>

        <div className="panel p-3 stack" style={{ flex: "1 1 18rem" }}>
          <div className="row-between">
            <div className="min-w-0">
              <div className="label">{chapter.category} · {chapter.difficulty} · +{chapter.xp} XP</div>
              <div className="font-bold wrap-anywhere" style={{ fontFamily: "var(--font-display)" }}>
                {chapter.theme}
              </div>
            </div>
            <button
              className="ctl ctl-xs shrink-0"
              onClick={() => setPlayAsBlack((v) => !v)}
              aria-pressed={playAsBlack}
              title="Balik sisi tampilan papan"
            >
              {boardSide === "white" ? "Putih bawah" : "Hitam bawah"}
            </button>
          </div>

          <p className="prose-note">{chapter.description}</p>

          {hint >= 1 && status === "unsolved" && (
            <p className="panel p-2 prose-note" style={{ borderColor: "var(--accent)" }}>
              <strong>Bidak:</strong> {chapter.hintPiece}
            </p>
          )}
          {hint >= 2 && status === "unsolved" && (
            <p className="panel p-2 prose-note" style={{ borderColor: "var(--primary)" }}>
              <strong>Petak:</strong> {chapter.hintExplanation}
            </p>
          )}
          {status === "correct" && (
            <p className="panel p-2 prose-note" style={{ borderColor: "var(--primary)" }}>
              <strong>{chapter.solutionSan} benar, +{chapter.xp} XP.</strong> {chapter.trickExplanation}
            </p>
          )}
          {status === "wrong" && <p className="prose-note">Belum tepat. Ulangi posisinya atau buka petunjuk.</p>}

          <div className="row" style={{ gap: "0.5rem" }}>
            <button className="ctl ctl-sm" onClick={() => load(chapter)}>
              Ulangi
            </button>
            {status === "unsolved" && (
              <>
                <button className="ctl ctl-sm" onClick={() => setHint((h) => Math.min(2, h + 1))}>
                  Petunjuk {hint + 1}
                </button>
                <button
                  className="ctl ctl-sm"
                  onClick={() => {
                    const c = new Chess(chapter.fen);
                    c.move({ from: from as Square, to: to as Square, promotion: chapter.solutionUci[4] || "q" });
                    setFen(c.fen());
                    setStatus("correct");
                    setHint(2);
                  }}
                >
                  Buka solusi
                </button>
              </>
            )}
          </div>

          <p className="prose-note" style={{ fontSize: "var(--text-xs)" }}>
            Bab ini juga muncul di Bank Teka-Teki. Menyelesaikannya di salah satu tempat langsung tercatat di
            keduanya.
          </p>
        </div>
      </div>
    </div>
  );
}
