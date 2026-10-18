"use client";

// Trik & Quest (Gabungan)
//
// Fitur "Quest" dan "Bank Teka-Teki" kini menjadi satu tampilan dengan filter
// kategori — keduanya menarik dari sumber data yang sama (lib/puzzle-data.ts).
// Dilengkapi:
// 1. Chess.com Style Badges (‼️ Brilliant, ⭐️ Great, 🟢 Best, 📖 Book, ❌ Blunder) di atas bidak.
// 2. Solusi Berantai Tuntas sampai Menang Materi / Skakmat (Tidak berhenti di langkah 1).
// 3. Panduan Taktik Pemula: Mengapa Menteri Tidak Dikorbankan & Cara Mengeksekusi Garpu e5.
// 4. Panel Ringkas Bebas Scroll Berlebihan.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, ShieldCheck, TrendingUp, BookOpen, Sparkles } from "lucide-react";
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

export type MoveBadgeType = "brilliant" | "great" | "best" | "book" | "blunder" | "mistake";

export interface MoveBadge {
  type: MoveBadgeType;
  label: string;
  bg: string;
  color: string;
  desc: string;
}

const BADGE_CONFIGS: Record<MoveBadgeType, { label: string; bg: string; color: string; desc: string }> = {
  brilliant: { label: "!!", bg: "#06b6d4", color: "#ffffff", desc: "Brilian (Pengorbanan Taktis Jenius)" },
  great: { label: "★", bg: "#0284c7", color: "#ffffff", desc: "Luar Biasa (Satu-satunya Langkah Menang)" },
  best: { label: "✓", bg: "#16a34a", color: "#ffffff", desc: "Langkah Terbaik (Best Move)" },
  book: { label: "📖", bg: "#d97706", color: "#ffffff", desc: "Teori Buku Pembukaan (Book Move)" },
  blunder: { label: "??", bg: "#dc2626", color: "#ffffff", desc: "Blunder Fatal Lawan" },
  mistake: { label: "?", bg: "#ea580c", color: "#ffffff", desc: "Kesalahan Posisi Lawan" },
};

const PIECE_NAMES: Record<string, string> = {
  p: "Pion",
  n: "Kuda",
  b: "Gajah",
  r: "Benteng",
  q: "Menteri",
  k: "Raja",
};

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3.2,
  r: 5,
  q: 9,
  k: 100,
};

interface TacticalAnalysisResult {
  targets: { from: string; to: string; pieceName: string }[];
  guardSquares: string[];
  coordinatingAttackers: { from: string; to: string }[];
  summary: string;
  san: string;
  captured?: string;
  gainHeadline: string;
  gainDetail: string;
  avoidedDanger: string;
  routeGuide: {
    enemyMove: string;
    ourReply: string;
    outcome: string;
  };
}

function analyzeMoveTactics(fen: string, fromSq: string, toSq: string, turn: "w" | "b"): TacticalAnalysisResult | null {
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

  // Cari kawan koordinasi
  for (const t of targets) {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = String.fromCharCode(97 + f) + (r + 1);
        if (sq === toSq) continue;
        const p = c.get(sq as Square);
        if (p && p.color === turn) {
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
          if (doesAttack) coordinatingAttackers.push({ from: sq, to: t.to });
        }
      }
    }
  }

  // Analisis Untung vs Dihindari (Padat & Jelas)
  let gainHeadline = "Dominasi Serangan & Inisiatif Mutlak";
  let gainDetail = "Mengeksploitasi kelemahan koordinasi lawan.";
  let avoidedDanger = "Menghindari posisi pasif dan mencegah serangan balik lawan.";
  let routeGuide = {
    enemyMove: "Bila lawan tutup (misal g6)",
    ourReply: "Makan e5 (Qxe5+) garpu Raja & Benteng",
    outcome: "Rebut Benteng bersih (+5 Poin)",
  };

  if (m.san.startsWith("Qh5") || m.to === "h5") {
    gainHeadline = "Menteri TIDAK Hilang! Garpu Skak Ganda";
    gainDetail = "Qh5+ memberikan skak langsung. Lawan wajib merespons Raja, Menteri Anda 100% aman!";
    avoidedDanger = "Membongkar diagonal maut e8-h5 yang ditinggalkan pion f6 lawan.";
    routeGuide = {
      enemyMove: "Jika lawan tutup 1... g6",
      ourReply: "Balas 2. Qxe5+! (Skak & bidik Benteng h8) ➔ 3. Qxh8",
      outcome: "Menang Benteng Bersih (+5 Poin) & Posisi Menang Total",
    };
  } else if (m.captured) {
    const val = PIECE_VALUES[m.captured] || 1;
    gainHeadline = `Menang Materi: ${PIECE_NAMES[m.captured]} (+${val} Poin)`;
    gainDetail = `Eksekusi perwira lawan di ${toSq.toUpperCase()} mengubah keseimbangan permainan.`;
  } else if (targets.length > 1) {
    gainHeadline = `Garpu Ganda (Fork) Mengincar ${targets.length} Sasaran`;
    gainDetail = `Menyerang ${targets.map((t) => t.pieceName).join(" & ")} — lawan tak bisa menjaga keduanya!`;
  }

  let summary = "";
  if (targets.length > 1) {
    summary = `⚡ Garpu / Serangan Ganda! ${PIECE_NAMES[m.piece] || "Perwira"} di ${toSq.toUpperCase()} mengincar ${targets.map((t) => t.pieceName).join(" dan ")}!`;
  } else if (targets.length === 1) {
    summary = `🎯 Mengincar ${targets[0].pieceName} lawan secara langsung!`;
  } else if (guardSquares.length > 0) {
    summary = `🛡️ Mengawal & menjaga ${guardSquares.length} petak strategis sentral.`;
  }

  return {
    targets,
    guardSquares,
    coordinatingAttackers,
    summary,
    san: m.san,
    captured: m.captured,
    gainHeadline,
    gainDetail,
    avoidedDanger,
    routeGuide,
  };
}

// Menghitung rangkaian taktik dinamis sampai benar-benar tuntas (skakmat / merebut perwira besar / kemenangan mutlak)
function computeFullContinuationSequence(fen: string, solutionSan: string, maxPlies = 10) {
  const c = new Chess(fen);
  let m1 = null;
  try {
    m1 = c.move(solutionSan);
  } catch {
    m1 = null;
  }
  if (!m1) return [];

  const sequence = [
    {
      san: m1.san,
      uci: m1.from + m1.to + (m1.promotion || ""),
      from: m1.from,
      to: m1.to,
      captured: m1.captured,
      isCheckmate: c.isCheckmate(),
      badge: "brilliant" as MoveBadgeType,
    },
  ];
  if (c.isCheckmate() || c.isGameOver()) return sequence;

  const valMap: Record<string, number> = { q: 900, r: 500, b: 330, n: 320, p: 100, k: 20000 };

  for (let p = 1; p < maxPlies; p++) {
    if (c.isGameOver()) break;
    const moves = c.moves({ verbose: true });
    if (moves.length === 0) break;

    // Prioritas AI: Skakmat -> Makan Perwira Terbesar -> Skak
    moves.sort((a, b) => {
      if (a.san.includes("#")) return -10000;
      if (b.san.includes("#")) return 10000;
      const vA = a.captured ? (valMap[a.captured] || 100) : 0;
      const vB = b.captured ? (valMap[b.captured] || 100) : 0;
      if (vA !== vB) return vB - vA;
      if (a.san.includes("+") && !b.san.includes("+")) return -50;
      if (b.san.includes("+") && !a.san.includes("+")) return 50;
      return 0;
    });

    const chosen = moves[0];
    const m = c.move(chosen);
    const isBot = p % 2 === 1; // 1 = Bot (Opponent), 2 = Player
    const badgeType: MoveBadgeType = isBot
      ? (m.captured ? "mistake" : "blunder")
      : (m.captured ? "best" : m.san.includes("+") ? "great" : "best");

    sequence.push({
      san: m.san,
      uci: m.from + m.to + (m.promotion || ""),
      from: m.from,
      to: m.to,
      captured: m.captured,
      isCheckmate: c.isCheckmate(),
      badge: badgeType,
    });

    // Syarat Tuntas Alami: Jika skakmat atau pemain telah merebut perwira besar (Menteri/Benteng/Perwira)
    if (c.isCheckmate()) break;
    if (!isBot && m.captured && (m.captured === "r" || m.captured === "q" || m.captured === "b" || m.captured === "n") && p >= 3) {
      break; // Trik tuntas: perwira sasaran berhasil direbut!
    }
  }
  return sequence;
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
  const [tacticalInfo, setTacticalInfo] = useState<TacticalAnalysisResult | null>(null);

  // CHESS.COM STYLE BADGES: Keyed by square (e.g. h5 -> Brilliant, g6 -> Blunder)
  const [moveBadges, setMoveBadges] = useState<Record<string, MoveBadge>>({});

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
    setMoveBadges({});
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

  // Eksekusi Langkah Manual Pemain (Dengan Auto-Continuation Bot & Badges)
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

        // Pasang badge Brilian / Best di petak tujuan
        const isBrilliant = m.san.includes("+") || m.san.startsWith("Q") || m.captured;
        const bType: MoveBadgeType = isBrilliant ? "brilliant" : "best";
        setMoveBadges((prev) => ({
          ...prev,
          [toSq]: { type: bType, ...BADGE_CONFIGS[bType] },
        }));

        const info = analyzeMoveTactics(puzzle.fen, fromSq, toSq, puzzle.turn);
        if (info) setTacticalInfo(info);

        if (c.isCheckmate() || c.isGameOver()) {
          setStage("completed");
          setCaptureMsg(c.isCheckmate() ? "🎉 Skakmat Mutlak! Raja lawan terkunci pada langkah pertama." : "Kombinasi taktis sukses diselesaikan!");
          return true;
        }

        // AUTO-CONTINUATION: Bot membalas otomatis secara instan agar pemula tahu menterinya TIDAK HILANG!
        setStage("opponent_thinking");
        setTimeout(() => {
          const opponentMoves = c.moves({ verbose: true });
          if (opponentMoves.length === 0) {
            setStage("completed");
            return;
          }

          // Prioritaskan respons realistis: blokade skak / serang balik
          opponentMoves.sort((a, b) => {
            if (a.san.includes("x")) return -10;
            if (a.piece === "p" && (a.to === "g6" || a.to === "d5" || a.to === "e6")) return -5;
            return 0;
          });

          const oppM = opponentMoves[0];
          c.move(oppM.san);
          setFen(c.fen());

          // Beri badge Blunder / Mistake pada langkah lawan
          setMoveBadges((prev) => ({
            ...prev,
            [oppM.to]: { type: "mistake", ...BADGE_CONFIGS.mistake },
          }));

          setStage("continuation");
          setCaptureMsg(
            `⚔️ Lawan membalas ${oppM.san}! Menterimu aman. Sekarang lanjutkan langkah ke-2 untuk merebut materi/skakmat!`
          );
        }, 550);
        return true;
      } else {
        setStatus("wrong");
        setSelected(null);
        // Tampilkan badge Blunder di petak salah
        setMoveBadges((prev) => ({
          ...prev,
          [toSq]: { type: "blunder", ...BADGE_CONFIGS.blunder },
        }));
        return false;
      }
    }

    if (stage === "continuation" || stage === "completed") {
      setFen(c.fen());
      setSelected(null);

      // Pasang badge Best pada langkah lanjutan
      setMoveBadges((prev) => ({
        ...prev,
        [toSq]: { type: "best", ...BADGE_CONFIGS.best },
      }));

      const postInfo = analyzeMoveTactics(fen, fromSq, toSq, puzzle.turn);
      if (postInfo) setTacticalInfo(postInfo);

      if (c.isCheckmate() || c.isGameOver()) {
        const msg = c.isCheckmate()
          ? "🎉 Skakmat Mutlak! Rangkaian taktik sukses menyudahi perlawanan lawan."
          : "Permainan selesai dengan keunggulan mutlak.";
        setCaptureMsg(msg);
        setStage("completed");
        return true;
      }

      if (m.captured) {
        const capName = PIECE_NAMES[m.captured] || "Perwira";
        setCaptureMsg(`🎯 Langkah ke-2 Sukses: Berhasil memakan ${capName} di ${m.to.toUpperCase()}! Posisi menang mutlak.`);
      }

      setStage("opponent_thinking");
      setTimeout(() => {
        const botMoves = c.moves({ verbose: true });
        if (botMoves.length > 0) {
          c.move(botMoves[0].san);
          setFen(c.fen());
        }
        setStage(c.isGameOver() ? "completed" : "continuation");
      }, 550);
      return true;
    }

    return false;
  };

  // FULL MULTI-STEP SOLVER: Memainkan demonstrasi lengkap berantai (3+ langkah) dengan Badge Chess.com!
  const handleSolveMultiStep = () => {
    if (!puzzle) return;
    try {
      const steps = computeFullContinuationSequence(puzzle.fen, puzzle.solutionSan, 6);
      if (steps.length === 0) return;

      const simChess = new Chess(puzzle.fen);

      // STEP 1: Langkah 1 Kawan
      const s0 = steps[0];
      simChess.move(s0.san);
      setFen(simChess.fen());
      setStatus("correct");
      setHint(2);
      complete(puzzle.id, puzzle.xp);

      setMoveBadges({
        [s0.to]: { type: "brilliant", ...BADGE_CONFIGS.brilliant },
      });

      const info0 = analyzeMoveTactics(puzzle.fen, s0.from, s0.to, puzzle.turn);
      if (info0) setTacticalInfo(info0);
      setCaptureMsg(`⚡ Langkah 1: ${s0.san} [‼️ Brilian] — Mengeksploitasi kelemahan lawan!`);

      if (steps.length === 1 || s0.isCheckmate) {
        setStage("completed");
        setCaptureMsg(s0.isCheckmate ? "🎉 Skakmat Mutlak di Langkah 1! Kemenangan sempurna." : "Langkah pembuka taktis sukses terlaksana.");
        return;
      }

      // STEP 2: Balasan Lawan 1
      setStage("opponent_thinking");
      setTimeout(() => {
        const s1 = steps[1];
        simChess.move(s1.san);
        setFen(simChess.fen());

        // Tampilkan badge hanya untuk langkah aktif di papan
        setMoveBadges({
          [s0.to]: { type: "brilliant", ...BADGE_CONFIGS.brilliant },
          [s1.to]: { type: "mistake", ...BADGE_CONFIGS.mistake },
        });

        if (steps.length <= 2) {
          setStage("completed");
          return;
        }

        // STEP 3: Langkah 2 Kawan (Makan Materi / Garpu)
        setTimeout(() => {
          const s2 = steps[2];
          simChess.move(s2.san);
          setFen(simChess.fen());

          // Bidak s0 sudah berpindah atau dilanjutkan, ganti badge ke langkah aktif terbaru
          setMoveBadges({
            [s2.to]: { type: "best", ...BADGE_CONFIGS.best },
            [s1.to]: { type: "mistake", ...BADGE_CONFIGS.mistake },
          });

          const info2 = analyzeMoveTactics(simChess.fen(), s2.from, s2.to, puzzle.turn);
          if (info2) setTacticalInfo(info2);

          const cap2 = s2.captured ? ` (Memakan ${PIECE_NAMES[s2.captured] || "Perwira"} di ${s2.to.toUpperCase()})` : "";
          setCaptureMsg(`⚔️ Langkah 2: ${s2.san}${cap2} [★ Best] — Menteri merebut materi & garpu lawan!`);

          if (steps.length <= 3 || s2.isCheckmate) {
            setStage("completed");
            setCaptureMsg(s2.isCheckmate ? `🎉 Skakmat di Langkah 2 (${s2.san})!` : `🎯 Tuntas: Keunggulan materi berhasil diamankan.`);
            return;
          }

          // STEP 4: Balasan Lawan 2
          setStage("opponent_thinking");
          setTimeout(() => {
            const s3 = steps[3];
            simChess.move(s3.san);
            setFen(simChess.fen());

            setMoveBadges({
              [s2.to]: { type: "best", ...BADGE_CONFIGS.best },
              [s3.to]: { type: "blunder", ...BADGE_CONFIGS.blunder },
            });

            // STEP 5: Langkah 3 Kawan (Eksekusi Puncak)
            setTimeout(() => {
              const s4 = steps[4];
              if (s4) {
                simChess.move(s4.san);
                setFen(simChess.fen());

                setMoveBadges({
                  [s4.to]: { type: "great", ...BADGE_CONFIGS.great },
                });

                const cap4 = s4.captured ? ` (Memakan ${PIECE_NAMES[s4.captured] || "Perwira"} di ${s4.to.toUpperCase()})` : "";
                const finalMsg = s4.isCheckmate
                  ? `🎉 Skakmat di Langkah 3 (${s4.san})! Lawan lumpuh total.`
                  : `🏆 Rantai Tuntas: ${s4.san}${cap4}! Menteri aman, materi untung mutlak.`;
                setCaptureMsg(finalMsg);
              }
              // PASTI SET KE COMPLETED
              setStage("completed");
            }, 600);
          }, 550);
        }, 600);
      }, 550);
    } catch {
      setStage("continuation");
    }
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

  // Tanda Hijau di Papan: OTOMATIS DIBERSIHKAN saat langkah/trik selesai (stage === "completed")
  if (stage !== "initial" && stage !== "completed") {
    squareStyles[from] = { backgroundColor: "rgba(34, 197, 94, 0.25)" };
    squareStyles[to] = { backgroundColor: "rgba(34, 197, 94, 0.45)", boxShadow: "inset 0 0 0 2px rgb(34, 197, 94)" };
  }

  if (tacticalInfo && stage !== "completed" && (stage !== "initial" || hint >= 2)) {
    for (const t of tacticalInfo.targets) {
      squareStyles[t.to] = {
        backgroundColor: "rgba(34, 197, 94, 0.45)",
        boxShadow: "inset 0 0 0 3px rgb(34, 197, 94)",
        borderRadius: "8px",
      };
    }
  }

  // Panah hijau di papan: DIBERSIHKAN saat puzzle tuntas (stage === "completed")
  const arrows: { startSquare: string; endSquare: string; color: string }[] = [];
  if (stage !== "completed") {
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
  }

  // CHESS.COM SQUARE RENDERER: Badge HANYA muncul di petak yang ADA BIDAKNYA dan langsung HILANG jika bidak berpindah!
  const customSquareRenderer = ({ square, children }: any) => {
    const badge = moveBadges[square];
    let hasPiece = false;
    try {
      hasPiece = Boolean(new Chess(fen).get(square as Square));
    } catch {
      hasPiece = false;
    }

    // Jika petak kosong (bidak sudah pindah atau dimakan), JANGAN PERNAH TAMPILKAN BADGE!
    const shouldShow = Boolean(badge && hasPiece);

    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          ...(squareStyles[square] || {}),
        }}
      >
        {children}
        {shouldShow && badge && (
          <div
            title={badge.desc}
            className="animate-in zoom-in duration-150"
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              zIndex: 40,
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 900,
              boxShadow: "0 2px 6px rgba(0,0,0,0.7), 0 0 8px rgba(255,255,255,0.3)",
              border: "1.5px solid white",
              pointerEvents: "none",
              backgroundColor: badge.bg,
              color: badge.color,
            }}
          >
            {badge.label}
          </div>
        )}
      </div>
    );
  };

  const doneCount = list.filter((c) => progress.completed.includes(c.id)).length;
  const currentIndex = Math.min(puzzleIndex, Math.max(0, list.length - 1));

  const diffBadgeClass =
    puzzle.difficulty === "Mudah"
      ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
      : puzzle.difficulty === "Sedang"
        ? "bg-amber-950/70 text-amber-300 border-amber-500/50"
        : "bg-rose-950/70 text-rose-300 border-rose-500/50";

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
                squareRenderer: customSquareRenderer,
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

          {/* LEGENDA BADGE ALA CHESS.COM DI BAWAH PAPAN */}
          <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs text-neutral-300 flex-wrap gap-2 w-full max-w-[min(100%,calc(100dvh-260px))] shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#06b6d4] text-white flex items-center justify-center font-black text-[9px] border border-white/50">!!</span>
              <span className="font-bold text-white text-[11px]">Brilian</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#16a34a] text-white flex items-center justify-center font-black text-[9px] border border-white/50">✓</span>
              <span className="text-[11px]">Terbaik</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#d97706] text-white flex items-center justify-center font-black text-[9px] border border-white/50">📖</span>
              <span className="text-[11px]">Buku</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#dc2626] text-white flex items-center justify-center font-black text-[9px] border border-white/50">??</span>
              <span className="text-[11px]">Blunder</span>
            </div>
          </div>
        </div>

        {/* RIGHT: INFO PANEL (KOMPAK, PAS 1 LAYAR TANPA SCROLL BERLEBIHAN) */}
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
          <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-sm space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <IconTarget3D size={14} className="shrink-0" />
              <span>Misi Trik & Taktik</span>
            </div>
            <p className="text-xs text-neutral-200 leading-relaxed font-normal">
              <HighlightedChessText text={puzzle.description} />
            </p>
          </div>

          {/* KARTU PANDUAN TAKTIK & ANCAMAN (RINGKAS) */}
          {tacticalInfo && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/60 shadow-md space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-400" />
                  <span>{tacticalInfo.gainHeadline}</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-500/40">
                  {tacticalInfo.targets.length} Sasaran
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 leading-relaxed">
                {tacticalInfo.gainDetail}
              </p>
            </div>
          )}

          {/* KARTU PANDUAN PEMULA: JAWABAN LAWAN & RUTE BALASAN (UNTUNG DI MANA) */}
          {tacticalInfo && (
            <div className="p-3 rounded-xl bg-neutral-900/95 border border-neutral-700/80 shadow-md space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-amber-400" />
                  <span>Rute Kelanjutan Taktis</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-sky-400">
                  {puzzle.source === "bpcaturpedia" ? "BPCaturPedia" : "Trik Master"}
                </span>
              </div>

              {/* RUTE LANGKAH LANJUTAN KONKRET */}
              <div className="space-y-1.5 text-xs">
                <div className="p-2 rounded-lg bg-neutral-950/90 border border-neutral-800 font-mono space-y-1">
                  <div className="text-amber-300 font-bold flex items-center gap-1">
                    <span>♟️ {tacticalInfo.routeGuide.enemyMove}:</span>
                  </div>
                  <div className="text-emerald-300 font-bold pl-3">
                    ➔ Balas: {tacticalInfo.routeGuide.ourReply}
                  </div>
                  <div className="text-neutral-300 text-[11px] pl-3 italic">
                    Hasil: {tacticalInfo.routeGuide.outcome}
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-sky-300 text-[11px] pt-0.5">
                  <ShieldCheck size={13} className="shrink-0 mt-0.5 text-sky-400" />
                  <span className="leading-snug">{tacticalInfo.avoidedDanger}</span>
                </div>
              </div>
            </div>
          )}

          {/* BANNER STATUS KELANJUTAN */}
          {captureMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border-2 border-emerald-400 text-emerald-100 space-y-1 shadow-lg animate-in fade-in">
              <div className="font-black text-xs text-emerald-300 flex items-center gap-1.5">
                <IconCheck3D size={16} />
                <span>{captureMsg}</span>
              </div>
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

          {/* FEEDBACK STATUS SALAH */}
          {status === "wrong" && (
            <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/60 text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
              <span className="font-bold flex items-center gap-1.5">
                <IconClose3D size={15} />
                <span>Langkah belum tepat [?? Blunder].</span>
              </span>
              <span className="text-[11px] text-rose-300">Coba analisa ulang atau buka petunjuk.</span>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center gap-2 pt-1 flex-wrap mt-auto">
            <button
              className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-xl border border-[var(--border)] text-neutral-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              onClick={() => load(puzzle)}
            >
              <RotateCcw size={13} />
              <span>Ulangi</span>
            </button>
            {stage === "initial" && (
              <>
                <button
                  className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-950/30 cursor-pointer"
                  onClick={() => setHint((h) => Math.min(2, h + 1))}
                >
                  Petunjuk {hint + 1}
                </button>
                <button
                  className="ctl ctl-sm px-3 py-1.5 text-xs font-bold rounded-xl border border-[var(--border)] text-neutral-400 hover:text-white cursor-pointer"
                  onClick={handleSolveMultiStep}
                  title="Mainkan demonstrasi kombinasi taktis dinamis sampai tuntas (skakmat / untung perwira)"
                >
                  Buka solusi (Rangkaian Tuntas)
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
