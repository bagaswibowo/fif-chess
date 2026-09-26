import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";

const CHESSCOG_URL = process.env.CHESSCOG_URL || "http://chesscog:8000";
const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "http://100.127.238.166:20129/v1";
const OMNIROUTE_KEY =
  process.env.OMNIROUTE_KEY ||
  "sk-d0bfff38efceb5e022c0022718ce9b05763131757820bb2629b35a7daeeac0641";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, fen: rawFen } = body;

    // 1. Direct FEN validation
    if (rawFen && typeof rawFen === "string") {
      try {
        const chess = new Chess(rawFen.trim());
        return NextResponse.json({
          ok: true,
          fen: chess.fen(),
          confidence: 1.0,
          source: "direct-fen",
        });
      } catch {
        return NextResponse.json(
          { ok: false, error: "Format notasi FEN tidak valid." },
          { status: 400 }
        );
      }
    }

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "Gambar atau FEN wajib disediakan." },
        { status: 400 }
      );
    }

    // 2. PRIMARY ENGINE: Local Computer Vision Chesscog (ResNet + InceptionV3 + Perspective OMR)
    // Kecepatan ~1.4 detik, 100% offline, tanpa timeout
    try {
      const chesscogRes = await fetch(`${CHESSCOG_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
        signal: AbortSignal.timeout(10000),
      });

      if (chesscogRes.ok) {
        const data = await chesscogRes.json();
        if (data.ok && data.fen) {
          const cleanFen = data.fen.trim();
          let finalFen = cleanFen;
          try {
            const chess = new Chess(cleanFen);
            finalFen = chess.fen();
          } catch {
            finalFen = cleanFen.includes(" ") ? cleanFen : (cleanFen + " w - - 0 1");
          }
          return NextResponse.json({
            ok: true,
            fen: finalFen,
            boardFen: data.board_fen,
            corners: data.corners,
            confidence: data.confidence || 0.95,
            engine: "chesscog-cv",
          });
        }
      }
    } catch (e: any) {
      console.warn("Chesscog local CV skipped or failed:", e?.message);
    }

    // 3. SECONDARY ENGINE (FALLBACK): Multimodal LLM Vision via OmniRoute
    try {
      const promptText =
        "You are an expert chess FEN vision extractor. Analyze this real-life chessboard photo accurately. " +
        "Detect the 8x8 squares and all pieces (P, N, B, R, Q, K for White; p, n, b, r, q, k for Black). " +
        "Output ONLY valid standard FEN notation (e.g. 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'). " +
        "Do not include explanation, do not include markdown codeblocks, only the raw FEN string.";

      const upstream = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OMNIROUTE_KEY}`,
        },
        body: JSON.stringify({
          model: "auto",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                {
                  type: "image_url",
                  image_url: {
                    url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 120,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (upstream.ok) {
        const data = await upstream.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        const cleanContent = content.replace(/```(?:json|fen)?/gi, "").replace(/```/g, "").trim();

        const match = cleanContent.match(/([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+[KQkq-]+\s+[a-h1-8-]+\s+\d+\s+\d+)?/);
        const candidateFen = match ? match[0] : cleanContent;

        const fullFen = candidateFen.includes(" ") ? candidateFen : `${candidateFen} w - - 0 1`;
        const chess = new Chess(fullFen);

        return NextResponse.json({
          ok: true,
          fen: chess.fen(),
          confidence: 0.90,
          engine: "omniroute-llm",
        });
      }
    } catch (llmErr: any) {
      console.error("OmniRoute fallback failed:", llmErr?.message);
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Gagal mengenali posisi catur dari gambar (sudut papan tidak terdeteksi atau gambar buram). Silakan gunakan preset cepat atau tempel FEN.",
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
