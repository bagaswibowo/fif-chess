"use client";

import { useState, useRef, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type Chapter = {
  id: number;
  title: string;
  status: "completed" | "active" | "locked";
  progress: number;
  description: string;
};

type Achievement = {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
};

// Static dictionaries outside component to avoid runtime re-allocation
const CONTENT = {
  id: {
    chapters: [
      {
        id: 1,
        title: "1. Dasar Pembukaan",
        status: "completed",
        progress: 100,
        description: "Kontrol petak pusat (e4/d4), perkembangan perwira, dan keamanan raja.",
      },
      {
        id: 2,
        title: "2. Pertahanan Sayap",
        status: "completed",
        progress: 100,
        description: "Memahami struktur pion Karokann, French, dan Sicilian Defense.",
      },
      {
        id: 3,
        title: "3. Taktik Garpu & Pin",
        status: "completed",
        progress: 100,
        description: "Eksploitasi percabangan kuda dan pin mutlak jalur terbuka.",
      },
      {
        id: 4,
        title: "4. Taktik Lanjut & Serangan",
        status: "active",
        progress: 65,
        description: "Skakmat baris belakang, pengorbanan di f7, dan serangan raja.",
      },
      {
        id: 5,
        title: "5. Babak Akhir (Endgame)",
        status: "locked",
        progress: 0,
        description: "Oposisi raja, promosi pion bebas, dan teknik benteng Lucena.",
      },
      {
        id: 6,
        title: "6. Strategi Master Tel-U",
        status: "locked",
        progress: 0,
        description: "Permainan posisional mendalam, pencegahan counter-play lawan.",
      },
    ] as Chapter[],
    achievements: [
      { id: "a1", name: "Langkah Pertama", desc: "Selesaikan 1 puzzle taktik", unlocked: true },
      { id: "a2", name: "Master Taktik", desc: "Selesaikan 25 teka-teki catur", unlocked: true },
      { id: "a3", name: "Raja Streak 7D", desc: "Latihan catur 7 hari beruntun", unlocked: true },
      { id: "a4", name: "Visi Elang", desc: "Capai skor 20+ di Vision Drills", unlocked: true },
      { id: "a5", name: "Penyihir Catur", desc: "Menangkan 10 babak vs AI", unlocked: false },
      { id: "a6", name: "Grandmaster Tel-U", desc: "Capai rating 2000 ELO di klub", unlocked: false },
    ] as Achievement[],
    quiz: {
      title: "Uji Taktis Cepat: Garpu Kuda",
      fen: "r1b1k2r/ppq2ppp/4p3/3N4/8/8/PPP2PPP/R1B1KB1R w KQkq - 0 10",
      question: "Di posisi ini, ke mana Kuda putih harus melompat untuk mencabangkan Raja dan Menteri lawan?",
      options: [
        { label: "Nc7+ (Skak & Garpu)", correct: true, points: 50 },
        { label: "Nf4 (Mundur ke pusat)", correct: false, points: 0 },
        { label: "Ne3 (Bertahan di e3)", correct: false, points: 0 },
      ],
      explanation: "Langkah Nc7+ memberikan skak sekaligus mengancam menteri Hitam di c7. Raja terpaksa lari dan menteri lawan jatuh!",
    },
  },
  en: {
    chapters: [
      {
        id: 1,
        title: "1. Opening Principles",
        status: "completed",
        progress: 100,
        description: "Center control (e4/d4), piece development, and king safety.",
      },
      {
        id: 2,
        title: "2. Flank Defenses",
        status: "completed",
        progress: 100,
        description: "Understanding Caro-Kann, French, and Sicilian pawn structures.",
      },
      {
        id: 3,
        title: "3. Forks & Absolute Pins",
        status: "completed",
        progress: 100,
        description: "Exploiting knight forks and open-file skewers/pins.",
      },
      {
        id: 4,
        title: "4. Advanced Attacks",
        status: "active",
        progress: 65,
        description: "Back rank mates, f7 sacrifice drills, and king hunts.",
      },
      {
        id: 5,
        title: "5. Endgame Techniques",
        status: "locked",
        progress: 0,
        description: "King opposition, passed pawns, and Lucena bridge.",
      },
      {
        id: 6,
        title: "6. Master Strategy",
        status: "locked",
        progress: 0,
        description: "Prophylaxis, positional outposts, and endgame transitions.",
      },
    ] as Chapter[],
    achievements: [
      { id: "a1", name: "First Step", desc: "Solve 1 tactical puzzle", unlocked: true },
      { id: "a2", name: "Tactics Master", desc: "Solve 25 chess puzzles", unlocked: true },
      { id: "a3", name: "Streak King 7D", desc: "Train 7 consecutive days", unlocked: true },
      { id: "a4", name: "Eagle Eye", desc: "Reach 20+ score in Vision Drills", unlocked: true },
      { id: "a5", name: "Chess Wizard", desc: "Win 10 matches vs AI", unlocked: false },
      { id: "a6", name: "Tel-U Grandmaster", desc: "Reach 2000 ELO in club", unlocked: false },
    ] as Achievement[],
    quiz: {
      title: "Tactical Quiz: Knight Fork",
      fen: "r1b1k2r/ppq2ppp/4p3/3N4/8/8/PPP2PPP/R1B1KB1R w KQkq - 0 10",
      question: "In this position, where should the White Knight jump to fork the Black King and Queen?",
      options: [
        { label: "Nc7+ (Check & Fork)", correct: true, points: 50 },
        { label: "Nf4 (Retreat to center)", correct: false, points: 0 },
        { label: "Ne3 (Defend on e3)", correct: false, points: 0 },
      ],
      explanation: "Nc7+ delivers check while attacking Black's queen on c7. Black's queen is captured next move!",
    },
  },
};

type LangType = keyof typeof CONTENT;
type Props = {
  lang?: LangType;
};

export function LearningHub({ lang = "id" }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<"quest" | "vision">("quest");
  const [xp, setXp] = useState(2450);
  const [solvedStreak] = useState(7);
  const [solvedCount, setSolvedCount] = useState(48);
  const [quizAnswered, setQuizAnswered] = useState<boolean>(false);
  const [quizSuccess, setQuizSuccess] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const celebrationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  const localized = CONTENT[lang] || CONTENT.id;

  const handleAnswer = (correct: boolean, points: number) => {
    if (quizAnswered) return;
    setQuizAnswered(true);
    setQuizSuccess(correct);
    if (correct) {
      setXp((p) => p + points);
      setSolvedCount((c) => c + 1);
      setShowCelebration(true);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = setTimeout(() => {
        setShowCelebration(false);
      }, 3500);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full pb-10">
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
          <span>{lang === "id" ? "Quest Gamifikasi" : "Learning Quest"}</span>
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
                    {solvedStreak} {lang === "id" ? "Hari" : "Days"}
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
                    {lang === "id" ? "Puzzle Selesai" : "Puzzles Solved"}
                  </div>
                  <div className="text-base md:text-2xl font-black text-white font-mono">
                    {solvedCount}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* PROGRESSION ROADMAP (ULAR TANGGA STYLE) */}
          <Card className="bg-[#262421] border-[#36322d] rounded-2xl overflow-hidden shadow-xl">
            <CardHeader className="bg-[#22201d] border-b border-[#36322d] p-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base md:text-lg text-white font-bold flex items-center gap-2">
                    <IconMedal3D size={22} />
                    <span>{lang === "id" ? "Jalur Progresi Belajar Catur" : "Learning Progression Track"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-400">
                    {lang === "id"
                      ? "Selesaikan bab bertahap untuk membuka materi taktik grandmaster."
                      : "Complete chapters to unlock advanced master tactics."}
                  </CardDescription>
                </div>
                <Badge className="bg-[#81b64c] text-white font-bold text-xs">
                  Chapter 4 (65%)
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {localized.chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      ch.status === "completed"
                        ? "bg-[#1c1a18] border-emerald-500/40 text-neutral-300 shadow-sm"
                        : ch.status === "active"
                        ? "bg-[#2c2824] border-[#81b64c] ring-2 ring-[#81b64c]/40 text-white shadow-lg"
                        : "bg-[#191816] border-[#36322d] text-neutral-500 opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-white">{ch.title}</span>
                      {ch.status === "completed" && (
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                          {lang === "id" ? "Selesai" : "Done"}
                        </Badge>
                      )}
                      {ch.status === "active" && (
                        <Badge className="bg-[#81b64c] text-white text-[10px] font-bold animate-pulse">
                          {lang === "id" ? "Aktif" : "Active"}
                        </Badge>
                      )}
                      {ch.status === "locked" && <IconLock3D size={16} />}
                    </div>

                    <p className="text-xs leading-relaxed mb-3 text-neutral-300">{ch.description}</p>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                        <span>{lang === "id" ? "Progres:" : "Progress:"}</span>
                        <span className="font-bold text-white">{ch.progress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#161513] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            ch.status === "completed"
                              ? "bg-emerald-500"
                              : ch.status === "active"
                              ? "bg-[#81b64c]"
                              : "bg-neutral-700"
                          }`}
                          style={{ width: `${ch.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* INTERACTIVE DAILY QUIZ CHALLENGE WITH MINI BOARD */}
          <Card className="bg-[#262421] border-[#36322d] rounded-2xl overflow-hidden shadow-xl">
            <CardHeader className="bg-[#22201d] border-b border-[#36322d] p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                  <IconPuzzle3D size={22} />
                  <span>{localized.quiz.title}</span>
                </CardTitle>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-bold text-xs">
                  +50 XP
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row gap-5 items-center">
                {/* Mini Board displaying the real FEN position via options prop */}
                <div className="w-[180px] h-[180px] shrink-0 rounded-xl overflow-hidden border-2 border-[#36322d] shadow-lg">
                  <Chessboard
                    options={{
                      id: "quiz-mini-board",
                      position: localized.quiz.fen,
                      boardOrientation: "white",
                      allowDragging: false,
                      boardStyle: {
                        borderRadius: "10px",
                      },
                      darkSquareStyle: { backgroundColor: "#b58863" },
                      lightSquareStyle: { backgroundColor: "#f0d9b5" },
                    }}
                  />
                </div>

                {/* Question & Interactive Choices */}
                <div className="flex-1 space-y-3 w-full">
                  <div className="text-sm font-bold text-white">{localized.quiz.question}</div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {localized.quiz.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(opt.correct, opt.points)}
                        disabled={quizAnswered}
                        className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                          quizAnswered
                            ? opt.correct
                              ? "bg-emerald-950/80 border-emerald-500 text-emerald-200"
                              : "bg-[#1a1816] border-[#36322d] text-neutral-500 opacity-60"
                            : "bg-[#1f1d1a] border-[#36322d] text-neutral-200 hover:border-[#81b64c] hover:bg-[#282522]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {quizAnswered && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs font-medium ${
                        quizSuccess
                          ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                          : "bg-rose-950/80 border-rose-500/50 text-rose-300"
                      }`}
                    >
                      <div className="font-bold text-white mb-1">
                        {quizSuccess
                          ? (lang === "id" ? "Jawaban Tepat! (+50 XP)" : "Correct Move! (+50 XP)")
                          : (lang === "id" ? "Belum Tepat, Pelajari Lagi:" : "Not quite, learn the tactic:")}
                      </div>
                      <div>{localized.quiz.explanation}</div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ACHIEVEMENT BADGES SHOWCASE */}
          <Card className="bg-[#262421] border-[#36322d] rounded-2xl overflow-hidden shadow-xl">
            <CardHeader className="bg-[#22201d] border-b border-[#36322d] p-4">
              <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                <IconMedal3D size={22} />
                <span>{lang === "id" ? "Lencana Prestasi (Achievements)" : "Achievement Badges"}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 md:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {localized.achievements.map((a) => (
                  <div
                    key={a.id}
                    className={`p-3.5 rounded-xl border flex flex-col items-center text-center space-y-1.5 transition-all ${
                      a.unlocked
                        ? "bg-[#1c1a18] border-amber-500/40 shadow-sm"
                        : "bg-[#161513] border-[#36322d] opacity-50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#262421] border border-[#3d3a37] flex items-center justify-center">
                      {a.unlocked ? <IconMedal3D size={24} /> : <IconLock3D size={20} />}
                    </div>
                    <div className="font-bold text-xs text-white">{a.name}</div>
                    <div className="text-[10px] text-neutral-400">{a.desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
