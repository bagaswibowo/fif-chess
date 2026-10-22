import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { parsePgnOrFen, applyParsedToChess, PARSE_ERRORS } from "./pgn-parse";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parsePgnOrFen — FEN", () => {
  it("menerima FEN valid 6 field", () => {
    const r = parsePgnOrFen(START_FEN);
    expect(r.kind).toBe("fen");
    if (r.kind === "fen") expect(r.fen).toBe(START_FEN);
  });

  it("FEN 5 field → error malformed", () => {
    expect(() => parsePgnOrFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0")).toThrow(
      PARSE_ERRORS.malformedFen,
    );
  });

  it("FEN ilegal (dua raja putih) → error illegal", () => {
    expect(() => parsePgnOrFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKKNR w KQkq - 0 1")).toThrow(
      PARSE_ERRORS.illegalFen,
    );
  });

  it("FEN ilegal (pion di rank 1) → error illegal", () => {
    expect(() => parsePgnOrFen("Pnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toThrow(
      PARSE_ERRORS.illegalFen,
    );
  });
});

describe("parsePgnOrFen — PGN", () => {
  const pgnHeaders = [
    '[Event "Test"]',
    '[White "Alice"]',
    '[Black "Bob"]',
    '[Result "1-0"]',
    "",
  ].join("\n");

  it("PGN dengan header + movetext", () => {
    const r = parsePgnOrFen(`${pgnHeaders}1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`);
    expect(r.kind).toBe("pgn");
    if (r.kind === "pgn") {
      expect(r.moves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
      expect(r.headers.White).toBe("Alice");
    }
  });

  it("PGN movetext telanjang tanpa header", () => {
    const r = parsePgnOrFen("1. d4 d5 2. c4");
    expect(r.kind).toBe("pgn");
    if (r.kind === "pgn") expect(r.moves).toEqual(["d4", "d5", "c4"]);
  });

  it("komentar, NAG, dan variasi di-skip", () => {
    const r = parsePgnOrFen(`1. e4 {best by test} $1 e5 2. Nf3 (2. f4 exd4) Nc6`);
    expect(r.kind).toBe("pgn");
    if (r.kind === "pgn") expect(r.moves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  it("PGN header tanpa langkah → error noMoves", () => {
    expect(() => parsePgnOrFen(`${pgnHeaders}*`)).toThrow(PARSE_ERRORS.noMoves);
  });

  it("movetext rusak → error brokenPgn", () => {
    expect(() => parsePgnOrFen("1. e4 e9 2. Qxh9")).toThrow(PARSE_ERRORS.brokenPgn);
  });

  it("applyParsedToChess memutar ulang movetext di Chess existing", () => {
    const chess = new Chess();
    const r = parsePgnOrFen("1. e4 e5");
    applyParsedToChess(chess, r);
    expect(chess.moves().length).toBeGreaterThan(20);
  });
});

describe("parsePgnOrFen — link & sampah", () => {
  it("tautan game internal dikenali", () => {
    const r = parsePgnOrFen("https://jev-chess.app/analysis/g-abc123");
    expect(r).toEqual({ kind: "internal-link", gameId: "g-abc123" });
  });

  it("tautan eksternal → error", () => {
    expect(() => parsePgnOrFen("https://chessgame.example/match/1")).toThrow(
      PARSE_ERRORS.externalLink,
    );
  });

  it("input kosong → error empty", () => {
    expect(() => parsePgnOrFen("   ")).toThrow(PARSE_ERRORS.empty);
  });

  it("paste sampah total → error unknown", () => {
    expect(() => parsePgnOrFen("hello world this is not chess")).toThrow(PARSE_ERRORS.unknown);
  });
});
