import { NextResponse } from "next/server";
import { GATE_COOKIE, gateConfigured, readCookie, sessionValid } from "@/lib/gate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const configured = Boolean(process.env.TYPESAFE_API_KEY?.trim());
  return NextResponse.json({
    hasApiKey: configured,
    gateConfigured: gateConfigured(),
    unlocked: sessionValid(readCookie(request, GATE_COOKIE)),
  });
}
