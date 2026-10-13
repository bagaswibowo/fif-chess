import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy ke service YOLOv11: deteksi 4 sudut papan gaya OMR-Scanner
 * (Canny -> contours -> quad terbesar). Dipakai PerspectiveCropModal untuk
 * auto-detect; user tetap bisa menggeser 4 sudut secara manual.
 */
const YOLO11_URL = process.env.YOLO11_URL || "http://yolo11:8100";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.image || typeof body.image !== "string") {
      return NextResponse.json({ ok: false, error: "Field 'image' wajib diisi (data URL base64)." }, { status: 400 });
    }

    const res = await fetch(`${YOLO11_URL}/corners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: body.image }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Service yolo11 tidak merespons (HTTP ${res.status}). Jalankan: docker compose --profile yolo11 up -d` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Service yolo11 tidak terjangkau. Jalankan: docker compose --profile yolo11 up -d (atau set YOLO11_URL di .env). Geser 4 sudut manual bila ingin lanjut tanpa service.",
      },
      { status: 502 }
    );
  }
}
