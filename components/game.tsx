"use client";
import { chessSound } from "@/lib/chess-sound";

import { classifyMove, createSquareBadgeRenderer, ChessBadgeLegend, type MoveBadge } from "@/lib/chess-move-badges";
import { Copy, Check, Download, Share2 } from "lucide-react";
import { DockModals, type DockModalType } from "@/components/dock-modals";

import { CapturedPiecesBar } from "@/components/captured-pieces";
import { BoardControls } from "@/components/board-controls";
import { PlayerStrip } from "@/components/board";
import { BOT_PERSONAS } from "@/lib/bot-personas";
import { BoardShell } from "@/components/board-workspace";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, PieceHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JevDistribution } from "@/components/jev-distribution";
import { MoveList } from "@/components/move-list";
import { PromotionDialog } from "@/components/promotion-dialog";
import { LearningHub } from "@/components/learning-hub";

import type { Puzzle } from "@/lib/puzzle-data";
import { buildLivePuzzle, loadSaved, persistSaved } from "@/lib/puzzle-store";
import { ScanView } from "@/components/scan-view";
import { CommunityView } from "@/components/community-view";
import { PuzzleHub } from "@/components/views/puzzle-hub";
import { GameReview } from "@/components/game-review";
import { ReviewAnalysisBoard } from "@/components/review-analysis-board";
import { AuthPanel } from "@/components/auth-panel";
import { AdminPanel } from "@/components/admin-panel";
import { PvpPanel, type PvpRoom } from "@/components/pvp-panel";
import { ChallengeLayer, type ChallengeInfo, type ChallengeState } from "@/components/challenge-card";
import { AppShell } from "@/components/shell/app-shell";
import { HomeView } from "@/components/views/home-view";
import { LeaderboardView } from "@/components/views/leaderboard-view";
import { FriendsView } from "@/components/views/friends-view";
import { EndgameDrillsView } from "@/components/views/endgame-drills-view";
import { CoursesView, type CoursesAuthStatus } from "@/components/views/courses-view";
import { LessonsView } from "@/components/views/lessons-view";
import { PracticeView } from "@/components/views/practice-view";
import { ClassroomView } from "@/components/views/classroom-view";
import { courseFromHash, learnDetailFromHash, drillsSetIdFromHash } from "@/components/views/learn-shared";
import { useRealtime } from "@/lib/use-realtime";
import { matcherTopic, presenceTopic, type ChallengeReceived, type GameAdded, type PlayingCountChanged, type RematchRequested } from "@/lib/realtime/events";
import { ClockMovesFullscreen } from "@/components/clock-moves-fullscreen";
import { TacticalCommentaryCard } from "@/components/tactical-commentary-card";
import { useSession } from "@/lib/use-session";
import { useGameHistory, type GameRecord } from "@/lib/game-history";
import { CoachModeView } from "@/components/coach-mode-view";
import { VersusBotsView } from "@/components/views/versus-bots-view";
import { ArchiveView } from "@/components/views/archive-view";
import { ExplorerView } from "@/components/views/explorer-view";
import { InsightsView } from "@/components/views/insights-view";
import { TournamentsView } from "@/components/views/tournaments-view";
import { SpectatorView } from "@/components/views/spectator-view";
import { PasteBar } from "@/components/paste-bar";
import { GameOverModal } from "@/components/game-over-modal";
import { useChessTheme } from "@/lib/chess-themes";
import { EvalBar } from "@/components/eval-bar";
import { useChessClock } from "@/lib/use-chess-clock";
import { loadStoredTimeControl } from "@/lib/time-control";
import { IconKingWhite3D, IconKingBlack3D, IconDice3D, IconPlay3D, IconSwap3D, IconAlert3D, IconClose3D } from "@/components/icons3d";
import {
  applyUci,
  describeOutcome,
  findLegalMove,
  getLegalMoves,
  replaySanList,
  parseFen as parseFenChess,
  isPromotionAttempt,
  sideToMove,
  type PromotionPiece,
  type Side,
  type GameOutcome,
} from "@/lib/chess";
import type { JevAnalysis, JevError, PlayedMove } from "@/lib/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Label control waktu untuk ChallengeCard. Event ChallengeReceived belum
// membawa field tc (kontrak backend S1-T4), jadi label diambil dari
// konstanta ini — satu sumber, tidak ada string tersebar di JSX.
const CHALLENGE_CONTROL_LABEL = "Cepat · 10 menit";

const getAiElo = (engine: "stockfish" | "jev-fly" | "jev" | "fly", depth = 14): string => {
  if (engine === "fly") return "3178";
  if (engine === "jev") return "3127";
  if (engine === "jev-fly") return "2536";
  if (depth <= 4) return "800";
  if (depth <= 8) return "1600";
  return "3550+";
};

const AI_LABEL: Record<string, string> = {
  stockfish: "Stockfish 19 NNUE",
  "jev-fly": "Jev + Fly Brain",
  jev: "Jev System One",
  fly: "Fruit Fly Brain",
};

type PendingPromotion = { from: string; to: string };
type NavTab =
  | "home" | "play" | "bots" | "coach"
  | "puzzles"
  | "review" | "scan" | "vision" | "drills"
  | "community" | "leaderboard" | "friends" | "archive"
  | "explorer" | "insights" | "tournaments"
  // S7 (design §0.2): layer belajar — navTab baru + deep-link sub-path.
  | "courses" | "learn" | "practice" | "classroom"
  | "admin";
// S9-T2: satu sumber daftar tab yang terbuka untuk guest — fitur lokal
// (render tanpa akun). Tab member-only yang di-klik guest TIDAK di-reject:
// view dirender + notice guest persisten tampil (handleNavClick).
const guestAllowedTabs: NavTab[] = ["home", "play", "bots", "coach", "review", "scan", "vision"];

type RightTab = "game-setup" | "analysis" | "moves";
type PlayMode = "ai" | "pvp";
type CoachSubTab = "coach" | "spectator";

type MatchCommentary = {
  headline: string;
  detail: string;
  focus: string;
  evaluation: string;
};

function buildMatchCommentary(
  chess: Chess,
  lastMove: PlayedMove | undefined,
  scoreCp: number | null,
  humanSide: Side,
): MatchCommentary {
  if (!lastMove) {
    return {
      headline: "Pertandingan siap dimulai.",
      detail: "Belum ada langkah untuk dikomentari. Setelah langkah pertama, komentator akan membaca perubahan posisi dan fase permainan.",
      focus: "Fokus awal: kuasai pusat, kembangkan perwira ringan, dan amankan raja.",
      evaluation: "Seimbang",
    };
  }

  const ply = chess.history().length;
  const phase = ply < 16 ? "pembukaan" : chess.isInsufficientMaterial() || ply > 60 ? "babak akhir" : "babak tengah";
  const actor = lastMove.by === "human" ? "Anda" : "lawan";
  const san = lastMove.san;
  const evaluation = scoreCp === null
    ? "Belum tersedia"
    : `${scoreCp > 25 ? "Putih unggul" : scoreCp < -25 ? "Hitam unggul" : "Seimbang"} (${scoreCp > 0 ? "+" : ""}${(scoreCp / 100).toFixed(1)})`;

  let headline = `${actor} memainkan ${san}`;
  let detail = `Langkah ini terjadi pada ${phase}.`;
  let focus = "Bandingkan keamanan raja, aktivitas perwira, dan kendali pusat sebelum memilih rencana berikutnya.";

  if (san.includes("#")) {
    headline = `Skakmat: ${san} mengakhiri pertandingan.`;
    detail = `${actor} menutup seluruh petak pelarian raja. Tidak ada respons legal yang tersisa.`;
    focus = "Pertandingan selesai. Tinjau langkah sebelum kombinasi ini untuk menemukan momen penentunya.";
  } else if (san.includes("+")) {
    headline = `Skak memaksa respons: ${san}.`;
    detail = `${actor} mengambil tempo dengan menyerang raja. Prioritas sekarang adalah keluar dari skak tanpa kehilangan material atau posisi.`;
    focus = "Cari tiga respons legal: tangkap penyerang, blokir garis, atau pindahkan raja ke petak aman.";
  } else if (san.includes("=")) {
    headline = `Promosi mengubah keseimbangan: ${san}.`;
    detail = `${actor} berhasil membawa pion ke baris terakhir. Nilai posisi kini ditentukan oleh keamanan raja dan koordinasi perwira baru.`;
    focus = "Amankan perwira hasil promosi dan cek ancaman balasan lawan sebelum menyerang lagi.";
  } else if (san.includes("x")) {
    headline = `Pertukaran material: ${san}.`;
    detail = `${actor} memilih perubahan material. Nilai langkah ini bergantung pada apakah bidak yang memakan aman dan apakah struktur pion menjadi lebih baik.`;
    focus = "Hitung recapture, bidak yang menggantung, dan ruang yang terbuka setelah pertukaran.";
  } else if (san === "O-O" || san === "O-O-O") {
    headline = `Raja diamankan lewat rokade ${san === "O-O" ? "pendek" : "panjang"}.`;
    detail = `Langkah ini menyelesaikan bagian penting dari ${phase}: raja lebih aman dan benteng mulai terhubung.`;
    focus = "Gunakan keunggulan perkembangan ini untuk merebut file terbuka atau menekan pusat.";
  }

  if (chess.isCheck()) {
    focus = `Raja ${chess.turn() === "w" ? "Putih" : "Hitam"} sedang diskak. ${focus}`;
  } else if (scoreCp !== null && Math.abs(scoreCp) >= 150) {
    const side = scoreCp > 0 ? "Putih" : "Hitam";
    const humanIsAhead = (scoreCp > 0 && humanSide === "white") || (scoreCp < 0 && humanSide === "black");
    focus = `${side} memegang tekanan nyata. ${humanIsAhead ? "Pertahankan keunggulan tanpa memaksakan kombinasi." : "Cari pertahanan aktif dan hindari pertukaran yang memperburuk posisi."}`;
  }

  return { headline, detail, focus, evaluation };
}

export function Game() {
  const { customPieces, notationStyles, boardTheme, boardThemeId, pieceThemeId } = useChessTheme();
  const [fen, setFen] = useState(START_FEN);
  const [gameStartFen, setGameStartFen] = useState(START_FEN);
  const [humanSide, setHumanSide] = useState<Side>("white");
  const [moves, setMoves] = useState<PlayedMove[]>([]);
  const [analysis, setAnalysis] = useState<JevAnalysis | null>(null);
  const [error, setError] = useState<JevError | null>(null);
  const [thinking, setThinking] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  // BUG-1 (QA S5): hasil paste PGN/FEN di review dirender ke papan analisis
  // inline — state game review terpisah dari papan play.
  const [reviewGame, setReviewGame] = useState<{ startFen: string; moves: { san: string; uci: string }[] } | null>(null);
  const [reviewPly, setReviewPly] = useState(0);
  const [moveBadges, setMoveBadges] = useState<Record<string, MoveBadge>>({});
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  // S4-T1: navTab diangkat ke shell-level; di sini tetap satu sumber state yang
// dioper ke AppShell via props + hash URL (#/home, #/play, ...).
const navTabFromHash = (): NavTab => {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.replace(/^#\//, "");
  // S5-T2: deep-link lama dialihkan ke parent view (bookmark tidak mati).
  // #/daily|#/rush|#/themes -> #/puzzles + initial tab; #/spectator -> #/coach sub-tab spectator.
  if (h === "daily" || h === "rush" || h === "themes") {
    initialPuzzleTabRef.current = h;
    return "puzzles";
  }
  if (h === "spectator") {
    initialCoachSubTabRef.current = "spectator";
    return "coach";
  }
  // S6-T4: deep-link publik #/insights/{username} — tanpa login.
  if (h === "insights" || h.startsWith("insights/")) {
    insightsDeepLinkRef.current = h === "insights" ? null : h.slice("insights/".length);
    return "insights";
  }
  if (h === "explorer" || h.startsWith("explorer?")) {
    explorerDeepLinkRef.current = h.startsWith("explorer?") ? h : null;
    return "explorer";
  }
  // S7 (design §0.2): deep-link layer belajar. Konten statis publik — tanpa
  // login; sub-path menentukan detail (course/{id}, learn/{lesson},
  // learn/openings/{eco}, drills/{setId}) + query ?tab= utk puzzles themes.
  if (h === "courses" || h.startsWith("courses/")) {
    courseDeepLinkIdRef.current =
      h === "courses" ? null : decodeURIComponent(h.slice("courses/".length).split("?")[0]) || null;
    return "courses";
  }
  if (h === "learn" || h.startsWith("learn/") || h.startsWith("learn?")) {
    learnDetailRef.current = learnDetailFromHash(`#/${h}`);
    // ?cat=<modul> → filter katalog lesson ke modul tsb (praktik hub §3.2).
    const qIdx = h.indexOf("?");
    learnModuleRef.current =
      qIdx >= 0 ? (new URLSearchParams(h.slice(qIdx + 1)).get("cat") || null) : null;
    return "learn";
  }
  if (h === "drills" || h.startsWith("drills/")) {
    drillSetIdRef.current = drillsSetIdFromHash(`#/${h}`);
    return "drills";
  }
  if (h === "puzzles" || h.startsWith("puzzles?")) {
    // #/puzzles?tab=themes&theme=X → tab themes (S5-T3 pola) — theme utk step
    // course routing (ADR D1); tema pool dibaca ThemesMasteryView sendiri.
    const q = h.startsWith("puzzles?") ? h.slice("puzzles?".length) : "";
    const t = new URLSearchParams(q).get("tab");
    initialPuzzleTabRef.current = t ?? "unlimited";
    return "puzzles";
  }
  const all: NavTab[] = ["home", "play", "bots", "coach", "puzzles", "review", "scan", "vision", "drills", "community", "leaderboard", "friends", "archive", "explorer", "insights", "tournaments", "courses", "learn", "practice", "classroom", "admin"];
  return (all.includes(h as NavTab) ? (h as NavTab) : "home") as NavTab;
};
// S5-T3: initial tab untuk PuzzleHub / Coach dari deep-link lama.
const initialPuzzleTabRef: { current: string | null } = { current: null };
const initialCoachSubTabRef: { current: CoachSubTab | null } = { current: null };
// S6: deep-link insight (username publik, null = sesi sendiri) + explorer (query ?eco=).
const insightsDeepLinkRef: { current: string | null } = { current: null };
const explorerDeepLinkRef: { current: string | null } = { current: null };
// S7: deep-link layer belajar (design §0.2) — detail course/lesson + modul learn
// + set drill (pola mirror state S5-T3/S6 BUG-2 QA: ref → state agar re-render).
const courseDeepLinkIdRef: { current: string | null } = { current: null };
const learnDetailRef: { current: string | null } = { current: null };
const learnModuleRef: { current: string | null } = { current: null };
const drillSetIdRef: { current: string | null } = { current: null };
const [navTab, setNavTab] = useState<NavTab>(navTabFromHash);
// BUG-2 (QA S5): ref tidak memicu re-render — deep-link #/daily|#/rush|#/themes
// saat view puzzles sudah aktif (atau fresh load) harus tetap mengganti tab.
// State mirror dari initialPuzzleTabRef, terbaca PuzzleHub via prop initialTab.
const [puzzleDeepLinkTab, setPuzzleDeepLinkTab] = useState<string | null>(() => initialPuzzleTabRef.current);
// S6: mirror state untuk deep-link insight + explorer (pola BUG-2 QA S5).
const [insightsDeepLinkUser, setInsightsDeepLinkUser] = useState<string | null>(() => insightsDeepLinkRef.current);
const [explorerDeepLinkEco, setExplorerDeepLinkEco] = useState<string | null>(() => explorerDeepLinkRef.current ? (explorerDeepLinkRef.current!.match(/eco=([^&]+)/)?.[1] ?? null) : null);
// S7: mirror state layer belajar (course detail / learn detail+modul / drill set).
const [courseDeepLinkId, setCourseDeepLinkId] = useState<string | null>(() => courseDeepLinkIdRef.current);
const [learnDetail, setLearnDetail] = useState<string | null>(() => learnDetailRef.current);
const [learnModule, setLearnModule] = useState<string | null>(() => learnModuleRef.current);
const [drillSetId, setDrillSetId] = useState<string | null>(() => drillSetIdRef.current);
// Hash <-> state sinkron (deep-link & back button, design doc S4 §1.5).
useEffect(() => {
  const onHash = () => {
    setNavTab(navTabFromHash());
    setPuzzleDeepLinkTab(initialPuzzleTabRef.current);
    setInsightsDeepLinkUser(insightsDeepLinkRef.current);
    setExplorerDeepLinkEco(explorerDeepLinkRef.current ? (explorerDeepLinkRef.current!.match(/eco=([^&]+)/)?.[1] ?? null) : null);
    // S7: mirror layer belajar (navTabFromHash sudah set ref sebagai side-effect).
    setCourseDeepLinkId(courseDeepLinkIdRef.current);
    setLearnDetail(learnDetailRef.current);
    setLearnModule(learnModuleRef.current);
    setDrillSetId(drillSetIdRef.current);
  };
  window.addEventListener("hashchange", onHash);
  return () => window.removeEventListener("hashchange", onHash);
}, []);
const navigate = useCallback((tab: NavTab) => {
  setNavTab(tab);
  // Navigasi internal bukan deep-link puzzle: reset agar tab PuzzleHub tidak
  // "nyangkut" ke deep-link terakhir (BUG-2 follow-up, QA S5).
  if (tab !== "puzzles" && initialPuzzleTabRef.current) {
    initialPuzzleTabRef.current = null;
    setPuzzleDeepLinkTab(null);
  }
  if (tab !== "insights") {
    insightsDeepLinkRef.current = null;
    setInsightsDeepLinkUser(null);
  }
  if (tab !== "explorer") {
    explorerDeepLinkRef.current = null;
    setExplorerDeepLinkEco(null);
  }
  // S7: klik shell = tab polos (tanpa sub-path) → reset semua detail mirror
  // agar tidak "nyangkut" ke deep-link layer belajar sebelumnya.
  courseDeepLinkIdRef.current = null;
  learnDetailRef.current = null;
  learnModuleRef.current = null;
  drillSetIdRef.current = null;
  setCourseDeepLinkId(null);
  setLearnDetail(null);
  setLearnModule(null);
  setDrillSetId(null);
  const h = `#/${tab}`;
  if (window.location.hash !== h) window.history.pushState(null, "", h);
}, []);
// S7: navigasi via hash penuh (sub-path layer belajar: #/courses/{id},
// #/learn/{lesson}, #/learn/openings/{eco}, #/drills/{setId},
// #/puzzles?tab=themes&theme=X). Set window.location.hash → hashchange →
// onHash → navTabFromHash parse sub-path + sync mirror (pola deep-link S5/S6).
const navigateHash = useCallback((hash: string) => {
  const h = hash.startsWith("#") ? hash : `#${hash}`;
  if (window.location.hash !== h) window.location.hash = h;
}, []);
  const [coachSubTab, setCoachSubTab] = useState<CoachSubTab>(initialCoachSubTabRef.current ?? "coach");
  const [aiDepth, setAiDepth] = useState(14);
  const [gameActive, setGameActive] = useState(false);
  const [selectedAiOpponent, setSelectedAiOpponent] = useState<"stockfish" | "jev-fly" | "jev" | "fly">("stockfish");
  const [rightTab, setRightTab] = useState<RightTab>("game-setup");
  const [boardOrientation, setBoardOrientation] = useState<Side>("white");


  const flipBoardOrientation = useCallback(() => {
    setBoardOrientation((s) => (s === "white" ? "black" : "white"));
  }, []);
  const [lang, setLang] = useState<"id" | "en">("id");
  const [timeMode, setTimeMode] = useState<string>("unlimited");

  // Identitas: satu session server-side (cookie httpOnly). Tidak ada lagi
  // identitas client-side yang bisa dipalsukan.
  const { user: currentUser, login, register, logout } = useSession();
  // S7 (design §0.3): status auth utk view layer belajar — konten statis
  // terbuka utk guest; aksi tulis (progres, bookmark, attempt) = login +
  // akun approved; pending → pesan + badge. "rejected" = tidak bisa tulis
  // → diperlakukan seperti guest (angka "—", bukan 0 riil palsu).
  const authStatus: CoursesAuthStatus = !currentUser
    ? "guest"
    : currentUser.status === "approved"
      ? "approved"
      : currentUser.status === "pending"
        ? "pending"
        : "guest";

  // Realtime inline challenge + badge "Bermain" (S1-T4). Kontrak event dari
  // lib/realtime/events.ts — tidak diubah. Aksi lewat /api/challenge (S1-T2).
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [challengeState, setChallengeState] = useState<ChallengeState>("incoming");
  const [playingCount, setPlayingCount] = useState(0);
  const userId = currentUser?.id;
  // S6-T3: RematchRequested (kontrak §2.2) — lawan kirim rematch dari
  // modal game-over mereka; kita tampilkan status "Menunggu rematch dari …".
  const [rematchRequest, setRematchRequest] = useState<{ fromUser: string } | null>(null);
  useRealtime({
    topics: userId ? [matcherTopic(userId), presenceTopic(userId)] : [],
    enabled: Boolean(userId),
    onEvent: (ev) => {
      if (ev.type === "challenge_received") {
        const c = ev as ChallengeReceived;
        setChallenge({ challengeId: c.challengeId, fromUsername: c.fromUsername });
        setChallengeState("incoming");
      } else if (ev.type === "rematch_requested") {
        // S6-T3 (D3.2): konteks "rematch dari partai X" di atas
        // ChallengeReceived existing — modal game-over menampilkan status.
        const r = ev as RematchRequested;
        setRematchRequest({ fromUser: r.fromUser });
      } else if (ev.type === "playing_count_changed") {
        setPlayingCount((ev as PlayingCountChanged).count);
      } else if (ev.type === "game_added") {
        // Match ditemukan (S1-T2 matcher) -> arahkan ke papan game (design doc:
        // "navigasi ke game"). Pola view switching sama dengan onChallengePlayer.
        const g = ev as GameAdded;
        const opponent = userId && g.white === userId ? g.black : g.white;
        if (opponent) setPvpOpponentName(opponent);
        setPlayMode("pvp");
        setNavTab("play");
        setGameActive(true);
        setChallenge(null);
        setChallengeState("incoming");
      }
    },
  });

  const resolveChallenge = useCallback(async (accept: boolean) => {
    if (!challenge) return;
    setChallengeState(accept ? "accepted" : "declined");
    try {
      // Kontrak S1-T4 (docs/db/sprint1.md): POST /api/challenge/[id]/respond
      // { action: "accept" | "decline" } -> { gameId? }.
      await fetch(`/api/challenge/${challenge.challengeId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: accept ? "accept" : "decline" }),
      });
    } catch {}
    if (!accept) {
      setTimeout(() => setChallenge(null), 2000);
    }
  }, [challenge]);
    const [activeDockModal, setActiveDockModal] = useState<DockModalType>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
    const [authNotice, setAuthNotice] = useState<string | null>(null);
    // S9-T2: notice guest persisten (role=alert, bukan toast 2,8s). Ref
    // trigger fokus — pola more-sheet app-shell.tsx:231-247 — supaya Esc
    // mengembalikan fokus ke trigger yang membuka notice (a11y floor).
    const guestNoticeFocusRef = useRef<HTMLElement | null>(null);
    const [fullscreenClocks, setFullscreenClocks] = useState(false);

  // Global Hotkeys: [F] = Putar Papan, [Z] = Fokus 1 Layar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        setFullscreenClocks((v) => !v);
      } else if (e.key === "z" || e.key === "Z") {
        flipBoardOrientation();
      } else if (e.key === "Escape") {
        setFullscreenClocks(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavClick = (tab: NavTab) => {
    // S9-T2: guest TIDAK di-reject — semua tab navigate normal.
    // Tab di luar guestAllowedTabs (member-only) tetap render view,
    // tetapi notice guest persisten tampil di atas konten (state
    // authNotice — hilang hanya lewat tombol dismiss / Esc).
    if (!currentUser) {
      guestNoticeFocusRef.current = document.activeElement as HTMLElement | null;
      if (!guestAllowedTabs.includes(tab)) {
        setAuthNotice("Fitur ini untuk anggota. Daftar untuk membuka akses penuh.");
      } else if (authNotice) {
        // Kembali ke tab guest-allowed → notice di-reset saat nav aktif.
        setAuthNotice(null);
      }
    }
    navigate(tab);
  };

  // S9-T2: Esc menutup notice guest (pola focus-trap more-sheet,
  // app-shell.tsx:231-247) — fokus kembali ke trigger pembuka notice.
  useEffect(() => {
    if (!authNotice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAuthNotice(null);
        guestNoticeFocusRef.current?.focus?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authNotice]);

  // F3 (P2, audit bed0bb5): deep-link lama #/admin utk user non-admin →
  // redirect ke section home. Menunggu sesi ter-resolve dulu (currentUser
  // terisi) supaya user admin tidak ter-egsek sebelum identitas diketahui;
  // guest (selalu null) tetap di #/admin — main content menampilkan
  // empty-state "Khusus admin" (bukan blank), sesuai kontrak spec §4.
  useEffect(() => {
    if (navTab !== "admin" || !currentUser || currentUser.isAdmin) return;
    navigate("home");
  }, [navTab, currentUser, navigate]);


  // Sisi yang dipilih pemain. "random" di-resolve sekali di sini lalu dipakai
  // ke AI maupun PvP supaya tidak ada ketidaksamaan antar menu.
  const [sideChoice, setSideChoice] = useState<"white" | "black" | "random">("white");
  // "random" diundi SEKALI saat permainan dimulai, lalu meng jadi nilai tetap
  // supaya board, jam, dan nama kartu tidak berganti di tengah jalan.
  const [sideResolved, setSideResolved] = useState<"white" | "black">("white");

  // Nama tampilan untuk kartu pemain. guest = belum masuk; tidak pernah
  // menyentuh currentUser tanpa dijaga null.
  const me = currentUser
    ? { name: currentUser.fullName, tag: `@${currentUser.username}`, elo: currentUser.elo, initials: currentUser.username.slice(0, 2).toUpperCase() }
    : { name: "Tamu", tag: "belum masuk", elo: null as number | null, initials: "?" };

  // PvP Real-time State
  const [playMode, setPlayMode] = useState<PlayMode>("ai");
  const [pvpRoom, setPvpRoom] = useState<PvpRoom | null>(null);
  const [pvpToken, setPvpToken] = useState<string>("");
  const [pvpJoinInput, setPvpJoinInput] = useState<string>("");
  const [pvpStatus, setPvpStatus] = useState<"idle" | "waiting" | "active" | "finished">("idle");
  const [pvpOpponentName, setPvpOpponentName] = useState<string>("Lawan Online");
  const [opponentTacticSaved, setOpponentTacticSaved] = useState<boolean>(false);
  const pvpRoomCode = pvpRoom?.code ?? "";

  // Riwayat satu sumber: lib/game-history.ts (dibaca juga oleh tab Riwayat).
  const { history: gameHistory, record: recordGameResult } = useGameHistory();

  const [customOutcome, setCustomOutcome] = useState<GameOutcome | null>(null);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  // S6-T3 (dev_note #2): delta rating RIIL dari /api/match-result — null
  // sampai respons tiba, sehingga modal menampilkan "Rating diperbarui"
  // tanpa angka (no-mock).
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const requestGen = useRef(0);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const outcome = describeOutcome(chess);
  const effectiveOutcome = customOutcome ?? outcome;

  // Siaran Langsung & Rekaman Pertandingan
  const [isPublicBroadcast, setIsPublicBroadcast] = useState(true);
  // Toggle komentator taktik AI untuk penonton siaran (default: ON)
  const [broadcastCommentary, setBroadcastCommentary] = useState(true);
  const [saveMatchReplay, setSaveMatchReplay] = useState(true);
  const [broadcastId, setBroadcastId] = useState<string>("");
  const [spectateMatchId, setSpectateMatchId] = useState<string | null>(null);

  // Daftar siaran publik aktif untuk ikon Notif (live matches + komentator status)
  const [liveMatchesForDock, setLiveMatchesForDock] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void fetch("/api/broadcast", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d) return;
          const list = Array.isArray(d) ? d : d.matches || [];
          setLiveMatchesForDock(list.filter((m: any) => m.isPublic && !m.over));
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const [spectateMatchData, setSpectateMatchData] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("spectate");
    if (p) {
      setSpectateMatchId(p);
      const poll = () => {
        fetch(`/api/broadcast?id=${p}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.ok && d.match) setSpectateMatchData(d.match);
          })
          .catch(() => {});
      };
      poll();
      const iv = setInterval(poll, 2500);
      return () => clearInterval(iv);
    }
  }, []);

  const syncBroadcast = useCallback(
    (nextFen: string, uci?: string, san?: string, comm?: any, isOver?: boolean, outcomeLabel?: string) => {
      if (!broadcastId) return;
      const whiteName = humanSide === "white" ? me.name : AI_LABEL[selectedAiOpponent] || "Engine";
      const blackName = humanSide === "black" ? me.name : AI_LABEL[selectedAiOpponent] || "Engine";
      void fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: broadcastId,
          whiteName,
          blackName,
          fen: nextFen,
          moves: chess.history(),
          lastUci: uci,
          commentary: broadcastCommentary ? comm : null,
          over: isOver !== undefined ? isOver : effectiveOutcome.over,
          outcomeLabel: outcomeLabel || effectiveOutcome.label,
          isPublic: isPublicBroadcast,
          saveReplay: saveMatchReplay,
        }),
      }).catch(() => {});
    },
    [broadcastId, humanSide, me.name, selectedAiOpponent, chess, effectiveOutcome, isPublicBroadcast, saveMatchReplay, broadcastCommentary],
  );

  // Otomatis akhiri siaran & kelola rekaman publik saat game selesai
  useEffect(() => {
    if (effectiveOutcome.over && broadcastId) {
      syncBroadcast(fen, undefined, undefined, undefined, true, effectiveOutcome.label);
    }
  }, [effectiveOutcome.over, effectiveOutcome.label, broadcastId, fen, syncBroadcast]);
  const turn = sideToMove(chess);
  const humanToMove = !effectiveOutcome.over && turn === humanSide && !thinking;

  // Show Game Over Modal automatically after game ends
  useEffect(() => {
    if (effectiveOutcome.over) {
      chessSound.playGameEnd(effectiveOutcome.winner === humanSide);
      const timer = setTimeout(() => setShowGameOverModal(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowGameOverModal(false);
    }
  }, [effectiveOutcome.over]);

  // Catat permainan selesai ke riwayat & trigger pembelajaran sinaptik backend (PAM/DAN Dopamine)
  useEffect(() => {
    if (!effectiveOutcome.over || moves.length === 0) return;
    recordGameResult({
      opponent: playMode === "ai" ? AI_LABEL[selectedAiOpponent] : pvpOpponentName,
      humanSide,
      outcomeKind: effectiveOutcome.kind,
      winner: effectiveOutcome.winner,
      moves: moves.map((m) => m.san),
      mode: playMode,
      timeMode,
    });

    if (effectiveOutcome.winner === "white" || effectiveOutcome.winner === "black") {
      // S6-T3: ambil ratingDelta RIIL bila endpoint mengirimnya (dev_note #2).
      // Field opsional — tanpa respons = null → modal "Rating diperbarui".
      setRatingDelta(null);
      void fetch("/api/match-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: moves.map((m: any) => m.san),
          winner: effectiveOutcome.winner,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => {
          if (d && typeof d.ratingDelta === "number") setRatingDelta(d.ratingDelta);
        })
        .catch((e) => console.warn("Match learning sync failed:", e));
    } else {
      // Remis: delta rating dihitung server — tanpa angka riil di respons,
      // modal menampilkan "Rating diperbarui" (no-mock; dev_note #2).
      setRatingDelta(null);
    }
  }, [effectiveOutcome.over, moves, playMode, humanSide, effectiveOutcome.kind, effectiveOutcome.winner, pvpOpponentName, selectedAiOpponent, timeMode, recordGameResult]);

  const onTimeout = useCallback((loser: Side) => {
    // Sesi latihan / lawan AI bebas batas waktu berfikir: tidak ada timeout game over
    if (playMode === "ai" || timeMode === "unlimited") return;
    setCustomOutcome({
      over: true,
      winner: loser === "white" ? "black" : "white",
      kind: "timeout",
      label: loser === "white"
        ? (lang === "id" ? "Waktu Putih Habis" : "White ran out of time")
        : (lang === "id" ? "Waktu Hitam Habis" : "Black ran out of time"),
    });
  }, [lang, playMode, timeMode]);

  const { resetClocks, formattedWhiteTime, formattedBlackTime } = useChessClock(timeMode, turn, effectiveOutcome.over, onTimeout);

  const askEngine = useCallback(
    async (position: string) => {
      const gen = ++requestGen.current;
      setThinking(true);
      setError(null);
      try {
        const engineParam = selectedAiOpponent === "fly" ? "fly" : selectedAiOpponent === "stockfish" ? "stockfish" : selectedAiOpponent === "jev-fly" ? "jev-fly" : "jev";
        const response = await fetch("/api/engine-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fen: position,
            depth: aiDepth,
            engine: engineParam,
            history: chess.history().slice(-10),
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
          retryable?: boolean;
          uci?: string;
          san?: string;
          fen?: string;
          probabilities?: Record<string, number>;
          confidence?: number | null;
          droppedMoveCount?: number;
          scoreCp?: number | null;
          mate?: number | null;
        };
        if (gen !== requestGen.current) return;
        if (!response.ok || !payload.uci || !payload.san || !payload.fen) {
          setError({
            message: payload.error ?? "AI did not return a move.",
            retryable: payload.retryable !== false,
          });
          return;
        }
        try {
          chess.load(payload.fen);
        } catch {
          // Fallback if load fails
        }
        setFen(payload.fen);
        if (chess.isCheck()) {
          chessSound.playCheck();
        } else if (payload.san!.includes("x")) {
          chessSound.playCapture();
        } else if (payload.san!.includes("O-O")) {
          chessSound.playCastle();
        } else {
          chessSound.playMove();
        }
        const aiToSq = payload.uci!.slice(2, 4);
        const aiBadge = classifyMove(position, payload.uci!, payload.san!, { isEngineBest: true });
        setMoveBadges({ [aiToSq]: aiBadge });
        setMoves((current) => [
          ...current,
          {
            san: payload.san!,
            uci: payload.uci!,
            by: selectedAiOpponent,
            ply: current.length + 1,
          },
        ]);
        setAnalysis({
          chosenUci: payload.uci,
          chosenSan: payload.san,
          probabilities: payload.probabilities ?? {},
          confidence: payload.confidence ?? null,
          droppedMoveCount: payload.droppedMoveCount ?? 0,
          scoreCp: payload.scoreCp ?? null,
          mate: payload.mate ?? null,
        });
      } catch {
        if (gen !== requestGen.current) return;
        setError({
          message: "Tidak dapat menghubungi server engine.",
          retryable: true,
        });
      } finally {
        if (gen === requestGen.current) {
          setThinking(false);
        }
      }
    },
    [aiDepth, selectedAiOpponent, chess],
  );

  const startGame = useCallback(
    (side: Side) => {
      const newBId = "LIVE-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      setBroadcastId(newBId);
      // "Acak" diundi di sini, sekali, lalu meng jadi nilai tetap.
      const resolved: Side = sideChoice === "random" ? (Math.random() < 0.5 ? "white" : "black") : side;
      setSideResolved(resolved);
      requestGen.current += 1;
      try { chess.load(START_FEN); } catch (_) {}
      setHumanSide(resolved);
      setBoardOrientation(resolved);
      setFen(START_FEN);
      setGameStartFen(START_FEN);
      setMoves([]);
      setAnalysis(null);
      setError(null);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setThinking(false);
      setCustomOutcome(null);
      setShowGameOverModal(false);
      setRatingDelta(null);
      setRematchRequest(null);
      setOpponentTacticSaved(false);
      resetClocks(timeMode);
      setGameActive(true);
      if (playMode === "ai" && resolved === "black") {
        void askEngine(START_FEN);
      }
    },
    [askEngine, timeMode, resetClocks, playMode, chess, sideChoice],
  );

  const resetGame = useCallback(() => {
    requestGen.current += 1;
    try { chess.load(START_FEN); } catch (_) {}
    setBoardOrientation(humanSide);
    setFen(START_FEN);
    setGameStartFen(START_FEN);
    setMoves([]);
    setAnalysis(null);
    setError(null);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setThinking(false);
    setCustomOutcome(null);
    setShowGameOverModal(false);
    setOpponentTacticSaved(false);
    resetClocks(timeMode);
    setGameActive(false);
  }, [timeMode, resetClocks, chess]);

  // Save last move by opponent as a dynamic puzzle
  const saveOpponentTrick = () => {
    if (moves.length === 0) return;
    const lastM = [...moves].reverse().find((m) => m.by !== "human") || moves[moves.length - 1];
    const newPuzzle = buildLivePuzzle(
      fen,
      lastM,
      playMode === "ai" ? AI_LABEL[selectedAiOpponent] : pvpOpponentName,
      moves.map((move) => move.san),
      gameStartFen,
    );
    if (!newPuzzle) return;

    try {
      // Lewat store yang sama dengan Bank Teka-Teki, supaya triiknya benar-benar
      // muncul di bank; key sendiri tidak akan dibaca siapa pun.
      const list = loadSaved().filter((p) => p.id !== newPuzzle.id);
      persistSaved([{ ...newPuzzle, savedAt: Date.now(), source: "live" }, ...list]);
      setOpponentTacticSaved(true);
      setTimeout(() => setOpponentTacticSaved(false), 3000);
    } catch {}
  };

  // PvP Room: Polling Loop for Multiplayer Sync
  useEffect(() => {
    if (playMode !== "pvp" || !pvpRoomCode || pvpStatus === "finished") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pvp?room=${pvpRoomCode}`, {
          cache: "no-store",
          headers: pvpToken ? { "x-player-token": pvpToken } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.room) {
          const r = data.room;
          if (r.fen !== fen) {
            setFen(r.fen);
          }
          if (r.status === "active" && pvpStatus === "waiting") {
            setPvpStatus("active");
            setPvpOpponentName(humanSide === "white" ? r.blackUser || "Pemain 2" : r.whiteUser);
          }
          if (r.status === "finished") {
            setPvpStatus("finished");
            setCustomOutcome({
              over: true,
              winner: r.winner || null,
              kind: r.outcomeKind || "checkmate",
              label: r.winner === humanSide ? "Kemenangan PvP!" : "Kekalahan PvP",
            });
            setShowGameOverModal(true);
          }
        }
      } catch {}
    };

    const interval = setInterval(poll, 1200);
    return () => clearInterval(interval);
  }, [playMode, pvpRoomCode, pvpStatus, fen, humanSide]);

  // Room PvP dibuat/diambil lewat PvpPanel; di sini hanya diterjemahkan ke
  // state papan supaya sisi yang dipilih pemain jadi sisi sebenarnya.
  const onPvpRoom = useCallback(
    (room: PvpRoom, side: Side, token: string) => {
      setPvpRoom(room);
      setPvpToken(token);
      setPlayMode("pvp");
      setHumanSide(side);
      setPvpStatus(room.status === "waiting" ? "waiting" : room.status === "finished" ? "finished" : "active");
      setPvpOpponentName(
        (side === "white" ? room.blackUser : room.whiteUser) || (room.invitedUser ?? "Lawan Online")
      );
      setFen(room.fen);
      setGameStartFen(START_FEN);
      setMoves(
        replaySanList(START_FEN, room.moves).map((m, i) => ({
          san: m.san,
          uci: m.uci,
          by: i % 2 === 0 ? "human" : "jev",
          ply: i + 1,
        })),
      );
      setGameActive(true);
    },
    [],
  );

  const leavePvpRoom = useCallback(() => {
    if (pvpRoomCode) {
      // S6-T3 (D3.1): op "leave" = abort — server menutup room
      // (0 langkah → outcomeKind "aborted" + publish GameAborted).
      void fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", code: pvpRoomCode, token: pvpToken, playerToken: pvpToken }),
      });
    }
    setPvpRoom(null);
    setPvpToken("");
    setPvpStatus("idle");
    setPlayMode("ai");
    setGameActive(false);
    resetGame();
  }, [pvpRoomCode, pvpToken, resetGame]);

  const lastMove = moves[moves.length - 1];
  const matchCommentary = useMemo(
    () => buildMatchCommentary(chess, lastMove, typeof analysis?.scoreCp === "number" ? analysis.scoreCp : null, humanSide),
    [analysis?.scoreCp, chess, humanSide, lastMove],
  );

  const tryHumanMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece): boolean => {
      if (!humanToMove) return false;
      const legal = findLegalMove(chess, from, to, promotion);
      if (!legal) return false;

      const fenBefore = chess.fen();
      const applied = applyUci(chess, legal.uci);
      const nextFen = chess.fen();
      setFen(nextFen);
      const badge = classifyMove(fenBefore, legal.uci, applied.san);
      if (chess.isCheck()) {
        chessSound.playCheck();
      } else if (applied.san.includes("x")) {
        chessSound.playCapture();
      } else if (applied.san.includes("O-O")) {
        chessSound.playCastle();
      } else {
        chessSound.playMove();
      }
      setMoveBadges({ [legal.to]: badge });
      setSelectedSquare(null);
      setMoves((current) => [
        ...current,
        {
          san: applied.san,
          uci: legal.uci,
          by: "human",
          ply: current.length + 1,
        },
      ]);

      // Sync move to live broadcast (AI & PvP — komentator publik ikut tampil)
      syncBroadcast(nextFen, legal.uci, applied.san, matchCommentary as any);

      // If in PvP mode, push move to server
      if (playMode === "pvp" && pvpRoomCode) {
        void fetch("/api/pvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move",
            code: pvpRoomCode,
            from,
            to,
            promotion,
            side: humanSide,
            playerToken: pvpToken,
          }),
        });
        return true;
      }

      // AI Mode
      const nextOutcome = describeOutcome(chess);
      if (!nextOutcome.over) {
        void askEngine(nextFen);
      }
      return true;
    },
    [askEngine, chess, humanToMove, playMode, pvpRoomCode, humanSide, pvpToken, matchCommentary],
  );

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!targetSquare || !humanToMove) return false;
    if (isPromotionAttempt(chess, sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return true;
    }
    return tryHumanMove(sourceSquare, targetSquare);
  };

  const canDragPiece = ({ piece }: PieceHandlerArgs): boolean => {
    if (!humanToMove) return false;
    return (
      (humanSide === "white" && piece.pieceType.startsWith("w")) ||
      (humanSide === "black" && piece.pieceType.startsWith("b"))
    );
  };

  const destinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const set = new Set<string>();
    for (const move of getLegalMoves(chess)) {
      if (move.from === selectedSquare) {
        set.add(move.to);
      }
    }
    return set;
  }, [chess, selectedSquare]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selectedSquare) {
      styles[selectedSquare] = {
        boxShadow: "inset 0 0 0 4px var(--primary)",
      };
    }
    for (const square of destinations) {
      styles[square] = {
        background: "radial-gradient(circle, rgba(253, 224, 71, 0.5) 25%, transparent 27%)",
      };
    }
    if (lastMove) {
      const from = lastMove.uci.slice(0, 2);
      const to = lastMove.uci.slice(2, 4);
      styles[from] = {
        ...styles[from],
        backgroundColor: "rgba(255, 235, 59, 0.3)",
      };
      styles[to] = {
        ...styles[to],
        backgroundColor: "rgba(255, 235, 59, 0.45)",
      };
    }

    // Effect: Raja Tumbang / Mated King fallen
    if (effectiveOutcome.over && effectiveOutcome.kind === "checkmate") {
      const matedSide = chess.turn();
      for (let r = 1; r <= 8; r++) {
        for (const f of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
          const sq = `${f}${r}` as Square;
          const piece = chess.get(sq);
          if (piece && piece.type === "k" && piece.color === matedSide) {
            styles[sq] = {
              backgroundColor: "rgba(239, 68, 68, 0.5)",
              boxShadow: "inset 0 0 0 4px var(--destructive)",
              transform: "rotate(-85deg) translate(-8px, 12px)",
              transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
            };
          }
        }
      }
    }

    return styles;
  }, [chess, destinations, lastMove, effectiveOutcome.kind, effectiveOutcome.over, selectedSquare]);

  // Chess.com Eval Bar Calculations (Score range -800 to +800 clamped)
  const scoreCp = typeof analysis?.scoreCp === "number" ? analysis.scoreCp : 0;
  const clampedCp = Math.max(-800, Math.min(800, scoreCp));
  const evalBarPercent = Math.round(50 + (clampedCp / 800) * 45);
  const evalScoreDisplay =
    scoreCp > 0
      ? `+${(scoreCp / 100).toFixed(1)}`
      : scoreCp < 0
        ? `${(scoreCp / 100).toFixed(1)}`
        : "0.0";

  const [copiedPgn, setCopiedPgn] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const copyShareLink = useCallback(() => {
    if (!broadcastId) return;
    const url = `${window.location.origin}/?spectate=${broadcastId}`;
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  }, [broadcastId]);

  const getFullPgn = useCallback(() => {
    const whitePlayerName = humanSide === "white"
      ? me.name
      : playMode === "ai"
        ? selectedAiOpponent === "jev-fly"
          ? "Jev + Fly Brain"
          : selectedAiOpponent === "fly"
            ? "Fruit Fly Brain"
            : selectedAiOpponent === "jev"
              ? "Jev"
              : "Stockfish 19 NNUE"
        : pvpOpponentName;

    const blackPlayerName = humanSide === "black"
      ? me.name
      : playMode === "ai"
        ? selectedAiOpponent === "jev-fly"
          ? "Jev + Fly Brain"
          : selectedAiOpponent === "fly"
            ? "Fruit Fly Brain"
            : selectedAiOpponent === "jev"
              ? "Jev"
              : "Stockfish 19 NNUE"
        : pvpOpponentName;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
    let resultStr = "*";
    if (effectiveOutcome?.over) {
      if (effectiveOutcome.winner === "white") resultStr = "1-0";
      else if (effectiveOutcome.winner === "black") resultStr = "0-1";
      else resultStr = "1/2-1/2";
    }

    const headers = [
      `[Event "FIF Chess Match"]`,
      `[Site "Telkom University (FIF)"]`,
      `[Date "${dateStr}"]`,
      `[Round "1"]`,
      `[White "${whitePlayerName}"]`,
      `[Black "${blackPlayerName}"]`,
      `[Result "${resultStr}"]`,
      effectiveOutcome?.label ? `[Termination "${effectiveOutcome.label}"]` : "",
    ].filter(Boolean).join("\n");

    const movePairs: string[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      const moveNo = Math.floor(i / 2) + 1;
      const w = moves[i]?.san || "";
      const b = moves[i + 1]?.san || "";
      if (b) {
        movePairs.push(`${moveNo}. ${w} ${b}`);
      } else if (w) {
        movePairs.push(`${moveNo}. ${w}`);
      }
    }

    return `${headers}\n\n${movePairs.join(" ")} ${resultStr}`.trim();
  }, [humanSide, me.name, playMode, selectedAiOpponent, pvpOpponentName, effectiveOutcome, moves]);

  const copyGamePgn = useCallback(() => {
    const pgn = getFullPgn();
    navigator.clipboard.writeText(pgn);
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  }, [getFullPgn]);

  const downloadGamePgn = useCallback(() => {
    const pgn = getFullPgn();
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fif-chess-match-${Date.now()}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getFullPgn]);

  // SPECTATOR: render fullscreen broadcast/replay ketika dibuka via ?spectate=<id>
  const spectateArrows = useMemo(() => {
    const list: { startSquare: string; endSquare: string; color: string }[] = [];
    const m = spectateMatchData;
    if (!m) return list;
    // Kuning: langkah terakhir
    if (m.lastUci && m.lastUci.length >= 4) {
      list.push({ startSquare: m.lastUci.slice(0, 2), endSquare: m.lastUci.slice(2, 4), color: "rgb(234, 179, 8)" });
    }
    const comm = m.commentary;
    if (!comm) return list;
    // Merah: ancaman
    if (comm.threat?.from && comm.threat?.to) {
      list.push({ startSquare: comm.threat.from, endSquare: comm.threat.to, color: "rgb(239, 68, 68)" });
    }
    // Biru: prediksi respons lawan
    if (comm.predFrom && comm.predTo) {
      list.push({ startSquare: comm.predFrom, endSquare: comm.predTo, color: "rgb(56, 189, 248)" });
    } else if (comm.tektokkan?.hasExchange && comm.tektokkan.defenderFrom && comm.tektokkan.targetSq) {
      list.push({ startSquare: comm.tektokkan.defenderFrom, endSquare: comm.tektokkan.targetSq, color: "rgb(56, 189, 248)" });
    }
    // Hijau: strategi / trajektori bidak
    const traj = Array.isArray(comm.pieceTrajectory) && comm.pieceTrajectory.length > 0
      ? comm.pieceTrajectory
      : (Array.isArray(comm.futureLine) ? comm.futureLine : []);
    traj.forEach((step: any, idx: number) => {
      if (step?.from && step?.to && step.from !== step.to) {
        list.push({ startSquare: step.from, endSquare: step.to, color: idx === 0 ? "rgb(16, 185, 129)" : "rgba(5, 150, 105, 0.8)" });
      }
    });
    if (traj.length === 0 && comm.stratFrom && comm.stratTo) {
      list.push({ startSquare: comm.stratFrom, endSquare: comm.stratTo, color: "rgb(16, 185, 129)" });
    }
    return list;
  }, [spectateMatchData]);

  if (spectateMatchId && spectateMatchData) {
    const m = spectateMatchData;
    return (
      <div className="min-h-screen w-screen bg-[var(--background)] text-white flex flex-col items-center justify-start pt-4 pb-8 p-4 gap-3 select-none overflow-y-auto">
        <div className="flex items-center gap-2 text-sm font-black tracking-widest uppercase">
          <IconPlay3D size={20} />
          <span>FIF <span className="text-[var(--primary)]">· Siaran Langsung</span></span>
        </div>
        <div className="flex items-center gap-6 text-xs font-bold text-neutral-300">
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-white border border-neutral-500" /> {m.whiteName || "Putih"}</span>
          <span className="text-neutral-500">vs</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-500" /> {m.blackName || "Hitam"}</span>
        </div>
        <ChessBadgeLegend className="w-full max-w-[min(100%,calc(100vw-2.5rem),calc(100dvh-190px))] mb-1.5" />
        <div className="w-full mx-auto max-w-[min(100%,calc(100vw-2.5rem),calc(100dvh-190px))] aspect-square rounded-2xl overflow-hidden border-2 border-[var(--primary)] shadow-xl">
          <Chessboard
            key={`spectate-board-${boardThemeId}-${pieceThemeId}`}
            options={{
              id: "board-spectate",
              position: m.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
              boardOrientation: "white",
              allowDragging: false,
              arrows: spectateArrows,
              boardStyle: {
                backgroundColor: boardTheme.dark,
              },
              darkSquareStyle: { backgroundColor: boardTheme.dark },
              lightSquareStyle: { backgroundColor: boardTheme.light },
              pieces: customPieces,
              ...notationStyles,
            }}
          />
        </div>
        <div className="text-sm font-black">
          {m.over ? (
            <span className="text-amber-400">⏹ Pertandingan Selesai — {m.outcomeLabel || "selesai"}</span>
          ) : (
            <span className="flex items-center gap-2 text-emerald-400"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Langsung</span>
          )}
        </div>
        {m.commentary && (
          <div className="w-full max-w-xl">
            <TacticalCommentaryCard
              commentary={m.commentary}
              badgeTitle="Komentator & Taktik AI"
              badgeSubtitle="Siaran Publik"
              isLive={!m.over}
            />
          </div>
        )}
        {Array.isArray(m.moves) && m.moves.length > 0 && (
          <div className="w-full max-w-xl max-h-[30dvh] overflow-y-auto custom-scrollbar">
            <MoveList
              moves={m.moves.map((san: string, i: number) => ({ san, uci: "", by: i % 2 === 0 ? "white" : "black", ply: i + 1 }))}
              whiteName={m.whiteName || "Putih"}
              blackName={m.blackName || "Hitam"}
            />
          </div>
        )}
      </div>
    );
  }

  if (spectateMatchId && !spectateMatchData) {
    return (
      <div className="h-screen w-screen bg-[var(--background)] text-white flex items-center justify-center">
        <span className="text-sm font-bold text-neutral-400 animate-pulse">Memuat siaran…</span>
      </div>
    );
  }

  return (
    <AppShell
      navTab={navTab}
      onNavigate={handleNavClick}
      user={currentUser ? { id: currentUser.id, username: currentUser.username, isAdmin: currentUser.isAdmin, elo: currentUser.elo } : null}
      playingCount={playingCount}
      lang={lang}
      onToggleLang={() => setLang((l) => (l === "id" ? "en" : "id"))}
      onOpenAuth={() => setShowAuthModal(true)}
      onOpenDock={(m) => setActiveDockModal(m)}
    >


      {/* S8: AppShell merender <main id="main-content"> — konten child masuk
          satu main (main-in-main tidak valid HTML). Kelas app-main
          dipegang main shell; di sini hanya div pembungkus. */}
      <div className="flex-1 flex flex-col min-h-0">
        {challenge && (
          <ChallengeLayer challenge={challenge} state={challengeState} controlLabel={CHALLENGE_CONTROL_LABEL} onAccept={() => void resolveChallenge(true)} onDecline={() => void resolveChallenge(false)} />
        )}
        {/* S9-T2: notice guest persisten — inline di atas konten view (bukan
            floating fixed), role=alert, ikon + teks + tombol dismiss.
            Persisten: hilang HANYA lewat dismiss / Esc (state authNotice).
            motion-safe: animasi hanya saat reduced-motion OFF. */}
        {authNotice && (
          <div
            role="alert"
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 mx-2 my-2 sm:mx-4 flex items-center gap-3 rounded-xl border border-[var(--primary)]/40 bg-[var(--card)] px-4 py-3 text-sm font-semibold text-white shadow-lg"
          >
            <span aria-hidden="true" className="shrink-0 text-[var(--primary)]">
              <IconAlert3D size={20} />
            </span>
            <span className="flex-1">{authNotice}</span>
            <button
              type="button"
              onClick={() => {
                setAuthNotice(null);
                guestNoticeFocusRef.current?.focus?.();
              }}
              aria-label="Tutup pengumuman"
              className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
            >
              <IconClose3D size={18} />
            </button>
          </div>
        )}
        {/* S4-T2: Home Dashboard — default landing */}
        {currentUser && navTab === "home" && (
          <HomeView
            onNavigate={(t) => navigate(t as NavTab)}
            onPlayGame={() => navigate("play")}
            onReviewGame={() => navigate("review")}
          />
        )}
        {/* S4-T3: Leaderboard & Friends */}
        {currentUser && navTab === "leaderboard" && (
          <div className="view-root">
            <LeaderboardView onPlayOnline={() => navigate("play")} />
          </div>
        )}
        {currentUser && navTab === "friends" && (
          <div className="view-root">
            <FriendsView
              onChallenge={async (u) => {
                try {
                  // Challenge nyata via /api/challenge (S1-T4). Kontrak store:
                  // toUserId = id store user. /api/auth/lookupByUsername
                  // mengekspos id publik tanpa data sensitif (S4-fix).
                  const lookRes = await fetch(
                    `/api/auth/lookupByUsername?username=${encodeURIComponent(u)}`,
                    { cache: "no-store" },
                  );
                  if (!lookRes.ok) return false;
                  const look = await lookRes.json().catch(() => ({}));
                  const toUserId = look?.id;
                  if (!toUserId) return false;
                  const res = await fetch("/api/challenge", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    // S6-T2 (§2.1): preset waktu terakhir per user jadi default
                    // undangan — tanpa data = "3+2" (loadStoredTimeControl).
                    body: JSON.stringify({ toUserId, timeControl: loadStoredTimeControl(), rated: false }),
                  });
                  if (!res.ok) return false;
                  setPlayMode("pvp");
                  navigate("play");
                  return true;
                } catch {
                  return false;
                }
              }}
            />
          </div>
        )}
        {/* S4-T4: Endgame Drills — S8: wrapper .view-root; Pola A komposisi di dalam view (spec §3). */}
        {navTab === "drills" && (
          <div className="view-root">
            <EndgameDrillsView
              authStatus={authStatus}
              username={currentUser?.username}
              initialSetId={drillSetId}
              onOpenPlayer={(u) => {
                window.location.hash = `#/insights/${encodeURIComponent(u)}`;
              }}
            />
          </div>
        )}
        {/* S7-T1: Kursus (konten statis publik; detail deep-link #/courses/{id}). */}
        {navTab === "courses" && (
          <div className="view-root">
            <CoursesView authStatus={authStatus} onNavigate={navigateHash} courseDeepLinkId={courseDeepLinkId} />
          </div>
        )}
        {/* S7-T2: Pelajaran + Pelajaran Pembukaan (3-mode ADR D3, materi tertulis D2). */}
        {navTab === "learn" && (
          <div className="view-root">
            <LessonsView authStatus={authStatus} onNavigate={navigateHash} detail={learnDetail} initialModule={learnModule} />
          </div>
        )}
        {/* S7-T3: Pusat Latihan (thin router + kartu target mingguan riil). */}
        {navTab === "practice" && (
          <div className="view-root">
            <PracticeView authStatus={authStatus} onNavigate={navigateHash} />
          </div>
        )}
        {/* S7-T4: Ruang Kelas (collab 2 pemain, in-memory, notice ADR D5). */}
        {navTab === "classroom" && (
          <div className="view-root">
            <ClassroomView authStatus={authStatus} />
          </div>
        )}
        {!currentUser ? (
          <div className="auth-page w-full max-w-lg mx-auto p-3 pt-6 sm:p-6 min-h-[calc(100vh-4rem)] flex flex-col justify-start md:justify-center items-center overflow-y-auto">
            <div className="w-full max-w-md mx-auto">
              <AuthPanel
                user={currentUser}
                onClose={() => {}}
                onLogin={login}
                onRegister={register}
                onLogout={logout}
                inline={true}
              />
            </div>
          </div>
        ) : (<>
        {navTab === "coach" && (
          <div className="h-full max-h-full flex flex-col min-h-0 overflow-hidden">
            {/* Coach sub-tab switcher */}
            <div className="flex bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] w-full max-w-md mx-auto shadow-md shrink-0 mb-2">
              {([
                { id: "coach", labelId: "AI Coach", labelEn: "AI Coach" },
                { id: "spectator", labelId: "Jev vs Stockfish", labelEn: "Jev vs Stockfish" },
              ] as { id: CoachSubTab; labelId: string; labelEn: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCoachSubTab(tab.id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    coachSubTab === tab.id ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {lang === "id" ? tab.labelId : tab.labelEn}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-2">
              <BoardShell
                layout="board-only"
                board={
                  <div className="min-h-0 w-full">
                    {coachSubTab === "coach" && <CoachModeView lang={lang} />}
                    {coachSubTab === "spectator" && (
                      <SpectatorView lang={lang} />
                    )}
                  </div>
                }
              />
            </div>
          </div>
        )}
        {navTab === "puzzles" && (
          <div className="view-root">
            <PuzzleHub lang={lang} initialTab={(puzzleDeepLinkTab ?? initialPuzzleTabRef.current ?? "unlimited") as "unlimited" | "daily" | "rush" | "themes"} onBack={() => setNavTab("play")} />
          </div>
        )}
        {currentUser && navTab === "archive" && (
          <div className="view-root">
            <ArchiveView onGoReview={() => setNavTab("review")} />
          </div>
        )}
        {/* S6-T1: Penjelajah Pembukaan (guest boleh lihat data publik).
            "Hasilkan di papan" → muat FEN node ke board analisis (S4-T5).
            S8 spec §3 Pola B: wrapper .view-root; list/filter pin di dalam view. */}
        {navTab === "explorer" && (
          <div className="view-root">
            <ExplorerView
              initialEco={explorerDeepLinkEco ?? undefined}
              onLoadFen={(fen) => {
                // Pola S4-T5 fast-path: FEN node langsung ke papan analisis
                // review — tanpa redirect ke play (konsisten PasteBar S5-T3).
                setGameStartFen(fen);
                setFen(fen);
                setMoves([]);
                setCustomOutcome(null);
                setReviewGame({ startFen: fen, moves: [] });
                setReviewPly(0);
                setNavTab("review");
              }}
            />
          </div>
        )}
        {/* S6-T4: Insight (publik saat deep-link username, sesi sendiri saat kosong) */}
        {navTab === "insights" && (
          <div className="view-root">
            <InsightsView
              username={insightsDeepLinkUser ?? ""}
              isSelf={!insightsDeepLinkUser}
              onOpenLeaderboard={() => setNavTab("leaderboard")}
              onOpenArchive={() => setNavTab("archive")}
            />
          </div>
        )}
        {/* S6-T5: Turnamen (daftar arena publik; CTA daftar login-wall) */}
        {navTab === "tournaments" && (
          <div className="view-root">
            <TournamentsView username={currentUser?.username ?? ""} />
          </div>
        )}
        {navTab === "vision" && <div className="view-root"><LearningHub lang={lang} /></div>}

        {navTab === "review" && (
          <div className="view-root">
            {/* S2-T4: paste bar fast-path di atas panel review (design doc §3.1) */}
            <div className="px-1 pt-1 pb-1 shrink-0">
              <PasteBar
                lang={lang}
                onLoadFen={(f) => {
                  // S5-T3: fast-path tetap di board analisis — tanpa redirect ke play.
                  setGameStartFen(f);
                  setFen(f);
                  setMoves([]);
                  setCustomOutcome(null);
                  // BUG-1 (QA S5): paste FEN harus merender papan analisis di review.
                  setReviewGame({ startFen: f, moves: [] });
                  setReviewPly(0);
                }}
                onLoadPgn={(sans, startFen) => {
                  const replayed = replaySanList(startFen, sans);
                  const boardAtEnd = parseFenChess(startFen);
                  for (const m of replayed) {
                    try {
                      boardAtEnd.move(m.san);
                    } catch {
                      break;
                    }
                  }
                  setGameStartFen(startFen);
                  setFen(boardAtEnd.fen());
                  setMoves(
                    replayed.map((m, i) => ({
                      san: m.san,
                      uci: m.uci,
                      by: i % 2 === 0 ? "human" : "jev",
                      ply: i + 1,
                    })),
                  );
                  setCustomOutcome(null);
                  // BUG-1 (QA S5): hasil paste PGN dirender ke papan analisis review.
                  setReviewGame({
                    startFen,
                    moves: replayed.map((m) => ({ san: m.san, uci: m.uci })),
                  });
                  setReviewPly(replayed.length);
                  // S5-T3: tetap di review — movelist terisi di panel analisis.
                }}
                onOpenGame={(gameId) => {
                  // Tautan game internal → panel review game tersebut.
                  setNavTab("review");
                }}
              />
            </div>
            {/* BUG-1 (QA S5): papan analisis inline — merender hasil paste PGN/FEN
                langsung di view review, tanpa redirect ke play. */}
            {reviewGame && (
              <ReviewAnalysisBoard
                game={reviewGame}
                ply={reviewPly}
                onPly={setReviewPly}
              />
            )}
            <GameReview
              history={gameHistory}
              onBackToPlay={() => setNavTab("play")}
              lang={lang}
            />
          </div>
        )}
        {navTab === "scan" && <div className="view-root"><ScanView onLoadFen={(f) => { setGameStartFen(f); setFen(f); setMoves([]); setNavTab("play"); }} lang={lang} /></div>}
        {navTab === "community" && <div className="view-root"><CommunityView user={currentUser} lang={lang} /></div>}
        {/* F3 (P2, audit bed0bb5): deep-link lama #/admin utk non-admin dulu
            blank (AdminPanel return null). Guard render: panel tidak di-mount
            utk non-admin; empty-state sopan + CTA — kontrak spec §4 "empty-state,
            bukan blank/crash". */}
        {navTab === "admin" && (
          <div className="view-root">
            {currentUser?.isAdmin ? (
              <AdminPanel user={currentUser} />
            ) : (
              <>
                <div className="view-head flex items-center gap-2 shrink-0" style={{ borderLeft: "3px solid var(--nav-accent-drill)" }}>
                  <h1 className="text-sm font-black text-white">Admin</h1>
                </div>
                <div className="view-body flex flex-col items-center justify-center gap-2 py-10 text-center" role="status">
                  <p className="text-sm font-bold text-neutral-300">Khusus admin</p>
                  <p className="text-xs text-neutral-400">Panel administrasi hanya dapat diakses oleh akun admin.</p>
                  <Button variant="outline" onClick={() => navigate("home")}>Ke Beranda</Button>
                </div>
              </>
            )}
          </div>
        )}
        {navTab === "bots" && (
          <div className="view-root">
            <VersusBotsView
              lang={lang}
              onSelectBot={(bot) => {
                setSelectedAiOpponent(bot.engine);
                setAiDepth(bot.depth);
                setPlayMode("ai");
                setNavTab("play");
                startGame(humanSide);
              }}
            />
          </div>
        )}


        {navTab === "play" && (
          <div className="play-layout lg:h-full lg:max-h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem] gap-4 items-start w-full min-h-0 max-w-[1320px] mx-auto">
            {/* CENTER CHESSBOARD ARENA: Desain Seragam Mengikuti Layout Trik & Quest */}
            <div className="board-card rounded-2xl p-2.5 md:p-3 bg-[var(--card)] border border-[var(--border)] shadow-xl w-full flex flex-col justify-start items-center">
              {/* 1. Toolbar Kontrol Papan */}
              <BoardControls
                variant="toolbar"
                orientation={boardOrientation}
                onFlipOrientation={flipBoardOrientation}
                isFullscreen={fullscreenClocks}
                onToggleFullscreen={() => setFullscreenClocks((open) => !open)}
                showShortcuts={true}
                className="w-full shrink-0 mb-1.5"
                onSaveTrick={saveOpponentTrick}
                trickSaved={opponentTacticSaved}
                canSaveTrick={gameActive && moves.length > 0}
                trickLabel={lang === "id" ? "Simpan Trik Lawan" : "Simpan Trik"}
              />

              {/* 2. Kartu Pemain Lawan (Dual Player Strip ala Chess.com) */}
              <div className="w-full max-w-[min(100%,calc(100dvh-260px))] mb-1.5 shrink-0">
                <PlayerStrip
                  name={playMode === "ai"
                    ? (selectedAiOpponent === "jev-fly" ? "Master JEV Connectome" : selectedAiOpponent === "fly" ? "Fruit Fly Brain" : selectedAiOpponent === "jev" ? "Jev AI" : "Stockfish 19 NNUE")
                    : (pvpOpponentName || "Lawan Online")}
                  rating={playMode === "ai" ? getAiElo(selectedAiOpponent, aiDepth) : "1500"}
                  title={playMode === "ai" ? "BOT" : undefined}
                  isBot={playMode === "ai"}
                  clockFormatted={humanSide === "white" ? formattedBlackTime : formattedWhiteTime}
                  isActiveTurn={!humanToMove && gameActive && !effectiveOutcome.over}
                  isCriticalTime={false}
                  capturedElements={<CapturedPiecesBar fen={fen} side={humanSide === "white" ? "black" : "white"} />}
                />
              </div>

              {/* 3. Baris Legenda Badge ala Chess.com */}
              <ChessBadgeLegend className="w-full max-w-[min(100%,calc(100dvh-260px))] mb-2" />

              {/* 4. Papan Catur & Bar Evaluasi Vertikal */}
              <div className="flex items-center justify-center gap-2 w-full max-w-[min(100%,calc(100dvh-260px))] min-h-0">
                <EvalBar
                  fen={fen}
                  scoreCp={
                    typeof analysis?.scoreCp === "number"
                      ? humanSide === "white"
                        ? analysis.scoreCp
                        : -analysis.scoreCp
                      : null
                  }
                  orientation={humanSide}
                />
                <div className="aspect-square flex-1 min-w-0 rounded-2xl overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--board-dark)] shadow-2xl relative">
                  <Chessboard
                    key={`main-board-${boardOrientation}-${boardThemeId}-${pieceThemeId}-${moves.length}-${fen.split(" ")[0]}`}
                    options={{
                      id: `fif-chess-main-${boardThemeId}-${pieceThemeId}`,
                      position: fen,
                      boardOrientation: boardOrientation,
                      allowDragging: humanToMove,
                      canDragPiece,
                      onPieceDrop,
                      alphaNotationStyle: {
                        ...notationStyles.alphaNotationStyle,
                        bottom: "3px",
                        right: "5px",
                      },
                      numericNotationStyle: {
                        ...notationStyles.numericNotationStyle,
                        top: "3px",
                        left: "4px",
                      },
                      squareRenderer: createSquareBadgeRenderer(moveBadges, fen, squareStyles),
                      onSquareClick: ({ square }) => {
                        if (!humanToMove) return;
                        if (selectedSquare) {
                          if (selectedSquare === square) {
                            setSelectedSquare(null);
                            return;
                          }
                          if (isPromotionAttempt(chess, selectedSquare, square)) {
                            setPendingPromotion({ from: selectedSquare, to: square });
                            setSelectedSquare(null);
                            return;
                          }
                          if (tryHumanMove(selectedSquare, square)) return;
                        }
                        const piece = chess.get(square as Square);
                        const isHumanPiece =
                          piece &&
                          ((humanSide === "white" && piece.color === "w") ||
                            (humanSide === "black" && piece.color === "b"));
                        setSelectedSquare(isHumanPiece ? square : null);
                      },
                      squareStyles,
                      boardStyle: {
                        backgroundColor: boardTheme.dark,
                        width: "100%",
                        height: "100%",
                      },
                      lightSquareStyle: { backgroundColor: boardTheme.light },
                      darkSquareStyle: { backgroundColor: boardTheme.dark },
                      pieces: customPieces,
                      animationDurationInMs: 200,
                      showNotation: true,
                    }}
                  />
                </div>
              </div>

              {/* 5. Kartu Pemain User (Dual Player Strip ala Chess.com) */}
              <div className="w-full max-w-[min(100%,calc(100dvh-260px))] mt-1.5 shrink-0">
                <PlayerStrip
                  name={currentUser?.fullName ?? (lang === "id" ? "Pak Bagas Wibowo" : "Player")}
                  rating={1650}
                  isBot={false}
                  clockFormatted={humanSide === "white" ? formattedWhiteTime : formattedBlackTime}
                  isActiveTurn={humanToMove && gameActive && !effectiveOutcome.over}
                  isCriticalTime={false}
                  capturedElements={<CapturedPiecesBar fen={fen} side={humanSide} />}
                />
              </div>
            </div>

            {fullscreenClocks && (
                <ClockMovesFullscreen
                  fen={fen}
                  moveBadges={moveBadges}
                  moves={moves}
                  whiteName={
                    humanSide === "white"
                      ? (currentUser?.fullName ?? "Anda")
                      : playMode === "ai"
                        ? AI_LABEL[selectedAiOpponent]
                        : pvpOpponentName
                  }
                  blackName={
                    humanSide === "black"
                      ? (currentUser?.fullName ?? "Anda")
                      : playMode === "ai"
                        ? AI_LABEL[selectedAiOpponent]
                        : pvpOpponentName
                  }
                  whiteTime={formattedWhiteTime}
                  blackTime={formattedBlackTime}
                  activeSide={effectiveOutcome.over ? null : turn}
                  onClose={() => setFullscreenClocks(false)}
                  boardOrientation={humanSide === "black" ? "black" : "white"}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={({ square }) => {
                    if (!humanToMove) return;
                    if (selectedSquare) {
                      if (selectedSquare === square) {
                        setSelectedSquare(null);
                        return;
                      }
                      if (isPromotionAttempt(chess, selectedSquare, square)) {
                        setPendingPromotion({ from: selectedSquare, to: square });
                        setSelectedSquare(null);
                        return;
                      }
                      if (tryHumanMove(selectedSquare, square)) return;
                    }
                    const piece = chess.get(square as Square);
                    const isHumanPiece =
                      piece &&
                      ((humanSide === "white" && piece.color === "w") ||
                        (humanSide === "black" && piece.color === "b"));
                    setSelectedSquare(isHumanPiece ? square : null);
                  }}
                  squareStyles={squareStyles}
                  canDragPiece={canDragPiece}
                  scoreCp={(analysis as any)?.scoreCp ?? 0}
                />
              )}

            {/* RIGHT SIDEBAR (Control Panel - 100% Chess.com) */}
            {/* Mobile: natural height below the board (scrolls with page); desktop: h-full panel */}
            <div className="game-side-panel lg:h-full lg:max-h-full lg:min-h-0 lg:flex lg:flex-col flex flex-col">
              <Card className="bg-[var(--card)] border border-[var(--border)] shadow-xl rounded-2xl overflow-hidden lg:h-full lg:max-h-full flex flex-col lg:min-h-0">
                <CardHeader className="p-2 border-b border-[var(--border)] bg-[var(--muted)] shrink-0">
                  <div className="flex w-full bg-[var(--surface)] p-1 rounded-full border border-[var(--border)] gap-1">
                    <button
                      onClick={() => setRightTab("game-setup")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                        rightTab === "game-setup" ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang === "id" ? "Permainan Baru" : "New Game"}
                    </button>
                    <button
                      onClick={() => setRightTab("analysis")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                        rightTab === "analysis" ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang === "id" ? "Analisis Engine" : "Analysis"}
                    </button>
                    <button
                      onClick={() => setRightTab("moves")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                        rightTab === "moves" ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang === "id" ? "Langkah" : "Moves"}
                    </button>
                  </div>
                </CardHeader>
<CardContent className="game-side-panel-content p-3.5 flex-1 min-h-0 overflow-y-auto space-y-3 custom-scrollbar">
                  {/* TAB 1: GAME SETUP OR ACTIVE MATCH HUB */}
                  {rightTab === "game-setup" && (
                    <div className="space-y-4">
                      {/* WHEN MATCH IS ACTIVE: HIDE SETUP BUTTONS AND SHOW LIVE CLOCKS & IN-GAME CONTROLS */}
                      {gameActive && !effectiveOutcome.over ? (
                        <div className="space-y-3">
<div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex justify-between items-center">
                            <span>Jam Catur Pertandingan</span>
                            <Badge className="bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/40 text-xs">
                              {timeMode === "unlimited" ? "Tanpa Batas" : timeMode}
                            </Badge>
                          </div>

                          {/* Opponent Live Clock */}
                          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            !humanToMove ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-md shadow-[var(--primary)]/20" : "bg-[var(--background)] border-[var(--border)]"
                          }`}>
                            <div>
                              <span className="text-xs font-bold text-neutral-300 block">
                                {playMode === "ai"
                                  ? (selectedAiOpponent === "jev-fly" ? "Jev + Fly Brain" : selectedAiOpponent === "fly" ? "Fruit Fly Brain" : selectedAiOpponent === "jev" ? "Jev System One" : "Stockfish 19")
                                  : pvpOpponentName}
                              </span>
                              {!humanToMove && <span className="text-xs text-[var(--primary)] font-black animate-pulse">Sedang Berpikir...</span>}
                            </div>
                            <div className="font-mono font-black text-2xl text-white">
                              {humanSide === "white" ? formattedBlackTime : formattedWhiteTime}
                            </div>
                          </div>

                          {/* Player Live Clock */}
                          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            humanToMove ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-md shadow-[var(--primary)]/20" : "bg-[var(--background)] border-[var(--border)]"
                          }`}>
                            <div>
                              <span className="text-xs font-bold text-neutral-300 block">Anda (Player)</span>
                              {humanToMove && <span className="text-xs text-[var(--primary)] font-black animate-pulse">Giliran Anda Melangkah</span>}
                            </div>
                            <div className="font-mono font-black text-2xl text-white">
                              {humanSide === "white" ? formattedWhiteTime : formattedBlackTime}
                            </div>
                          </div>

                          {/* In-Game Actions — AI mode: action instan lokal
                              (tanpa lawan manusia). S6-T3 (PvP): kontrol
                              Remis/Menyerah/Tinggalkan + konfirmasi + status
                              WS hidup di PvpPanel (panel samping) — TIDAK
                              diduplikat di sini (anti-duplikat, house style). */}
                          {playMode !== "pvp" && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]">
                              <button
                                onClick={() => {
                                  setCustomOutcome({
                                    over: true,
                                    winner: null,
                                    kind: "draw",
                                    label: "Remis — Kesepakatan Bersama",
                                  });
                                  setShowGameOverModal(true);
                                }}
                                className="ctl ctl-sm ctl-quiet"
                              >
                                Remis
                              </button>
                              <button
                                onClick={() => {
                                  setCustomOutcome({
                                    over: true,
                                    winner: humanSide === "white" ? "black" : "white",
                                    kind: "resigned",
                                    label: "Kekalahan — Anda Menyerah",
                                  });
                                  setShowGameOverModal(true);
                                }}
                                className="ctl ctl-sm ctl-danger"
                              >
                                Menyerah
                              </button>
                            </div>
                          )}

                          <button
                            onClick={resetGame}
                            className="w-full py-2.5 rounded-xl text-xs font-bold border border-[var(--primary)]/40 text-emerald-400 hover:text-white hover:bg-[var(--primary)]/20 transition-all bg-[var(--background)] flex items-center justify-center gap-2"
                          >
                            <IconSwap3D size={15} />
                            <span>Reset Permainan</span>
                          </button>
                        
                          {broadcastId && (
                            <button
                              type="button"
                              onClick={copyShareLink}
                              className="w-full py-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-neutral-200 flex items-center justify-center gap-2 transition-all"
                              title="Salin tautan agar orang lain bisa menonton siaran ini"
                            >
                              {copiedShare ? (<><Check size={15} className="text-emerald-400" /><span className="text-emerald-400">Tautan Tersalin!</span></>) : (<><Share2 size={15} /><span>Salin Tautan Siaran</span></>)}
                            </button>
                          )}
                        </div>
                      ) : (
                        /* SETUP — Chess.com Dark Interface */
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">Pilih lawan</div>
                            <div className="flex w-full rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5" role="tablist" aria-label="Jenis lawan">
                              <button
                                type="button"
                                role="tab"
                                aria-selected={playMode === "ai"}
                                onClick={() => setPlayMode("ai")}
                                className={`flex-1 rounded-full py-1 text-xs font-black transition-all ${playMode === "ai" ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"}`}
                              >
                                Lawan Engine AI
                              </button>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={playMode === "pvp"}
                                onClick={() => setPlayMode("pvp")}
                                className={`flex-1 rounded-full py-1 text-xs font-black transition-all ${playMode === "pvp" ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"}`}
                              >
                                Lawan Pemain
                              </button>
                            </div>
                          </div>

                          {/* Format Waktu (Time Control Pills) */}
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                              <span>Format Waktu</span>
                              <span className="text-xs text-[var(--primary)] font-black font-mono">
                                {timeMode === "unlimited" ? "Tanpa Batas" : `${timeMode}`}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                {                                [
                                  { id: "1m", label: "1 mnt", sub: "Peluru", icon: "/icons/chess/time-bullet.png" },
                                  { id: "3m", label: "3 mnt", sub: "Kilat", icon: "/icons/chess/time-blitz.png" },
                                  { id: "5m", label: "5 mnt", sub: "Kilat", icon: "/icons/chess/time-blitz.png" },
                                  { id: "10m", label: "10 mnt", sub: "Cepat", icon: "/icons/chess/time-rapid.png" },
                                  { id: "30m", label: "30 mnt", sub: "Klasik", icon: "/icons/chess/time-classic.png" },
                                  { id: "unlimited", label: "Bebas", sub: "Tanpa Batas", icon: "/icons/chess/time-daily.png" },
                                ].map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setTimeMode(t.id)}
                                  className={`p-1.5 rounded-lg border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                                    timeMode === t.id
                                      ? "bg-[var(--primary-strong)] border-[var(--primary)] text-white shadow-sm ring-1 ring-[var(--primary)]"
                                      : "bg-[var(--background)] border-[var(--border)] text-neutral-400 hover:border-neutral-500 hover:text-white"
                                  }`}
                                >
                                  <img src={t.icon} alt="" className="w-7 h-7 mb-1 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
                                  <div className="text-xs font-black leading-tight text-white">{t.label}</div>
                                  <div className="text-xs text-neutral-400 font-medium">{t.sub}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sisi Bidak (Chess.com 3-Card Visual Selector) */}
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Pilih Sisi Bidak</div>
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                type="button"
                                onClick={() => { setSideChoice("white"); setHumanSide("white"); }}
                                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                  sideChoice === "white"
                                    ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]"
                                    : "bg-[var(--background)] border-[var(--border)] hover:border-neutral-500 text-neutral-400"
                                }`}
                              >
                                <IconKingWhite3D size={22} />
                                <span className="text-xs font-bold text-white">Putih</span>
                                <span className="text-xs text-neutral-400 font-medium">Main Pertama</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSideChoice("random")}
                                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                  sideChoice === "random"
                                    ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]"
                                    : "bg-[var(--background)] border-[var(--border)] hover:border-neutral-500 text-neutral-400"
                                }`}
                              >
                                <IconDice3D size={22} />
                                <span className="text-xs font-bold text-white">Acak</span>
                                <span className="text-xs text-neutral-400 font-medium">Otomatis</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => { setSideChoice("black"); setHumanSide("black"); }}
                                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                  sideChoice === "black"
                                    ? "bg-[var(--primary-strong)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]"
                                    : "bg-[var(--background)] border-[var(--border)] hover:border-neutral-500 text-neutral-400"
                                }`}
                              >
                                <IconKingBlack3D size={22} />
                                <span className="text-xs font-bold text-white">Hitam</span>
                                <span className="text-xs text-neutral-400 font-medium">Main Kedua</span>
                              </button>
                            </div>
                          </div>

                          {/* Pilihan Engine hanya untuk mode AI */}
                          {playMode === "ai" && <div className="space-y-1">
                            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Mode Lawan</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { id: "stockfish", label: "Stockfish 19 NNUE", sub: `Elo ${aiDepth <= 4 ? "800" : aiDepth <= 8 ? "1600" : "3550+"}` },
                                { id: "fly", label: "Fruit Fly Brain", sub: "Elo 3178 (Connectome)" },
                                { id: "jev", label: "Jev System One", sub: "Elo 3127 (Kenari AI)" },
                                { id: "jev-fly", label: "Jev + Fly Brain", sub: "Elo 2536 (Hybrid GAB)" },
                              ].map((eng) => (
                                <button
                                  key={eng.id}
                                  type="button"
                                  onClick={() => { setPlayMode("ai"); setSelectedAiOpponent(eng.id as any); }}
                                  className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    playMode === "ai" && selectedAiOpponent === eng.id
                                      ? "bg-[var(--primary-strong)] border-[var(--primary)] text-white shadow-sm ring-1 ring-[var(--primary)]"
                                      : "bg-[var(--background)] border-[var(--border)] hover:border-neutral-500 text-neutral-400"
                                  }`}
                                >
                                  <span className="text-xs font-bold text-white leading-snug">{eng.label}</span>
                                  <span className="text-xs text-neutral-400">{eng.sub}</span>
                                </button>
                              ))}
                            </div>
                          </div>}

                          {playMode === "pvp" ? (
                            <PvpPanel
                              user={currentUser}
                              room={pvpRoom}
                              yourSide={pvpRoom ? humanSide : null}
                              token={pvpToken}
                              onRoom={onPvpRoom}
                              onLeave={leavePvpRoom}
                            />
                          ) : (
                            <>
                              {/* Tingkat Kesulitan AI (Hanya untuk Stockfish 19) */}
                              {selectedAiOpponent === "stockfish" && (
                                <div className="space-y-1">
                                  <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Kedalaman Stockfish</div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {[
                                      { depth: 3, label: "Mudah", elo: "~800" },
                                      { depth: 8, label: "Sedang", elo: "~1600" },
                                      { depth: 14, label: "Expert", elo: "3550+" },
                                    ].map((lvl) => (
                                      <button
                                        key={lvl.depth}
                                        type="button"
                                        onClick={() => setAiDepth(lvl.depth)}
                                        className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                                          aiDepth === lvl.depth
                                            ? "bg-[var(--primary-strong)] border-[var(--primary)] text-white ring-1 ring-[var(--primary)]"
                                            : "bg-[var(--background)] border-[var(--border)] text-neutral-400 hover:text-white"
                                        }`}
                                      >
                                        <div className="text-xs font-bold text-white">{lvl.label}</div>
                                        <div className="text-xs text-neutral-400">{lvl.elo}</div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* TOGGLES SIARAN LANGSUNG & REKAMAN PERTANDINGAN */}
                              <div className="space-y-2 py-2 border-t border-[var(--border)]">
                                <div className="flex items-center justify-between py-1">
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-white">Siarkan ke Publik</div>
                                    <div className="text-[10px] text-neutral-400">Izinkan orang lain menonton siaran langsung</div>
                                  </div>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isPublicBroadcast}
                                    onClick={() => setIsPublicBroadcast(!isPublicBroadcast)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      isPublicBroadcast ? "bg-emerald-500" : "bg-neutral-700"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        isPublicBroadcast ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between py-1 border-t border-neutral-800">
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-white">Komentator Taktik AI</div>
                                    <div className="text-[10px] text-neutral-400">Penonton siaran melihat analisis taktik per langkah</div>
                                  </div>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={broadcastCommentary}
                                    onClick={() => setBroadcastCommentary(!broadcastCommentary)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      broadcastCommentary ? "bg-emerald-500" : "bg-neutral-700"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        broadcastCommentary ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between py-1 border-t border-neutral-800">
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-white">Simpan Rekaman Pertandingan</div>
                                    <div className="text-[10px] text-neutral-400">Bisa ditonton ulang via tautan share publik saat permainan selesai</div>
                                  </div>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={saveMatchReplay}
                                    onClick={() => setSaveMatchReplay(!saveMatchReplay)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      saveMatchReplay ? "bg-emerald-500" : "bg-neutral-700"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        saveMatchReplay ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>

                              </div>

                              {/* GIANT CHESS.COM GREEN CTA BUTTON */}
                              <button
                                type="button"
                                onClick={() => startGame(sideChoice === "random" ? (Math.random() < 0.5 ? "white" : "black") : sideChoice)}
                                className="w-full h-14 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:translate-y-[2px] text-white font-black text-lg shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer"
                              >
                                <IconPlay3D size={24} />
                                <span>Mulai Permainan</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ENGINE ANALYSIS */}
                  {rightTab === "analysis" && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400">{lang === "id" ? "Kedalaman Kalkulasi:" : "Engine Depth:"}</span>
                        <span className="font-mono text-emerald-400 font-bold">Depth 14+ (Elo 3550)</span>
                      </div>
                      <JevDistribution analysis={analysis} thinking={thinking} />
                    </div>
                  )}

                  {/* TAB 3: MOVES */}
                  {rightTab === "moves" && (
                    <div className="h-full flex flex-col min-h-0 space-y-2">
                      <div className="flex items-center justify-between shrink-0 mb-1">
                        <div className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                          {lang === "id" ? "Notasi Langkah Catur:" : "Chess Notation:"}
                        </div>
                        {moves.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={copyGamePgn}
                              className="px-2 py-0.5 rounded text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-[var(--border)] transition-colors cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                              title="Salin PGN lengkap dengan metadata pertandingan"
                            >
                              {copiedPgn ? (<><Check size={12} className="text-emerald-400" /><span className="text-emerald-400">Tersalin!</span></>) : (<><Copy size={12} /><span>Salin PGN</span></>)}
                            </button>
                            <button
                              type="button"
                              onClick={downloadGamePgn}
                              className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white transition-colors cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                              title="Unduh file .pgn"
                            >
                              <Download size={12} /><span>Unduh .pgn</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-h-0">
                        <MoveList
                          moves={moves}
                          whiteName={
                            humanSide === "white"
                              ? me.name
                              : playMode === "ai"
                                ? selectedAiOpponent === "jev-fly"
                                  ? "Jev + Fly Brain"
                                  : selectedAiOpponent === "fly"
                                    ? "Fruit Fly Brain"
                                    : selectedAiOpponent === "jev"
                                      ? "Jev"
                                      : "Stockfish"
                                : pvpOpponentName
                          }
                          blackName={
                            humanSide === "black"
                              ? me.name
                              : playMode === "ai"
                                ? selectedAiOpponent === "jev-fly"
                                  ? "Jev + Fly Brain"
                                  : selectedAiOpponent === "fly"
                                    ? "Fruit Fly Brain"
                                    : selectedAiOpponent === "jev"
                                      ? "Jev"
                                      : "Stockfish"
                                : pvpOpponentName
                          }
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </>
        )}
      </div>

      {/* S9-T2: notice lama (floating fixed, role=status, auto-dismiss 2,8s)
          digantikan notice persisten inline di atas konten view. */}


            {/* DOCK MODALS (Teman, Pesan, Pemberitahuan, Pengaturan) */}
      <DockModals
        activeModal={activeDockModal}
        onClose={() => setActiveDockModal(null)}
        user={currentUser}
        liveMatches={liveMatchesForDock}
        onWatchLiveMatch={(id) => setSpectateMatchId(id)}
        onChallengePlayer={(uname) => {
          setPlayMode("pvp");
          setNavTab("play");
        }}
        onLogout={logout}
      />
{showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <AuthPanel
            user={currentUser}
            onClose={() => setShowAuthModal(false)}
            onLogin={login}
            onRegister={register}
            onLogout={logout}
            inline={true}
          />
        </div>
      )}

      <GameOverModal
        outcome={effectiveOutcome}
        humanSide={humanSide}
        lang={lang}
        open={showGameOverModal}
        onClose={() => setShowGameOverModal(false)}
        onNewGame={() => startGame(humanSide)}
        onExportPgn={downloadGamePgn}
        onReview={() => {
          setShowGameOverModal(false);
          // S2-T1: idempoten — satu jalur review, view switching bukan route baru.
          setNavTab("review");
        }}
        history={moves.map((m) => m.san)}
        ratingDelta={ratingDelta}
        opponentUsername={playMode === "pvp" ? pvpOpponentName : null}
        gameId={playMode === "pvp" ? pvpRoomCode : null}
        timeControl={pvpRoom?.timeControl ?? null}
        rematchRequest={rematchRequest}
        pendingAccount={currentUser?.status === "pending"}
        onOpenAuth={currentUser ? undefined : () => setShowAuthModal(true)}
      />

      <PromotionDialog
        open={pendingPromotion !== null}
        side={humanSide}
        onCancel={() => setPendingPromotion(null)}
        onPick={(piece) => {
          if (!pendingPromotion) return;
          tryHumanMove(pendingPromotion.from, pendingPromotion.to, piece);
        }}
      />
    </AppShell>
  );
}