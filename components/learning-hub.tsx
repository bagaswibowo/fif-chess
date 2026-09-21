"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconStar3D,
  IconFire3D,
  IconMedal3D,
  IconLock3D,
  IconTrophy3D,
  IconPuzzle3D,
  IconVision3D,
} from "@/components/icons3d";
import { VisionDrill } from "@/components/vision-drill";
import { Confetti } from "@/components/confetti";

export type QuestChapter = {
  id: number;
  titleId: string;
  titleEn: string;
  fen: string;
  turn: "w" | "b";
  solutionUci: string;
  solutionSan: string;
  promotion?: "q" | "r" | "b" | "n";
  xp: number;
  objectiveId: string;
  objectiveEn: string;
  hintPieceId: string;
  hintPieceEn: string;
  hintTargetId: string;
  hintTargetEn: string;
  explanationId: string;
  explanationEn: string;
};

export const QUEST_CHAPTERS: QuestChapter[] = [
  {
    id: 1,
    titleId: "Bab 1: Dasar Pembukaan & Pusat",
    titleEn: "Chapter 1: Center Control & Opening",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",
    turn: "w",
    solutionUci: "g1f3",
    solutionSan: "Nf3",
    xp: 50,
    objectiveId: "Kembangkan perwira ringan (Kuda) ke petak pusat untuk menekan pion e5 lawan.",
    objectiveEn: "Develop the Knight to the center to pressure Black's e5 pawn.",
    hintPieceId: "Gunakan Kuda di petak g1.",
    hintPieceEn: "Use the Knight on square g1.",
    hintTargetId: "Langkahkan Kuda g1 ke f3 untuk mengontrol pusat d4 dan e5.",
    hintTargetEn: "Move the Knight to f3 to exert pressure on central squares.",
    explanationId: "Langkah 2. Nf3 adalah prinsip emas pembukaan catur: mengembangkan perwira ringan sembari langsung menyerang pion pusat lawan di e5.",
    explanationEn: "2. Nf3 is a classic opening principle: develop your minor piece while immediately pressuring Black's central pawn on e5.",
  },
  {
    id: 2,
    titleId: "Bab 2: Menghukum Celah Sayap",
    titleEn: "Chapter 2: Punishing Flank Weakness",
    fen: "rnbqkbnr/ppppp1pp/5p2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    turn: "w",
    solutionUci: "d1h5",
    solutionSan: "Qh5+",
    xp: 75,
    objectiveId: "Hitam melangkahkan f6 yang melemahkan diagonal raja. Manfaatkan celah ini!",
    objectiveEn: "Black played f6 weakening the king's diagonal. Exploit the weakness!",
    hintPieceId: "Menteri putih di petak d1 siap menyerang.",
    hintPieceEn: "White Queen on d1 is ready to strike.",
    hintTargetId: "Luncurkan Menteri ke h5 untuk memberikan skak keras pada raja Hitam.",
    hintTargetEn: "Launch the Queen to h5 to deliver a devastating check.",
    explanationId: "Langkah f7-f6 membuka jalur diagonal e8-h5 yang fatal bagi raja Hitam. Qh5+ mengeksploitasi kelemahan struktural lawan.",
    explanationEn: "The move f7-f6 dangerously opens the e8-h5 diagonal. Qh5+ punishes Black's positional error immediately.",
  },
  {
    id: 3,
    titleId: "Bab 3: Garpu Kuda Taktis (Fork)",
    titleEn: "Chapter 3: Tactical Knight Fork",
    fen: "r1b1k2r/ppq2ppp/4p3/3N4/8/8/PPP2PPP/R1B1KB1R w KQkq - 0 10",
    turn: "w",
    solutionUci: "d5c7",
    solutionSan: "Nxc7+",
    xp: 100,
    objectiveId: "Temukan lompatan taktis kuda untuk mencabangkan Raja dan Menteri sekaligus.",
    objectiveEn: "Find the knight fork checking the King and trapping the Queen.",
    hintPieceId: "Kuda putih di d5 memiliki jalur serangan garpu ganda.",
    hintPieceEn: "White Knight on d5 has a double attack opportunity.",
    hintTargetId: "Lompatkan Kuda dari d5 memukul pion c7 dengan skak.",
    hintTargetEn: "Jump the Knight from d5 to c7 capturing the pawn with check.",
    explanationId: "Langkah Nxc7+ memberikan garpu maut (double attack). Raja dipaksa menghindar, dan menteri di c7 jatuh gratis di langkah berikutnya!",
    explanationEn: "Nxc7+ forks King and Queen. King must move, and Black's queen is captured next move!",
  },
  {
    id: 4,
    titleId: "Bab 4: Skakmat Baris Belakang",
    titleEn: "Chapter 4: Back Rank Checkmate",
    fen: "6k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1",
    turn: "w",
    solutionUci: "e2e8",
    solutionSan: "Qe8#",
    xp: 125,
    objectiveId: "Raja Hitam terperangkap di balik dinding pionnya sendiri. Selesaikan dalam 1 langkah!",
    objectiveEn: "Black King is trapped behind its pawns. Finish with mate in 1!",
    hintPieceId: "Menteri putih di e2 memiliki akses langsung ke baris ke-8.",
    hintPieceEn: "White Queen on e2 can reach the 8th rank.",
    hintTargetId: "Luncurkan Menteri ke e8 untuk memberikan skakmat mutlak.",
    hintTargetEn: "Slide the Queen to e8 for an inescapable back-rank checkmate.",
    explanationId: "Qe8# adalah skakmat koridor klasik (Back-Rank Mate). Raja Hitam tidak memiliki petak lari karena terhalang pionnya sendiri di f7, g7, dan h7.",
    explanationEn: "Qe8# is a textbook back-rank mate. The King has no escape squares due to its own pawn shield.",
  },
  {
    id: 5,
    titleId: "Bab 5: Babak Akhir & Promosi Pion",
    titleEn: "Chapter 5: Endgame & Pawn Promotion",
    fen: "8/4P3/8/8/8/8/6k1/4K3 w - - 0 1",
    turn: "w",
    solutionUci: "e7e8q",
    solutionSan: "e8=Q",
    promotion: "q",
    xp: 150,
    objectiveId: "Dorong pion bebas Putih ke petak promosi untuk mendominasi babak akhir.",
    objectiveEn: "Push the passed pawn to the 8th rank to promote to Queen.",
    hintPieceId: "Pion bebas di petak e7 selangkah lagi mencapai petak promosi.",
    hintPieceEn: "The passed pawn on e7 is one square away from promotion.",
    hintTargetId: "Dorong pion ke petak e8 dan promosikan menjadi Menteri baru.",
    hintTargetEn: "Push pawn to e8 and promote to Queen.",
    explanationId: "e8=Q menyelesaikan babak akhir dengan keunggulan mutlak menteri baru melawan raja lawan yang terisolasi.",
    explanationEn: "Promoting to Queen gives White decisive winning advantage in the king-and-pawn endgame.",
  },
  {
    id: 6,
    titleId: "Bab 6: Skakmat Kuda Terjepit (Philidor)",
    titleEn: "Chapter 6: Smothered Mate (Philidor)",
    fen: "6rk/6pp/8/4N3/8/8/6PP/7K w - - 0 1",
    turn: "w",
    solutionUci: "e5f7",
    solutionSan: "Nf7#",
    xp: 200,
    objectiveId: "Raja lawan terkurung rapat di sudut oleh benteng dan pionnya. Berikan skakmat elegan!",
    objectiveEn: "Black King is boxed in the corner. Deliver an elegant smothered mate!",
    hintPieceId: "Kuda Putih di e5 dapat melompat melewati barikade musuh.",
    hintPieceEn: "White Knight on e5 can leap over enemy barricades.",
    hintTargetId: "Lompatkan Kuda ke petak f7 untuk skakmat langsung.",
    hintTargetEn: "Jump the Knight to f7 for an instant smothered checkmate.",
    explanationId: "Nf7# adalah skakmat kuda terjepit (Smothered Mate). Raja Hitam mati langkah karena semua petak di sekelilingnya terisi bidaknya sendiri.",
    explanationEn: "Nf7# delivers the famous Smothered Mate. The King cannot move because its own pieces occupy all surrounding escape squares.",
  },
];

export type LangType = "id" | "en";

type Props = {
  lang?: LangType;
};

export function LearningHub({ lang = "id" }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<"quest" | "vision">("quest");
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [unlockedChapters, setUnlockedChapters] = useState<number[]>([1]);
  const [completedChapters, setCompletedChapters] = useState<number[]>([]);
  const [currentFen, setCurrentFen] = useState(QUEST_CHAPTERS[0].fen);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [status, setStatus] = useState<"unsolved" | "correct" | "wrong">("unsolved");
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [xp, setXp] = useState(2450);
  const [showCelebration, setShowCelebration] = useState(false);

  const celebrationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load progress from localStorage on initial client mount
  useEffect(() => {
    try {
      const savedCompleted = localStorage.getItem("fif_chess_quest_completed");
      const savedUnlocked = localStorage.getItem("fif_chess_quest_unlocked");
      const savedXp = localStorage.getItem("fif_chess_quest_xp");

      if (savedCompleted) {
        const parsed = JSON.parse(savedCompleted);
        if (Array.isArray(parsed)) setCompletedChapters(parsed);
      }
      if (savedUnlocked) {
        const parsed = JSON.parse(savedUnlocked);
        if (Array.isArray(parsed)) setUnlockedChapters(parsed);
      }
      if (savedXp) {
        const num = parseInt(savedXp, 10);
        if (!isNaN(num)) setXp(num);
      }
    } catch {
      // Graceful fallback if localStorage is unavailable
    }
  }, []);

  // Save progress changes
  const saveProgress = useCallback((newCompleted: number[], newUnlocked: number[], newXp: number) => {
    try {
      localStorage.setItem("fif_chess_quest_completed", JSON.stringify(newCompleted));
      localStorage.setItem("fif_chess_quest_unlocked", JSON.stringify(newUnlocked));
      localStorage.setItem("fif_chess_quest_xp", newXp.toString());
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  const chapter = QUEST_CHAPTERS[activeChapterIndex];

  // Select a chapter
  const selectChapter = (index: number) => {
    setActiveChapterIndex(index);
    setCurrentFen(QUEST_CHAPTERS[index].fen);
    setSelectedSquare(null);
    setStatus("unsolved");
    setHintLevel(0);
  };

  // Reset current chapter board
  const resetBoard = useCallback(() => {
    setCurrentFen(chapter.fen);
    setSelectedSquare(null);
    setStatus("unsolved");
    setHintLevel(0);
  }, [chapter.fen]);

  // Click-to-Move Handler
  const onSquareClick = ({ square }: { square: string; piece?: { pieceType: string } | null }) => {
    if (status === "correct") return;

    let game: Chess;
    try {
      game = new Chess(currentFen);
    } catch {
      return;
    }

    const clickedSq = square.toLowerCase() as Square;

    // 1. If no square currently selected:
    if (!selectedSquare) {
      const pieceOnSquare = game.get(clickedSq);
      if (pieceOnSquare && pieceOnSquare.color === chapter.turn) {
        setSelectedSquare(clickedSq);
      }
      return;
    }

    // 2. If clicking same square, deselect
    if (selectedSquare === clickedSq) {
      setSelectedSquare(null);
      return;
    }

    // 3. If clicking another piece of our own color, switch selection
    const targetPiece = game.get(clickedSq);
    if (targetPiece && targetPiece.color === chapter.turn) {
      setSelectedSquare(clickedSq);
      return;
    }

    // 4. Attempt the move
    const from = selectedSquare;
    const to = clickedSq;
    const moveUci = `${from}${to}${chapter.promotion || ""}`.toLowerCase();

    try {
      const moveResult = game.move({
        from,
        to,
        promotion: chapter.promotion || "q",
      });

      if (!moveResult) {
        setSelectedSquare(null);
        return;
      }

      // Check if move matches solution
      const isExpected =
        moveUci === chapter.solutionUci.toLowerCase() ||
        moveResult.san === chapter.solutionSan;

      if (isExpected) {
        setCurrentFen(game.fen());
        setStatus("correct");
        setSelectedSquare(null);

        // Award XP and complete chapter cleanly
        let nextCompleted = completedChapters;
        let nextUnlocked = unlockedChapters;
        let nextXp = xp;

        if (!completedChapters.includes(chapter.id)) {
          nextCompleted = [...completedChapters, chapter.id];
          setCompletedChapters(nextCompleted);

          if (chapter.id < QUEST_CHAPTERS.length && !unlockedChapters.includes(chapter.id + 1)) {
            nextUnlocked = [...unlockedChapters, chapter.id + 1];
            setUnlockedChapters(nextUnlocked);
          }

          nextXp = xp + chapter.xp;
          setXp(nextXp);
          saveProgress(nextCompleted, nextUnlocked, nextXp);
        }

        setShowCelebration(true);
        if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = setTimeout(() => {
          setShowCelebration(false);
        }, 3500);
      } else {
        setStatus("wrong");
        setSelectedSquare(null);
      }
    } catch {
      setSelectedSquare(null);
    }
  };

  // Auto-play Solution (Zero free XP on reveal to prevent gamification exploitation)
  const autoPlaySolution = () => {
    let game: Chess;
    try {
      game = new Chess(chapter.fen);
    } catch {
      return;
    }

    const from = chapter.solutionUci.slice(0, 2) as Square;
    const to = chapter.solutionUci.slice(2, 4) as Square;
    game.move({ from, to, promotion: chapter.promotion || "q" });

    setCurrentFen(game.fen());
    setStatus("correct");
    setSelectedSquare(null);
    setHintLevel(2);

    // Unlocks next chapter so learner is not stuck, but awards 0 XP
    if (chapter.id < QUEST_CHAPTERS.length && !unlockedChapters.includes(chapter.id + 1)) {
      const nextUnlocked = [...unlockedChapters, chapter.id + 1];
      setUnlockedChapters(nextUnlocked);
      saveProgress(completedChapters, nextUnlocked, xp);
    }

    setShowCelebration(true);
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = setTimeout(() => {
      setShowCelebration(false);
    }, 3500);
  };

  // Dynamic square highlights for Click-to-Move and Hints
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlight selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        boxShadow: "inset 0 0 0 4px #facc15",
        backgroundColor: "rgba(250, 204, 21, 0.4)",
      };
    }

    // Hint Level 1: Highlight source piece
    if (hintLevel >= 1 && status === "unsolved") {
      const fromSquare = chapter.solutionUci.slice(0, 2);
      styles[fromSquare] = {
        boxShadow: "inset 0 0 0 4px #38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.45)",
      };
    }

    // Hint Level 2: Highlight destination square
    if (hintLevel >= 2 && status === "unsolved") {
      const toSquare = chapter.solutionUci.slice(2, 4);
      styles[toSquare] = {
        boxShadow: "inset 0 0 0 4px #81b64c",
        backgroundColor: "rgba(129, 182, 76, 0.5)",
      };
    }

    // If solved: highlight move
    if (status === "correct") {
      const fromSquare = chapter.solutionUci.slice(0, 2);
      const toSquare = chapter.solutionUci.slice(2, 4);
      styles[fromSquare] = {
        boxShadow: "inset 0 0 0 3px rgba(129, 182, 76, 0.6)",
        backgroundColor: "rgba(129, 182, 76, 0.3)",
      };
      styles[toSquare] = {
        boxShadow: "inset 0 0 0 4px #81b64c",
        backgroundColor: "rgba(129, 182, 76, 0.6)",
      };
    }

    return styles;
  }, [selectedSquare, hintLevel, status, chapter.solutionUci]);

  const uniqueCompleted = useMemo(() => {
    return new Set(completedChapters).size;
  }, [completedChapters]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full pb-12">
      {showCelebration && <Confetti />}

      {/* SUB-NAV SWITCHER: QUEST VS VISION DRILLS */}
      <div className="flex bg-[#262421] p-1.5 rounded-2xl border border-[#36322d] w-full max-w-md mx-auto shadow-lg">
        <button
          onClick={() => setActiveSubTab("quest")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === "quest"
              ? "bg-[#81b64c] text-white shadow-md"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <IconMedal3D size={18} />
          <span>{lang === "id" ? "Quest Latihan Catur" : "Tactical Quest"}</span>
        </button>
        <button
          onClick={() => setActiveSubTab("vision")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === "vision"
              ? "bg-[#81b64c] text-white shadow-md"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <IconVision3D size={18} />
          <span>{lang === "id" ? "Drill Visi 30s" : "Vision Drills"}</span>
        </button>
      </div>

      {activeSubTab === "vision" && <VisionDrill lang={lang} />}

      {activeSubTab === "quest" && (
        <div className="space-y-6">
          {/* STATS TRACKER BANNER */}
          <div className="grid grid-cols-3 gap-2.5 md:gap-3">
            <Card className="bg-[#262421] border-[#36322d] p-3 md:p-4 rounded-2xl shadow-md">
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#1c1a18] border border-[#36322d] flex items-center justify-center shrink-0 shadow">
                  <IconFire3D size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider truncate">
                    {lang === "id" ? "Streak Aktif" : "Day Streak"}
                  </div>
                  <div className="text-base md:text-2xl font-black text-amber-400 font-mono">
                    7 {lang === "id" ? "Hari" : "Days"}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-[#262421] border-[#36322d] p-3 md:p-4 rounded-2xl shadow-md">
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#1c1a18] border border-[#36322d] flex items-center justify-center shrink-0 shadow">
                  <IconStar3D size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider truncate">
                    {lang === "id" ? "Poin XP" : "Total XP"}
                  </div>
                  <div className="text-base md:text-2xl font-black text-emerald-400 font-mono">
                    {xp.toLocaleString()} XP
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-[#262421] border-[#36322d] p-3 md:p-4 rounded-2xl shadow-md">
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#1c1a18] border border-[#36322d] flex items-center justify-center shrink-0 shadow">
                  <IconTrophy3D size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider truncate">
                    {lang === "id" ? "Bab Tuntas" : "Solved"}
                  </div>
                  <div className="text-base md:text-2xl font-black text-white font-mono">
                    {uniqueCompleted} / 6
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* ROADMAP CHAPTER SELECTOR (ULAR TANGGA TRACK) */}
          <Card className="bg-[#262421] border-[#36322d] rounded-2xl overflow-hidden shadow-xl">
            <CardHeader className="bg-[#22201d] border-b border-[#36322d] p-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base md:text-lg text-white font-bold flex items-center gap-2">
                    <IconMedal3D size={22} />
                    <span>{lang === "id" ? "Pilih Bab Progresi Latihan" : "Select Progression Chapter"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-400">
                    {lang === "id"
                      ? "Setiap bab melatih insting langkah nyata pada papan catur interaktif (Click-to-Move)."
                      : "Each chapter trains real chess intuition on the interactive board."}
                  </CardDescription>
                </div>
                <Badge className="bg-[#81b64c] text-white font-bold text-xs">
                  {lang === "id" ? `Bab ${chapter.id} dari 6` : `Chapter ${chapter.id} of 6`}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 md:p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {QUEST_CHAPTERS.map((ch, idx) => {
                  const isDone = completedChapters.includes(ch.id);
                  const isUnlocked = unlockedChapters.includes(ch.id);
                  const isCurrent = idx === activeChapterIndex;

                  return (
                    <button
                      key={ch.id}
                      onClick={() => isUnlocked && selectChapter(idx)}
                      disabled={!isUnlocked}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                        isCurrent
                          ? "bg-[#2c2824] border-[#81b64c] ring-2 ring-[#81b64c]/40 text-white shadow-lg"
                          : isDone
                          ? "bg-[#1c1a18] border-emerald-500/40 text-neutral-300 hover:border-emerald-500 cursor-pointer"
                          : isUnlocked
                          ? "bg-[#1f1d1a] border-[#3d3a37] text-white hover:border-[#81b64c] cursor-pointer"
                          : "bg-[#151412] border-[#292623] text-neutral-600 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-xs font-bold text-white">Bab {ch.id}</span>
                        {isDone ? (
                          <span className="text-[10px] font-bold text-emerald-400">✓ Tuntas</span>
                        ) : isUnlocked ? (
                          <span className="text-[10px] font-bold text-amber-400">+{ch.xp} XP</span>
                        ) : (
                          <IconLock3D size={14} />
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-neutral-200 line-clamp-2 leading-tight">
                        {lang === "id" ? ch.titleId.split(": ")[1] : ch.titleEn.split(": ")[1]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* INTERACTIVE REAL CHESSBOARD CLICK-TO-MOVE DRILL */}
          <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
            {/* BOARD AREA */}
            <div className="w-full max-w-[480px] mx-auto aspect-square shrink-0 rounded-2xl overflow-hidden border-2 border-[#36322d] shadow-2xl bg-[#1c1a18]">
              <Chessboard
                options={{
                  id: `quest-board-${chapter.id}`,
                  position: currentFen,
                  boardOrientation: chapter.turn === "w" ? "white" : "black",
                  allowDragging: false, // CLICK-TO-MOVE ONLY
                  boardStyle: {
                    borderRadius: "14px",
                  },
                  squareStyles: customSquareStyles,
                  darkSquareStyle: { backgroundColor: "#b58863" },
                  lightSquareStyle: { backgroundColor: "#f0d9b5" },
                  onSquareClick,
                }}
              />
            </div>

            {/* CONTROLS & TACTICAL FEEDBACK */}
            <div className="flex-1 w-full space-y-4">
              <Card className="bg-[#262421] border-[#36322d] rounded-2xl p-4 md:p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3 border-b border-[#36322d] pb-3">
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                      <IconPuzzle3D size={20} />
                      <span>{lang === "id" ? chapter.titleId : chapter.titleEn}</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {lang === "id"
                        ? "Giliran Putih melangkah. Klik bidak, lalu klik petak tujuan."
                        : "White to move. Click piece, then click destination."}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-bold text-xs">
                    +{chapter.xp} XP
                  </Badge>
                </div>

                <div className="p-3.5 rounded-xl bg-[#191816] border border-[#36322d] mb-4">
                  <div className="text-xs font-bold text-neutral-300 mb-1">
                    {lang === "id" ? "Tugas & Misi Babak Ini:" : "Chapter Mission:"}
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {lang === "id" ? chapter.objectiveId : chapter.objectiveEn}
                  </div>
                </div>

                {/* HINT DISPLAY */}
                {hintLevel >= 1 && status === "unsolved" && (
                  <div className="p-3.5 rounded-xl bg-sky-950/50 border border-sky-600/50 text-sky-200 text-xs mb-3 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping inline-block" />
                      <span>{lang === "id" ? "Petunjuk Level 1 (Bidak):" : "Hint Level 1 (Piece):"}</span>
                    </div>
                    <div>{lang === "id" ? chapter.hintPieceId : chapter.hintPieceEn}</div>
                  </div>
                )}

                {hintLevel >= 2 && status === "unsolved" && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-600/50 text-emerald-200 text-xs mb-3 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                      <span>{lang === "id" ? "Petunjuk Level 2 (Petak Sasaran):" : "Hint Level 2 (Target Square):"}</span>
                    </div>
                    <div>{lang === "id" ? chapter.hintTargetId : chapter.hintTargetEn}</div>
                  </div>
                )}

                {/* STATUS ALERT */}
                {status === "correct" && (
                  <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs space-y-2 mb-4">
                    <div className="font-black text-sm text-white flex items-center gap-2">
                      <IconMedal3D size={18} />
                      <span>
                        {lang === "id"
                          ? `Langkah Benar! (${chapter.solutionSan}) — +${chapter.xp} XP`
                          : `Correct Move! (${chapter.solutionSan}) — +${chapter.xp} XP`}
                      </span>
                    </div>
                    <div className="text-neutral-200 leading-relaxed">
                      {lang === "id" ? chapter.explanationId : chapter.explanationEn}
                    </div>
                  </div>
                )}

                {status === "wrong" && (
                  <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs space-y-1 mb-4">
                    <div className="font-bold text-white">
                      {lang === "id" ? "Langkah Kurang Akurat!" : "Inaccurate Move!"}
                    </div>
                    <div>
                      {lang === "id"
                        ? "Bidak tersebut belum mengeksekusi taktik optimal. Tekan 'Ulangi Posisi' atau buka 'Petunjuk'."
                        : "That move didn't seize the best advantage. Click 'Retry' or use 'Hint'."}
                    </div>
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    onClick={resetBoard}
                    variant="outline"
                    className="border-[#36322d] bg-[#1a1816] text-neutral-200 hover:text-white hover:bg-[#25221f] text-xs font-bold"
                  >
                    {lang === "id" ? "Ulangi Posisi" : "Reset Board"}
                  </Button>

                  {status === "unsolved" && (
                    <>
                      <Button
                        onClick={() => setHintLevel((prev) => Math.min(2, prev + 1))}
                        variant="outline"
                        className="border-[#38bdf8]/40 bg-[#0f2231] text-sky-300 hover:bg-[#142e44] text-xs font-bold"
                      >
                        {hintLevel === 0
                          ? (lang === "id" ? "Buka Petunjuk 1" : "Show Hint 1")
                          : (lang === "id" ? "Buka Petunjuk 2" : "Show Hint 2")}
                      </Button>

                      <Button
                        onClick={autoPlaySolution}
                        variant="outline"
                        className="border-[#81b64c]/40 bg-[#1e2a14] text-[#81b64c] hover:bg-[#273819] text-xs font-bold ml-auto"
                      >
                        {lang === "id" ? "Buka Solusi Langkah" : "Reveal Move"}
                      </Button>
                    </>
                  )}

                  {status === "correct" && activeChapterIndex < QUEST_CHAPTERS.length - 1 && (
                    <Button
                      onClick={() => selectChapter(activeChapterIndex + 1)}
                      className="bg-[#81b64c] hover:bg-[#72a342] text-white font-bold text-xs ml-auto shadow-lg"
                    >
                      {lang === "id" ? "Bab Selanjutnya →" : "Next Chapter →"}
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
