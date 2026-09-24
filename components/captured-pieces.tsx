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

  return (
    <div className="flex items-center gap-1.5 text-xs select-none">
      <div className="flex items-center -space-x-1 text-sm tracking-tighter opacity-80">
        {pieces.map((p, idx) => (
          <span key={idx} className={side === "white" ? "text-neutral-400" : "text-neutral-200"}>
            {symbols[p] ?? p}
          </span>
        ))}
      </div>
      {adv > 0 && (
        <span className="font-extrabold text-[11px] text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/30">
          +{adv}
        </span>
      )}
    </div>
  );
}
