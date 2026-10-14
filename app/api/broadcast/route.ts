import { NextResponse } from "next/server";

interface BroadcastMatch {
  id: string;
  whiteName: string;
  blackName: string;
  fen: string;
  moves: string[];
  plyCount?: number;
  lastUci?: string;
  commentary?: any;
  over?: boolean;
  outcomeLabel?: string;
  isPublic?: boolean;
  saveReplay?: boolean;
  updatedAt: number;
}

const broadcasts = new Map<string, BroadcastMatch>();

function pruneOldBroadcasts() {
  const now = Date.now();
  for (const [id, m] of broadcasts.entries()) {
    if (m.over && m.saveReplay === false) {
      broadcasts.delete(id);
    } else if (now - m.updatedAt > 4 * 3600 * 1000) {
      broadcasts.delete(id);
    }
  }
}

export async function GET(req: Request) {
  pruneOldBroadcasts();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const match = broadcasts.get(id);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Siaran tidak ditemukan atau telah berakhir" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, match });
  }

  const list = Array.from(broadcasts.values())
    .filter((m) => m.isPublic !== false)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return NextResponse.json({ ok: true, matches: list });
}

export async function POST(req: Request) {
  pruneOldBroadcasts();
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ ok: false, error: "ID siaran wajib disediakan" }, { status: 400 });
    }

    const isOver = Boolean(body.over);
    const saveReplay = body.saveReplay !== false;

    if (isOver && !saveReplay) {
      broadcasts.delete(body.id);
      return NextResponse.json({ ok: true, deleted: true, status: "stopped" });
    }

    const match: BroadcastMatch = {
      id: body.id,
      whiteName: body.whiteName || "Putih",
      blackName: body.blackName || "Hitam",
      fen: body.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: Array.isArray(body.moves) ? body.moves : [],
      plyCount: Array.isArray(body.moves) ? body.moves.length : 0,
      lastUci: body.lastUci,
      commentary: body.commentary,
      over: isOver,
      outcomeLabel: body.outcomeLabel,
      isPublic: body.isPublic !== false,
      saveReplay,
      updatedAt: Date.now(),
    };

    broadcasts.set(body.id, match);
    return NextResponse.json({ ok: true, match });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
