import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { currentUser, loadUsers } from "@/lib/auth-store";
import type { ForumThread, ForumPost } from "@/components/community-view";

export const runtime = "nodejs";

const POSTS_FILE = path.join(process.env.JEV_DATA_DIR || path.join(process.cwd(), "data"), "community-threads.json");

const DEFAULT_THREADS: ForumThread[] = [
  {
    id: "t1",
    categoryId: "general",
    categoryName: "Diskusi Umum Catur",
    title: "What's your biggest chess HOT TAKE",
    authorUsername: "smiley_face10",
    authorName: "Smiley Face",
    authorTitle: "PRO PLAYER",
    avatarInitials: "SF",
    repliesCount: 2,
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
];

function loadThreads(): ForumThread[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : DEFAULT_THREADS;
  } catch {
    return DEFAULT_THREADS;
  }
}

function saveThreads(threads: ForumThread[]) {
  fs.mkdirSync(path.dirname(POSTS_FILE), { recursive: true });
  const tmp = `${POSTS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(threads, null, 1));
  fs.renameSync(tmp, POSTS_FILE);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "US";
}

export async function GET() {
  return NextResponse.json({ success: true, threads: loadThreads() });
}

export async function POST(req: Request) {
  const me = currentUser(req, loadUsers());
  if (!me) return NextResponse.json({ error: "Masuk dulu." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
  }

  const action = String(body.action || "");
  let threads = loadThreads();

  if (action === "create_thread") {
    const threadData = body.thread as Partial<ForumThread> | undefined;
    if (!threadData || !threadData.title || !threadData.posts?.[0]?.content) {
      return NextResponse.json({ error: "Data thread tidak lengkap." }, { status: 400 });
    }

    const title = String(threadData.title).trim().slice(0, 120);
    const content = String(threadData.posts[0].content).trim().slice(0, 5000);
    if (title.length < 3) return NextResponse.json({ error: "Judul minimal 3 karakter." }, { status: 400 });
    if (content.length < 3) return NextResponse.json({ error: "Isi diskusi terlalu pendek." }, { status: 400 });

    const initials = getInitials(me.fullName);
    const newPost: ForumPost = {
      id: "p-" + crypto.randomUUID().slice(0, 8),
      postNumber: 1,
      authorUsername: me.username,
      authorName: me.fullName,
      authorRole: me.role,
      avatarInitials: initials,
      content,
      likes: 0,
      createdAt: "Baru saja",
      attachedGames: threadData.posts[0].attachedGames,
    };

    const newThread: ForumThread = {
      id: "t-" + crypto.randomUUID().slice(0, 8),
      categoryId: String(threadData.categoryId || "general"),
      categoryName: String(threadData.categoryName || "Diskusi Umum Catur"),
      title,
      authorUsername: me.username,
      authorName: me.fullName,
      authorTitle: me.isAdmin ? "ADMIN KOMUNITAS" : "CIVITAS TEL-U",
      avatarInitials: initials,
      repliesCount: 1,
      lastActivity: "Baru saja",
      posts: [newPost],
    };

    threads.unshift(newThread);
    saveThreads(threads);
    return NextResponse.json({ success: true, threads });
  }

  if (action === "reply") {
    const threadId = String(body.threadId || "");
    const postData = body.post as Partial<ForumPost> | undefined;
    if (!threadId || !postData?.content) {
      return NextResponse.json({ error: "Data balasan tidak lengkap." }, { status: 400 });
    }

    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx < 0) return NextResponse.json({ error: "Thread tidak ditemukan." }, { status: 404 });

    const content = String(postData.content).trim().slice(0, 5000);
    if (content.length < 3) return NextResponse.json({ error: "Isi balasan terlalu pendek." }, { status: 400 });

    const newPost: ForumPost = {
      id: "p-" + crypto.randomUUID().slice(0, 8),
      postNumber: threads[idx].posts.length + 1,
      authorUsername: me.username,
      authorName: me.fullName,
      authorRole: me.role,
      avatarInitials: getInitials(me.fullName),
      content,
      likes: 0,
      createdAt: "Baru saja",
      attachedGames: postData.attachedGames,
    };

    threads[idx].posts.push(newPost);
    threads[idx].repliesCount += 1;
    threads[idx].lastActivity = "Baru saja";
    saveThreads(threads);
    return NextResponse.json({ success: true, threads });
  }

  if (action === "delete_post") {
    const threadId = String(body.threadId || "");
    const postId = String(body.postId || "");

    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx < 0) return NextResponse.json({ error: "Thread tidak ditemukan." }, { status: 404 });

    const targetPost = threads[idx].posts.find((p) => p.id === postId);
    if (!targetPost) return NextResponse.json({ error: "Post tidak ditemukan." }, { status: 404 });

    if (targetPost.authorUsername !== me.username && !me.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    threads[idx].posts = threads[idx].posts.filter((p) => p.id !== postId);
    threads[idx].repliesCount = Math.max(0, threads[idx].posts.length - 1);

    if (threads[idx].posts.length === 0) {
      threads = threads.filter((t) => t.id !== threadId);
    }

    saveThreads(threads);
    return NextResponse.json({ success: true, threads });
  }

  if (action === "like") {
    const threadId = String(body.threadId || "");
    const postId = String(body.postId || "");

    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx < 0) return NextResponse.json({ error: "Thread tidak ditemukan." }, { status: 404 });

    const pIdx = threads[idx].posts.findIndex((p) => p.id === postId);
    if (pIdx < 0) return NextResponse.json({ error: "Post tidak ditemukan." }, { status: 404 });

    threads[idx].posts[pIdx].likes += 1;
    saveThreads(threads);
    return NextResponse.json({ success: true, threads });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
