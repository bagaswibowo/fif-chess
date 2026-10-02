"use client";

export type { ForumCategory, ForumPost, ForumThread } from "./community/types";

import { useState, useMemo, useEffect, useRef } from "react";
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

  const categories: ForumCategory[] = [
    { id: "general", name: "Diskusi Umum Catur", description: "Opini catur, perdebatan menarik, dan topik santai", threadsCount: 1420 },
    { id: "telu", name: "Komunitas Tel-U / FIF CHESS", description: "Pengumuman kampus, turnamen civitas, dan jadwal latihan UKM", threadsCount: 380 },
    { id: "analysis", name: "Analisis Permainan & Taktik", description: "Bagikan partai brilian, evaluasi engine, dan koleksi blunder", threadsCount: 890 },
    { id: "beginner", name: "Untuk Pemula & Latihan", description: "Tanya jawab pemula, trik garpu kuda, dan panduan taktik dasar", threadsCount: 512 },
  ];

  // Threads Data
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        opponent: "Stockfish 15 NNUE",
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
            opponent: "Stockfish 15 NNUE",
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
    <div className="w-full max-w-6xl mx-auto space-y-2.5 pb-6">
      {/* HEADER FORUM */}
      <div className="panel px-3.5 py-2.5 row-between flex-wrap gap-2" style={{ background: "var(--card)" }}>
        <div className="row items-center gap-2">
          <IconCommunity3D size={22} />
          <h2 className="text-base md:text-lg font-black text-white m-0">
            Komunitas &amp; Forum Catur FIF Tel-U
          </h2>
        </div>

        <div className="row gap-2">
          {viewMode === "thread" && (
            <button
              onClick={() => setViewMode("index")}
              className="ctl ctl-sm ctl-quiet flex items-center gap-1"
            >
              <span>← Kembali</span>
            </button>
          )}

          <button
            onClick={() => setShowNewTopicModal(true)}
            className="ctl ctl-sm ctl-primary font-bold flex items-center gap-1.5"
          >
            <IconPencil3D size={14} />
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
                  <label className="label font-bold text-sm">Kategori Forum:</label>
                  <select
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
                  <label className="label font-bold text-sm">Judul Topik:</label>
                  <input
                    type="text"
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    placeholder="Contoh: Analisis Pembukaan Sisilia Najdorf..."
                    className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-white focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              <label className="label font-bold text-sm mt-1">Isi Diskusi (Rich Text Editor):</label>
              
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

      {/* VIEW 1: INDEX TOPIK FORUM */}
      {viewMode === "index" && (
        <div className="stack-tight">
          {/* SEARCH & CATEGORY FILTER */}
          <div className="panel p-2.5 stack-tight" style={{ background: "var(--surface)" }}>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari topik diskusi atau username..."
                className="w-full p-1.5 pl-7 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-white focus:outline-none focus:border-[var(--primary)]"
              />
              <div className="absolute left-2 top-2 pointer-events-none opacity-60">
                <IconSearch3D size={13} />
              </div>
            </div>

            <div className="row items-center gap-1 overflow-x-auto pt-0.5 text-sm">
              <button
                onClick={() => setFilterCategory("all")}
                className={`ctl ctl-sm shrink-0 ${filterCategory === "all" ? "ctl-active ring-1 ring-[var(--primary)] font-bold" : "ctl-quiet"}`}
              >
                Semua Kategori
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilterCategory(c.id)}
                  className={`ctl ctl-sm shrink-0 ${filterCategory === c.id ? "ctl-active ring-1 ring-[var(--primary)] font-bold" : "ctl-quiet"}`}
                >
                  {c.name} ({c.threadsCount})
                </button>
              ))}
            </div>
          </div>

          {/* THREADS LIST */}
          <div className="stack-tight">
            {filteredThreads.map((th) => (
              <div
                key={th.id}
                onClick={() => {
                  setActiveThreadId(th.id);
                  setViewMode("thread");
                }}
                className="panel p-3 hover:border-[var(--primary)] transition-all cursor-pointer stack-tight"
                style={{ background: "var(--card)" }}
              >
                <div className="row-between flex-wrap gap-1.5">
                  <div className="row items-center gap-1.5 min-w-0">
                    {th.isPinned && <IconPin3D size={14} />}
                    {th.isHot && <IconFire3D size={14} />}
                    <h3 className="font-bold text-base md:text-lg text-white hover:text-[var(--primary)] truncate m-0">
                      {th.title}
                    </h3>
                  </div>
                  <span className="ctl ctl-sm" style={{ background: "var(--surface)" }}>
                    {th.categoryName}
                  </span>
                </div>

                <p className="prose-note text-sm text-neutral-300 line-clamp-2 m-0">
                  {th.posts[0]?.content}
                </p>

                <div className="row-between pt-1 text-sm text-[var(--muted-foreground)]" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="row items-center gap-1.5">
                    <span className="font-bold text-white">@{th.authorUsername}</span>
                    <span>·</span>
                    <span>{th.lastActivity}</span>
                    {th.attachedGameSummary && (
                      <span className="text-[var(--primary)] font-bold">
                        · [Partai vs {th.attachedGameSummary.opponent}]
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 font-bold text-white">
                    <IconMessages3D size={12} />
                    <span>{th.repliesCount} Balasan</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: THREAD DETAIL & REPLIES */}
      {viewMode === "thread" && (
        <div className="stack-tight">
          <div className="panel p-3 stack-tight" style={{ background: "var(--card)" }}>
            <div className="row-between flex-wrap gap-1">
              <span className="ctl ctl-sm font-bold" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
                {activeThread.categoryName}
              </span>
              <span className="text-sm text-[var(--muted-foreground)]">
                Aktivitas: {activeThread.lastActivity}
              </span>
            </div>
            <h1 className="text-sm md:text-base font-black text-white m-0">
              {activeThread.title}
            </h1>
          </div>

          {/* Posts List */}
          <div className="stack-tight">
            {activeThread.posts.map((post) => (
              <div key={post.id} className="panel p-3 stack-tight" style={{ background: "var(--card)" }}>
                <div className="row-between pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="row items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--primary)]/20 border border-[var(--primary)] text-[var(--primary)] font-bold flex items-center justify-center text-sm">
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

                <div className="row-between pt-1.5 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/community", {
                        method: "POST",
                        body: JSON.stringify({ action: "like", threadId: activeThread.id, postId: post.id }),
                      }).then(r => r.json());
                      if (res.threads) setThreads(res.threads);
                    }}
                    className="ctl ctl-sm flex items-center gap-1 font-bold"
                  >
                    <IconThumbsUp3D size={12} />
                    <span>{post.likes} Suka</span>
                  </button>


                  <button
                    onClick={() => handleQuotePost(post)}
                    className="ctl ctl-sm ctl-quiet flex items-center gap-1 font-bold"
                  >
                    <IconQuote3D size={12} />
                    <span>Kutip Balas</span>
                  </button>

                  {user?.username === post.authorUsername && (
                    <button
                      onClick={async () => {
                        if (confirm("Yakin ingin menghapus kiriman ini?")) {
                          const res = await fetch("/api/community", {
                            method: "POST",
                            body: JSON.stringify({ action: "delete_post", threadId: activeThread.id, postId: post.id }),
                          }).then(r => r.json());
                          if (res.threads) {
                             if (!res.threads.find((t: any) => t.id === activeThread.id)) {
                               setViewMode("index");
                             }
                             setThreads(res.threads);
                          } else {
                             alert(res.error || "Gagal menghapus.");
                          }
                        }
                      }}
                      className="ctl ctl-sm flex items-center gap-1 font-bold text-[var(--destructive)] hover:bg-[var(--destructive)] hover:text-white"
                    >
                      <span>Hapus</span>
                    </button>
                  )}

                </div>
              </div>
            ))}
          </div>

          {/* REPLY FORM */}
          <div className="panel p-3 stack-tight" style={{ background: "var(--surface)" }}>
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
              <div className="p-2 rounded-xl bg-[var(--card)] border border-[var(--primary)] stack-tight text-sm">
                <div className="row-between pb-1 border-b border-[var(--border)]">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <IconHistory3D size={14} /> Permainan Terlampir ({selectedGamesForReply.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGameImportPicker(true)}
                    className="text-sm text-[var(--primary)] font-bold hover:underline"
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
                        className="text-[var(--destructive)] font-bold hover:scale-110 p-0.5"
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
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                placeholder="Ketik balasan Anda..."
                className="w-full p-2.5 bg-[var(--card)] text-sm text-white focus:outline-none resize-y"
              />
            </div>

            <div className="row justify-end pt-1">
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() && selectedGamesForReply.length === 0}
                className="ctl ctl-sm ctl-primary font-bold flex items-center gap-1 px-3"
              >
                <IconMessages3D size={13} />
                <span>Kirim Balasan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}