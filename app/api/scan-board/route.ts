import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";

const CHESSCOG_URL = process.env.CHESSCOG_URL || "http://chesscog:8000";
const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "http://100.127.238.166:20129/v1";
const OMNIROUTE_KEY =
  process.env.OMNIROUTE_KEY ||
  "sk-d0bfff38efceb5e022c0022718ce9b05763131757820bb2629b35a7daeeac0641";

/**
 * Validasi dan perbaiki notasi FEN secara deterministik.
 * Memastikan 8 baris terisi tepat 8 kotak, tidak ada pion di baris 1/8,
 * serta memastikan Raja Putih (K) dan Raja Hitam (k) ada agar sah menurut chess.js.
 */
export function sanitizeAndRepairFen(rawFen: string): string | null {
  if (!rawFen || typeof rawFen !== "string") return null;
  let fen = rawFen.trim();
  if (!fen.includes(" ")) fen += " w - - 0 1";

  // 1. Uji langsung jika sudah valid
  try {
    const c = new Chess(fen);
    return c.fen();
  } catch {
    // Lanjutkan ke tahap rekonstruksi
  }

  try {
    const parts = fen.split(" ");
    const ranks = parts[0].split("/");
    if (ranks.length !== 8) return null;

    let hasWhiteKing = parts[0].includes("K");
    let hasBlackKing = parts[0].includes("k");

    // Ekspansi setiap baris menjadi 8 karakter kotak (kosong = "")
    const expanded = ranks.map((rank, rankIdx) => {
      let squares: string[] = [];
      for (const ch of rank) {
        if (ch >= "1" && ch <= "8") {
          for (let i = 0; i < parseInt(ch, 10); i++) squares.push("");
        } else {
          squares.push(ch);
        }
      }
      if (squares.length < 8) {
        while (squares.length < 8) squares.push("");
      } else if (squares.length > 8) {
        squares = squares.slice(0, 8);
      }
      // Aturan Catur: Pion tidak boleh berada di baris 8 (index 0) atau baris 1 (index 7)
      if (rankIdx === 0 || rankIdx === 7) {
        squares = squares.map((sq) => (sq.toLowerCase() === "p" ? "" : sq));
      }
      return squares;
    });

    // Pastikan Raja Putih (K) di baris 1 (index 7, kolom e/index 4 jika kosong)
    if (!hasWhiteKing) {
      if (!expanded[7][4] || expanded[7][4] === "") {
        expanded[7][4] = "K";
      } else {
        const emptyIdx = expanded[7].findIndex((s) => s === "");
        if (emptyIdx !== -1) expanded[7][emptyIdx] = "K";
        else expanded[7][4] = "K";
      }
    }

    // Pastikan Raja Hitam (k) di baris 8 (index 0, kolom e/index 4 jika kosong)
    if (!hasBlackKing) {
      if (!expanded[0][4] || expanded[0][4] === "") {
        expanded[0][4] = "k";
      } else {
        const emptyIdx = expanded[0].findIndex((s) => s === "");
        if (emptyIdx !== -1) expanded[0][emptyIdx] = "k";
        else expanded[0][4] = "k";
      }
    }

    // Rekompresi 8 baris kembali ke string FEN
    const recompressed = expanded
      .map((row) => {
        let r = "";
        let empty = 0;
        for (const sq of row) {
          if (!sq) {
            empty++;
          } else {
            if (empty > 0) {
              r += empty;
              empty = 0;
            }
            r += sq;
          }
        }
        if (empty > 0) r += empty;
        return r;
      })
      .join("/");

    const candidate = `${recompressed} ${parts[1] || "w"} ${parts[2] || "-"} ${parts[3] || "-"} ${parts[4] || "0"} ${parts[5] || "1"}`;
    const c = new Chess(candidate);
    return c.fen();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, fen: rawFen } = body;

    // 1. Validasi FEN Langsung jika dikirim oleh client
    if (rawFen && typeof rawFen === "string") {
      const repaired = sanitizeAndRepairFen(rawFen);
      if (repaired) {
        return NextResponse.json({
          ok: true,
          fen: repaired,
          confidence: 1.0,
          source: "direct-fen",
        });
      }
      return NextResponse.json(
        { ok: false, error: "Format notasi FEN tidak valid." },
        { status: 400 }
      );
    }

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "Gambar atau FEN wajib disediakan." },
        { status: 400 }
      );
    }

    // 2. PRIMARY ENGINE: Local Computer Vision Chesscog (ResNet + InceptionV3 + Perspective OMR)
    // Kecepatan ~1.4 detik, 100% offline di container jev-chesscog
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
          const repaired = sanitizeAndRepairFen(data.fen);
          if (repaired) {
            return NextResponse.json({
              ok: true,
              fen: repaired,
              boardFen: data.board_fen,
              corners: data.corners,
              confidence: data.confidence || 0.95,
              engine: "chesscog-cv",
            });
          }
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
        "Output ONLY valid standard FEN notation (e.g. 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3'). " +
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
        signal: AbortSignal.timeout(35000),
      });

      if (upstream.ok) {
        const data = await upstream.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        const cleanContent = content.replace(/```(?:json|fen)?/gi, "").replace(/```/g, "").trim();

        const match = cleanContent.match(/([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+[KQkq-]+\s+[a-h1-8-]+\s+\d+\s+\d+)?/);
        const candidateFen = match ? match[0] : cleanContent;

        const repaired = sanitizeAndRepairFen(candidateFen);
        if (repaired) {
          return NextResponse.json({
            ok: true,
            fen: repaired,
            confidence: 0.92,
            engine: "omniroute-llm",
          });
        }
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
