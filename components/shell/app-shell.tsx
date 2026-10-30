"use client";

/**
 * components/shell/app-shell.tsx (ticket S4-T1 — Sprint 4)
 * App Shell ala chess.com: skip-link, topbar (search combobox + akun),
 * sidebar fixed 6 grup beraksen warna (V6 — ui-parity-v2) + Lainnya
 * (accordion), mobile bottom nav 5 item + more-sheet. Aksen per grup via
 * token CSS; icon lucide-react; invariant BUG-3 (QA S5):
 * `aria-current="page"` TEPAT 1 — hanya di section button (sidebar) / item
 * bottom-nav / more-sheet, di-gate mounted/isDesktop/accordion. Strip subtab
 * S8 (spec §4) adalah role="tablist" + item role="tab"/aria-selected
 * TANPA aria-current, sehingga tidak menduplikasi indikasi halaman aktif.
 * navTab dikontrol parent (Game) via props — deep-link hash ditangani parent.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayingBadge } from "@/components/playing-badge";
import { readCachedUser } from "@/lib/use-session";
import {
  Home, Swords, Bot, GraduationCap, Puzzle, Dumbbell, Eye, Trophy,
  Users, User, Archive, Shield, Compass, LineChart,
  Library, NotebookText, Target, Presentation, Clock, Flame,
} from "lucide-react";
import {
  IconPlay3D, IconMedal3D, IconScan3D,
  IconFriends3D, IconSearch3D, IconTarget3D, IconShield3D,
  IconClose3D, IconGlobe3D, IconSettings3D, IconMessages3D, IconBell3D,
} from "@/components/icons3d";

export type NavTab =
  | "home" | "play" | "bots" | "coach"
  | "puzzles"
  | "review" | "scan" | "vision" | "drills"
  | "community" | "leaderboard" | "friends" | "archive"
  | "explorer" | "insights" | "tournaments"
  // S7 (design §0.2): layer belajar — Kursus/Pelajaran/Ruang Kelas + Pusat Latihan.
  | "courses" | "learn" | "practice" | "classroom"
  | "admin";

export type ShellUser = {
  id: string;
  username: string;
  isAdmin: boolean;
  elo: number | null;
  // S9-T1 (G0.2): status akun dari session — badge user-chip "Menunggu" saat
  // pending. Additive: consumer lama tetap valid (field opsional).
  status?: "pending" | "approved" | "rejected";
} | null;

type AppShellProps = {
  navTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  user: ShellUser;
  playingCount: number;
  lang: "id" | "en";
  onToggleLang: () => void;
  onOpenAuth: () => void;
  onOpenDock: (modal: "friends" | "messages" | "notifications" | "settings") => void;
  children: React.ReactNode;
};

type Item = { id: NavTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: boolean; accent?: string };
type SubTab = { id: NavTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };
// S8 (docs/design/sprint8-ia.md §1): 21 tab flat → 8 section. Klik section →
// subtab default; strip subtab 44px (role=tablist) HANYA saat section punya
// ≥2 subtab (area konten, sticky di atas main). Section tunggal
// (Beranda/Taktik/Tonton) tanpa strip. Hash lama (#play, #courses, dsb.)
// tetap resolve di parent (game.tsx).
type Section = { title: string; accent: string; icon: React.ComponentType<{ size?: number; className?: string }>; items: SubTab[]; default: NavTab; badge?: boolean };

/**
 * S8: 8 section, label jev-chess (Indo). Aksen per section via token CSS
 * vars V6 (app/globals.css) — bukan hex baru di TSX.
 */
const SECTIONS: Section[] = [
  {
    title: "Beranda",
    icon: Home,
    accent: "var(--nav-accent-play)",
    items: [{ id: "home", label: "Beranda", icon: Home }],
    default: "home",
  },
  {
    title: "Main",
    icon: Swords,
    accent: "var(--nav-accent-play)",
    badge: true,
    items: [
      { id: "play", label: "Main Online", icon: Swords },
      { id: "bots", label: "Lawan Bot", icon: Bot },
      { id: "tournaments", label: "Turnamen", icon: Trophy },
    ],
    default: "play",
  },
  {
    title: "Taktik",
    icon: Puzzle,
    accent: "var(--nav-accent-puzzle)",
    items: [{ id: "puzzles", label: "Teka-Teki", icon: Puzzle }],
    default: "puzzles",
  },
  {
    title: "Analisis",
    icon: IconMedal3D,
    accent: "var(--nav-accent-learn)",
    items: [
      { id: "review", label: "Analisis", icon: IconMedal3D },
      { id: "scan", label: "Scan Papan", icon: IconScan3D },
    ],
    default: "review",
  },
  {
    title: "Latih",
    icon: Dumbbell,
    accent: "var(--nav-accent-drill)",
    items: [
      { id: "explorer", label: "Penjelajah", icon: Compass },
      { id: "insights", label: "Insight", icon: LineChart },
      { id: "practice", label: "Pusat Latihan", icon: Target },
      { id: "drills", label: "Permainan Akhir", icon: Dumbbell },
      { id: "vision", label: "Latihan Penglihatan", icon: Eye },
    ],
    default: "explorer",
  },
  {
    title: "Belajar",
    icon: GraduationCap,
    accent: "var(--nav-accent-learn)",
    items: [
      { id: "courses", label: "Kursus", icon: Library },
      { id: "learn", label: "Pelajaran", icon: NotebookText },
      { id: "classroom", label: "Ruang Kelas", icon: Presentation },
      { id: "coach", label: "Pelatih", icon: GraduationCap },
    ],
    default: "courses",
  },
  {
    title: "Tonton",
    icon: Archive,
    accent: "var(--nav-accent-watch)",
    items: [{ id: "archive", label: "Arsip Partai", icon: Archive }],
    default: "archive",
  },
  {
    title: "Komunitas",
    icon: Users,
    accent: "var(--nav-accent-social)",
    items: [
      { id: "leaderboard", label: "Papan Peringkat", icon: Trophy },
      { id: "friends", label: "Teman", icon: User },
      { id: "community", label: "Komunitas", icon: Users },
    ],
    default: "leaderboard",
  },
];

const OTHER_ITEMS: Item[] = [
  { id: "admin", label: "Admin", icon: IconShield3D },
];

// S8: lookup tab→section (section aktif + strip subtab).
const SECTION_OF_TAB = new Map<NavTab, Section>();
for (const s of SECTIONS) for (const it of s.items) SECTION_OF_TAB.set(it.id, s);

const BOTTOM_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: boolean; accent?: string }[] = [
  { id: "home", label: "Beranda", icon: Home, accent: "var(--nav-accent-play)" },
  { id: "play", label: "Main", icon: Swords, badge: true, accent: "var(--nav-accent-play)" },
  { id: "puzzles", label: "Teka-Teki", icon: Puzzle, accent: "var(--nav-accent-puzzle)" },
  { id: "review", label: "Analisis", icon: IconMedal3D, accent: "var(--nav-accent-learn)" },
  { id: "community", label: "Komunitas", icon: Users, accent: "var(--nav-accent-social)" },
];

const PLAYER_RESULT = { username: "", rating: 0 };

// S9-T1 (G0.2): pill status akun di user-chip shell. Pending = "Menunggu"
// (teks + ikon, bukan warna saja — floor DHH a11y). Approved = tanpa pill
// (titik hijau existing sudah ada); rejected diperlakukan seperti guest
// (S7 design §0.3) — tidak ada status tambahan.
function UserStatusPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-400">
      <Clock size={11} aria-hidden="true" />
      Menunggu
    </span>
  );
}

/**
 * T2: pill streak harian di user-chip (pola retensi chess.com — elemen
 * paling terlihat di seluruh situs). Teks + ikon (DHH floor a11y, bukan
 * warna saja). Hanya dirender saat streak terdefinisi (>=0).
 */
function StreakPill({ streak }: { streak: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-orange-400"
      aria-label={`${streak} hari beruntun`}
    >
      <Flame size={11} aria-hidden="true" />
      {streak}
    </span>
  );
}

/**
 * S9-T1 (G0.2): status akun dari session sungguhan — sumber data sama dgn
 * useSession (cache localStorage `jev_chess_user` + GET /api/auth), tanpa
 * menyentuh game.tsx. Returns "pending"/"approved"/"rejected" | null.
 * Additive: dipakai hanya untuk badge user-chip shell.
 */
function useSessionStatus(): "pending" | "approved" | "rejected" | null {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | null>(() =>
    readCachedUser()?.status ?? null
  );
  useEffect(() => {
    let alive = true;
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const s: unknown = d?.user?.status;
        if (alive && (s === "pending" || s === "approved" || s === "rejected")) setStatus(s);
      })
      .catch(() => {
        /* jaringan gagal — pakai cache */
      });
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

/**
 * T2 (P0, parity chess.com): streak harian di user-chip — data dari
 * /api/home/dashboard (field streakHarian, tanpa tabel baru). Fetch
 * sekali (hydration-gated) HANYA utk user eligible (bukan guest/pending/
 * rejected) agar chip tidak menampilkan angka palsu. Returns null saat
 * tak eligible atau fetch gagal (fallback: chip menampilkan rating saja).
 */
function useDashboardStreak(user: ShellUser): number | null {
  const [streak, setStreak] = useState<number | null>(null);
  const uid = user?.id ?? null;
  const eligible =
    user != null && user.status !== "pending" && user.status !== "rejected";
  useEffect(() => {
    if (!uid || !eligible) return;
    let alive = true;
    fetch("/api/home/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { streakHarian?: unknown } | null) => {
        if (!alive || !d) return;
        setStreak(typeof d.streakHarian === "number" ? d.streakHarian : null);
      })
      .catch(() => {
        /* jaringan gagal — streak tetap null, chip menampilkan rating saja. */
      });
    return () => {
      alive = false;
    };
  }, [uid, eligible]);
  return streak;
}

function usePlayerSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<{ username: string; rating: number }[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/leaderboard?scope=global", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const entries: { username: string; rating: number }[] = data.entries ?? [];
        const q = query.trim().toLowerCase().replace(/^@/, "");
        const filtered = q
          ? entries.filter((e) => e.username.toLowerCase().includes(q))
          : entries.slice(0, 5);
        if (alive) setResults(filtered.slice(0, 5));
      } catch {
        /* jaringan gagal — biarkan hasil kosong */
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, enabled]);
  return results;
}

export function AppShell({ navTab, onNavigate, user, playingCount, lang, onToggleLang, onOpenAuth, onOpenDock, children }: AppShellProps) {
  const [othersOpen, setOthersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [moreOpen, setMoreOpen] = useState(false);
  // BUG-3 (QA S5): bottom-nav mobile disembunyikan via CSS (md:hidden) di desktop,
  // tapi tetap ada di DOM dan membawa aria-current="page". Lacak breakpoint
  // sehingga aria-current hanya diterapkan saat elemen benar-benar visible.
  const [isDesktop, setIsDesktop] = useState(false);
  // BUG-3 (QA S5): SSR merender navTab "home" sementara hydration client memakai
  // hash asli — perbedaan aria-current ini tidak pernah dikoreksi React pasca
  // hydration sehingga atribut stale tertinggal di DOM. Render aria-current hanya
  // setelah mount (render pertama client identik dengan SSR), lalu atribut benar
  // di-set oleh re-render normal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setIsDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const moreSheetRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const results = usePlayerSearch(query, searchOpen);
  // G0.2: status akun riil dari session (cache + GET /api/auth) untuk badge
  // user-chip — sumber data sama dgn useSession, tanpa menyentuh game.tsx.
  const accountStatus = useSessionStatus();
  // Merge: ShellUser.status (jika consumer game.tsx sudah wiring) fallback
  // ke session riil di shell (cache localStorage + GET /api/auth).
  const accountPending = user ? (user.status ?? accountStatus) === "pending" : false;
  // T2 (P0, parity chess.com): streak harian di user-chip (data riil dari
  // /api/home/dashboard, bukan mock). Null utk guest/pending/rejected/gagal.
  const streak = useDashboardStreak(user);

  const pickResult = useCallback((username: string) => {
    setSearchOpen(false);
    setQuery("");
    setHighlight(-1);
    onNavigate("leaderboard");
    void username;
  }, [onNavigate]);

  // S9-T4 (G7.2): navigasi panah bottom-nav — Left/Right antar 6 tombol
  // (5 item + "Lainnya") dengan wrap; fokus tetap di dalam nav.
  const handleNavArrowKeys = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const buttons = Array.from(e.currentTarget.querySelectorAll("button")) as HTMLButtonElement[];
    const active = document.activeElement;
    const idx = buttons.findIndex((b) => b === active);
    if (idx === -1) return;
    e.preventDefault();
    const next = e.key === "ArrowRight"
      ? (idx + 1) % buttons.length
      : (idx - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }, []);

  // S9-T4 (G7.2): navigasi panah grid more-sheet (2 kolom) — Left/Right
  // pindah kolom, Up/Down pindah baris (wrap atas/bawah di dalam grid).
  const handleSheetArrowKeys = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!keys.includes(e.key)) return;
    const grid = active.parentElement as HTMLElement | null;
    if (!grid) return;
    const buttons = Array.from(grid.querySelectorAll("button")) as HTMLButtonElement[];
    const idx = buttons.findIndex((b) => b === active);
    if (idx === -1) return;
    e.preventDefault();
    const cols = 2;
    const col = idx % cols;
    let target: number;
    if (e.key === "ArrowRight") target = Math.min(idx + 1, buttons.length - 1);
    else if (e.key === "ArrowLeft") target = Math.max(idx - 1, 0);
    else if (e.key === "ArrowDown") {
      target = idx + cols;
      if (target >= buttons.length) target = col; // wrap ke baris atas kolom sama
    } else {
      target = idx - cols;
      if (target < 0) target = buttons.length - cols + col; // wrap ke baris bawah
    }
    buttons[target]?.focus();
  }, []);

  // Esc menutup search & more-sheet; fokus kembali ke trigger (a11y §8).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchOpen) {
          setSearchOpen(false);
          searchBoxRef.current?.querySelector("input")?.focus();
        }
        if (moreOpen) {
          setMoreOpen(false);
          moreTriggerRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, moreOpen]);

  // Focus trap sederhana untuk more-sheet (role=dialog aria-modal).
  useEffect(() => {
    if (!moreOpen || !moreSheetRef.current) return;
    const sheet = moreSheetRef.current;
    const focusables = sheet.querySelectorAll<HTMLElement>("button, a, [tabindex]:not([tabindex='-1'])");
    focusables[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    sheet.addEventListener("keydown", onKey);
    return () => sheet.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const itemCls = (active: boolean) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left duration-150 ${
      active
        ? "bg-[var(--primary-strong)]/30 text-[var(--primary)] border-l-[3px] border-[var(--primary)]"
        : "text-neutral-300 hover:bg-[var(--surface)] hover:text-white"
    } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]`;

  // BUG-3 (QA S5): elemen nav yang disembunyikan (accordion "Lainnya" collapsed)
  // tidak boleh membawa aria-current="page" — DOM selector QA menghitung semua
  // [aria-current='page'], dan elemen hidden harus dikecualikan.
  const otherIds = useMemo(() => new Set(OTHER_ITEMS.map((i) => i.id)), []);
  const renderIconBtn = (item: Item, active: boolean) => (
    <button
      key={item.id}
      onClick={() => onNavigate(item.id)}
      aria-current={mounted && active && isDesktop && !(otherIds.has(item.id) && !othersOpen) ? "page" : undefined}
      aria-label={`${item.label}${active ? " (halaman saat ini)" : ""}`}
      title={item.label}
      className={itemCls(active)}
    >
      <span style={item.accent ? { color: item.accent } : undefined} className="flex shrink-0" aria-hidden="true">
        <item.icon size={22} />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <PlayingBadge count={playingCount} />}
      {item.badge && playingCount > 0 && <span className="sr-only">{`${playingCount} permainan aktif`}</span>}
    </button>
  );

  const visibleOthers = OTHER_ITEMS.filter((i) => i.id !== "admin" || user?.isAdmin);
  const otherActive = visibleOthers.some((i) => i.id === navTab);
  // S8: section aktif dari navTab (single source = hash state parent).
  const activeSection = SECTION_OF_TAB.get(navTab);
  // Strip subtab (44px, role=tablist): hanya saat section punya ≥2 subtab
  // (spec §1/§2). Section tunggal (Beranda/Taktik/Tonton) tanpa strip.
  const subtabs = activeSection && activeSection.items.length >= 2 ? activeSection.items : null;

  // S8: more-sheet mobile — item tak terjangkau bottom-nav (5 item + Lainnya),
  // dikelompokkan per section (menu baru, ID tetap navTab lama).
  const moreSheetSections = useMemo(() => {
    const covered = new Set(BOTTOM_ITEMS.map((b) => b.id));
    return SECTIONS.map((s) => ({
      section: s,
      items: s.items.filter((i) => !covered.has(i.id)),
    })).filter((g) => g.items.length > 0);
  }, []);

  return (
    <div className="app-shell flex flex-col md:flex-row h-screen max-h-screen overflow-hidden bg-[var(--background)] text-white select-none">
      {/* Skip-link: elemen fokus-able pertama (a11y §8) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black"
      >
        Lewati ke konten utama
      </a>

      {/* MOBILE TOP BAR */}
      <header className="mobile-safe-top flex md:hidden items-center justify-between px-3.5 pb-2 bg-[var(--card)] border-b border-[var(--border)] shrink-0 z-30 shadow-md">
        <button onClick={() => onNavigate("home")} className="flex items-center gap-2 cursor-pointer" aria-label="Beranda">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow">
            <IconPlay3D size={20} />
          </div>
          <div className="font-black text-sm uppercase leading-tight text-white flex items-center gap-1">
            FIF <span className="text-[var(--primary)]">CHESS</span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleLang()}
            aria-label="Ganti bahasa"
            className="flex items-center gap-1 text-xs font-bold text-neutral-300 bg-[var(--surface)] border border-[var(--border)] px-2 py-1 rounded-md"
          >
            <IconGlobe3D size={13} />
            <span>{lang.toUpperCase()}</span>
          </button>
          <button
            onClick={onOpenAuth}
            className={`relative w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow cursor-pointer ${
              accountPending ? "ring-2 ring-amber-500" : ""
            }`}
            aria-label={user
              ? `Akun @${user.username}${accountPending ? ", status menunggu persetujuan" : ""}${streak != null ? `, ${streak} hari beruntun` : ""}`
              : "Masuk atau daftar"}
          >
            {user ? user.username.slice(0, 2).toUpperCase() : "?"}
            {/* T2: indikator streak di sudut avatar mobile (titik + sr-only). */}
            {streak != null && streak > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center gap-0.5 rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white"
                aria-hidden="true"
              >
                <Flame size={8} />
                {streak}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* DESKTOP SIDEBAR (240px kelas md, hilang di mobile) */}
      <aside className="app-sidebar hidden md:flex md:w-[240px] bg-[var(--card)] border-r border-[var(--border)] flex-col p-3 shrink-0 h-screen overflow-y-auto select-none">
        <button onClick={() => onNavigate("home")} className="flex items-center gap-3 px-2 py-3 mb-4 cursor-pointer" aria-label="Beranda jev-chess">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-strong)] border border-[var(--primary)]/40 flex items-center justify-center shadow-lg">
            <IconPlay3D size={26} />
          </div>
          <div className="text-left">
            <div className="font-black tracking-wider text-sm uppercase leading-tight text-white flex items-center gap-1.5">
              FIF <span className="text-[var(--primary)]">CHESS</span>
            </div>
            <div className="text-xs text-neutral-400 font-semibold tracking-wide">ARENA CATUR TEL-U</div>
          </div>
        </button>

        <nav className="space-y-1 flex-1" aria-label="Navigasi utama">
          {/* S8: 8 section — klik section → subtab default + strip subtab. */}
          {SECTIONS.map((s) => {
            const active = activeSection?.title === s.title;
            return (
              <div key={s.title}>
                {/* S9-T4 (G7.1b): heading semantik sr-only per grup sidebar —
                    orientasi SR; label visual tombol section tetap ada (tanpa
                    duplikat teks di antarmuka). */}
                <h2 className="sr-only">{s.title}</h2>
                <button
                  onClick={() => onNavigate(s.default)}
                  aria-current={mounted && active && isDesktop ? "page" : undefined}
                  aria-label={`${s.title}${active ? " (bagian aktif)" : ""}`}
                  title={s.title}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left duration-150 ${
                    active
                      ? "bg-[var(--primary-strong)]/30 text-[var(--primary)]"
                      : "text-neutral-300 hover:bg-[var(--surface)] hover:text-white"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]`}
                >
                  <span style={{ color: s.accent }} className="flex shrink-0" aria-hidden="true">
                    <s.icon size={22} />
                  </span>
                  <span className="flex-1 truncate">{s.title}</span>
                  {s.badge && active && <PlayingBadge count={playingCount} />}
                </button>
              </div>
            );
          })}

          {/* Lainnya — accordion, default collapsed, admin-only (design §1.1) */}
          <div>
            <button
              onClick={() => setOthersOpen((v) => !v)}
              aria-expanded={othersOpen}
              aria-controls="shell-others"
              aria-current={mounted && otherActive && isDesktop && !othersOpen ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left duration-150 ${
                otherActive ? "text-[var(--primary)]" : "text-neutral-300 hover:bg-[var(--surface)] hover:text-white"
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]`}
            >
              <IconTarget3D size={22} aria-hidden="true" />
              <span className="flex-1">Lainnya</span>
              <span aria-hidden="true" className={`text-xs transition-transform duration-150 ${othersOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            <div id="shell-others" aria-hidden={!othersOpen} className={othersOpen ? "space-y-0.5 mt-0.5" : "hidden"}>
              {/* S9-T4 (G7.1b): heading sr-only untuk grup "Lainnya" (accordion). */}
              <h2 className="sr-only">Menu lainnya</h2>
              {visibleOthers.map((it) => renderIconBtn(it, navTab === it.id))}
            </div>
          </div>
        </nav>

        {/* Bottom sidebar: cari (modal dock), profil, dock utilitas — dipertahankan dari shell lama */}
        <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
          <div className="px-1">
            <input
              type="text"
              placeholder="Cari pemain, taktik..."
              onClick={() => onOpenDock("friends")}
              readOnly
              aria-label="Buka pencarian teman"
              className="w-full px-3 py-1.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-neutral-300 placeholder-neutral-500 hover:border-neutral-400 cursor-pointer transition-all"
            />
          </div>
          <button
            onClick={onOpenAuth}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] cursor-pointer hover:border-[var(--primary)] transition-all shadow-sm text-left"
            aria-label={user
              ? `Profil @${user.username}${accountPending ? ", status menunggu persetujuan" : ""}`
              : "Masuk atau daftar"}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow shrink-0">
              {user ? user.username.slice(0, 2).toUpperCase() : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate text-white flex items-center gap-1.5">
                <span className="truncate">{user ? user.username : "Tamu"}</span>
                {/* G0.2: pill status akun — teks + ikon (tidak warna saja). */}
                {accountPending && <UserStatusPill />}
              </div>
              <div className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] inline-block" aria-hidden="true"></span>
                <span className="truncate">{user ? `${user.elo ?? "-"} rating` : "Masuk untuk rating"}</span>
                {streak != null && <StreakPill streak={streak} />}
              </div>
            </div>
          </button>
          <div className="grid grid-cols-4 gap-1 px-1">
            {([
              { m: "friends", icon: IconFriends3D, label: "Teman" },
              { m: "messages", icon: IconMessages3D, label: "Pesan" },
              { m: "notifications", icon: IconBell3D, label: "Notif" },
              { m: "settings", icon: IconSettings3D, label: "Pengaturan" },
            ] as const).map((d) => (
              <button
                key={d.m}
                type="button"
                onClick={() => onOpenDock(d.m)}
                title={d.label}
                aria-label={d.label}
                className="p-2 rounded-xl bg-[var(--background)] hover:bg-[var(--muted)] border border-[var(--border)] hover:border-neutral-500 text-neutral-300 hover:text-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <d.icon size={18} />
                <span className="text-xs font-bold text-neutral-400">{d.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT WRAP */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* DESKTOP TOPBAR dengan search combobox */}
        <div className="hidden md:flex items-center justify-between gap-4 h-14 px-4 bg-[var(--card)] border-b border-[var(--border)] shrink-0 z-20">
          <div ref={searchBoxRef} className="relative w-full max-w-[420px]" role="combobox" aria-expanded={searchOpen && results.length > 0} aria-haspopup="listbox">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] focus-within:border-[var(--primary)] transition-all">
              <IconSearch3D size={16} aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                  setHighlight(-1);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) => Math.min(h + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter" && results[highlight]) {
                    pickResult(results[highlight].username);
                  }
                }}
                placeholder="Cari pemain atau partai…"
                aria-label="Cari pemain atau partai"
                aria-autocomplete="list"
                aria-controls="shell-search-results"
                className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 outline-none"
              />
            </div>
            {searchOpen && (
              <ul id="shell-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden">
                {results.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-neutral-400" aria-live="polite">
                    {query.trim() ? `Tidak ada hasil untuk "${query.trim()}"` : "Ketik untuk mencari pemain…"}
                  </li>
                ) : (
                  results.map((r, i) => (
                    <li key={r.username} role="option" aria-selected={i === highlight}>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickResult(r.username);
                        }}
                        onMouseEnter={() => setHighlight(i)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${i === highlight ? "bg-[var(--surface)] text-white" : "text-neutral-300"}`}
                      >
                        <span className="font-bold">@{r.username}</span>
                        <span className="text-xs text-neutral-400">{r.rating}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 text-sm font-bold text-neutral-300 hover:text-white"
            aria-label={user
              ? `Akun @${user.username}${accountPending ? ", status menunggu persetujuan" : ""}`
              : "Masuk atau daftar"}
          >
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-xs text-white shadow">
              {user ? user.username.slice(0, 2).toUpperCase() : "?"}
            </span>
            <span>{user ? `@${user.username}` : "Masuk"}</span>
            {/* G0.2: pill status akun — teks + ikon (tidak warna saja). */}
            {accountPending && <UserStatusPill />}
            {/* T2: streak harian (retensi pola chess.com). */}
            {streak != null && <StreakPill streak={streak} />}
          </button>
        </div>

        {/* S8: strip subtab 44px (spec §2/§3) — sticky di atas konten, hanya
            saat section aktif punya ≥2 subtab. Subtab default aktif = navTab
            (dipilih shell via section click); strip ini memilih antar subtab. */}
        {subtabs && (
          <div
            role="tablist"
            aria-label={`Bagian ${activeSection!.title}`}
            className="hidden md:flex items-center gap-1 h-11 shrink-0 px-2 sticky top-0 z-10 bg-[var(--card)]/95 backdrop-blur border-b border-[var(--border)]"
          >
            {subtabs.map((st) => (
              <button
                key={st.id}
                role="tab"
                aria-selected={navTab === st.id}
                onClick={() => onNavigate(st.id)}
                className={`flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-bold transition-all ${
                  navTab === st.id
                    ? "bg-[var(--primary-strong)]/30 text-[var(--primary)]"
                    : "text-neutral-400 hover:bg-[var(--surface)] hover:text-white"
                } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]`}
              >
                <span style={{ color: activeSection!.accent }} aria-hidden="true">
                  <st.icon size={15} />
                </span>
                {st.label}
              </button>
            ))}
          </div>
        )}

        {/* MAIN CONTENT */}
        <main
          id="main-content"
          tabIndex={-1}
          className="app-main flex-1 flex flex-col p-2.5 md:p-5 xl:p-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-5 overflow-hidden h-full max-h-screen w-full min-h-0 focus:outline-none"
        >
          {children}
        </main>      </div>

      {/* MOBILE BOTTOM NAV (5 item + Lainnya) */}
      <nav
        className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 min-h-14 bg-[var(--card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md border-t border-[var(--border)] shadow-2xl"
        aria-label="Navigasi bawah"
        onKeyDown={handleNavArrowKeys}
      >
        <div className="flex justify-around items-center py-1.5 px-0.5 gap-0.5 min-w-full">
          {BOTTOM_ITEMS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              aria-current={mounted && navTab === tab.id && !isDesktop ? "page" : undefined}
              aria-label={`${tab.label}${tab.badge && playingCount > 0 ? `, ${playingCount} permainan aktif` : ""}`}
              className={`relative flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-all min-w-0 flex-1 ${
                navTab === tab.id ? "text-white font-bold" : "text-neutral-400 font-medium hover:text-white"
              }`}
            >
              <div className={`p-1 rounded-lg relative ${navTab === tab.id ? "bg-[var(--muted)] text-white" : ""}`}>
                <span style={tab.accent ? { color: tab.accent } : undefined} className="flex" aria-hidden="true">
                  <tab.icon size={20} />
                </span>
                {tab.badge && <span className="absolute -top-0.5 -right-1"><PlayingBadge count={playingCount} /></span>}
              </div>
              <span className="text-[10px] leading-none">{tab.label}</span>
            </button>
          ))}
          <button
            ref={moreTriggerRef}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-label="Menu Lainnya"
            className="flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg text-neutral-400 font-medium hover:text-white min-w-0 flex-1"
          >
            <div className="p-1 rounded-lg">
              <IconTarget3D size={20} />
            </div>
            <span className="text-[10px] leading-none">Lainnya</span>
          </button>
        </div>
      </nav>

      {/* MORE-SHEET (bottom-sheet mobile) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex items-end bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMoreOpen(false);
              moreTriggerRef.current?.focus();
            }
          }}
        >
          <div
            ref={moreSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu Lainnya"
            className="w-full max-h-[60vh] rounded-t-2xl bg-[var(--card)] border-t border-[var(--border)] shadow-2xl overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            <div className="sticky top-0 bg-[var(--card)] px-4 pt-3 pb-2 flex items-center justify-between border-b border-[var(--border)]">
              <div className="w-10 h-1 rounded-full bg-[var(--muted)] absolute left-1/2 -translate-x-1/2 top-1.5" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase tracking-wide text-white">Menu Lainnya</h2>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  moreTriggerRef.current?.focus();
                }}
                aria-label="Tutup menu"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[var(--surface)]"
              >
                <IconClose3D size={18} />
              </button>
            </div>
            <div className="p-3 space-y-3" onKeyDown={handleSheetArrowKeys}>
              {moreSheetSections.map(({ section, items }) => (
                <div key={section.title}>
                  {/* S9-T4 (G7.1b): label grup → heading h3 visual (tanpa
                      duplikat teks; hierarki h2 "Menu Lainnya" → h3). */}
                  <h3 className="px-1 pb-1 text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: section.accent }} aria-hidden="true" />
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-1">
                    {items.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => {
                          setMoreOpen(false);
                          moreTriggerRef.current?.focus();
                          onNavigate(it.id);
                        }}
                        aria-current={mounted && navTab === it.id && !isDesktop ? "page" : undefined}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${
                          navTab === it.id ? "bg-[var(--primary-strong)]/30 text-[var(--primary)]" : "text-neutral-300 hover:bg-[var(--surface)] hover:text-white"
                        }`}
                      >
                        <it.icon size={20} aria-hidden="true" />
                        <span className="truncate">{it.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {visibleOthers.length > 0 && (
                <div>
                  <h3 className="px-1 pb-1 text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--nav-accent-drill)" }} aria-hidden="true" />
                    Lainnya
                  </h3>
                  <div className="grid grid-cols-2 gap-1">
                    {visibleOthers.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => {
                          setMoreOpen(false);
                          moreTriggerRef.current?.focus();
                          onNavigate(it.id);
                        }}
                        aria-current={mounted && navTab === it.id && !isDesktop ? "page" : undefined}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${
                          navTab === it.id ? "bg-[var(--primary-strong)]/30 text-[var(--primary)]" : "text-neutral-300 hover:bg-[var(--surface)] hover:text-white"
                        }`}
                      >
                        <it.icon size={20} aria-hidden="true" />
                        <span className="truncate">{it.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
