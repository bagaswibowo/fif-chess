import { describe, expect, it } from "vitest";
import {
  applyUci,
  dailyShareText,
  formatClock,
  formatDailyDate,
  sideToMove,
  uciToSan,
  utcDateKey,
  validateSolutionStep,
} from "./puzzle-solve";

const FEN_MATE_IN_1 = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"; // Ra1-a8 #
const FEN_BLACK_TO_MOVE = "6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1";

describe("sideToMove", () => {
  it("putih melangkah dari FEN w", () => {
    expect(sideToMove(FEN_MATE_IN_1)).toBe("white");
  });
  it("hitam melangkah dari FEN b", () => {
    expect(sideToMove(FEN_BLACK_TO_MOVE)).toBe("black");
  });
});

describe("validateSolutionStep", () => {
  it("langkah solusi benar → nextFen baru", () => {
    const r = validateSolutionStep(FEN_MATE_IN_1, "a1a8", "a1a8");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toBe("Ra8#");
      expect(r.nextFen).not.toBe(FEN_MATE_IN_1);
    }
  });

  it("legal tapi bukan solusi → not-solution (shake)", () => {
    const r = validateSolutionStep(FEN_MATE_IN_1, "a1a2", "a1a8");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not-solution");
  });

  it("legal tapi bukan solusi (a1a2) → not-solution (shake)", () => {
    const r = validateSolutionStep(FEN_MATE_IN_1, "a1a2", "a1a8");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not-solution");
  });

  it("ilegal penuh → illegal (papan menolak senyap)", () => {
    // Benteng tidak bisa melompat: a1→h4 ilegal penuh.
    const r = validateSolutionStep(FEN_MATE_IN_1, "a1h4", "a1a8");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("illegal");
  });

  it("promosi UCI 5 char diterima", () => {
    const fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
    const r = validateSolutionStep(fen, "a7a8q", "a7a8q");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.san).toBe("a8=Q");
  });
});

describe("applyUci", () => {
  it("auto-reply lawan mengubah FEN", () => {
    const after = applyUci(FEN_MATE_IN_1, "a1a8");
    expect(after).toBeTruthy();
    expect(applyUci(FEN_MATE_IN_1, "e9e9")).toBeNull();
  });
});

describe("uciToSan", () => {
  it("mengubah UCI ke SAN", () => {
    expect(uciToSan(FEN_MATE_IN_1, "a1a8")).toBe("Ra8#");
    expect(uciToSan(FEN_MATE_IN_1, "a1z9")).toBeNull();
  });
});

describe("formatClock", () => {
  it("mm:ss", () => {
    expect(formatClock(134)).toBe("02:14");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-5)).toBe("00:00");
  });
});

describe("tanggal daily (UTC)", () => {
  it("utcDateKey", () => {
    expect(utcDateKey(new Date(Date.UTC(2026, 9, 22, 23, 30)))).toBe("2026-10-22");
  });
  it("formatDailyDate → 'Kamis, 22 Okt 2026'", () => {
    expect(formatDailyDate("2026-10-22")).toBe("Kamis, 22 Okt 2026");
  });
  it("dailyShareText sesuai design §2.3", () => {
    expect(dailyShareText("2026-10-22", true)).toBe("Jev Chess Daily 22 Okt 2026: ✅ 1/1");
    expect(dailyShareText("2026-10-22", false)).toBe("Jev Chess Daily 22 Okt 2026: ❌ 0/1");
  });
});
