import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";

const CHESSCOG_URL = process.env.CHESSCOG_URL || "http://chesscog:8000";
const YOLO11_URL = process.env.YOLO11_URL || "http://yolo11:8100";
const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "http://100.127.238.166:20129/v1";
const OMNIROUTE_KEY = process.env.OMNIROUTE_KEY || "sk-d0b...0641";

const SYSTEM_PROMPT =
  "You are a precise chess board perception engine. Read the physical chessboard in this image.\n\n" +
  "STEP 1 - ORIENTATION:\n" +
  "Determine which corner is a8 (black queen-side corner). The board may be photographed from either player side.\n" +
  "A standard starting position has 4 rooks in the corners, knights next to them, and kings/e on the back ranks.\n" +
  "White pieces are light-colored with the white king often marked; black pieces are dark.\n" +
  "If white pieces appear at the BOTTOM of the photo, the photo is from White side and row 1 of your grid = rank 8.\n" +
  "If black pieces appear at the BOTTOM, the photo is from Black side and row 1 of your grid = rank 1 (then reversed later).\n\n" +
  "STEP 2 - GRID EXTRACTION:\n" +
  "Output EXACTLY 8 lines, each with EXACTLY 8 characters, top row first.\n" +
  "Use one character per square:\n" +
  "  . = empty\n" +
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
  "{\"orientation\": \"white_bottom\" | \"black_bottom\", \"rows\": [\"........\", \"........\", \"........\", \"........\", \"........\", \"........\", \"........\", \"........\"]}\n" +
  "rows[0] must be the TOP row of the board as seen in the photo. Each row MUST be exactly 8 characters.";

function isChessPlausible(fen: string): boolean {
  try {
    const c = new Chess(fen);
    const board = c.board().flat().filter(Boolean);
    const whitePieces = board.filter((p) => p && p.color === "w");
    const blackPieces = board.filter((p) => p && p.color === "b");

    const whiteKings = whitePieces.filter((p) => p && p.type === "k").length;
    const blackKings = blackPieces.filter((p) => p && p.type === "k").length;
    if (whiteKings !== 1 || blackKings !== 1) return false;

    if (whitePieces.length > 16 || blackPieces.length > 16) return false;

    const whitePawns = whitePieces.filter((p) => p && p.type === "p").length;
    const blackPawns = blackPieces.filter((p) => p && p.type === "p").length;
    if (whitePawns > 8 || blackPawns > 8) return false;

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

    for (let col = 0; col < 8; col++) {
      if (grid[1][col] === "p") {
        let hasAdvanced = false;
        for (let row = 2; row <= 5; row++) {
          if (grid[row][col] === "p") {
            hasAdvanced = true;
            break;
          }
        }
        if (hasAdvanced) grid[1][col] = "";
      }
    }

    for (let col = 0; col < 8; col++) {
      if (grid[6][col] === "P") {
        let hasAdvanced = false;
        for (let row = 2; row <= 5; row++) {
          if (grid[row][col] === "P") {
            hasAdvanced = true;
            break;
          }
        }
        if (hasAdvanced) grid[6][col] = "";
      }
    }

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
  } catch {}

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

function gridToFen(rows: string[], orientation: string): string | null {
  if (!Array.isArray(rows) || rows.length !== 8) return null;
  const norm = rows.map((r) => r.replace(/[^PNBRQKpnbrqk.]/g, ""));
  if (norm.some((r) => r.length !== 8)) return null;

  let grid = norm.map((r) => r.split(""));
  if (orientation === "black_bottom") {
    grid = grid.slice().reverse().map((r) => r.slice().reverse());
  }

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
}

function parseVisionGrid(cleanText: string): { fen: string; orientation: string } | null {
  let parsed: any = null;
  try {
    parsed = JSON.parse(cleanText);
  } catch {
    const m = cleanText.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { return null; }
    }
  }
  if (parsed && Array.isArray(parsed.rows)) {
    const fen = gridToFen(parsed.rows, parsed.orientation || "white_bottom");
    if (fen) return { fen, orientation: parsed.orientation || "white_bottom" };
  }

  const lineRows = cleanText
    .split(/\n+/)
    .map((l) => l.trim().replace(/[^PNBRQKpnbrqk.]/g, ""))
    .filter((l) => l.length === 8 && /[PNBRQKpnbrqk]/.test(l));

  if (lineRows.length === 8) {
    const fen = gridToFen(lineRows, "white_bottom");
    if (fen) return { fen, orientation: "white_bottom" };
  }
  return null;
}

async function scanWithGemini(base64Data: string) {
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: SYSTEM_PROMPT },
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
      if (viaGrid) {
        return { ok: true, fen: viaGrid.fen, orientation: viaGrid.orientation, confidence: 0.96, source: "gemini-1.5-flash" };
      }
    }
  } catch {}
  return null;
}

async function scanWithOmniRoute(imgPayload: string) {
  try {
    const omniRes = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OMNIROUTE_KEY}`,
      },
      body: JSON.stringify({
        model: "auto/best-free",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SYSTEM_PROMPT },
              { type: "image_url", image_url: { url: imgPayload } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (omniRes.ok) {
      const oData = await omniRes.json();
      const rawText = oData?.choices?.[0]?.message?.content?.trim() || "";
      const cleanText = rawText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const viaGrid = parseVisionGrid(cleanText);
      if (viaGrid) {
        return { ok: true, fen: viaGrid.fen, orientation: viaGrid.orientation, confidence: 0.95, source: "omniroute-vlm" };
      }
    }
  } catch {}
  return null;
}

async function scanWithYolo11(image: string, prewarped?: boolean) {
  try {
    const yoloRes = await fetch(`${YOLO11_URL}/scan-board`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, prewarped }),
      signal: AbortSignal.timeout(15000),
    });
    if (yoloRes.ok) {
      const yData = await yoloRes.json();
      const fenCandidate = yData.fen || yData.predicted_fen;
      if (fenCandidate) {
        const repaired = sanitizeAndRepairFen(fenCandidate);
        if (repaired && isChessPlausible(repaired)) {
          return { ok: true, fen: repaired, confidence: yData.confidence || 0.90, source: "yolo11-service" };
        }
      }
    }
  } catch {}
  return null;
}

async function scanWithChesscog(image: string, prewarped?: boolean) {
  try {
    const cogRes = await fetch(`${CHESSCOG_URL}/scan-board`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, prewarped }),
      signal: AbortSignal.timeout(20000),
    });
    if (cogRes.ok) {
      const cData = await cogRes.json();
      const fenCandidate = cData.fen || cData.predicted_fen;
      if (fenCandidate) {
        const repaired = sanitizeAndRepairFen(fenCandidate);
        if (repaired && isChessPlausible(repaired)) {
          return { ok: true, fen: repaired, confidence: cData.confidence || 0.85, source: "chesscog-service" };
        }
      }
    }
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, fen: rawFen, prewarped } = body;

    if (rawFen && typeof rawFen === "string") {
      const repaired = sanitizeAndRepairFen(rawFen);
      if (repaired) {
        return NextResponse.json({ ok: true, fen: repaired, confidence: 1.0, source: "direct-fen" });
      }
      return NextResponse.json({ ok: false, error: "Format notasi FEN tidak valid." }, { status: 400 });
    }

    if (!image) {
      return NextResponse.json({ ok: false, error: "Gambar atau FEN wajib disediakan." }, { status: 400 });
    }

    const imgPayload = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
    const base64Data = imgPayload.replace(/^data:image\/\w+;base64,/, "");

    if (process.env.GEMINI_API_KEY) {
      const res = await scanWithGemini(base64Data);
      if (res) return NextResponse.json(res);
    }

    const omniRes = await scanWithOmniRoute(imgPayload);
    if (omniRes) return NextResponse.json(omniRes);

    const yoloRes = await scanWithYolo11(image, prewarped);
    if (yoloRes) return NextResponse.json(yoloRes);

    const cogRes = await scanWithChesscog(image, prewarped);
    if (cogRes) return NextResponse.json(cogRes);

    return NextResponse.json({ ok: false, error: "Gagal mendeteksi papan catur." }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Kesalahan server." }, { status: 500 });
  }
}
