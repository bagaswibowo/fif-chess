"use client";

/**
 * components/shell/app-shell.tsx (ticket S4-T1 — Sprint 4)
 * App Shell ala chess.com: skip-link, topbar (search combobox + akun),
 * sidebar fixed 6 grup beraksen warna (V6 — ui-parity-v2) + Lainnya
 * (accordion), mobile bottom nav 5 item + more-sheet. Aksen per grup via
 * token CSS; icon lucide-react; aria-current tetap TEPAT 1 (regression
 * BUG-3 — dijaga via mounted/isDesktop/accordion gating).
 * navTab dikontrol parent (Game) via props — deep-link hash ditangani parent.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayingBadge } from "@/components/playing-badge";
import {
  Home, Swords, Bot, GraduationCap, Puzzle, Dumbbell, Eye, Trophy,
  Users, User, Archive, Shield, LayoutGrid,
} from "lucide-react";
import {
  IconPlay3D, IconBot3D, IconCoach3D, IconPuzzle3D, IconLightning3D,
  IconMedal3D, IconScan3D, IconVision3D, IconCommunity3D, IconTrophy3D,
  IconFriends3D, IconSearch3D, IconTarget3D, IconHistory3D, IconShield3D,
  IconClose3D, IconGlobe3D, IconSettings3D, IconMessages3D, IconBell3D,
} from "@/components/icons3d";

export type NavTab =
  | "home" | "play" | "bots" | "coach"
  | "puzzles"
  | "review" | "scan" | "vision" | "drills"
  | "community" | "leaderboard" | "friends" | "archive"
  | "admin";

export type ShellUser = { id: string; username: string; isAdmin: boolean; elo: number | null } | null;

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
type Group = { title: string; accent: string; items: Item[] };

/**
 * V6: 6 grup ala pola chess.com, label jev-chess sendiri. Aksen per grup
 * via token CSS vars (didefinisikan di app/globals.css section V6) —
 * bukan aset eksternal. Icon lucide-react.
 */

const GROUPS: Group[] = [
  {
    title: "Main",
    accent: "var(--nav-accent-play)",
    items: [
      { id: "home", label: "Beranda", icon: Home, accent: "var(--nav-accent-play)" },
      { id: "play", label: "Main Online", icon: Swords, badge: true, accent: "var(--nav-accent-play)" },
      { id: "bots", label: "Lawan Bot", icon: Bot, accent: "var(--nav-accent-play)" },
    ],
  },
  {
    title: "Teka-Teki",
    accent: "var(--nav-accent-puzzle)",
    items: [
      { id: "puzzles", label: "Teka-Teki", icon: Puzzle, accent: "var(--nav-accent-puzzle)" },
    ],
  },
  {
    title: "Latihan",
    accent: "var(--nav-accent-drill)",
    items: [
      { id: "drills", label: "Permainan Akhir", icon: Dumbbell, accent: "var(--nav-accent-drill)" },
      { id: "vision", label: "Latihan Penglihatan", icon: Eye, accent: "var(--nav-accent-drill)" },
    ],
  },
  {
    title: "Belajar",
    accent: "var(--nav-accent-learn)",
    items: [
      { id: "coach", label: "Pelatih", icon: GraduationCap, accent: "var(--nav-accent-learn)" },
      { id: "review", label: "Analisis", icon: IconMedal3D, accent: "var(--nav-accent-learn)" },
      { id: "scan", label: "Scan Papan", icon: IconScan3D, accent: "var(--nav-accent-learn)" },
    ],
  },
  {
    title: "Sosial",
    accent: "var(--nav-accent-social)",
    items: [
      { id: "community", label: "Komunitas", icon: Users, accent: "var(--nav-accent-social)" },
      { id: "leaderboard", label: "Papan Peringkat", icon: Trophy, accent: "var(--nav-accent-social)" },
      { id: "friends", label: "Teman", icon: User, accent: "var(--nav-accent-social)" },
    ],
  },
  {
    title: "Tonton",
    accent: "var(--nav-accent-watch)",
    items: [
      { id: "archive", label: "Arsip Partai", icon: Archive, accent: "var(--nav-accent-watch)" },
    ],
  },
];

const OTHER_ITEMS: Item[] = [
  { id: "admin", label: "Admin", icon: IconShield3D },
];

const BOTTOM_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: boolean; accent?: string }[] = [
  { id: "home", label: "Home", icon: Home, accent: "var(--nav-accent-play)" },
  { id: "play", label: "Main", icon: Swords, badge: true, accent: "var(--nav-accent-play)" },
  { id: "puzzles", label: "Teka-Teki", icon: Puzzle, accent: "var(--nav-accent-puzzle)" },
  { id: "review", label: "Analisis", icon: IconMedal3D, accent: "var(--nav-accent-learn)" },
  { id: "community", label: "Komunitas", icon: Users, accent: "var(--nav-accent-social)" },
];

const PLAYER_RESULT = { username: "", rating: 0 };

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

  const pickResult = useCallback((username: string) => {
    setSearchOpen(false);
    setQuery("");
    setHighlight(-1);
    onNavigate("leaderboard");
    void username;
  }, [onNavigate]);

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

  const moreSheetItems: { id: NavTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: boolean }[] = [
    { id: "scan", label: "Scan Papan", icon: IconScan3D },
    { id: "vision", label: "Materi Belajar", icon: IconVision3D },
    { id: "drills", label: "Permainan Akhir", icon: IconShield3D },
    { id: "bots", label: "Lawan Bot", icon: IconBot3D },
    { id: "coach", label: "Pelatih", icon: IconCoach3D },
    { id: "leaderboard", label: "Papan Peringkat", icon: IconTrophy3D },
    { id: "friends", label: "Teman", icon: IconFriends3D },
    { id: "archive", label: "Arsip", icon: IconHistory3D },
    ...visibleOthers,
  ];

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
            className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow cursor-pointer"
            aria-label={user ? `Akun @${user.username}` : "Masuk atau daftar"}
          >
            {user ? user.username.slice(0, 2).toUpperCase() : "?"}
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
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-2" data-nav-group={g.title}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: g.accent }} aria-hidden="true" />
                {g.title}
              </div>
              <div className="space-y-0.5">{g.items.map((it) => renderIconBtn(it, navTab === it.id))}</div>
            </div>
          ))}

          {/* Lainnya — accordion, default collapsed (design §1.1) */}
          <div>
            <button
              onClick={() => setOthersOpen((v) => !v)}
              aria-expanded={othersOpen}
              aria-controls="shell-others"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left duration-150 ${
                otherActive ? "text-[var(--primary)]" : "text-neutral-300 hover:bg-[var(--surface)] hover:text-white"
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]`}
            >
              <IconTarget3D size={22} aria-hidden="true" />
              <span className="flex-1">Lainnya</span>
              <span aria-hidden="true" className={`text-xs transition-transform duration-150 ${othersOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            <div id="shell-others" aria-hidden={!othersOpen} className={othersOpen ? "space-y-0.5 mt-0.5" : "hidden"}>
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
            aria-label={user ? `Profil @${user.username}` : "Masuk atau daftar"}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold flex items-center justify-center text-xs text-white shadow shrink-0">
              {user ? user.username.slice(0, 2).toUpperCase() : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate text-white">{user ? user.username : "Tamu"}</div>
              <div className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] inline-block" aria-hidden="true"></span>
                <span className="truncate">{user ? `${user.elo ?? "-"} rating` : "Masuk untuk rating"}</span>
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
            aria-label={user ? `Akun @${user.username}` : "Masuk atau daftar"}
          >
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-xs text-white shadow">
              {user ? user.username.slice(0, 2).toUpperCase() : "?"}
            </span>
            <span>{user ? `@${user.username}` : "Masuk"}</span>
          </button>
        </div>

        {/* MAIN CONTENT */}
        <main
          id="main-content"
          tabIndex={-1}
          className="app-main flex-1 flex flex-col p-2.5 md:p-5 xl:p-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-5 overflow-y-auto md:overflow-hidden h-full max-h-screen w-full min-h-0 focus:outline-none"
        >
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAV (5 item + Lainnya) */}
      <nav
        className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 min-h-14 bg-[var(--card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md border-t border-[var(--border)] shadow-2xl"
        aria-label="Navigasi bawah"
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
            <div className="grid grid-cols-2 gap-1 p-3">
              {moreSheetItems.map((it) => (
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
                  {it.badge && <PlayingBadge count={playingCount} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
