"use client";

// Trik & Quest (Gabungan)
//
// Fitur "Quest" dan "Bank Teka-Teki" kini menjadi satu tampilan dengan filter
// kategori — keduanya menarik dari sumber data yang sama (lib/puzzle-data.ts),
// sehingga tidak ada lagi dua mode terpisah. Semua puzzle memberikan XP.
// Konten diperkaya dari Buku Pintar Catur-Pedia (Fienso Suharsono):
// Bab 7 Taktik Catur, Bab 10 Permainan Akhir, Bab 11 Jebakan, dan
// Bab 12 Taktik Skak Mat.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { BoardControls } from "@/components/board-controls";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { PUZZLE_CATEGORIES, type Puzzle, type PuzzleCategory } from "@/lib/puzzle-data";
import { mergePuzzles, useSavedPuzzles, filterPuzzles } from "@/lib/puzzle-store";
import { HighlightedChessText } from "@/components/chess-text-highlight";
import { useChessTheme } from "@/lib/chess-themes";
import {
  IconCheck3D,
  IconStar3D,
  IconTarget3D,
  IconSearch3D,
  IconLightbulb3D,
  IconClose3D,
  IconLightning3D,
} from "@/components/icons3d";

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
type PlayStage = "initial" | "opponent_thinking" | "continuation" | "completed";

const PIECE_NAMES: Record<string, string> = {
  p: "Pion",
  n: "Kuda",
  b: "Gajah",
  r: "Benteng",
  q: "Menteri",
  k: "Raja",
};

function analyzeMoveTactics(fen: string, fromSq: string, toSq: string, turn: "w" | "b") {
  const c = new Chess(fen);
  const m = c.move({ from: fromSq as Square, to: toSq as Square, promotion: "q" });
  if (!m) return null;

  const col = toSq.charCodeAt(0) - 97;
  const row = parseInt(toSq[1], 10) - 1;
  const targets: { from: string; to: string; pieceName: string }[] = [];
  const guardSquares: string[] = [];
  const coordinatingAttackers: { from: string; to: string }[] = [];

  const addSquare = (cIdx: number, rIdx: number, isPawnMoveOnly = false) => {
    if (cIdx < 0 || cIdx > 7 || rIdx < 0 || rIdx > 7) return false;
    const s = String.fromCharCode(97 + cIdx) + (rIdx + 1);
    const target = c.get(s as Square);
    if (!target) {
      if (!isPawnMoveOnly) guardSquares.push(s);
      return true;
    }
    if (target.color === turn) {
      guardSquares.push(s);
      return false;
    } else {
      targets.push({
        from: toSq,
        to: s,
        pieceName: `${PIECE_NAMES[target.type] || "Perwira"} (${s.toUpperCase()})`,
      });
      return false;
    }
  };

  if (m.piece === "p") {
    const dir = turn === "w" ? 1 : -1;
    addSquare(col - 1, row + dir);
    addSquare(col + 1, row + dir);
  } else if (m.piece === "n") {
    const deltas = [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]];
    for (const [dc, dr] of deltas) addSquare(col + dc, row + dr);
  } else if (m.piece === "k") {
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        addSquare(col + dc, row + dr);
      }
    }
  } else {
    const dirs: [number, number][] = [];
    if (m.piece === "b" || m.piece === "q") dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    if (m.piece === "r" || m.piece === "q") dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    for (const [dc, dr] of dirs) {
      let cIdx = col + dc;
      let rIdx = row + dr;
      while (cIdx >= 0 && cIdx < 8 && rIdx >= 0 && rIdx < 8) {
        if (!addSquare(cIdx, rIdx)) break;
        cIdx += dc;
        rIdx += dr;
      }
    }
  }

  // Cari kawan yang ikut mengincar target yang sama
  for (const t of targets) {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = String.fromCharCode(97 + f) + (r + 1);
        if (sq === toSq) continue;
        const p = c.get(sq as Square);
        if (p && p.color === turn) {
          // Check if piece p attacks target t.to
          const pCol = f;
          const pRow = r;
          let doesAttack = false;
          if (p.type === "p") {
            const dir = turn === "w" ? 1 : -1;
            doesAttack = (pRow + dir === parseInt(t.to[1], 10) - 1) && Math.abs(pCol - (t.to.charCodeAt(0) - 97)) === 1;
          } else if (p.type === "n") {
            const dc = Math.abs(pCol - (t.to.charCodeAt(0) - 97));
            const dr = Math.abs(pRow - (parseInt(t.to[1], 10) - 1));
            doesAttack = (dc === 1 && dr === 2) || (dc === 2 && dr === 1);
          } else if (p.type === "b" || p.type === "r" || p.type === "q") {
            const dCol = t.to.charCodeAt(0) - 97 - pCol;
            const dRow = parseInt(t.to[1], 10) - 1 - pRow;
            const isDiag = Math.abs(dCol) === Math.abs(dRow);
            const isOrth = dCol === 0 || dRow === 0;
            if ((p.type === "b" && isDiag) || (p.type === "r" && isOrth) || (p.type === "q" && (isDiag || isOrth))) {
              const stepC = dCol === 0 ? 0 : dCol > 0 ? 1 : -1;
              const stepR = dRow === 0 ? 0 : dRow > 0 ? 1 : -1;
              let currC = pCol + stepC;
              let currR = pRow + stepR;
              let blocked = false;
              while (currC !== t.to.charCodeAt(0) - 97 || currR !== parseInt(t.to[1], 10) - 1) {
                const checkSq = String.fromCharCode(97 + currC) + (currR + 1);
                if (c.get(checkSq as Square)) {
                  blocked = true;
                  break;
                }
                currC += stepC;
                currR += stepR;
              }
              doesAttack = !blocked;
            }
          }
          if (doesAttack) {
            coordinatingAttackers.push({ from: sq, to: t.to });
          }
        }
      }
    }
  }

  let summary = "";
  if (targets.length > 1) {
    summary = `⚡ Garpu / Serangan Ganda! ${PIECE_NAMES[m.piece] || "Perwira"} di ${toSq.toUpperCase()} mengincar ${targets.map((t) => t.pieceName).join(" dan ")}!`;
  } else if (targets.length === 1) {
    if (coordinatingAttackers.length > 0) {
      summary = `⚔️ Serangan Koordinasi! ${PIECE_NAMES[m.piece] || "Perwira"} di ${toSq.toUpperCase()} berkolaborasi mengincar ${targets[0].pieceName}!`;
    } else {
      summary = `🎯 Mengincar ${targets[0].pieceName} lawan secara langsung!`;
    }
  } else if (guardSquares.length > 0) {
    summary = `🛡️ Mengawal & menjaga ${guardSquares.length} petak strategis (${guardSquares.slice(0, 4).map((s) => s.toUpperCase()).join(", ")}).`;
  }

  return { targets, guardSquares, coordinatingAttackers, summary, san: m.san, captured: m.captured };
}

async function getBotReply(currentFen: string): Promise<{ uci: string; san: string } | null> {
  try {
    const res = await fetch("/api/engine-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen: currentFen, depth: 8, engine: "stockfish" }),
    });
    const d = await res.json();
    if (d.uci && d.san) return { uci: d.uci, san: d.san };
  } catch {}
  try {
    const c = new Chess(currentFen);
    const moves = c.moves({ verbose: true });
    if (moves.length === 0) return null;
    const capture = moves.find((m) => m.captured);
    const chosen = capture || moves[0];
    return { uci: chosen.from + chosen.to + (chosen.promotion || ""), san: chosen.san };
  } catch {
    return null;
  }
}

export function LearningHub({ lang = "id" }: Props) {
  const { progress, complete } = useQuestProgress();
  const { saved } = useSavedPuzzles();
  const { customPieces, notationStyles, boardTheme, boardThemeId, pieceThemeId } = useChessTheme();

  const [fullscreen, setFullscreen] = useState(false);
  const [category, setCategory] = useState<PuzzleCategory | "all">("all");
  const [puzzleIndex, setPuzzleIndex] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        setFullscreen((v) => !v);
      } else if (e.key === "z" || e.key === "Z") {
        setPlayAsBlack((v) => !v);
      } else if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const [fen, setFen] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"unsolved" | "correct" | "wrong">("unsolved");
  const [stage, setStage] = useState<PlayStage>("initial");
  const [hint, setHint] = useState(0);
  const [playAsBlack, setPlayAsBlack] = useState(false);
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);
  const [tacticalInfo, setTacticalInfo] = useState<{
    targets: { from: string; to: string; pieceName: string }[];
    guardSquares: string[];
    coordinatingAttackers: { from: string; to: string }[];
    summary: string;
  } | null>(null);

  const list = useMemo(() => filterPuzzles(mergePuzzles(saved), category), [saved, category]);
  const puzzle = list[Math.min(puzzleIndex, Math.max(0, list.length - 1))];

  const boardSide = playAsBlack
    ? (puzzle?.turn === "w" ? "black" : "white")
    : puzzle?.turn === "w" ? "white" : "black";

  const load = useCallback((c: Puzzle | undefined) => {
    if (!c) return;
    setFen(c.fen);
    setSelected(null);
    setStatus("unsolved");
    setStage("initial");
    setHint(0);
    setCaptureMsg(null);
    // Pre-calculate tactical targets so player immediately sees green preview on hint
    const from = c.solutionUci.slice(0, 2);
    const to = c.solutionUci.slice(2, 4);
    const preInfo = analyzeMoveTactics(c.fen, from, to, c.turn);
    setTacticalInfo(preInfo);
  }, []);

  useEffect(() => {
    load(puzzle);
  }, [puzzle?.id, load]);

  useEffect(() => {
    setPuzzleIndex(0);
  }, [category]);

  const executeMove = async (fromSq: Square, toSq: Square) => {
    if (!puzzle || stage === "opponent_thinking") return false;
    const c = new Chess(fen);
    let m = null;
    try {
      m = c.move({ from: fromSq, to: toSq, promotion: "q" });
    } catch {
      m = null;
    }
    if (!m) {
      setSelected(null);
      return false;
    }

    if (stage === "initial") {
      if (m.san === puzzle.solutionSan) {
        setFen(c.fen());
        setSelected(null);
        setStatus("correct");
        complete(puzzle.id, puzzle.xp);

        // Kunci info taktis langkah 1
        const info = analyzeMoveTactics(puzzle.fen, fromSq, toSq, puzzle.turn);
        if (info) setTacticalInfo(info);

        if (c.isCheckmate() || c.isGameOver()) {
          setStage("completed");
          setCaptureMsg(c.isCheckmate() ? "🎉 Skakmat Mutlak! Raja lawan terkunci tanpa pelarian." : "Permainan selesai dengan keunggulan mutlak.");
          return true;
        }

        // Trik belum skakmat -> lawan merespon otomatis
        setStage("opponent_thinking");
        setTimeout(async () => {
          const reply = await getBotReply(c.fen());
          if (reply) {
            const oppMove = c.move(reply.san);
            if (oppMove) {
              setFen(c.fen());
            }
          }
          setStage("continuation");
        }, 700);
        return true;
      } else {
        setStatus("wrong");
        setSelected(null);
        return false;
      }
    }

    if (stage === "continuation") {
      // Langkah lanjutan pemain (bisa memakan bidak sasaran!)
      setFen(c.fen());
      setSelected(null);

      if (m.captured || m.san.includes("#") || c.isCheckmate()) {
        const capName = m.captured ? (PIECE_NAMES[m.captured] || "Perwira") : "Target";
        const msg = m.san.includes("#") || c.isCheckmate()
          ? "🎉 Skakmat! Trik tuntas menyudahi perlawanan lawan."
          : `🎯 Berhasil memakan ${capName} di ${m.to.toUpperCase()}! Trik sukses terlaksana!`;
        setCaptureMsg(msg);
        setStage("completed");
        return true;
      }

      // Jika belum memakan tapi langkah legal lanjutan, biarkan bot membalas lagi
      setStage("opponent_thinking");
      setTimeout(async () => {
        const reply = await getBotReply(c.fen());
        if (reply) {
          c.move(reply.san);
          setFen(c.fen());
        }
        setStage(c.isGameOver() ? "completed" : "continuation");
      }, 700);
      return true;
    }

    return false;
  };

  const onSquareClick = ({ square }: { square: string }) => {
    if (!puzzle || stage === "opponent_thinking") return;
    const c = new Chess(fen);
    const sq = square.toLowerCase() as Square;
    const turn = c.turn();

    if (!selected) {
      const p = c.get(sq);
      if (p && p.color === turn) setSelected(square);
      return;
    }
    if (selected.toLowerCase() === sq) {
      setSelected(null);
      return;
    }
    const target = c.get(sq);
    if (target && target.color === turn) {
      setSelected(square);
      return;
    }

    const from = selected.toLowerCase() as Square;
    void executeMove(from, sq);
  };

  const handlePieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }): boolean => {
    if (!puzzle || !targetSquare || stage === "opponent_thinking") return false;
    const from = sourceSquare.toLowerCase() as Square;
    const to = targetSquare.toLowerCase() as Square;
    void executeMove(from, to);
    return true;
  };

  if (!puzzle) return <p className="prose-note">Belum ada teka-teki.</p>;

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selected) squareStyles[selected] = { boxShadow: "inset 0 0 0 3px var(--board-mark)" };

  const from = puzzle.solutionUci.slice(0, 2);
  const to = puzzle.solutionUci.slice(2, 4);

  if (hint >= 1 && stage === "initial") {
    squareStyles[from] = { boxShadow: "inset 0 0 0 3px var(--accent)", backgroundColor: "rgba(245, 158, 11, 0.2)" };
  }
  if (hint >= 2 && stage === "initial") {
    squareStyles[to] = { boxShadow: "inset 0 0 0 3px var(--primary)", backgroundColor: "rgba(129, 182, 76, 0.35)" };
  }

  // Tanda Hijau di Papan:
  if (stage !== "initial") {
    squareStyles[from] = { backgroundColor: "rgba(34, 197, 94, 0.25)" };
    squareStyles[to] = { backgroundColor: "rgba(34, 197, 94, 0.45)", boxShadow: "inset 0 0 0 2px rgb(34, 197, 94)" };
  }

  // Petak sasaran / bidak yang diincar (Warna Hijau Terang & Glowing Box)
  if (tacticalInfo && (stage !== "initial" || hint >= 2)) {
    for (const t of tacticalInfo.targets) {
      squareStyles[t.to] = {
        backgroundColor: "rgba(34, 197, 94, 0.45)",
        boxShadow: "inset 0 0 0 3px rgb(34, 197, 94)",
        borderRadius: "8px",
      };
    }
    // Petak yang dijaga / dikawal (Warna Hijau Menjaga Kotak)
    for (const sq of tacticalInfo.guardSquares) {
      if (!squareStyles[sq]) {
        squareStyles[sq] = {
          backgroundColor: "rgba(129, 182, 76, 0.18)",
          boxShadow: "inset 0 0 0 1.5px rgba(129, 182, 76, 0.55)",
        };
      }
    }
  }

  // Panah hijau di papan
  const arrows: { startSquare: string; endSquare: string; color: string }[] = [];
  if (hint >= 3 && stage === "initial") {
    arrows.push({ startSquare: from, endSquare: to, color: "rgb(34, 197, 94)" });
  }

  if (tacticalInfo && (stage !== "initial" || hint >= 2)) {
    for (const t of tacticalInfo.targets) {
      arrows.push({ startSquare: t.from, endSquare: t.to, color: "rgb(34, 197, 94)" });
    }
    for (const coord of tacticalInfo.coordinatingAttackers) {
      arrows.push({ startSquare: coord.from, endSquare: coord.to, color: "rgba(34, 197, 94, 0.85)" });
    }
  }

  const doneCount = list.filter((c) => progress.completed.includes(c.id)).length;
  const currentIndex = Math.min(puzzleIndex, Math.max(0, list.length - 1));

  const diffBadgeClass =
    puzzle.difficulty === "Mudah"
      ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
      : puzzle.difficulty === "Sedang"
        ? "bg-amber-950/70 text-amber-300 border-amber-500/50"
        : "bg-rose-950/70 text-rose-300 border-rose-500/50";

  const isBPCaturPedia = puzzle.source === "bpcaturpedia" || puzzle.theme?.includes("BPCaturPedia");

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-[var(--background)] text-white flex flex-col p-2 sm:p-3 overflow-hidden animate-in fade-in duration-200"
          : "stack"
      }
      style={fullscreen ? undefined : { maxWidth: "64rem", margin: "0 auto" }}
    >
      {/* HEADER */}
      <div className="row-between items-center gap-2 shrink-0">
        <div>
          <h2 className="section-title text-xl sm:text-2xl font-black text-white tracking-wide">
            {lang === "id" ? "Trik & Quest Taktik" : "Tricks & Tactical Quests"}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Konten diperkaya dari Taktik Fabiano Caruana, Buku Pintar Catur-Pedia & CT-ART 4.0
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 shadow-sm">
            <IconCheck3D size={16} />
            {doneCount}/{list.length} selesai · {progress.xp} XP
          </span>
        </div>
      </div>

      {/* NAVIGASI + FILTER KATEGORI */}
      <div className="panel px-3 py-2 flex items-center gap-2 flex-wrap bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PuzzleCategory | "all")}
          className="ctl ctl-sm text-xs font-bold py-1.5 px-2.5 cursor-pointer bg-[var(--surface)] text-neutral-200 border border-[var(--border)] rounded-lg"
          aria-label="Pilih Kategori"
        >
          {PUZZLE_CATEGORIES.map((c) => {
            const count = c.id === "all" ? list.length : filterPuzzles(mergePuzzles(saved), c.id as PuzzleCategory).length;
            if (count === 0) return null;
            return (
              <option key={c.id} value={c.id}>
                {c.label} ({count})
              </option>
            );
          })}
        </select>

        <button
          className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white shrink-0"
          disabled={currentIndex <= 0}
          onClick={() => setPuzzleIndex((i) => Math.max(0, i - 1))}
          title="Sebelumnya"
        >
          <ChevronLeft size={16} className="shrink-0" /><span>Prev</span>
        </button>

        <select
          value={currentIndex}
          onChange={(e) => setPuzzleIndex(Number(e.target.value))}
          className="ctl ctl-sm text-xs font-bold truncate py-1.5 px-3 cursor-pointer bg-[var(--surface)] text-white border border-[var(--border)] rounded-lg flex-1 min-w-[180px]"
          aria-label="Pilih Teka-Teki"
        >
          {list.map((p, idx) => {
            const isDone = progress.completed.includes(p.id);
            const srcLabel = p.source === "bpcaturpedia" ? " 📖" : "";
            return (
              <option key={p.id} value={idx}>
                {isDone ? "[✓] " : ""}{idx + 1}. {p.theme}{srcLabel} ({p.difficulty})
              </option>
            );
          })}
        </select>

        <button
          className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] text-neutral-300 hover:text-white shrink-0"
          disabled={currentIndex >= list.length - 1}
          onClick={() => setPuzzleIndex((i) => Math.min(list.length - 1, i + 1))}
          title="Berikutnya"
        >
          <span>Next</span><ChevronRight size={16} className="shrink-0" />
        </button>
      </div>

      <div
        className={
          fullscreen
            ? "flex-1 grid lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_430px] gap-3 items-stretch min-h-0 overflow-hidden pt-1"
            : "grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-3 items-start w-full min-h-0"
        }
      >
        {/* LEFT: BOARD */}
        <div
          className={
            fullscreen
              ? "flex flex-col items-center justify-center h-full min-h-0 w-full max-w-[min(96vw,calc(100dvh-140px))] mx-auto py-0.5"
              : "rounded-2xl p-2.5 bg-[var(--card)] border border-[var(--border)] shadow-xl w-full flex flex-col justify-start items-center"
          }
        >
          <BoardControls
            variant="toolbar"
            orientation={boardSide}
            onFlipOrientation={() => setPlayAsBlack((v) => !v)}
            isFullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            showShortcuts={true}
            className="w-full shrink-0 mb-1"
          />

          <div
            className="aspect-square rounded-2xl overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--board-dark)] shadow-2xl w-full max-w-[min(100%,calc(100dvh-260px))]"
          >
            <Chessboard
              key={`trikquest-${puzzle.id}-${boardSide}-${boardThemeId}-${pieceThemeId}`}
              options={{
                id: `trikquest-${puzzle.id}`,
                position: fen,
                boardOrientation: boardSide,
                allowDragging: stage !== "opponent_thinking",
                canDragPiece: ({ piece }) => {
                  if (stage === "opponent_thinking") return false;
                  const turn = new Chess(fen).turn();
                  return turn === "w" ? piece.pieceType.startsWith("w") : piece.pieceType.startsWith("b");
                },
                onPieceDrop: handlePieceDrop,
                squareStyles,
                arrows,
                onSquareClick,
                boardStyle: {
                  backgroundColor: boardTheme.dark,
                  width: "100%",
                  height: "100%",
                },
                darkSquareStyle: { backgroundColor: boardTheme.dark },
                lightSquareStyle: { backgroundColor: boardTheme.light },
                pieces: customPieces,
                animationDurationInMs: 200,
                ...notationStyles,
              }}
            />
          </div>

          {/* LEGENDA TANDA HIJAU DI PAPAN */}
          <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs text-neutral-300 flex-wrap gap-2 w-full max-w-[min(100%,calc(100dvh-260px))] shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[rgba(34,197,94,0.45)] border-2 border-[rgb(34,197,94)]" />
              <span className="font-bold text-white">Target Diincar</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[rgba(129,182,76,0.2)] border border-[rgba(129,182,76,0.6)]" />
              <span>Kotak Dijaga</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[rgb(34,197,94)] font-bold">➔ Panah Hijau</span>
              <span>Arah Serangan</span>
            </div>
          </div>
        </div>

        {/* RIGHT: INFO PANEL */}
        <div
          className="panel p-3.5 flex flex-col gap-2.5 flex-1 min-w-[18rem] max-h-[calc(100dvh-185px)] overflow-y-auto custom-scrollbar min-h-0 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl"
        >
          {/* Header Metadata */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider bg-[var(--surface)] text-neutral-300 border border-[var(--border)]">
                #{currentIndex + 1} · {puzzle.category}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${diffBadgeClass}`}>
                {puzzle.difficulty}
              </span>
              {isBPCaturPedia && (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-950/60 text-amber-200 border border-amber-500/40">
                  📖 BPCaturPedia
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black text-amber-300 bg-amber-950/70 border border-amber-500/50 shadow-sm flex items-center gap-1.5">
                <IconStar3D size={14} className="shrink-0" />
                <span>+{puzzle.xp} XP</span>
              </span>
            </div>
          </div>

          {/* Theme Title */}
          <div>
            <h3 className="text-sm sm:text-base font-black text-white leading-snug tracking-tight">
              {puzzle.theme}
            </h3>
            <span className="text-xs font-semibold text-emerald-400 mt-0.5 block">
              Giliran {puzzle.turn === "w" ? "Putih Melangkah & Menang" : "Hitam Melangkah & Menang"}
            </span>
          </div>

          {/* MISI TAKTIK */}
          <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <IconTarget3D size={15} className="shrink-0" />
              <span>Misi Trik & Taktik</span>
            </div>
            <p className="text-xs text-neutral-200 leading-relaxed font-normal">
              <HighlightedChessText text={puzzle.description} />
            </p>
          </div>

          {/* KARTU VISUAL TAKTIK & ANCAMAN (TANDA HIJAU) */}
          {tacticalInfo && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border-2 border-emerald-500/70 shadow-lg space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <IconTarget3D size={15} />
                  <span>Target & Pengawalan Petak</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-900/90 border border-emerald-400/60 text-emerald-200">
                  Tanda Hijau Aktif
                </span>
              </div>

              <div className="text-xs font-bold text-white leading-snug">
                {tacticalInfo.summary}
              </div>

              {tacticalInfo.targets.length > 0 && (
                <div className="space-y-1 pt-1.5 border-t border-emerald-800/60">
                  <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                    <span>🎯 Bidak Sasaran yang Diincar:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tacticalInfo.targets.map((t, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-emerald-900 border border-emerald-400 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        {t.pieceName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {tacticalInfo.guardSquares.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-emerald-800/60">
                  <div className="text-[11px] font-bold text-emerald-300">
                    🛡️ Wilayah / Kotak yang Dikawal:
                  </div>
                  <div className="text-xs text-emerald-200/90 font-mono font-bold">
                    {tacticalInfo.guardSquares.slice(0, 8).map((s) => s.toUpperCase()).join(", ")}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATUS RESPON LAWAN & KELANJUTAN */}
          {stage === "opponent_thinking" && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-xs font-bold text-amber-200 flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Langkah kunci tepat! Lawan sedang membalas di papan...</span>
            </div>
          )}

          {stage === "continuation" && (
            <div className="p-3.5 rounded-xl bg-sky-950/60 border-2 border-sky-500/70 text-xs text-sky-100 space-y-1.5 animate-in fade-in">
              <div className="font-black text-xs text-sky-300 flex items-center gap-1.5 uppercase tracking-wide">
                <IconLightning3D size={16} />
                <span>⚔️ Lanjutan Trik: Giliranmu!</span>
              </div>
              <p className="leading-relaxed text-xs">
                Lawan telah membalas langkah. Sekarang lanjutkan gerakanmu di papan untuk <strong>memakan bidak sasaran</strong> atau melumpuhkan pertahanan lawan!
              </p>
            </div>
          )}

          {captureMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border-2 border-emerald-400 text-emerald-100 space-y-1 shadow-lg animate-in fade-in">
              <div className="font-black text-xs text-emerald-300 flex items-center gap-1.5">
                <IconCheck3D size={16} />
                <span>{captureMsg}</span>
              </div>
              <p className="text-[11px] text-emerald-200/90">
                Seluruh rangkaian manuver taktis berhasil diselesaikan sampai tuntas.
              </p>
            </div>
          )}

          {/* HINTS */}
          {hint >= 1 && stage === "initial" && (
            <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs leading-relaxed text-amber-100 animate-in fade-in">
              <strong className="text-amber-300 mb-0.5 text-[11px] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <IconSearch3D size={13} />
                <span>Petunjuk 1 (Bidak):</span>
              </strong>
              <HighlightedChessText text={puzzle.hintPiece} />
            </div>
          )}
          {hint >= 2 && stage === "initial" && (
            <div className="p-2.5 rounded-xl bg-sky-950/30 border border-sky-500/40 text-xs leading-relaxed text-sky-100 animate-in fade-in">
              <strong className="text-sky-300 mb-0.5 text-[11px] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <IconTarget3D size={13} />
                <span>Petunjuk 2 (Petak Tujuan):</span>
              </strong>
              <HighlightedChessText text={puzzle.hintExplanation} />
            </div>
          )}

          {/* TRIK PENJELASAN (Saat Benar) */}
          {status === "correct" && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border-2 border-emerald-500/70 shadow-lg space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-300 font-black text-sm">
                  <IconCheck3D size={18} />
                  <span>{puzzle.solutionSan} Benar!</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-black bg-emerald-900/80 border border-emerald-400/50 text-emerald-200">
                  +{puzzle.xp} XP Didapat
                </span>
              </div>

              <div className="pt-1 border-t border-emerald-800/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-0.5 flex items-center gap-1.5">
                  <IconLightbulb3D size={13} />
                  <span>
                    {isBPCaturPedia
                      ? "Penjelasan Trik · Buku Pintar Catur-Pedia:"
                      : "Rahasia Trik & Motif Taktik:"}
                  </span>
                </span>
                <p className="text-xs text-emerald-50 leading-relaxed font-normal">
                  <HighlightedChessText text={puzzle.trickExplanation} />
                </p>
              </div>
            </div>
          )}

          {status === "wrong" && (
            <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/60 text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
              <span className="font-bold flex items-center gap-1.5">
                <IconClose3D size={15} />
                <span>Langkah belum tepat.</span>
              </span>
              <span className="text-[11px] text-rose-300">Coba analisa ulang atau buka petunjuk.</span>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center gap-2 pt-1 flex-wrap mt-auto">
            <button
              className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-xl border border-[var(--border)] text-neutral-300 hover:text-white flex items-center gap-1.5"
              onClick={() => load(puzzle)}
            >
              <RotateCcw size={13} />
              <span>Ulangi</span>
            </button>
            {stage === "initial" && (
              <>
                <button
                  className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-950/30"
                  onClick={() => setHint((h) => Math.min(2, h + 1))}
                >
                  Petunjuk {hint + 1}
                </button>
                <button
                  className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-xl border border-[var(--border)] text-neutral-400 hover:text-white"
                  onClick={() => {
                    try {
                      const c = new Chess(puzzle.fen);
                      const move = c.move({ from: from as Square, to: to as Square, promotion: puzzle.solutionUci[4] || "q" });
                      if (!move || move.san !== puzzle.solutionSan) return;
                      setFen(c.fen());
                      const info = analyzeMoveTactics(puzzle.fen, from, to, puzzle.turn);
                      if (info) setTacticalInfo(info);
                      setStatus("correct");
                      setHint(2);
                      if (c.isCheckmate() || c.isGameOver()) {
                        setStage("completed");
                        setCaptureMsg("🎉 Skakmat Mutlak! Raja lawan terkunci tanpa pelarian.");
                      } else {
                        setStage("opponent_thinking");
                        setTimeout(async () => {
                          const reply = await getBotReply(c.fen());
                          if (reply) {
                            c.move(reply.san);
                            setFen(c.fen());
                          }
                          setStage("continuation");
                        }, 700);
                      }
                    } catch {}
                  }}
                >
                  Buka solusi
                </button>
              </>
            )}
            <button
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                status === "correct" || stage === "completed"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400"
                  : "border border-[var(--border)] text-neutral-300 hover:text-white"
              }`}
              onClick={() => setPuzzleIndex((i) => Math.min(list.length - 1, i + 1))}
              disabled={currentIndex >= list.length - 1}
            >
              <span className="flex items-center gap-1"><span>Berikutnya</span><ChevronRight size={15} className="shrink-0" /></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
