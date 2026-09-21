"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconStar3D,
  IconFire3D,
  IconMedal3D,
  IconLock3D,
  IconTrophy3D,
  IconPawn3D,
  IconPuzzle3D,
  IconVision3D,
} from "@/components/icons3d";
import { VisionDrill } from "@/components/vision-drill";
import { Confetti } from "@/components/confetti";

type Props = {
  lang?: "id" | "en";
};

type Chapter = {
  id: number;
  title: string;
  status: "completed" | "active" | "locked";
  progress: number;
  points: number;
  description: string;
};

const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: "1. Dasar Pembukaan",
    status: "completed",
    progress: 100,
    points: 300,
    description: "Kontrol petak pusat (e4/d4), perkembangan perwira ringan, dan keamanan raja.",
  },
  {
    id: 2,
    title: "2. Pertahanan Sayap",
    status: "completed",
    progress: 100,
    points: 450,
    description: "Memahami struktur pion Karokann, French, dan Sicilian Defense.",
  },
  {
    id: 3,
    title: "3. Taktik Garpu & Pin",
    status: "completed",
    progress: 100,
    points: 600,
    description: "Eksploitasi percabangan kuda dan pin mutlak jalur terbuka.",
  },
  {
    id: 4,
    title: "4. Taktik Lanjut & Serangan",
    status: "active",
    progress: 65,
    points: 750,
    description: "Skakmat baris belakang, pengorbanan gajah di f7, dan serangan raja.",
  },
  {
    id: 5,
    title: "5. Babak Akhir (Endgame)",
    status: "locked",
    progress: 0,
    points: 900,
    description: "Oposisi raja, promosi pion bebas, dan teknik benteng Lucena.",
  },
  {
    id: 6,
    title: "6. Strategi Master Tel-U",
    status: "locked",
    progress: 0,
    points: 1200,
    description: "Permainan posisional mendalam, pencegahan counter-play lawan.",
  },
];

const ACHIEVEMENTS = [
  { id: "a1", name: "Langkah Pertama", desc: "Selesaikan 1 puzzle taktik", unlocked: true },
  { id: "a2", name: "Master Taktik", desc: "Selesaikan 25 teka-teki catur", unlocked: true },
  { id: "a3", name: "Raja Streak 7D", desc: "Latihan catur 7 hari beruntun", unlocked: true },
  { id: "a4", name: "Visi Elang", desc: "Capai skor 20+ di Vision Drills", unlocked: true },
  { id: "a5", name: "Penyihir Catur", desc: "Menangkan 10 pertandingan vs AI", unlocked: false },
  { id: "a6", name: "Grandmaster Tel-U", desc: "Capai rating 2000 ELO di klub", unlocked: false },
];

export function LearningHub({ lang = "id" }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<"quest" | "vision">("quest");
  const [xp, setXp] = useState(2450);
  const [solvedStreak, setSolvedStreak] = useState(7);
  const [solvedCount, setSolvedCount] = useState(48);
  const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState<boolean>(false);
  const [quizSuccess, setQuizSuccess] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const QUIZ_QUESTIONS = [
    {
      id: 1,
      title: "Uji Cepat: Garpu Kuda (Fork)",
      fen: "r1b1k2r/ppq2ppp/4p3/3N4/8/8/PPP2PPP/R1B1KB1R w KQkq - 0 10",
      question: lang === "id"
        ? "Di posisi ini, ke mana Kuda putih harus melompat untuk mencabangkan Raja dan Menteri lawan?"
        : "Where should the White Knight jump to fork the King and Queen?",
      options: [
        { label: "Nc7+ (Skak dan Garpu)", correct: true, points: 50 },
        { label: "Nf4 (Mundur menjaga pusat)", correct: false, points: 0 },
        { label: "Ne3 (Bertahan di baris ke-3)", correct: false, points: 0 },
      ],
      explanation: lang === "id"
        ? "Langkah Nc7+ memberikan skak sekaligus mengancam menteri Hitam di c7. Raja terpaksa lari dan menteri jatuh gratis!"
        : "Nc7+ checks the King while attacking the Queen on c7, winning the Queen!",
    },
  ];

  const handleAnswer = (correct: boolean, points: number) => {
    setQuizAnswered(true);
    setQuizSuccess(correct);
    if (correct) {
      setXp((p) => p + points);
      setSolvedCount((c) => c + 1);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3500);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
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
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-[#262421] border-[#36322d] p-3.5 md:p-4 rounded-2xl shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1c1a18] border border-[#36322d] flex items-center justify-center shrink-0 shadow">
                  <IconFire3D size={24} />
                </div>
                <div>
                  <div className="text-[10px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider">
                    {lang === "id" ? "Streak Aktif" : "Day Streak"}
                  </div>
                  <div className="text-lg md:text-2xl font-black text-amber-400 font-mono">
                    {solvedStreak} {lang === "id" ? "Hari" : "Days"}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-[#262421] border-[#36322d] p-3.5 md:p-4 rounded-2xl shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1c1a18] border border-[#36322d] flex items-center justify-center shrink-0 shadow">
                  <IconStar3D size={24} />
                </div>
                <div>
                  <div className="text-[10px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider">
                    {lang === "id" ? "Poin XP" : "Total XP"}
                  </div>
                  <div className="text-lg md:text-2xl font-black text-emerald-400 font-mono">
                    {xp.toLocaleString()} XP
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-[#262421] border-[#36322d] p-3.5 md:p-4 rounded-2xl shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1c1a18] border border-[#36322d] flex items-center justify-center shrink-0 shadow">
                  <IconTrophy3D size={24} />
                </div>
                <div>
                  <div className="text-[10px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider">
                    {lang === "id" ? "Teka-Teki Selesai" : "Puzzles Solved"}
                  </div>
                  <div className="text-lg md:text-2xl font-black text-white font-mono">
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
                      ? "Selesaikan materi bertahap untuk membuka level taktik grandmaster."
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
                {CHAPTERS.map((ch) => (
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
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold">Selesai</Badge>
                      )}
                      {ch.status === "active" && (
                        <Badge className="bg-[#81b64c] text-white text-[10px] font-bold animate-pulse">Aktif</Badge>
                      )}
                      {ch.status === "locked" && (
                        <IconLock3D size={16} />
                      )}
                    </div>

                    <p className="text-xs leading-relaxed mb-3">{ch.description}</p>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span>Progres:</span>
                        <span className="font-bold text-white">{ch.progress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#161513] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            ch.status === "completed" ? "bg-emerald-500" : ch.status === "active" ? "bg-[#81b64c]" : "bg-neutral-700"
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

          {/* INTERACTIVE DAILY QUIZ CHALLENGE */}
          <Card className="bg-[#262421] border-[#36322d] rounded-2xl overflow-hidden shadow-xl">
            <CardHeader className="bg-[#22201d] border-b border-[#36322d] p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                  <IconPuzzle3D size={22} />
                  <span>{lang === "id" ? "Tantangan Kuis Taktis Harian" : "Daily Tactical Quiz Challenge"}</span>
                </CardTitle>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-bold text-xs">
                  +50 XP
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-6 space-y-4">
              {QUIZ_QUESTIONS.map((q) => (
                <div key={q.id} className="space-y-3">
                  <div className="text-sm font-bold text-white">{q.question}</div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {q.options.map((opt, i) => (
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
                        {quizSuccess ? "Jawaban Tepat! (+50 XP)" : "Belum Tepat, Pelajari Lagi:"}
                      </div>
                      <div>{q.explanation}</div>
                    </div>
                  )}
                </div>
              ))}
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
                {ACHIEVEMENTS.map((a) => (
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
