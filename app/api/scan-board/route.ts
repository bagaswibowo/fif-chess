import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";

const CHESSCOG_URL = process.env.CHESSCOG_URL || "http://chesscog:8000";
const YOLO11_URL = process.env.YOLO11_URL || "http://yolo11:8100";
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

    // Tepat satu raja per sisi — VLM sering mengarang raja ganda/absen.
    const whiteKings = whitePieces.filter((p) => p && p.type === "k").length;
    const blackKings = blackPieces.filter((p) => p && p.type === "k").length;
    if (whiteKings !== 1 || blackKings !== 1) return false;

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

/**
 * Rekonsiliasi pion: Jika sebuah lajur (file) memiliki pion yang sudah maju
 * ke petak tengah (misal d5 atau e5), maka petak asal (d7 atau e7) wajib kosong.
 * Ini mencegah VLM/CV mendeteksi 9 pion akibat menduplikasi pion asal dan pion maju.
 */
export function reconcilePawnColumns(fenString: string): string {
  try {
    const parts = fenString.trim().split(" ");
    const ranks = parts[0].split("/");
    if (ranks.length !== 8) return fenString;

    const grid: string[][] = ranks.map((r) => {
      const row: string[] = [];
      for (const ch of r) {
        if (ch >= "1" && ch <= "8") {
          for (let i = 0; i < parseInt(ch, 10); i++) row.push("");
        } else {
          row.push(ch);
        }
      }
      return row;
    });

    // 1. Rekonsiliasi Pion Hitam: Grid row 1 adalah Rank 7.
    // Jika ada pion hitam maju di row 2..5 (Rank 6..3), kosongkan row 1 (Rank 7).
    for (let col = 0; col < 8; col++) {
      if (grid[1][col] === "p") {
        let hasAdvanced = false;
        for (let row = 2; row <= 5; row++) {
          if (grid[row][col] === "p") {
            hasAdvanced = true;
            break;
          }
        }
        if (hasAdvanced) {
          grid[1][col] = "";
        }
      }
    }

    // 2. Rekonsiliasi Pion Putih: Grid row 6 adalah Rank 2.
    // Jika ada pion putih maju di row 2..5 (Rank 6..3), kosongkan row 6 (Rank 2).
    for (let col = 0; col < 8; col++) {
      if (grid[6][col] === "P") {
        let hasAdvanced = false;
        for (let row = 2; row <= 5; row++) {
          if (grid[row][col] === "P") {
            hasAdvanced = true;
            break;
          }
        }
        if (hasAdvanced) {
          grid[6][col] = "";
        }
      }
    }

    // Kompresi ulang ke FEN
    const recompressed = grid
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

    return `${recompressed} ${parts.slice(1).join(" ") || "w - - 0 1"}`;
  } catch {
    return fenString;
  }
}

export function sanitizeAndRepairFen(rawFen: string): string | null {
  if (!rawFen || typeof rawFen !== "string") return null;
  let fen = reconcilePawnColumns(rawFen.trim());
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
    const { image, fen: rawFen, prewarped } = body;

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

    // 2. PRIMARY ENGINE: Modern Multimodal Foundation Vision
    // Mendukung Gemini API, OpenAI API, dan OmniRoute.
    //
    // STRATEGI AKURASI: VLM buruk menulis FEN langsung (sering salah panjang rank,
    // kebalang orientasi, atau mengarang bidak). Minta model mengekstrak papan
    // sebagai GRID 64 KARAKTER per baris (8 baris × 8 kolom, dari kiri atas = a8
    // sampai kanan bawah = h1). Grid ini deterministik dan mudah diperiksa:
    // - '.' = petak kosong, huruf kapital = putih (PNBRQK), huruf kecil = hitam (pnbrqk).
    // Grid lalu dikonversi ke FEN secara deterministik di server — bukan oleh model.
    const imgPayload = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
    const systemPrompt =
      "You are a precise chess board perception engine. Read the physical chessboard in this image.\n\n" +
      "STEP 1 - ORIENTATION:\n" +
      "Determine which corner is a8 (black queen-side corner). The board may be photographed from either player's side.\n" +
      "A standard starting position has 4 rooks in the corners, knights next to them, and kings/e on the back ranks.\n" +
      "White pieces are light-colored with the white king often marked; black pieces are dark.\n" +
      "If white pieces appear at the BOTTOM of the photo, the photo is from White's side and row 1 of your grid = rank 8.\n" +
      "If black pieces appear at the BOTTOM, the photo is from Black's side and row 1 of your grid = rank 1 (then reversed later).\n\n" +
      "STEP 2 - GRID EXTRACTION:\n" +
      "Output EXACTLY 8 lines, each with EXACTLY 8 characters, top row first.\n" +
      "Use one character per square:\n" +
      "  '.' = empty\n" +
      "  P p = pawn (White / black)\n" +
      "  N n = knight\n" +
      "  B b = bishop\n" +
      "  R r = rook\n" +
      "  Q q = queen\n" +
      "  K k = king\n" +
      "Rules:\n" +
      "- Count squares carefully; empty dark squares are NOT pieces.\n" +
      "- Shadows, reflections and wood grain are NOT pieces.\n" +
      "- A chess STARTING position must have exactly 8 pawns per side on rank 7 / rank 2 - use this as a sanity check.\n" +
      "- There is exactly ONE king per side.\n\n" +
      "STEP 3 - OUTPUT: Return ONLY valid JSON, no other text:\n" +
      '{"orientation": "white_bottom" | "black_bottom", "rows": ["........", "........", "........", "........", "........", "........", "........", "........"]}\n' +
      'rows[0] must be the TOP row of the board as seen in the photo. Each row MUST be exactly 8 characters.';

    /**
     * Konversi grid 8x8 dari respons VLM menjadi FEN dengan validasi ketat.
     * Mengembalikan null jika grid tidak layak (bukan papan catur masuk akal).
     */
    const gridToFen = (
      rows: string[],
      orientation: string
    ): string | null => {
      if (!Array.isArray(rows) || rows.length !== 8) return null;
      const norm = rows.map((r) => r.replace(/[^PNBRQKpnbrqk.]/g, ""));
      if (norm.some((r) => r.length !== 8)) return null;

      // rows[0] adalah baris teratas FOTO. Susun rank 8 → rank 1.
      let grid = norm.map((r) => r.split(""));
      if (orientation === "black_bottom") {
        // Foto dari sisi Hitam: baris teratas foto = rank 1. Balik urutan baris
        // dan setiap barisnya (rotasi 180°) agar grid menjadi rank 8 → rank 1.
        grid = grid
          .slice()
          .reverse()
          .map((r) => r.slice().reverse());
      }

      // grid[0] = rank 8 ... grid[7] = rank 1. FEN menulis rank 8 dulu.
      const boardFen = grid
        .map((row) => {
          let fen = "", empty = 0;
          for (const sq of row) {
            if (sq === "." || sq === "") { empty++; continue; }
            if (empty > 0) { fen += empty; empty = 0; }
            fen += sq;
          }
          if (empty > 0) fen += empty;
          return fen;
        })
        .join("/");

      const fullFen = `${boardFen} w - - 0 1`;
      const repaired = sanitizeAndRepairFen(fullFen);
      return repaired && isChessPlausible(repaired) ? repaired : null;
    };

    const parseVisionGrid = (cleanText: string): { fen: string; orientation: string } | null => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanText);
      } catch {
        // Model kadang menyisipkan teks sebelum/ sesudah JSON. Ambil objek pertama.
        const m = cleanText.match(/\{[\s\S]*\}/);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch { return null; }
        }
      }
      if (parsed && Array.isArray(parsed.rows)) {
        const fen = gridToFen(parsed.rows, parsed.orientation || "white_bottom");
        if (fen) return { fen, orientation: parsed.orientation || "white_bottom" };
      }
      // Fallback: model balas 8 baris polos tanpa JSON.
      const lineRows = cleanText
        .split(/\n+/)
        .map((l) => l.trim().replace(/[^PNBRQKpnbrqk.]/g, ""))
        .filter((l) => l.length === 8 && /[PNBRQKpnbrqk]/.test(l));
      if (lineRows.length === 8) {
        const fen = gridToFen(lineRows, "white_bottom");
        if (fen) return { fen, orientation: "white_bottom" };
      }
      return null;
    };

    // 2a. Direct Google Gemini Vision (if GEMINI_API_KEY provided)
    if (process.env.GEMINI_API_KEY) {
      try {
        const base64Data = imgPayload.replace(/^data:image\/\w+;base64,/, "");
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    { inlineData: { mimeType: "image/jpeg", data: base64Data } },
                  ],
                },
              ],
              generationConfig: { temperature: 0, maxOutputTokens: 400 },
            }),
            signal: AbortSignal.timeout(20000),
          }
        );
        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const rawText = gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          const cleanText = rawText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
          const viaGrid = parseVisionGrid(cleanText);
          let candFen: string | null = viaGrid?.fen ?? null;
          if (!candFen) {
            // Fallback: model yang membalas FEN langsung.
            const match = cleanText.match(/([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+[KQkq-]+\s+[a-h1-8-]+\s+\d+\s+\d+)?/);
            if (match) candFen = match[0];
          }
          if (candFen) {
            const rep = sanitizeAndRepairFen(candFen);
            if (rep && isChessPlausible(rep)) {
              return NextResponse.json({
                ok: true,
                fen: rep,
                confidence: viaGrid ? 0.97 : 0.85,
                engine: "gemini-vision",
              });
            }
          }
        }
      } catch (geminiErr: any) {
        console.warn("Direct Gemini inference skipped:", geminiErr?.message);
      }
    }

    // 2b. Direct OpenAI Vision (if OPENAI_API_KEY provided)
    if (process.env.OPENAI_API_KEY) {
      try {
        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: systemPrompt },
                  { type: "image_url", image_url: { url: imgPayload } },
                ],
              },
            ],
            max_tokens: 400,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          const clean = oaiData?.choices?.[0]?.message?.content?.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim() || "";
          const viaGrid = parseVisionGrid(clean);
          let candFen: string | null = viaGrid?.fen ?? null;
          if (!candFen) {
            const match = clean.match(/([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+[KQkq-]+\s+[a-h1-8-]+\s+\d+\s+\d+)?/);
            if (match) candFen = match[0];
          }
          if (candFen) {
            const rep = sanitizeAndRepairFen(candFen);
            if (rep && isChessPlausible(rep)) {
              return NextResponse.json({
                ok: true,
                fen: rep,
                confidence: viaGrid ? 0.97 : 0.85,
                engine: "openai-vision",
              });
            }
          }
        }
      } catch (oaiErr: any) {
        console.warn("Direct OpenAI vision inference skipped:", oaiErr?.message);
      }
    }

    // 2c. OmniRoute VLM endpoint
    try {
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
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (vlmRes.ok) {
        const vlmData = await vlmRes.json();
        const content = vlmData.choices?.[0]?.message?.content?.trim() || "";
        const cleanContent = content.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

        const viaGrid = parseVisionGrid(cleanContent);
        let candidateFen: string | null = viaGrid?.fen ?? null;
        let openingName: string | null = null;
        if (!candidateFen) {
          // Fallback: model yang membalas FEN langsung.
          try {
            const parsed = JSON.parse(cleanContent);
            candidateFen = parsed.fen || null;
            openingName = parsed.opening || null;
          } catch {
            const match = cleanContent.match(/([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+[KQkq-]+\s+[a-h1-8-]+\s+\d+\s+\d+)?/);
            if (match) candidateFen = match[0];
          }
        }

        if (candidateFen) {
          const repaired = sanitizeAndRepairFen(candidateFen);
          if (repaired && isChessPlausible(repaired)) {
            return NextResponse.json({
              ok: true,
              fen: repaired,
              opening: openingName,
              confidence: viaGrid ? 0.97 : 0.85,
              engine: "multimodal-vlm",
            });
          }
        }
      }
    } catch (vlmErr: any) {
      console.warn("Modern VLM inference skipped or failed:", vlmErr?.message);
    }

    // 2e. Chesscog prewarped-direct: gambar sudah di-warp persegi oleh
    // PerspectiveCropModal client — baca 64 petak tanpa deteksi papan.
    // Ini jalur 100% lokal tanpa API key, dan paling andal untuk foto miring.
    if (prewarped) {
      try {
        const preRes = await fetch(`${CHESSCOG_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, prewarped: true }),
          signal: AbortSignal.timeout(15000),
        });
        if (preRes.ok) {
          const preData = await preRes.json();
          if (preData.ok && preData.fen) {
            const repaired = sanitizeAndRepairFen(preData.fen);
            if (repaired && isChessPlausible(repaired)) {
              return NextResponse.json({
                ok: true,
                fen: repaired,
                boardFen: preData.board_fen,
                confidence: 0.96,
                engine: "prewarped-direct",
              });
            }
          }
        }
      } catch (preErr: any) {
        console.warn("Prewarped direct read skipped:", preErr?.message);
      }
    }

    // 2d. YOLOv11 lokal — prioritas akurasi tertinggi untuk foto papan fisik.
    // Deteksi per-bidak (bukan tebakan VLM), jadi posisi jauh lebih konsisten.
    try {
      const yoloRes = await fetch(`${YOLO11_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imgPayload, autoCrop: !prewarped, prewarped: !!prewarped }),
        signal: AbortSignal.timeout(12000),
      });

      if (yoloRes.ok) {
        const yoloData = await yoloRes.json();
        if (yoloData.ok && yoloData.fen) {
          const repaired = sanitizeAndRepairFen(yoloData.fen);
          if (repaired && isChessPlausible(repaired)) {
            return NextResponse.json({
              ok: true,
              fen: repaired,
              boardFen: yoloData.board_fen,
              detections: yoloData.detections,
              confidence: 0.99,
              engine: "yolo11",
            });
          }
        }
        // Kandidat tidak sepenuhnya masuk akal (mis. raja tergeletak sehingga
        // tak terdeteksi) — tetap kirim sebagai hasil "perlu review" agar user
        // bisa mengedit di tab Papan Referensi, bukan menolak mentah.
        const candidate =
          sanitizeAndRepairFen(yoloData.board_fen_candidate || "") ||
          sanitizeAndRepairFen(yoloData.fen || "");
        const candidatePieces = candidate
          ? (candidate.match(/[a-zA-Z]/g) || []).length
          : 0;
        if (candidate && candidatePieces >= 2) {
          return NextResponse.json({
            ok: true,
            fen: candidate,
            boardFen: candidate,
            confidence: 0.6,
            engine: "yolo11-review",
            needsReview: true,
            note: "Hasil scan perlu diperiksa — beberapa bidak kemungkinan salah terbaca (mis. bidak tergeletak). Edit di tab Papan Referensi sebelum dipakai.",
          });
        }
      }
    } catch (yoloErr: any) {
      console.warn("YOLO11 service skipped:", yoloErr?.message);
    }

    // 3. Local Computer Vision Chesscog (if running)
    try {
      const chesscogRes = await fetch(`${CHESSCOG_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, prewarped: false }),
        signal: AbortSignal.timeout(6000),
      });

      if (chesscogRes.ok) {
        const data = await chesscogRes.json();
        if (data.ok && data.fen) {
          const repaired = sanitizeAndRepairFen(data.fen);
          if (repaired && isChessPlausible(repaired)) {
            return NextResponse.json({
              ok: true,
              fen: repaired,
              boardFen: data.board_fen,
              corners: data.corners,
              confidence: 0.95,
              engine: "chesscog-cv",
            });
          }
        }
      }
    } catch (cvErr: any) {
      console.warn("Chesscog local CV skipped:", cvErr?.message);
    }

    // 4. Semua engine gagal — JANGAN mengarang posisi. Ini akar bug "hasil import
    // selalu sama": fallback dulu mengembalikan posisi hardcoded sehingga user
    // selalu melihat Elephant Gambit berapa pun fotonya. Sekarang gagal jujur
    // dengan pesan yang memberi tahu cara memperbaiki.
    return NextResponse.json(
      {
        ok: false,
        error:
          "Service vision lokal (yolo11) tidak terjangkau untuk membaca foto papan. " +
          "Solusi: (1) jalankan ulang stack: docker compose up -d --build, " +
          "(2) cek log: docker logs jev-yolo11, atau " +
          "(3) tempel notasi FEN manual / gunakan preset. " +
          "Catatan: hasil scan sebaiknya selalu diperiksa & diedit di tab 'Papan Referensi & Edit Posisi'.",
      },
      { status: 422 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
