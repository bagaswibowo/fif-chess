/**
 * pgn-parse.ts — S2-T4 Analysis fast-path parser (client-side).
 *
 * Deteksi otomatis input paste bar:
 *  - FEN   : 6 field dipisah spasi → { kind: "fen", fen }
 *  - PGN   : header tags [Key "..."] + movetext → { kind: "pgn", fen, moves }
 *  - URL   : tautan game internal /analysis/[gameId] → { kind: "internal-link", gameId }
 *
 * Validasi memakai chess.js (sudah ada di package.json — tanpa dependency baru).
 * Copy error mengikuti docs/design/sprint2.md §3.3 (jangan diringkas).
 */

import { Chess } from "chess.js";

export type PgnParseResult =
  | { kind: "fen"; fen: string }
  | { kind: "pgn"; fen: string; moves: string[]; headers: Record<string, string> }
  | { kind: "internal-link"; gameId: string };

/** Copy error spesifik — sumber kebenaran: design doc §3.3. */
export const PARSE_ERRORS = {
  empty: "Masukkan PGN atau FEN terlebih dahulu.",
  malformedFen:
    "FEN tidak valid — pastikan formatnya 6 bagian dipisah spasi (mis. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1).",
  illegalFen:
    "FEN tidak valid — posisi papan tidak mungkin terjadi dalam permainan catur.",
  brokenPgn:
    "PGN tidak valid — gerakan tidak bisa dibaca. Periksa movetext atau tempel ulang PGN lengkap dengan header.",
  noMoves: "PGN tidak berisi langkah apa pun.",
  externalLink:
    "Hanya tautan game internal yang didukung. Gunakan PGN atau FEN.",
  unknown: "Input tidak dikenali. Tempel PGN, FEN, atau tautan game internal.",
} as const;

const FEN_FIELD_RE = /^(?:[pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8}$/;
const PGN_HEADER_RE = /^\s*\[\s*(\w+)\s+"([^"]*)"\s*\]\s*$/;
const INTERNAL_LINK_RE = /^https?:\/\/[^/]*\/analysis\/([A-Za-z0-9_-]+)/;

/** Bandingkan dua FEN hanya pada 4 field pertama (posisi + giliran + castling + en passant). */
function samePosition(a: string, b: string): boolean {
  return a.split(/\s+/).slice(0, 4).join(" ") === b.split(/\s+/).slice(0, 4).join(" ");
}

function looksLikeFen(input: string): boolean {
  return FEN_FIELD_RE.test(input.split(/\s+/)[0]);
}

function looksLikePgn(input: string): boolean {
  // Papan FEN mengandung '/', movetext tidak — cegah FEN rusak terbaca sebagai movetext.
  if (input.includes("/")) return false;
  if (/^\s*\[\s*\w+\s+"/.test(input)) return true;
  // movetext: nomor langkah "1." atau token SAN diikuti spasi/akhir
  return /(?:\b\d+\s*\.+|\b(?:[KQRBN][a-h1-8]?[a-h1-8]?x?[a-h][1-8]|[pa-h]x?[a-h]?[1-8]|O-O(?:-O)?)[+#]?\b)/.test(input);
}

export function parsePgnOrFen(raw: string): PgnParseResult {
  const input = (raw ?? "").trim();

  if (input.length === 0) {
    throw new Error(PARSE_ERRORS.empty);
  }

  // Tautan game internal → redirect; eksternal = out of scope.
  const linkMatch = input.match(INTERNAL_LINK_RE);
  if (linkMatch) {
    return { kind: "internal-link", gameId: linkMatch[1] };
  }
  if (/^https?:\/\//i.test(input)) {
    throw new Error(PARSE_ERRORS.externalLink);
  }

  // FEN: struktur 6 field dipisah spasi.
  if (looksLikeFen(input)) {
    const fields = input.split(/\s+/);
    const castlingOk = fields[2] === "-" || /^[KQkq]+$/.test(fields[2]);
    const halfmoveOk = /^\d+$/.test(fields[4]);
    const fullmoveOk = /^\d+$/.test(fields[5]);
    if (fields.length !== 6 || (fields[1] !== "w" && fields[1] !== "b") || !castlingOk || !halfmoveOk || !fullmoveOk) {
      throw new Error(PARSE_ERRORS.malformedFen);
    }
    try {
      // chess.js memvalidasi legalitas penuh (raja ganda, pion rank 1/8, dsb).
      new Chess(input);
    } catch {
      throw new Error(PARSE_ERRORS.illegalFen);
    }
    return { kind: "fen", fen: input };
  }

  // PGN: header tags + movetext (header opsional — movetext telanjang juga diterima).
  if (looksLikePgn(input)) {
    const headers: Record<string, string> = {};
    const movetextLines: string[] = [];
    for (const line of input.split(/\r?\n/)) {
      const m = line.match(PGN_HEADER_RE);
      if (m) headers[m[1]] = m[2];
      else movetextLines.push(line);
    }
    const movetext = movetextLines
      .join(" ")
      .replace(/\{[^}]*\}/g, " ") // komentar inline di-skip
      .replace(/;[^\n]*/g, " ") // komentar rest-of-line
      .replace(/\$\d+/g, " ") // NAG di-skip
      .replace(/\([^()]*\)/g, " ") // variasi analisis di-skip
      .replace(/1-0|0-1|1\/2-1\/2|\*/g, " ");

    const sanTokens = movetext
      .split(/\s+/)
      .map((t) => t.replace(/^\d+\.+/, "").trim())
      .filter((t) => t.length > 0);

    if (Object.keys(headers).length > 0 && sanTokens.length === 0) {
      throw new Error(PARSE_ERRORS.noMoves);
    }

    const chess = new Chess();
    const moves: string[] = [];
    for (const san of sanTokens) {
      try {
        const mv = chess.move(san);
        moves.push(mv.san);
      } catch {
        throw new Error(PARSE_ERRORS.brokenPgn);
      }
    }
    if (moves.length === 0) {
      throw new Error(Object.keys(headers).length > 0 ? PARSE_ERRORS.noMoves : PARSE_ERRORS.unknown);
    }
    return { kind: "pgn", fen: chess.fen(), moves, headers };
  }

  throw new Error(PARSE_ERRORS.unknown);
}

/** Muat hasil parsing ke objek Chess yang sudah ada (jalur analisis existing). */
export function applyParsedToChess(chess: Chess, parsed: PgnParseResult): void {
  if (parsed.kind === "fen") {
    chess.load(parsed.fen);
    return;
  }
  if (parsed.kind === "pgn") {
    chess.load(startFenOf(parsed));
    for (const san of parsed.moves) chess.move(san);
  }
}

function startFenOf(parsed: Extract<PgnParseResult, { kind: "pgn" }>): string {
  const setUp = parsed.headers.SetUp === "1" || !!parsed.headers.FEN;
  if (setUp && parsed.headers.FEN) return parsed.headers.FEN;
  return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}

export { samePosition, looksLikeFen };
