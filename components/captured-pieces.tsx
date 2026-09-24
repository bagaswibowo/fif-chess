import React from "react";

export type CapturedPiecesData = {
  whiteCaptured: string[]; // black pieces captured by white
  blackCaptured: string[]; // white pieces captured by black
  whiteAdvantage: number;
};

export function getCapturedPieces(fen: string): CapturedPiecesData {
  const boardPart = fen.split(" ")[0];
  const current = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  for (const ch of boardPart) {
    if (ch >= "a" && ch <= "z" && current.b[ch as keyof typeof current.b] !== undefined) {
      current.b[ch as keyof typeof current.b]++;
    }
    if (ch >= "A" && ch <= "Z") {
      const lower = ch.toLowerCase() as keyof typeof current.w;
      if (current.w[lower] !== undefined) current.w[lower]++;
    }
  }

  const initial = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

  // White pieces taken by Black
  const whiteTaken: string[] = [];
  let whiteLostVal = 0;
  for (const [k, init] of Object.entries(initial)) {
    const diff = Math.max(0, init - current.w[k as keyof typeof current.w]);
    for (let i = 0; i < diff; i++) whiteTaken.push(k);
    whiteLostVal += diff * values[k];
  }

  // Black pieces taken by White
  const blackTaken: string[] = [];
  let blackLostVal = 0;
  for (const [k, init] of Object.entries(initial)) {
    const diff = Math.max(0, init - current.b[k as keyof typeof current.b]);
    for (let i = 0; i < diff; i++) blackTaken.push(k);
    blackLostVal += diff * values[k];
  }

  // Advantage: positive = White leads, negative = Black leads
  const whiteAdv = blackLostVal - whiteLostVal;

  return {
    whiteCaptured: blackTaken, // pieces White captured
    blackCaptured: whiteTaken, // pieces Black captured
    whiteAdvantage: whiteAdv,
  };
}

// Unicode chess symbols with bold clear rendering
const PIECE_SYMBOLS_BLACK: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
};

const PIECE_SYMBOLS_WHITE: Record<string, string> = {
  p: "♙",
  n: "♘",
  b: "♗",
  r: "♖",
  q: "♕",
};

export function CapturedPiecesBar({
  fen,
  side,
}: {
  fen: string;
  side: "white" | "black";
}) {
  const { whiteCaptured, blackCaptured, whiteAdvantage } = getCapturedPieces(fen);

  const pieces = side === "white" ? whiteCaptured : blackCaptured;
  const symbols = side === "white" ? PIECE_SYMBOLS_BLACK : PIECE_SYMBOLS_WHITE;
  const adv = side === "white" ? whiteAdvantage : -whiteAdvantage;

  if (pieces.length === 0 && adv <= 0) return null;

  // Group pieces in standard order: Queen, Rook, Bishop, Knight, Pawn
  const order = ["q", "r", "b", "n", "p"];
  const counts: Record<string, number> = {};
  for (const p of pieces) counts[p] = (counts[p] || 0) + 1;

  return (
    <div className="flex items-center gap-2 select-none flex-wrap py-0.5">
      <div className="flex items-center gap-2 bg-[#141311] px-2.5 py-1 rounded-xl border border-[#383531] shadow-inner">
        {order.map((pt) => {
          const count = counts[pt];
          if (!count) return null;
          return (
            <div
              key={pt}
              className={`inline-flex items-center gap-1 ${
                side === "white"
                  ? "text-neutral-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                  : "text-amber-200 drop-shadow-[0_1px_2px_rgba(251,191,36,0.3)]"
              }`}
            >
              <span className="text-xl md:text-2xl leading-none font-bold">
                {symbols[pt] ?? pt}
              </span>
              {count > 1 && (
                <span className="text-xs font-black text-neutral-400 bg-[#22201d] px-1 py-0.2 rounded border border-[#383531]">
                  ×{count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {adv > 0 && (
        <span className="font-black text-xs md:text-sm text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded-lg border border-emerald-500/50 shadow-md">
          +{adv}
        </span>
      )}
    </div>
  );
}
