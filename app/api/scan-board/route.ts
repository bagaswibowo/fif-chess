import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";

const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "http://100.127.238.166:20129/v1";
const OMNIROUTE_KEY =
  process.env.OMNIROUTE_API_KEY ||
  process.env.OPENAI_API_KEY ||
  "sk-d0bfff38efceb5e022c0022718ce9b05763131757820bb2629b35a7daeeac0641";

// Endpoint pemindai foto papan catur (Kamera HP, Webcam, Upload Foto / Screenshot)
export async function POST(req: NextRequest) {
  try {
    const { image, fen: directFen } = await req.json();

    // 1. Jika FEN langsung di-pass
    if (directFen && typeof directFen === "string") {
      try {
        const chess = new Chess(directFen.trim());
        return NextResponse.json({
          ok: true,
          fen: chess.fen(),
          confidence: 1.0,
          turn: chess.turn() === "w" ? "white" : "black",
          piecesCount: {
            white: chess.board().flat().filter((p) => p && p.color === "w").length,
            black: chess.board().flat().filter((p) => p && p.color === "b").length,
          },
        });
      } catch {
        return NextResponse.json({ error: "Format FEN tidak valid" }, { status: 400 });
      }
    }

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Data gambar tidak ditemukan" }, { status: 400 });
    }

    let detectedFen: string | null = null;

    // 2. Multimodal LLM Vision Extractor via OmniRoute (auto/best-vision)
    try {
      const promptText =
        "You are an expert chess FEN vision extractor. Analyze this real-life chessboard photo or screenshot carefully.\n" +
        "1. Identify every White piece and Black piece on their exact squares (rank 1-8, file a-h).\n" +
        "2. Determine whose turn it is (default to 'w' if unclear).\n" +
        "3. Output ONLY the valid FEN string (e.g. 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').\n" +
        "Do not output markdown, reasoning, or extra words.";

      const visionRes = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OMNIROUTE_KEY}`,
        },
        body: JSON.stringify({
          model: "auto/best-vision",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                {
                  type: "image_url",
                  image_url: { url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}` },
                },
              ],
            },
          ],
          temperature: 0.1,
        }),
      });

      if (visionRes.ok) {
        const vData = await visionRes.json();
        const rawOutput = vData.choices?.[0]?.message?.content?.trim() || "";
        const fenMatch = rawOutput.match(/([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(\s+[wb]\s+[\w-]+\s+[\w-]+\s+\d+\s+\d+)?/);
        if (fenMatch) {
          let candidate = fenMatch[0].trim();
          if (!candidate.includes(" w ") && !candidate.includes(" b ")) {
            candidate += " w KQkq - 0 1";
          }
          const testChess = new Chess(candidate);
          detectedFen = testChess.fen();
        }
      } else {
        console.warn("OmniRoute vision response not ok:", visionRes.status, await visionRes.text().catch(() => ""));
      }
    } catch (err) {
      console.warn("Vision model detection failed:", err);
    }

    if (!detectedFen) {
      return NextResponse.json(
        { error: "Gagal mengenali posisi catur dari gambar. Pastikan 64 petak papan catur terlihat jelas atau masukkan FEN secara manual." },
        { status: 400 }
      );
    }

    const finalChess = new Chess(detectedFen);

    return NextResponse.json({
      ok: true,
      fen: finalChess.fen(),
      confidence: 0.98,
      turn: finalChess.turn() === "w" ? "white" : "black",
      piecesCount: {
        white: finalChess.board().flat().filter((p) => p && p.color === "w").length,
        black: finalChess.board().flat().filter((p) => p && p.color === "b").length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal memindai gambar" }, { status: 500 });
  }
}
