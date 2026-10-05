import { NextResponse } from "next/server";
import { reinforceMatchDopamine } from "@/lib/experience";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { history, winner } = body;
    if (Array.isArray(history) && (winner === "white" || winner === "black")) {
      reinforceMatchDopamine(history, winner);
      return NextResponse.json({ ok: true, learned: true });
    }
    return NextResponse.json({ ok: true, learned: false });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
