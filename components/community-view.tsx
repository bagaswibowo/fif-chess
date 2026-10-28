"use client";

export type { ForumCategory, ForumPost, ForumThread } from "./community/types";

import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import type { SessionUser } from "@/lib/use-session";
import { useGameHistory, type GameRecord } from "@/lib/game-history";
import {
  IconCommunity3D,
  IconMessages3D,
  IconPin3D,
  IconFire3D,
  IconPencil3D,
  IconSearch3D,
  IconQuote3D,
  IconHistory3D,
  IconClose3D,
  IconThumbsUp3D,
  IconTrash3D,
} from "@/components/icons3d";

import { ForumCategory, ForumPost, ForumThread } from "./community/types";
import { FormattedPostContent } from "./community/formatted-post-content";
import { RichTextToolbar } from "./community/rich-text-toolbar";
import { GameAttachmentModal } from "./community/game-attachment-modal";
import { EmbeddedMatchPlayer } from "./community/embedded-match-player";

type Props = {
  user: SessionUser | null;
  lang?: "id" | "en";
};

export function CommunityView({ user, lang = "id" }: Props) {
  const { history: gameHistory } = useGameHistory();
  const [viewMode, setViewMode] = useState<"index" | "thread">("index");
  const [activeThreadId, setActiveThreadId] = useState<string>("t1");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);

  // New Topic Form State
  const [newTopicCategory, setNewTopicCategory] = useState("general");
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicContent, setNewTopicContent] = useState("");
  const [selectedGamesForNewTopic, setSelectedGamesForNewTopic] = useState<GameRecord[]>([]);
  const [showGamePickerInNewTopic, setShowGamePickerInNewTopic] = useState(false);
  const newTopicTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reply Form State
  const [replyText, setReplyText] = useState("");
  const [selectedGamesForReply, setSelectedGamesForReply] = useState<GameRecord[]>([]);
  const [showGameImportPicker, setShowGameImportPicker] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  // Threads Data
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const categories: ForumCategory[] = useMemo(() => [
    { id: "general", name: "Diskusi Umum Catur", description: "Opini catur, perdebatan menarik, dan topik santai", threadsCount: threads.filter((t) => t.categoryId === "general").length },
    { id: "telu", name: "Komunitas Tel-U / FIF CHESS", description: "Pengumuman kampus, turnamen civitas, dan jadwal latihan UKM", threadsCount: threads.filter((t) => t.categoryId === "telu").length },
    { id: "analysis", name: "Analisis Permainan & Taktik", description: "Bagikan partai brilian, evaluasi engine, dan koleksi blunder", threadsCount: threads.filter((t) => t.categoryId === "analysis").length },
    { id: "beginner", name: "Untuk Pemula & Latihan", description: "Tanya jawab pemula, trik garpu kuda, dan panduan taktik dasar", threadsCount: threads.filter((t) => t.categoryId === "beginner").length },
  ], [threads]);

  useEffect(() => {
    fetch("/api/community")
      .then(res => res.json())
      .then(data => {
        if (data.threads) setThreads(data.threads);
        setIsLoading(false);
      });
  }, []);

  /*
    {
      id: "t1",
      categoryId: "general",
      categoryName: "Diskusi Umum Catur",
      title: "What's your biggest chess HOT TAKE",
      authorUsername: "smiley_face10",
      authorName: "Smiley Face",
      authorTitle: "PRO PLAYER",
      avatarInitials: "SF",
      repliesCount: 42,
      lastActivity: "2 mnt lalu",
      isHot: true,
      posts: [
        {
          id: "p1",
          postNumber: 1,
          authorUsername: "smiley_face10",
          authorName: "Smiley Face",
          authorTitle: "PRO PLAYER",
          authorRole: "Civitas Catur Tel-U",
          avatarInitials: "SF",
          content: "Tell me your chess hot takes. Mine is that chess is partially a luck based game. Hear me out: you cannot see thirty moves into the future. There are positions where making the best human move opens an emergent tactical dynamic twenty moves later that neither side could completely compute. What are your biggest hot takes?",
          likes: 24,
          createdAt: "2 jam lalu",
        },
        {
          id: "p2",
          postNumber: 2,
          authorUsername: "admin_komunitas",
          authorName: "Admin Komunitas",
          authorTitle: "ADMIN KOMUNITAS",
          authorRole: "Dosen Tel-U & Admin",
          avatarInitials: "BW",
          content: "Hot take yang sangat menarik! Dari perspektif teori komputasi dan pohon pencarian Minimax/Stockfish, kompleksitas posisi catur memang memiliki branching factor ~35 per ply. Namun itulah mengapa penguasaan pola (heuristik) dan manajemen risiko waktu (time control) menjadi pembeda antara Master dan Grandmaster.",
          likes: 38,
          createdAt: "1 jam lalu",
        },
      ],
    },
    {
      id: "t2",
      categoryId: "analysis",
      categoryName: "Analisis Permainan & Taktik",
      title: "Evaluasi Endgame: Blunder Benteng d7 vs Sayap Raja Putih",
      authorUsername: "grandmaster_telu",
      authorName: "Bagas Wibowo",
      authorTitle: "DOSEN & AUTHOR",
      avatarInitials: "BW",
      repliesCount: 18,
      lastActivity: "15 mnt lalu",
      isPinned: true,
      attachedGameSummary: {
        opponent: "Stockfish 19 NNUE",
        outcome: "win",
        movesCount: 38,
        playedAs: "white",
      },
      posts: [
        {
          id: "p201",
          postNumber: 1,
          authorUsername: "grandmaster_telu",
          authorName: "Bagas Wibowo",
          authorTitle: "DOSEN & AUTHOR",
          authorRole: "KK SEAL Tel-U",
          avatarInitials: "BW",
          content: "Berikut analisis taktis partai endgame terbaru. Hitam mencoba bertahan dengan Benteng di d7, namun terobosan pion b6 membuka jalan bagi Menteri putih untuk melancarkan serangan skakmat mutlak.",
          likes: 56,
          createdAt: "3 jam lalu",
          attachedGame: {
            id: "game-demo-1",
            playedAt: Date.now(),
            opponent: "Stockfish 19 NNUE",
            humanSide: "white",
            outcomeKind: "win",
            winner: "white",
            mode: "ai",
            timeMode: "10 mnt",
            moves: [
              "d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O",
              "Be2", "e5", "O-O", "Nc6", "d5", "Ne7", "b4", "Nh5", "Re1", "f5",
              "Ng5", "Nf6", "Bf3", "c6", "b5", "cxd5", "cxd5", "h6", "Ne6", "Bxe6",
              "dxe6", "fxe4", "Nxe4", "Nxe4", "Bxe4", "d5", "Bc2", "Qb6", "Qe2", "Qxe6",
              "Ba3", "Rfd8", "Rad1", "Kh8", "Bb3", "Rd7", "b6", "axb6", "Bxe7", "Qxe7",
              "Rxd5", "Rxd5", "Bxd5", "Rd8", "Qe4", "Qd6", "Bxb7", "Qd2", "Rf1", "Kh7",
              "Qc6", "Rd6", "Qc8", "Qxa2", "Be4", "Qe6", "Qf8", "Rd7", "Rc1", "Qf7",
              "Qa8", "Ra7", "Qc6", "Ra2", "Qxb6", "Rd2", "Rc6", "Qd7", "Bxg6+", "Kh8",
              "Rc8+", "Qxc8", "Qf6#",
            ],
          },
        },
      ],
    },
  */

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) || threads[0];
  }, [threads, activeThreadId]);

  const handleQuotePost = (post: ForumPost) => {
    const snippet = post.content.length > 140 ? `${post.content.slice(0, 140)}...` : post.content;
    const quoteText = `> @${post.authorUsername} (#${post.postNumber}): "${snippet}"\n\n`;
    setReplyText((prev) => quoteText + prev);
    replyInputRef.current?.focus();
    replyInputRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmitReply = async () => {
    if (!user) {
      alert("Harap masuk atau daftarkan akun terlebih dahulu untuk membalas diskusi komunitas.");
      return;
    }
    if (!replyText.trim() && selectedGamesForReply.length === 0) return;
    if (!activeThread) return;

    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reply",
        threadId: activeThread.id,
        post: {
          content: replyText,
          attachedGames: selectedGamesForReply.length > 0 ? selectedGamesForReply : undefined,
        },
      }),
    }).then((r) => r.json());

    if (res.threads) {
      setThreads(res.threads);
    } else if (res.error) {
      alert(res.error);
      return;
    }

    setReplyText("");
    setSelectedGamesForReply([]);
  };

  const handleCreateTopic = async () => {
    if (!user) {
      alert("Harap masuk atau daftarkan akun terlebih dahulu untuk membuat topik diskusi baru.");
      return;
    }
    if (!newTopicTitle.trim() || !newTopicContent.trim()) return;

    const cat = categories.find((c) => c.id === newTopicCategory) || categories[0];

    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_thread",
        thread: {
          categoryId: cat.id,
          categoryName: cat.name,
          title: newTopicTitle,
          posts: [
            {
              content: newTopicContent,
              attachedGames: selectedGamesForNewTopic.length > 0 ? selectedGamesForNewTopic : undefined,
            },
          ],
        },
      }),
    }).then((r) => r.json());

    if (res.threads) {
      setThreads(res.threads);
      if (res.threads.length > 0) {
        setActiveThreadId(res.threads[0].id);
      }
    } else if (res.error) {
      alert(res.error);
      return;
    }

    setViewMode("thread");
    setShowNewTopicModal(false);
    setNewTopicTitle("");
    setNewTopicContent("");
    setSelectedGamesForNewTopic([]);
  };

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const matchCat = filterCategory === "all" || t.categoryId === filterCategory;
      const matchQ =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.posts.some((p) => p.content.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQ;
    });
  }, [threads, filterCategory, searchQuery]);

  return (
    <div className="view-root w-full max-w-6xl mx-auto">
      {/* Head tunggal (S8 Pola B) — 44px: judul + filter/pill + aksi; tetap terpasang di semua mode agar tidak layout shift */}
      <div className="view-head flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <IconCommunity3D size={18} />
          <h2 className="text-sm font-black text-white m-0 truncate">
            Komunitas &amp; Forum Catur FIF Tel-U
          </h2>
        </div>

        {viewMode === "index" && (
          <>
            <div className="relative flex-1 min-w-[150px] max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari topik diskusi atau username..."
                aria-label="Cari topik diskusi"
                className="w-full p-1.5 pl-7 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-white focus:outline-none focus:border-[var(--nav-accent-social)]"
              />
              <div className="absolute left-2 top-2 pointer-events-none opacity-60">
                <IconSearch3D size={13} />
              </div>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto min-w-0 text-xs shrink-0" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setFilterCategory("all")}
                className={`ctl ctl-xs shrink-0 ${filterCategory === "all" ? "ctl-active ring-1 ring-[var(--nav-accent-social)] font-bold" : "ctl-quiet"}`}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilterCategory(c.id)}
                  className={`ctl ctl-xs shrink-0 ${filterCategory === c.id ? "ctl-active ring-1 ring-[var(--nav-accent-social)] font-bold" : "ctl-quiet"}`}
                >
                  {c.name} ({c.threadsCount})
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {viewMode === "thread" && activeThread && (
            <button
              onClick={() => setViewMode("index")}
              className="ctl ctl-xs ctl-quiet flex items-center gap-1"
            >
              <span className="flex items-center gap-1.5"><ArrowLeft size={14} className="shrink-0" /><span>Kembali</span></span>
            </button>
          )}

          <button
            onClick={() => setShowNewTopicModal(true)}
            className="ctl ctl-xs ctl-primary font-bold flex items-center gap-1.5"
          >
            <IconPencil3D size={13} />
            <span>Buat Topik Baru</span>
          </button>
        </div>
      </div>

      {/* MODAL BUAT TOPIK BARU DENGAN RICH TEXT & IMPORT PARTAI */}
      {showNewTopicModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <div className="panel p-4 stack max-w-2xl w-full max-h-[92vh] overflow-y-auto relative" style={{ background: "var(--card)" }}>
            <div className="row-between pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                <IconPencil3D size={16} /> Buat Topik Diskusi Catur Baru
              </span>
              <button className="ctl ctl-sm ctl-quiet" onClick={() => setShowNewTopicModal(false)}>
                <IconClose3D size={14} />
              </button>
            </div>

            <div className="stack-tight text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="label font-bold text-sm" htmlFor="new-topic-category">Kategori Forum:</label>
                  <select
                    id="new-topic-category"
                    aria-label="Kategori forum"
                    value={newTopicCategory}
                    onChange={(e) => setNewTopicCategory(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-white focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label font-bold text-sm" htmlFor="new-topic-title">Judul Topik:</label>
                  <input
                    id="new-topic-title"
                    aria-label="Judul topik diskusi"
                    type="text"
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    placeholder="Contoh: Analisis Pembukaan Sisilia Najdorf..."
                    className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-white focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              <label className="label font-bold text-sm mt-1" htmlFor="new-topic-content">Isi Diskusi (Rich Text Editor):</label>
              
              {/* Full Rich Text Editor */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <RichTextToolbar
                  textareaRef={newTopicTextareaRef}
                  value={newTopicContent}
                  onChange={setNewTopicContent}
                  onAttachGame={() => setShowGamePickerInNewTopic(!showGamePickerInNewTopic)}
                  attachedGamesCount={selectedGamesForNewTopic.length}
                />
                <textarea
                  ref={newTopicTextareaRef}
                  id="new-topic-content"
                  aria-label="Isi diskusi"
                  value={newTopicContent}
                  onChange={(e) => setNewTopicContent(e.target.value)}
                  rows={6}
                  placeholder="Tulis opini, penjelasan taktis, atau paste notasi PGN di sini..."
                  className="w-full p-2.5 bg-[var(--surface)] text-sm text-white font-sans focus:outline-none resize-y"
                />
              </div>

              {/* Game Attachment Picker Modal & Attached Games Chips */}
              <GameAttachmentModal
                isOpen={showGamePickerInNewTopic}
                onClose={() => setShowGamePickerInNewTopic(false)}
                games={gameHistory}
                selectedGames={selectedGamesForNewTopic}
                onConfirm={(chosen) => setSelectedGamesForNewTopic(chosen)}
              />

              {selectedGamesForNewTopic.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--primary)] stack-tight text-sm">
                  <div className="row-between pb-1 border-b border-[var(--border)]">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <IconHistory3D size={14} /> Permainan Terlampir ({selectedGamesForNewTopic.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowGamePickerInNewTopic(true)}
                      className="text-sm text-[var(--primary)] font-bold hover:underline"
                    >
                      + Ubah / Tambah Permainan
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedGamesForNewTopic.map((g) => (
                      <div
                        key={g.id}
                        className="px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center gap-2 text-sm"
                      >
                        <span className="font-bold text-white">vs {g.opponent}</span>
                        <span className="text-sm text-[var(--muted-foreground)]">
                          ({g.humanSide === "white" ? "Putih" : "Hitam"} · {g.outcomeKind})
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedGamesForNewTopic((prev) => prev.filter((item) => item.id !== g.id))}
                          className="text-[var(--destructive)] font-bold hover:scale-110 transition-transform p-0.5"
                          title="Hapus lampiran ini"
                        >
                          <IconClose3D size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="row justify-end gap-2 pt-2.5" style={{ borderTop: "1px solid var(--border)" }}>
              <button className="ctl ctl-sm ctl-quiet" onClick={() => setShowNewTopicModal(false)}>
                Batal
              </button>
              <button
                onClick={handleCreateTopic}
                disabled={!newTopicTitle.trim() || !newTopicContent.trim()}
                className="ctl ctl-sm ctl-primary font-bold flex items-center gap-1"
              >
                <IconPencil3D size={13} />
                <span>Terbitkan Tulisan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: INDEX TOPIK FORUM (S8 Pola B — filter di head global, list scroll internal) */}
      {viewMode === "index" && (
        <div className="view-body" style={{ scrollbarWidth: "thin" }}>
          {filteredThreads.length === 0 ? (
              <p className="text-sm text-neutral-400 py-6 text-center" role="status">
                {isLoading ? "Memuat topik…" : "Tidak ada topik untuk filter ini."}
              </p>
            ) : (
              <div className="stack-tight">
                {filteredThreads.map((th) => (
                  <div
                    key={th.id}
                    onClick={() => {
                      setActiveThreadId(th.id);
                      setViewMode("thread");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveThreadId(th.id);
                        setViewMode("thread");
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Buka diskusi ${th.title}`}
                    className="panel p-2.5 rounded-xl hover:border-[var(--nav-accent-social)] transition-all cursor-pointer stack-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                    style={{ background: "var(--card)" }}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {th.isPinned && <IconPin3D size={13} />}
                        {th.isHot && <IconFire3D size={13} />}
                        <h3 className="font-bold text-sm text-white hover:text-[var(--nav-accent-social)] truncate m-0">
                          {th.title}
                        </h3>
                      </div>
                      <span className="ctl ctl-xs shrink-0" style={{ background: "var(--surface)" }}>
                        {th.categoryName}
                      </span>
                    </div>

                    <p className="prose-note text-xs text-neutral-300 line-clamp-1 m-0">
                      {th.posts[0]?.content}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-xs text-[var(--muted-foreground)]" style={{ borderTop: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-white">@{th.authorUsername}</span>
                        <span>·</span>
                        <span>{th.lastActivity}</span>
                        {th.attachedGameSummary && (
                          <span className="text-[var(--nav-accent-social)] font-bold truncate">
                            · [Partai vs {th.attachedGameSummary.opponent}]
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 font-bold text-white shrink-0">
                        <IconMessages3D size={12} />
                        <span>{th.repliesCount} Balasan</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* VIEW 2: THREAD DETAIL & REPLIES (S8 Pola C — konten .view-body + sidebar meta) */}
      {viewMode === "thread" && activeThread && (
        <div className="view-cols flex-1 min-h-0">
          {/* Kolom utama: judul + posts + form balasan (scroll internal) */}
          <div className="view-body flex flex-col gap-2 min-h-0" style={{ scrollbarWidth: "thin" }}>
            <div className="panel p-3 rounded-xl shrink-0" style={{ background: "var(--card)" }}>
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="ctl ctl-xs font-bold" style={{ borderColor: "var(--nav-accent-social)", color: "var(--nav-accent-social)" }}>
                  {activeThread.categoryName}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  Aktivitas: {activeThread.lastActivity}
                </span>
              </div>
              <h1 className="text-sm font-black text-white m-0 mt-1">
                {activeThread.title}
              </h1>
            </div>

            {/* Posts List */}
            <div className="flex flex-col gap-2">
              {activeThread.posts.map((post) => (
                <div key={post.id} className="panel p-3 rounded-xl stack-tight" style={{ background: "var(--card)" }}>
                  <div className="flex items-center justify-between pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[var(--nav-accent-social)]/20 border border-[var(--nav-accent-social)] text-[var(--nav-accent-social)] font-bold flex items-center justify-center text-sm">
                        {post.avatarInitials}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-white">@{post.authorUsername}</span>
                        <span className="text-sm text-[var(--muted-foreground)] ml-1.5">{post.createdAt}</span>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-[var(--muted-foreground)]">#{post.postNumber}</span>
                  </div>

                  <FormattedPostContent text={post.content} />

                  {post.attachedGames && post.attachedGames.length > 0 ? (
                    <div className="space-y-3 mt-2">
                      {post.attachedGames.map((g, idx) => (
                        <EmbeddedMatchPlayer key={g.id || idx} game={g} authorUsername={post.authorUsername} />
                      ))}
                    </div>
                  ) : post.attachedGame ? (
                    <EmbeddedMatchPlayer game={post.attachedGame} authorUsername={post.authorUsername} />
                  ) : null}

                  <div className="flex items-center justify-between pt-1.5 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/community", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "like", threadId: activeThread.id, postId: post.id }),
                        }).then(r => r.json());
                        if (res.threads) setThreads(res.threads);
                      }}
                      className="ctl ctl-xs flex items-center gap-1 font-bold"
                    >
                      <IconThumbsUp3D size={14} />
                      <span>{post.likes} Suka</span>
                    </button>


                    <button
                      onClick={() => handleQuotePost(post)}
                      className="ctl ctl-xs ctl-quiet flex items-center gap-1 font-bold"
                    >
                      <IconQuote3D size={14} />
                      <span>Kutip Balas</span>
                    </button>

                    {user?.username === post.authorUsername && (
                      <button
                        onClick={async () => {
                          if (confirm("Yakin ingin menghapus kiriman ini?")) {
                            const res = await fetch("/api/community", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "delete_post", threadId: activeThread.id, postId: post.id }),
                            }).then(r => r.json());
                            if (res.threads) {
                               if (!res.threads.find((t: any) => t.id === activeThread.id)) {
                                 setViewMode("index");
                               }
                               setThreads(res.threads);
                            } else if (res.error) {
                               setThreads([]);
                               alert(res.error);
                            }
                          }
                        }}
                        className="ctl ctl-xs flex items-center gap-1 font-bold text-[var(--destructive)] hover:bg-[var(--destructive)] hover:text-white"
                      >
                        <IconTrash3D size={14} />
                        <span>Hapus</span>
                      </button>
                    )}

                  </div>
                </div>
              ))}
            </div>

            {/* REPLY FORM */}
            <div className="panel p-3 rounded-xl shrink-0" style={{ background: "var(--surface)" }}>
              <span className="label font-bold text-sm">Balas Diskusi:</span>

              {/* Game Attachment Modal & Attached Games in Reply */}
              <GameAttachmentModal
                isOpen={showGameImportPicker}
                onClose={() => setShowGameImportPicker(false)}
                games={gameHistory}
                selectedGames={selectedGamesForReply}
                onConfirm={(chosen) => setSelectedGamesForReply(chosen)}
              />

              {selectedGamesForReply.length > 0 && (
                <div className="p-2 rounded-xl bg-[var(--card)] border border-[var(--nav-accent-social)] stack-tight text-sm">
                  <div className="row-between pb-1 border-b border-[var(--border)]">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <IconHistory3D size={14} /> Permainan Terlampir ({selectedGamesForReply.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowGameImportPicker(true)}
                      className="text-sm text-[var(--nav-accent-social)] font-bold hover:underline"
                    >
                      + Ubah / Tambah Permainan
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedGamesForReply.map((g) => (
                      <div
                        key={g.id}
                        className="px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center gap-1.5 text-sm"
                      >
                        <span className="font-bold text-white">vs {g.opponent}</span>
                        <span className="text-sm text-[var(--muted-foreground)]">
                          ({g.humanSide === "white" ? "Putih" : "Hitam"} · {g.outcomeKind})
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedGamesForReply((prev) => prev.filter((item) => item.id !== g.id))}
                          className="text-[var(--destructive)] font-bold p-0.5"
                          title="Hapus"
                        >
                          <IconClose3D size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rich Text Editor for Reply */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <RichTextToolbar
                  textareaRef={replyInputRef}
                  value={replyText}
                  onChange={setReplyText}
                  onAttachGame={() => setShowGameImportPicker(!showGameImportPicker)}
                  attachedGamesCount={selectedGamesForReply.length}
                />
                <textarea
                  ref={replyInputRef}
                  aria-label="Balasan diskusi"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  placeholder="Ketik balasan Anda..."
                  className="w-full p-2.5 bg-[var(--card)] text-sm text-white focus:outline-none resize-y"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSubmitReply}
                  disabled={!replyText.trim() && selectedGamesForReply.length === 0}
                  className="ctl ctl-xs ctl-primary font-bold flex items-center gap-1 px-3"
                >
                  <IconMessages3D size={13} />
                  <span>Kirim Balasan</span>
                </button>
              </div>
            </div>
          </div>

          {/* Kolom meta: ringkasan thread + aktivitas */}
          <div className="view-body min-h-0" style={{ scrollbarWidth: "thin" }}>
            <div className="panel p-3 rounded-xl" style={{ background: "var(--card)" }}>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Ringkasan</p>
              <dl className="mt-2 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-400">Kategori</dt>
                  <dd className="font-bold text-white text-right">{activeThread.categoryName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-400">Pembuat</dt>
                  <dd className="font-bold text-white">@{activeThread.authorUsername}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-400">Balasan</dt>
                  <dd className="font-bold text-white tabular-nums">{activeThread.repliesCount}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-400">Aktivitas</dt>
                  <dd className="text-neutral-300">{activeThread.lastActivity}</dd>
                </div>
              </dl>
              {activeThread.attachedGameSummary && (
                <p className="mt-2 text-xs text-[var(--nav-accent-social)] font-bold">
                  Partai vs {activeThread.attachedGameSummary.opponent} · {activeThread.attachedGameSummary.movesCount} langkah · {activeThread.attachedGameSummary.playedAs === "white" ? "Putih" : "Hitam"} menang
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}