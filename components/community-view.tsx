"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/use-session";
import {
  IconCommunity3D,
  IconMedal3D,
  IconPlay3D,
  IconMessages3D,
  IconPin3D,
  IconFire3D,
  IconPencil3D,
  IconPawn3D,
  IconSearch3D,
} from "@/components/icons3d";

export type ForumCategory = {
  id: string;
  name: string;
  description: string;
  threadsCount: number;
};

export type ForumThread = {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  authorUsername: string;
  authorName: string;
  authorTitle?: string;
  avatarInitials: string;
  repliesCount: number;
  lastActivity: string;
  isHot?: boolean;
  isPinned?: boolean;
  isLocked?: boolean;
  posts: ForumPost[];
};

export type ForumPost = {
  id: string;
  postNumber: number;
  authorUsername: string;
  authorName: string;
  authorTitle?: string;
  authorRole: string;
  avatarInitials: string;
  content: string;
  likes: number;
  dislikes: number;
  createdAt: string;
};

type Props = {
  user: SessionUser | null;
  lang?: "id" | "en";
};

export function CommunityView({ user, lang = "id" }: Props) {
  const [viewMode, setViewMode] = useState<"index" | "thread">("index");
  const [activeThreadId, setActiveThreadId] = useState<string>("t1");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);

  // New Topic Form State
  const [newTopicCategory, setNewTopicCategory] = useState("general");
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicContent, setNewTopicContent] = useState("");

  // Reply Form State
  const [replyText, setReplyText] = useState("");
  const [followThread, setFollowThread] = useState(true);

  // Categories
  const categories: ForumCategory[] = [
    { id: "general", name: "Diskusi Umum Catur", description: "Opini catur, perdebatan menarik, dan topik santai", threadsCount: 1420 },
    { id: "telu", name: "Komunitas Tel-U / FIF CHESS", description: "Pengumuman kampus, turnamen civitas, dan jadwal latihan UKM", threadsCount: 380 },
    { id: "analysis", name: "Analisis Permainan & Taktik", description: "Bagikan partai brilian, evaluasi engine, dan koleksi blunder", threadsCount: 890 },
    { id: "beginner", name: "Untuk Pemula & Latihan", description: "Tanya jawab pemula, trik garpu kuda, dan panduan taktik dasar", threadsCount: 512 },
  ];

  // Threads Data
  const [threads, setThreads] = useState<ForumThread[]>([
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
          dislikes: 3,
          createdAt: "2 jam lalu",
        },
        {
          id: "p2",
          postNumber: 2,
          authorUsername: "bagaswibowo",
          authorName: "Pak Bagas Wibowo",
          authorTitle: "ADMIN KOMUNITAS",
          authorRole: "Dosen Tel-U & Admin",
          avatarInitials: "BW",
          content: "Hot take yang sangat menarik! Dari perspektif teori komputasi dan pohon pencarian Minimax/Stockfish, kompleksitas posisi catur memang memiliki branching factor ~35 per ply. Namun itulah mengapa penguasaan pola (heuristik) dan manajemen risiko waktu (time control) menjadi pembeda antara Master dan Grandmaster.",
          likes: 38,
          dislikes: 0,
          createdAt: "1 jam lalu",
        },
        {
          id: "p3",
          postNumber: 3,
          authorUsername: "DaRonK1",
          authorName: "DaRonK1",
          authorTitle: "ELO 2300",
          authorRole: "Mahasiswa Informatika",
          avatarInitials: "DR",
          content: "Saya setuju bahwa di time control kilat (Bullet / Blitz 3 mnt), elemen intuisi instan sangat dominan. Tapi di partai Klasik, kalkulasi konkret tetap menjadi penentu kemenangan utama!",
          likes: 19,
          dislikes: 1,
          createdAt: "45 mnt lalu",
        },
      ],
    },
    {
      id: "t2",
      categoryId: "telu",
      categoryName: "Komunitas Tel-U / FIF CHESS",
      title: "Jadwal Turnamen Kilat Blitz 5 Mnt Antar Mahasiswa FIF Tel-U",
      authorUsername: "bagaswibowo",
      authorName: "Pak Bagas Wibowo",
      authorTitle: "ADMIN KOMUNITAS",
      avatarInitials: "BW",
      repliesCount: 28,
      lastActivity: "15 mnt lalu",
      isPinned: true,
      posts: [
        {
          id: "p2_1",
          postNumber: 1,
          authorUsername: "bagaswibowo",
          authorName: "Pak Bagas Wibowo",
          authorTitle: "ADMIN KOMUNITAS",
          authorRole: "Dosen Tel-U & Admin",
          avatarInitials: "BW",
          content: "Diberitahukan kepada seluruh mahasiswa dan civitas Telkom University, turnamen online PvP Blitz 5 mnt akan diadakan setiap Jumat sore di platform ini. Sistem pertandingan menggunakan pairing Swiss 5 ronde. Silakan daftarkan akun Anda dan lakukan verifikasi.",
          likes: 45,
          dislikes: 0,
          createdAt: "4 jam lalu",
        },
      ],
    },
    {
      id: "t3",
      categoryId: "analysis",
      categoryName: "Analisis Permainan & Taktik",
      title: "Post your brilliant moves here! (Koleksi Taktik Spektakuler)",
      authorUsername: "parth_18",
      authorName: "Parth Chess",
      authorTitle: "ELO 1950",
      avatarInitials: "PC",
      repliesCount: 64,
      lastActivity: "39 mnt lalu",
      isHot: true,
      posts: [
        {
          id: "p3_1",
          postNumber: 1,
          authorUsername: "parth_18",
          authorName: "Parth Chess",
          authorTitle: "ELO 1950",
          authorRole: "Mahasiswa SI",
          avatarInitials: "PC",
          content: "Bagikan langkah brilian Anda saat melawan bot Stockfish atau pemain nyata. Pengorbanan menteri di d1 atau Greek Gift di h7 paling disambut!",
          likes: 29,
          dislikes: 0,
          createdAt: "5 jam lalu",
        },
      ],
    },
    {
      id: "t4",
      categoryId: "beginner",
      categoryName: "Untuk Pemula & Latihan",
      title: "Perbedaan Nyata Antara Pemain Rating 1200, 1600, dan 2300",
      authorUsername: "zenwisteriaclarines",
      authorName: "Zen Wisteria",
      authorTitle: "PRO MEMBER",
      avatarInitials: "ZW",
      repliesCount: 17,
      lastActivity: "22 mnt lalu",
      posts: [
        {
          id: "p4_1",
          postNumber: 1,
          authorUsername: "zenwisteriaclarines",
          authorName: "Zen Wisteria",
          authorTitle: "PRO MEMBER",
          authorRole: "Civitas Akademika",
          avatarInitials: "ZW",
          content: "Bagi pemula, kunci naik dari 1200 ke 1600 adalah eliminasi blunder 1-langkah dan latihan teka-teki taktis 50 posisi secara konsisten.",
          likes: 21,
          dislikes: 0,
          createdAt: "3 jam lalu",
        },
      ],
    },
  ]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim() || !newTopicContent.trim() || !user) return;

    const catObj = categories.find((c) => c.id === newTopicCategory) || categories[0];
    const newThread: ForumThread = {
      id: "t-" + Date.now(),
      categoryId: catObj.id,
      categoryName: catObj.name,
      title: newTopicTitle.trim(),
      authorUsername: user.username,
      authorName: user.fullName,
      authorTitle: user.isAdmin ? "ADMIN KOMUNITAS" : "MEMBER",
      avatarInitials: user.username.slice(0, 2).toUpperCase(),
      repliesCount: 0,
      lastActivity: "Baru saja",
      posts: [
        {
          id: "p-" + Date.now(),
          postNumber: 1,
          authorUsername: user.username,
          authorName: user.fullName,
          authorTitle: user.isAdmin ? "ADMIN KOMUNITAS" : "MEMBER",
          authorRole: user.role,
          avatarInitials: user.username.slice(0, 2).toUpperCase(),
          content: newTopicContent.trim(),
          likes: 0,
          dislikes: 0,
          createdAt: "Baru saja",
        },
      ],
    };

    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setViewMode("thread");
    setShowNewTopicModal(false);
    setNewTopicTitle("");
    setNewTopicContent("");
  };

  const handlePostReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !user) return;

    const newPost: ForumPost = {
      id: "p-" + Date.now(),
      postNumber: activeThread.posts.length + 1,
      authorUsername: user.username,
      authorName: user.fullName,
      authorTitle: user.isAdmin ? "ADMIN KOMUNITAS" : "MEMBER",
      authorRole: user.role,
      avatarInitials: user.username.slice(0, 2).toUpperCase(),
      content: replyText.trim(),
      likes: 0,
      dislikes: 0,
      createdAt: "Baru saja",
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              repliesCount: t.repliesCount + 1,
              lastActivity: "Baru saja",
              posts: [...t.posts, newPost],
            }
          : t
      )
    );

    setReplyText("");
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* 2-KOLOM UTAMA */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {viewMode === "index" ? (
            /* ================= VIEW 1: FORUM CATEGORIES INDEX ================= */
            <div className="space-y-6">
              {/* Header Forum Index */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#262421] border border-[#3d3a34] flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1a1714] border border-[#383530] flex items-center justify-center">
                    <IconMessages3D size={24} />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">Forum Komunitas</h1>
                    <p className="text-xs text-neutral-400 font-medium">
                      Pusat diskusi catur civitas Telkom University & analisis taktik
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(true)}
                  className="lg:hidden px-3.5 py-2 rounded-xl bg-[#81b64c] text-white text-xs font-bold transition-all shadow flex items-center gap-1"
                >
                  <IconPencil3D size={14} />
                  <span>Topik</span>
                </button>
              </div>

              {/* DAFTAR KATEGORI FORUM & TOPIK TERAKHIR */}
              <div className="space-y-6">
                {categories.map((cat) => {
                  const catThreads = threads.filter((t) => t.categoryId === cat.id);
                  return (
                    <div
                      key={cat.id}
                      className="p-4 sm:p-5 rounded-2xl bg-[#211f1d] border border-[#3d3a34] space-y-3.5 shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-[#312e2b] pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-white hover:text-[#81b64c] cursor-pointer transition-colors">
                              {cat.name}
                            </h2>
                            <span className="text-xs text-neutral-500 font-bold">›</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{cat.description}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-[#1a1714] text-[10px] font-mono font-bold text-neutral-400">
                          {catThreads.length} Topik
                        </span>
                      </div>

                      <div className="space-y-2">
                        {catThreads.length === 0 ? (
                          <p className="text-xs text-neutral-500 italic py-2">Belum ada topik di kategori ini.</p>
                        ) : (
                          catThreads.map((t) => (
                            <div
                              key={t.id}
                              onClick={() => {
                                setActiveThreadId(t.id);
                                setViewMode("thread");
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="p-3 rounded-xl bg-[#262421] border border-[#312e2b] hover:border-neutral-400 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-[#2b2926]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {t.isPinned && <IconPin3D size={16} className="shrink-0" />}
                                {t.isHot && <IconFire3D size={16} className="shrink-0" />}
                                <div className="min-w-0">
                                  <div className="text-xs sm:text-sm font-bold text-white hover:text-[#81b64c] truncate transition-colors">
                                    {t.title}
                                  </div>
                                  <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                    <span>Oleh <strong className="text-neutral-300">@{t.authorUsername}</strong></span>
                                    <span>•</span>
                                    <span>{t.lastActivity}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono shrink-0">
                                <IconMessages3D size={14} />
                                <span className="font-bold text-white">{t.repliesCount}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================= VIEW 2: ACTIVE THREAD DETAIL ================= */
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("index")}
                  className="px-3.5 py-2 rounded-xl bg-[#211f1d] hover:bg-[#302e2b] border border-[#3d3a34] text-xs font-bold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>‹</span>
                  <span>Kembali ke Semua Forum</span>
                </button>
                <div className="text-xs text-neutral-400 flex items-center gap-1 font-medium">
                  <span>Forum</span>
                  <span>›</span>
                  <span className="text-neutral-300">{activeThread.categoryName}</span>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-[#262421] border border-[#3d3a34] space-y-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#1a1714] text-[10px] font-bold text-[#81b64c] border border-[#3d3a34]">
                    {activeThread.categoryName}
                  </span>
                  {activeThread.isPinned && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                      <IconPin3D size={12} />
                      <span>Dipin</span>
                    </span>
                  )}
                  {activeThread.isHot && (
                    <span className="px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 text-[10px] font-bold flex items-center gap-1">
                      <IconFire3D size={12} />
                      <span>Topik Hangat</span>
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white leading-snug">{activeThread.title}</h1>
                <div className="text-xs text-neutral-400 font-medium">
                  Dimulai oleh <strong className="text-white">@{activeThread.authorUsername}</strong> • {activeThread.posts.length} kiriman aktif
                </div>
              </div>

              {/* POSTS LIST */}
              <div className="space-y-4">
                {activeThread.posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#262421] border border-[#3d3a34] space-y-3.5 shadow-sm transition-all hover:border-neutral-400"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-[#312e2b] pb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#81b64c] to-[#457524] flex items-center justify-center font-bold text-sm text-white shrink-0 shadow">
                          {post.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white">{post.authorName}</span>
                            <span className="text-xs text-[#81b64c] font-semibold">@{post.authorUsername}</span>
                            {post.authorTitle && (
                              <span className="px-2 py-0.5 rounded-full bg-[#1a1714] border border-[#3d3a34] text-[10px] font-black text-amber-400">
                                {post.authorTitle}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            <span>{post.authorRole}</span>
                            <span className="mx-1.5">•</span>
                            <span>{post.createdAt}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-neutral-500">#{post.postNumber}</span>
                    </div>

                    <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#312e2b] text-xs text-neutral-400">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setThreads((prev) =>
                              prev.map((t) =>
                                t.id === activeThread.id
                                  ? {
                                      ...t,
                                      posts: t.posts.map((p) =>
                                        p.id === post.id ? { ...p, likes: p.likes + 1 } : p
                                      ),
                                    }
                                  : t
                              )
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#1a1714] hover:bg-[#302e2b] border border-[#3d3a34] flex items-center gap-1.5 font-bold hover:text-white transition-all cursor-pointer"
                        >
                          <span className="text-[#81b64c]">↑</span>
                          <span>{post.likes}</span>
                          <span className="text-neutral-500">↓</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReplyText((prev) => prev + `\n> @${post.authorUsername} menulis:\n> "${post.content.slice(0, 120)}..."\n\n`)
                          }
                          className="hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <span>”</span>
                          <span>Kutip</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* REPLY FORM */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#211f1d] border border-[#3d3a34] space-y-3.5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Tulis Balasan</span>
                  <span className="text-xs text-neutral-400 font-mono">Karakter: {replyText.length}</span>
                </div>

                <div className="flex items-center gap-1 p-1.5 rounded-xl bg-[#1a1714] border border-[#312e2b] flex-wrap">
                  <button
                    type="button"
                    onClick={() => setReplyText((prev) => prev + " **teks tebal** ")}
                    className="w-8 h-8 rounded-lg hover:bg-[#302e2b] text-sm font-bold text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
                    title="Tebal"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyText((prev) => prev + " *teks miring* ")}
                    className="w-8 h-8 rounded-lg hover:bg-[#302e2b] text-sm italic font-bold text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
                    title="Miring"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyText((prev) => prev + "\n> Kutipan teks...\n")}
                    className="w-8 h-8 rounded-lg hover:bg-[#302e2b] text-sm font-bold text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
                    title="Kutipan"
                  >
                    ”
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyText((prev) => prev + " `1.e4 e5 2.Nf3` ")}
                    className="w-8 h-8 rounded-lg hover:bg-[#302e2b] text-sm font-mono text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
                    title="Notasi"
                  >
                    #
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyText((prev) => prev + " [FEN: r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4] ")}
                    className="px-2.5 h-8 rounded-lg hover:bg-[#302e2b] text-xs font-bold text-[#81b64c] hover:text-white flex items-center gap-1.5 cursor-pointer"
                    title="Sisipkan Diagram Papan"
                  >
                    <IconPawn3D size={16} />
                    <span>Papan</span>
                  </button>
                </div>

                <form onSubmit={handlePostReply} className="space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={user ? "Ketik tanggapan atau analisis Anda..." : "Silakan masuk untuk menulis tanggapan..."}
                    disabled={!user}
                    rows={4}
                    className="w-full p-3.5 rounded-xl bg-[#1a1714] border border-[#3d3a34] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#81b64c] leading-relaxed"
                  />

                  <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={followThread}
                        onChange={(e) => setFollowThread(e.target.checked)}
                        className="w-4 h-4 accent-[#81b64c] rounded cursor-pointer"
                      />
                      <span>Ikuti pembaruan utas ini (Notifikasi)</span>
                    </label>

                    <button
                      type="submit"
                      disabled={!user || !replyText.trim()}
                      className="px-6 py-2.5 rounded-xl bg-[#81b64c] hover:bg-[#72a342] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm transition-all shadow-[0_3px_0_#4d7a27] cursor-pointer"
                    >
                      Tulisan (Kirim)
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* KOLOM KANAN */}
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setShowNewTopicModal(true)}
            className="w-full h-12 rounded-xl bg-[#81b64c] hover:bg-[#72a342] text-white font-black text-sm transition-all shadow-[0_4px_0_#4d7a27,0_4px_16px_rgba(129,182,76,0.3)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <IconPencil3D size={18} />
            <span>Topik Baru</span>
          </button>

          <div className="p-4 rounded-2xl bg-[#262421] border border-[#3d3a34] space-y-3 shadow-md">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <IconSearch3D size={14} />
              <span>Cari & Saring</span>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Cari topik forum..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#1a1714] border border-[#3d3a34] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#81b64c]"
              />

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#1a1714] border border-[#3d3a34] text-xs text-neutral-300 focus:outline-none focus:border-[#81b64c]"
              >
                <option value="all">-- Semua Kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TERBARU */}
          <div className="p-4 rounded-2xl bg-[#262421] border border-[#3d3a34] space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-[#312e2b] pb-2.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Terbaru</span>
              <span className="text-[10px] text-[#81b64c] font-bold">Aktivitas Live</span>
            </div>
            <div className="space-y-2.5">
              {threads.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveThreadId(t.id);
                    setViewMode("thread");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="p-2.5 rounded-xl bg-[#1a1714] border border-[#312e2b] hover:border-neutral-500 transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-bold text-white hover:text-[#81b64c] line-clamp-2 transition-colors">
                    {t.title}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-400">
                    <span>@{t.authorUsername}</span>
                    <span className="text-neutral-500">•</span>
                    <span>{t.lastActivity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KETERANGAN FORUM */}
          <div className="p-4 rounded-2xl bg-[#262421] border border-[#3d3a34] space-y-3 shadow-md text-xs">
            <div className="border-b border-[#312e2b] pb-2">
              <span className="font-bold text-white uppercase tracking-wider text-xs">Keterangan Forum</span>
            </div>
            <div className="space-y-2 text-neutral-300">
              <div className="flex items-center gap-2.5">
                <IconMessages3D size={16} />
                <span>Mengikuti Topik</span>
              </div>
              <div className="flex items-center gap-2.5">
                <IconPin3D size={16} />
                <span>Topik Pilihan Civitas</span>
              </div>
              <div className="flex items-center gap-2.5">
                <IconFire3D size={16} />
                <span>Topik Hangat & Viral</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL BUAT TOPIK BARU */}
      {showNewTopicModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewTopicModal(false);
          }}
        >
          <div className="w-full max-w-lg bg-[#211f1d] border border-[#3d3a34] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden text-white flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#312e2b] bg-[#262421]">
              <div className="flex items-center gap-2">
                <IconPencil3D size={20} />
                <span className="font-bold text-base">Buat Topik Diskusi Baru</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewTopicModal(false)}
                className="w-8 h-8 rounded-lg bg-[#302e2b] hover:bg-[#3d3a34] text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Kategori Forum</label>
                <select
                  value={newTopicCategory}
                  onChange={(e) => setNewTopicCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1714] border border-[#3d3a34] text-sm text-white focus:outline-none focus:border-[#81b64c]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Judul Topik</label>
                <input
                  type="text"
                  placeholder="Misal: Taktik Pembukaan Scotch Game yang Efektif"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  maxLength={120}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1714] border border-[#3d3a34] text-sm text-white focus:outline-none focus:border-[#81b64c]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Isi Pembahasan</label>
                <textarea
                  placeholder="Tuliskan gagasan, pertanyaan, atau analisis lengkap Anda..."
                  value={newTopicContent}
                  onChange={(e) => setNewTopicContent(e.target.value)}
                  rows={5}
                  required
                  className="w-full p-3.5 rounded-xl bg-[#1a1714] border border-[#3d3a34] text-sm text-white focus:outline-none focus:border-[#81b64c] leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#1a1714] hover:bg-[#302e2b] text-neutral-300 text-sm font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!user || !newTopicTitle.trim() || !newTopicContent.trim()}
                  className="px-6 py-2.5 rounded-xl bg-[#81b64c] hover:bg-[#72a342] disabled:opacity-50 text-white font-bold text-sm transition-all shadow-[0_3px_0_#4d7a27] cursor-pointer"
                >
                  Publikasikan Topik
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
