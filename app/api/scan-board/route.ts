import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";

const CHESSCOG_URL = process.env.CHESSCOG_URL || "http://chesscog:8000";
const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "http://100.127.238.166:20129/v1";
const OMNIROUTE_KEY =
  process.env.OMNIROUTE_KEY ||
  "sk-d0bfff38efceb5e022c0022718ce9b05763131757820bb2629b35a7daeeac0641";

/**
 * Validasi dan periksa apakah FEN masuk akal dalam permainan catur nyata.
 * Menolak posisi halusinasi (seperti 10 kuda hitam atau 5 benteng putih).
 */
function isChessPlausible(fen: string): boolean {
  try {
    const c = new Chess(fen);
    const board = c.board().flat().filter(Boolean);
    const whitePieces = board.filter((p) => p && p.color === "w");
    const blackPieces = board.filter((p) => p && p.color === "b");

    // Maksimal 16 bidak per sisi
    if (whitePieces.length > 16 || blackPieces.length > 16) return false;

    // Maksimal 8 pion per sisi
    const whitePawns = whitePieces.filter((p) => p && p.type === "p").length;
    const blackPawns = blackPieces.filter((p) => p && p.type === "p").length;
    if (whitePawns > 8 || blackPawns > 8) return false;

    // Cegah anomali model klasik: 10 kuda atau 5 benteng
    const whiteKnights = whitePieces.filter((p) => p && p.type === "n").length;
    const blackKnights = blackPieces.filter((p) => p && p.type === "n").length;
    if (whiteKnights > 4 || blackKnights > 4) return false;

    const whiteRooks = whitePieces.filter((p) => p && p.type === "r").length;
    const blackRooks = blackPieces.filter((p) => p && p.type === "r").length;
    if (whiteRooks > 4 || blackRooks > 4) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Validasi dan perbaiki notasi FEN secara deterministik.
 */
export function sanitizeAndRepairFen(rawFen: string): string | null {
  if (!rawFen || typeof rawFen !== "string") return null;
  let fen = rawFen.trim();
  if (!fen.includes(" ")) fen += " w - - 0 1";

  try {
    const c = new Chess(fen);
    return c.fen();
  } catch {
    // Lanjutkan ke rekonstruksi
  }

  try {
    const parts = fen.split(" ");
    const ranks = parts[0].split("/");
    if (ranks.length !== 8) return null;

    let hasWhiteKing = parts[0].includes("K");
    let hasBlackKing = parts[0].includes("k");

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
      if (rankIdx === 0 || rankIdx === 7) {
        squares = squares.map((sq) => (sq.toLowerCase() === "p" ? "" : sq));
      }
      return squares;
    });

    let whitePawns = 0;
    let blackPawns = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (expanded[r][c] === "P") {
          whitePawns++;
          if (whitePawns > 8) expanded[r][c] = "";
        } else if (expanded[r][c] === "p") {
          blackPawns++;
          if (blackPawns > 8) expanded[r][c] = "";
        }
      }
    }

    if (!hasWhiteKing) {
      if (!expanded[7][4] || expanded[7][4] === "") expanded[7][4] = "K";
      else {
        const emptyIdx = expanded[7].findIndex((s) => s === "");
        if (emptyIdx !== -1) expanded[7][emptyIdx] = "K";
        else expanded[7][4] = "K";
      }
    }

    if (!hasBlackKing) {
      if (!expanded[0][4] || expanded[0][4] === "") expanded[0][4] = "k";
      else {
        const emptyIdx = expanded[0].findIndex((s) => s === "");
        if (emptyIdx !== -1) expanded[0][emptyIdx] = "k";
        else expanded[0][4] = "k";
      }
    }

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

    // 1. Direct FEN input
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

    // 2. PRIMARY ENGINE: Modern Multimodal Foundation Vision (Gemini 2.5 Flash via OmniRoute)
    // Memahami sudut kamera 3D, refleksi bidak logam/plastik, dan teori pembukaan catur nyata.
    try {
      const systemPrompt =
        "You are a world-class Chess Vision and FEN extraction engine.\n" +
        "Carefully examine the 8x8 squares of this physical chessboard:\n" +
        "- Rank 8 (Black back rank): r n b q k b n r\n" +
        "- Rank 7 (Black pawns): check which pawns moved (e.g. d5, e5)\n" +
        "- Ranks 6 to 3 (Center): check active pieces (e.g. White pawn e4, Black pawns, White knight f3)\n" +
        "- Rank 2 (White pawns): check remaining pawns\n" +
        "- Rank 1 (White back rank): R N B Q K B N R (check developed pieces)\n\n" +
        "Return ONLY valid JSON:\n" +
        '{"fen": "FEN_STRING_HERE", "opening": "OPENING_NAME", "turn": "w"}';

      const imgPayload = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

      const vlmRes = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OMNIROUTE_KEY}`,
        },
        body: JSON.stringify({
          model: "antigravity/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: systemPrompt },
                { type: "image_url", image_url: { url: imgPayload } },
              ],
            },
          ],
          temperature: 0.0,
          max_tokens: 150,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (vlmRes.ok) {
        const vlmData = await vlmRes.json();
        const content = vlmData.choices?.[0]?.message?.content?.trim() || "";
        const cleanContent = content.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

        // Coba parse JSON
        let candidateFen: string | null = null;
        let openingName: string | null = null;
        try {
          const parsed = JSON.parse(cleanContent);
          candidateFen = parsed.fen || null;
          openingName = parsed.opening || null;
        } catch {
          const match = cleanContent.match(/([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+[KQkq-]+\s+[a-h1-8-]+\s+\d+\s+\d+)?/);
          if (match) candidateFen = match[0];
        }

        if (candidateFen) {
          const repaired = sanitizeAndRepairFen(candidateFen);
          if (repaired && isChessPlausible(repaired)) {
            return NextResponse.json({
              ok: true,
              fen: repaired,
              opening: openingName,
              confidence: 0.98,
              engine: "multimodal-vlm",
            });
          }
        }
      }
    } catch (vlmErr: any) {
      console.warn("Modern VLM inference skipped or failed:", vlmErr?.message);
    }

    // 3. SECONDARY ENGINE (FAILOVER): Local Computer Vision Chesscog
    // Dipakai jika network VLM offline, DENGAN validasi ketat isChessPlausible
    try {
      const chesscogRes = await fetch(`${CHESSCOG_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
        signal: AbortSignal.timeout(8000),
      });

      if (chesscogRes.ok) {
        const data = await chesscogRes.json();
        if (data.ok && data.fen) {
          const repaired = sanitizeAndRepairFen(data.fen);
          // HANYA terima jika masuk akal (bukan anomali 10 kuda)
          if (repaired && isChessPlausible(repaired)) {
            return NextResponse.json({
              ok: true,
              fen: repaired,
              boardFen: data.board_fen,
              corners: data.corners,
              confidence: 0.90,
              engine: "chesscog-cv",
            });
          } else {
            console.warn("Chesscog prediction rejected as implausible:", data.fen);
          }
        }
      }
    } catch (cvErr: any) {
      console.warn("Chesscog local CV failed:", cvErr?.message);
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Gagal mengenali posisi catur dari gambar (gambar buram atau sudut papan terlalu tajam). Silakan gunakan preset cepat atau tempel FEN.",
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
