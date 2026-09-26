"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/use-session";
import { IconCommunity3D, IconMedal3D } from "@/components/icons3d";

export type ForumPost = {
  id: string;
  authorUsername: string;
  authorName: string;
  authorRole: string;
  authorTitle?: string;
  avatarInitials: string;
  postNumber: number;
  content: string;
  category: string;
  likes: number;
  dislikes: number;
  createdAt: string;
};

export type RecentActivity = {
  id: string;
  title: string;
  author: string;
  replies: number;
  timeAgo: string;
};

type Props = { user: SessionUser | null; lang?: "id" | "en" };

export function CommunityView({ user, lang = "id" }: Props) {
  const [posts, setPosts] = useState<ForumPost[]>([
    {
      id: "p1",
      authorUsername: "bagaswibowo",
      authorName: "Pak Bagas Wibowo",
      authorRole: "Dosen Tel-U & Admin",
      authorTitle: "👑 ADMIN",
      avatarInitials: "BW",
      postNumber: 1,
      content: "Selamat datang di Forum Komunitas Catur Telkom University (FIF CHESS). Di sini kita dapat berdiskusi mengenai pembukaan, analisis partai, berbagi teka-teki, dan mengorganisir turnamen civitas. Mari junjung tinggi fair play!",
      category: "Pengumuman",
      likes: 12,
      dislikes: 0,
      createdAt: "3 jam lalu",
    },
    {
      id: "p2",
      authorUsername: "daron_k1",
      authorName: "DaRonK1",
      authorRole: "Mahasiswa Informatika",
      authorTitle: "♟️ 2300",
      avatarInitials: "DR",
      postNumber: 2,
      content: "Halo semua, saya baru saja mencoba mode latihan Stockfish 15 NNUE di kedalaman 14. Evaluasinya sangat tajam dan bank teka-teki 50 posisi sangat membantu pemahaman taktik!",
      category: "Analisis & Teori",
      likes: 8,
      dislikes: 0,
      createdAt: "2 jam lalu",
    },
    {
      id: "p3",
      authorUsername: "zenwisteriaclarines",
      authorName: "Zen Wisteria",
      authorRole: "Civitas Akademika",
      authorTitle: "💎 PRO",
      avatarInitials: "ZW",
      postNumber: 3,
      content: "Apakah ada rencana turnamen kilat (Blitz 5 mnt) antar mahasiswa minggu depan? Saya siap mendaftar!",
      category: "Turnamen Civitas",
      likes: 5,
      dislikes: 0,
      createdAt: "1 jam lalu",
    },
  ]);

  const [recentActivities] = useState<RecentActivity[]>([
    { id: "r1", title: "Diskusi Pembukaan Scotch Game & Center Fork", author: "DaRonK1", replies: 14, timeAgo: "23 mnt lalu" },
    { id: "r2", title: "Jadwal Latihan Bersama UKM Catur Tel-U", author: "parth_18", replies: 9, timeAgo: "31 mnt lalu" },
    { id: "r3", title: "Koleksi Taktik Menakjubkan: Greek Gift di h7", author: "TheGreatJata", replies: 27, timeAgo: "38 mnt lalu" },
    { id: "r4", title: "Bagikan Langkah Brilian Anda di Sini!", author: "parth_18", replies: 42, timeAgo: "41 mnt lalu" },
    { id: "r5", title: "Evaluasi AI Coach untuk Endgame Raja & Benteng", author: "SirChessterton", replies: 18, timeAgo: "52 mnt lalu" },
  ]);

  const [replyText, setReplyText] = useState("");
  const [followThread, setFollowThread] = useState(true);
  const [busy, setBusy] = useState(false);

  const wordCount = replyText.trim() ? replyText.trim().split(/\s+/).length : 0;

  const handlePostReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !user) return;
    setBusy(true);

    const newPost: ForumPost = {
      id: "p-" + Date.now(),
      authorUsername: user.username,
      authorName: user.fullName,
      authorRole: user.role,
      authorTitle: user.isAdmin ? "👑 ADMIN" : "♟️ MEMBER",
      avatarInitials: user.username.slice(0, 2).toUpperCase(),
      postNumber: posts.length + 1,
      content: replyText.trim(),
      category: "Diskusi Umum",
      likes: 0,
      dislikes: 0,
      createdAt: "Baru saja",
    };

    setPosts((prev) => [...prev, newPost]);
    setReplyText("");
    setBusy(false);
  };

  const handleInsertFormat = (tag: string) => {
    if (tag === "b") setReplyText((prev) => prev + " **teks tebal** ");
    if (tag === "i") setReplyText((prev) => prev + " *teks miring* ");
    if (tag === "quote") setReplyText((prev) => prev + "\n> Kutipan teks...\n");
    if (tag === "code") setReplyText((prev) => prev + " `1.e4 e5 2.Nf3` ");
    if (tag === "board") setReplyText((prev) => prev + " [FEN: r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4] ");
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* HEADER UTAS / THREAD TITLE */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#262421] border border-[#3d3a34] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-[#81b64c] uppercase tracking-wider">
            <span>Forum Komunitas</span>
            <span>•</span>
            <span className="text-neutral-400">Pengumuman & Diskusi Terbuka</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
            Selamat Datang di Arena Catur Civitas Telkom University (FIF CHESS)
          </h1>
          <p className="text-xs text-neutral-400 font-medium">
            Dimulai oleh <strong className="text-white">@bagaswibowo</strong> • {posts.length} balasan aktif • Terbuka untuk umum
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="px-3 py-2 rounded-xl bg-[#211f1d] hover:bg-[#302e2b] border border-[#3d3a34] text-xs font-bold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>^</span>
            <span>Papan Atas</span>
          </button>
        </div>
      </div>

      {/* 2-KOLOM (MAIN CONTENT + RIGHT SIDEBAR) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* KOLOM TENGAH: POSTINGAN THREAD + EDITOR BALASAN */}
        <div className="space-y-5 min-w-0">
          {/* DAFTAR POSTINGAN ANGGOTA */}
          <div className="space-y-4">
            {posts.map((p) => (
              <div
                key={p.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#262421] border border-[#3d3a34] space-y-3.5 shadow-sm transition-all hover:border-neutral-500"
              >
                {/* Header Post */}
                <div className="flex items-start justify-between gap-3 border-b border-[#312e2b] pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#81b64c] to-[#457524] flex items-center justify-center font-bold text-sm text-white shrink-0 shadow">
                      {p.avatarInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{p.authorName}</span>
                        <span className="text-xs text-[#81b64c] font-semibold">@{p.authorUsername}</span>
                        {p.authorTitle && (
                          <span className="px-2 py-0.5 rounded-full bg-[#1a1714] border border-[#3d3a34] text-[10px] font-black text-amber-400">
                            {p.authorTitle}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        <span>{p.authorRole}</span>
                        <span className="mx-1.5">•</span>
                        <span>{p.createdAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-neutral-500">#{p.postNumber}</span>
                  </div>
                </div>

                {/* Konten Post */}
                <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                  {p.content}
                </div>

                {/* Footer Interaksi */}
                <div className="flex items-center justify-between pt-2 border-t border-[#312e2b] text-xs text-neutral-400">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPosts(prev => prev.map(x => x.id === p.id ? { ...x, likes: x.likes + 1 } : x))}
                      className="px-2.5 py-1 rounded-lg bg-[#1a1714] hover:bg-[#302e2b] border border-[#3d3a34] flex items-center gap-1.5 font-bold hover:text-white transition-all cursor-pointer"
                    >
                      <span className="text-[#81b64c]">↑</span>
                      <span>{p.likes}</span>
                      <span className="text-neutral-500">↓</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyText(prev => prev + `\n> @${p.authorUsername} menulis:\n> "${p.content.slice(0, 100)}..."\n\n`)}
                      className="hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <span>”</span>
                      <span>Kutip</span>
                    </button>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#1a1714] text-[10px] text-neutral-400 font-medium">
                    {p.category}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* FORM BALASAN / RICH TEXT INPUT BOX */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#211f1d] border border-[#3d3a34] space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Tulis Balasan ke Forum</span>
              <span className="text-xs text-neutral-400 font-mono">Kata: {wordCount} • Karakter: {replyText.length}</span>
            </div>

            {/* WYSIWYG Toolbar */}
            <div className="flex items-center gap-1 p-1.5 rounded-xl bg-[#1a1714] border border-[#312e2b] flex-wrap">
              <button
                type="button"
                onClick={() => handleInsertFormat("b")}
                className="w-8 h-8 rounded-lg hover:bg-[#302e2b] text-sm font-bold text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
                title="Tebal (Bold)"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => handleInsertFormat("i")}
                className="w-8 h-8 rounded-lg hover:bg-[#302e2b] text-sm italic font-bold text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
                title="Miring (Italic)"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => handleInsertFormat("quote")}
                className="w-8 h-8 rounded-lg hover:bg-[#302e2b] text-sm font-bold text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
                title="Kutipan (Quote)"
              >
                ”
              </button>
              <button
                type="button"
                onClick={() => handleInsertFormat("code")}
                className="w-8 h-8 rounded-lg hover:bg-[#302e2b] text-sm font-mono text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
                title="Notasi / Kode"
              >
                #
              </button>
              <button
                type="button"
                onClick={() => handleInsertFormat("board")}
                className="px-2.5 h-8 rounded-lg hover:bg-[#302e2b] text-xs font-bold text-[#81b64c] hover:text-white flex items-center gap-1 cursor-pointer"
                title="Sisipkan Diagram Papan"
              >
                <span>♟️</span>
                <span>Papan</span>
              </button>
            </div>

            {/* Textarea Input */}
            <form onSubmit={handlePostReply} className="space-y-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={user ? "Ketik tanggapan atau analisis Anda di sini..." : "Silakan masuk untuk menulis balasan ke forum..."}
                disabled={!user}
                rows={4}
                className="w-full p-3.5 rounded-xl bg-[#1a1714] border border-[#3d3a34] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#81b64c] leading-relaxed resize-y"
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
                  disabled={!user || !replyText.trim() || busy}
                  className="px-6 py-2.5 rounded-xl bg-[#81b64c] hover:bg-[#72a342] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm transition-all shadow-[0_3px_0_#4d7a27] cursor-pointer"
                >
                  {busy ? "Mengirim…" : "Tulisan (Kirim)"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* KOLOM KANAN: WIDGETS CHESS.COM (POSTINGAN TERBARU & KETERANGAN FORUM) */}
        <div className="space-y-5">
          {/* WIDGET 1: POSTINGAN TERBARU */}
          <div className="p-4 rounded-2xl bg-[#262421] border border-[#3d3a34] space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-[#312e2b] pb-2.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Postingan Terbaru</span>
              <span className="text-[10px] text-[#81b64c] font-bold">Aktivitas Live</span>
            </div>
            <div className="space-y-2.5">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-xl bg-[#1a1714] border border-[#312e2b] hover:border-neutral-500 transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-bold text-white hover:text-[#81b64c] line-clamp-2 transition-colors">
                    {act.title}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-400">
                    <span>@{act.author}</span>
                    <span className="text-neutral-500">•</span>
                    <span>{act.timeAgo}</span>
                    <span className="text-neutral-500">•</span>
                    <span className="font-mono text-[#81b64c]">{act.replies} balasan</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* WIDGET 2: KETERANGAN FORUM (FORUM LEGEND) */}
          <div className="p-4 rounded-2xl bg-[#262421] border border-[#3d3a34] space-y-3 shadow-md text-xs">
            <div className="border-b border-[#312e2b] pb-2">
              <span className="font-bold text-white uppercase tracking-wider text-xs">Keterangan Forum</span>
            </div>
            <div className="space-y-2 text-neutral-300">
              <div className="flex items-center gap-2.5">
                <span className="text-base text-[#81b64c]">💬</span>
                <span>Mengikuti Topik</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-base text-blue-400">💬</span>
                <span>Komentar Baru Tersedia</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-base text-amber-400">📌</span>
                <span>Topik Pilihan Civitas</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-base text-neutral-400">🔒</span>
                <span>Topik Terkunci</span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#312e2b]">
              <button
                type="button"
                onClick={() => alert("Semua topik ditandai sudah dibaca.")}
                className="text-xs text-[#81b64c] hover:underline font-semibold cursor-pointer"
              >
                Tandai semua topik sebagai DIBACA
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
