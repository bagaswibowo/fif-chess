import React from "react";

interface Props {
  text: string;
  className?: string;
}

// Regex to capture chess terms: squares, SAN moves, piece names, and key tactical concepts
const CHESS_PATTERN =
  /(\b[a-h][1-8]\b|\b[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[\+#]?\b|\b(?:Kuda|Gajah|Benteng|Menteri|Ratu|Raja|Pion|Knight|Bishop|Rook|Queen|King|Pawn)\b|\b(?:Giuoco Piano|Colle System|CT-ART|serangan ganda|garpu|skakmat|pin|skewer|tusukan|rokade|deflection|decoy|clearance|overload|infiltrasi)\b)/gi;

export function HighlightedChessText({ text, className = "" }: Props) {
  if (!text) return null;

  const parts = text.split(CHESS_PATTERN);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;

        // 1. Square coordinate (e.g., f7, c4, g5)
        if (/^[a-h][1-8]$/i.test(part)) {
          return (
            <span
              key={index}
              className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-mono font-black text-amber-300 bg-amber-950/70 border border-amber-500/40 align-baseline"
            >
              {part}
            </span>
          );
        }

        // 2. Chess Move / SAN (e.g., Ng5, Bxf7+, Qh5#)
        if (/^[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[\+#]?$/i.test(part)) {
          return (
            <span
              key={index}
              className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-mono font-black text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 shadow-xs align-baseline"
            >
              {part}
            </span>
          );
        }

        // 3. Piece names (Kuda, Gajah, Benteng, Menteri, Raja, Pion)
        if (
          /^(Kuda|Gajah|Benteng|Menteri|Ratu|Raja|Pion|Knight|Bishop|Rook|Queen|King|Pawn)$/i.test(
            part
          )
        ) {
          return (
            <span key={index} className="font-bold text-sky-300">
              {part}
            </span>
          );
        }

        // 4. Tactical concepts & Openings
        if (
          /^(Giuoco Piano|Colle System|CT-ART|serangan ganda|garpu|skakmat|pin|skewer|tusukan|rokade|deflection|decoy|clearance|overload|infiltrasi)$/i.test(
            part
          )
        ) {
          return (
            <span
              key={index}
              className="font-bold text-yellow-300 underline decoration-yellow-500/50 underline-offset-2"
            >
              {part}
            </span>
          );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}
