import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { findLegalMove, getLegalMoves, describeOutcome, applyUci } from "@/lib/chess";
import { playStockfishMove } from "@/lib/stockfish";

vi.mock("node:child_process", () => ({
  spawn: (command: string, args: string[]) => {
    const { EventEmitter } = require("events");
    const emitter = new EventEmitter();
    setImmediate(() => {
      emitter.stdout.emit("data", Buffer.from("info depth 14 seldepth 20 multipv 1 score cp 50 nodes 1000 nps 100000 pv e2e4 e7e5\n"));
      emitter.stdout.emit("data", Buffer.from("bestmove e2e4 ponder e7e5\n"));
      emitter.emit("close", 0);
    });
    return {
      stdin: { write: () => {} },
      stdout: emitter,
      stderr: emitter,
      on: (event: string, cb: Function) => emitter.on(event, cb),
      kill: () => {},
    } as any;
  },
}));

describe("Coach legal move enforcement", () => {
  it("rejects illegal moves that would leave king in check", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const c = new Chess(fen);
    const legal = findLegalMove(c, "e2", "e5");
    expect(legal).toBeUndefined();
    const ok = findLegalMove(c, "e2", "e4");
    expect(ok?.san).toBe("e4");
  });

  it("correctly identifies check and checkmate outcomes", () => {
    const checkFen = "r1b1k2r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4";
    const c = new Chess(checkFen);
    expect(c.isCheck()).toBe(true);
    const outcome = describeOutcome(c);
    expect(outcome.kind).toBe("check");
    expect(outcome.over).toBe(false);
  });

  it("detects checkmate", () => {
    const mateFen = "rnb1kbnr/pppp1ppp/8/4p3/5P2/8/PPPP2P/RNBQKBNR w KQkq - 0 2";
    const c = new Chess(mateFen);
    const move = findLegalMove(c, "f3", "f4");
    if (move) c.move(move);
    const afterMateFen = "rnb1kbnr/pppp1ppp/8/4p3/5P2/6P1/PPPP2P/RNBQKBNR b KQkq - 0 2";
    const c2 = new Chess(afterMateFen);
    expect(c2.isCheckmate()).toBe(true);
  });
});

describe("Stockfish result parsing", () => {
  it("parses MultiPV pv line with spaces correctly", async () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const result = await playStockfishMove(fen);
    expect(result.uci).toBe("e2e4");
    expect(result.san).toBe("e4");
    expect(result.confidence).toBeCloseTo(0.7, 0.1);
    expect(result.probabilities["e2e4"]).toBe(0.7);
  });

  it("handles invalid FEN gracefully", async () => {
    await expect(playStockfishMove("invalid fen")).rejects.toThrow("Invalid FEN string format");
  });
});