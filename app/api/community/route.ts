import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { currentUser, loadUsers } from "@/lib/auth-store";

export const runtime = "nodejs";

const POSTS_FILE = path.join(process.env.JEV_DATA_DIR || path.join(process.cwd(), "data"), "community-posts.json");

export type CommunityPost = {
  id: string;
  authorUsername: string;
  authorName: string;
  authorRole: string;
  title: string;
  content: string;
  category: string;
  likes: number;
  createdAt: string;
};

const CATEGORIES = ["diskusi", "analisis", "tantangan", "pengumuman"];

function loadPosts(): CommunityPost[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePosts(posts: CommunityPost[]) {
  fs.mkdirSync(path.dirname(POSTS_FILE), { recursive: true });
  const tmp = `${POSTS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(posts, null, 1));
  fs.renameSync(tmp, POSTS_FILE);
}

export async function GET() {
  return NextResponse.json({ success: true, posts: loadPosts() });
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
  const posts = loadPosts();

  if (action === "create") {
    const title = String(body.title || "").trim().slice(0, 120);
    const content = String(body.content || "").trim().slice(0, 2000);
    if (title.length < 3) return NextResponse.json({ error: "Judul minimal 3 karakter." }, { status: 400 });
    if (content.length < 3) return NextResponse.json({ error: "Isi diskusi terlalu pendek." }, { status: 400 });

    const post: CommunityPost = {
      id: "post-" + crypto.randomUUID().slice(0, 8),
      authorUsername: me.username,
      authorName: me.fullName,
      authorRole: me.role,
      title,
      content,
      category: CATEGORIES.includes(String(body.category)) ? String(body.category) : "diskusi",
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    savePosts([post, ...posts]);
    return NextResponse.json({ success: true, post });
  }

  if (action === "like") {
    const id = String(body.postId || "");
    const post = posts.find((p) => p.id === id);
    if (!post) return NextResponse.json({ error: "Post tidak ditemukan." }, { status: 404 });
    post.likes += 1;
    savePosts(posts);
    return NextResponse.json({ success: true, likes: post.likes });
  }

  if (action === "delete") {
    if (!me.isAdmin) return NextResponse.json({ error: "Hanya admin yang bisa menghapus." }, { status: 403 });
    const id = String(body.postId || "");
    const next = posts.filter((p) => p.id !== id);
    if (next.length === posts.length) return NextResponse.json({ error: "Post tidak ditemukan." }, { status: 404 });
    savePosts(next);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
