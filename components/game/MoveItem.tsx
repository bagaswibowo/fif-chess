"use client";

/**
 * MoveItem.tsx
 * Single move row in move list with SAN, eval delta, and quality symbol (!!/!/★/✓/?!/?/??/x).
 */

export interface MoveItemProps {
  ply: number;
  san: string;
  uci: string;
  scoreCp: number | null;
  deltaCp: number | null;
  classification: "brilliant" | "great" | "good" | "book" | "mistake" | "blunder" | "inaccuracy";
  isBestMove: boolean;
  isLatest: boolean;
  onSelect: (ply: number) => void;
}

const CLASS_STYLE: Record<string, { color: string; symbol: string }> = {
  brilliant: { color: "text-emerald-400", symbol: "!!" },
  great: { color: "text-emerald-300", symbol: "!" },
  good: { color: "text-neutral-300", symbol: "✓" },
  book: { color: "text-blue-400", symbol: "★" },
  inaccuracy: { color: "text-amber-400", symbol: "?!" },
  mistake: { color: "text-orange-400", symbol: "?" },
  blunder: { color: "text-red-400", symbol: "??" },
};

export function MoveItem({
  ply,
  san,
  uci,
  scoreCp,
  deltaCp,
  classification,
  isBestMove,
  isLatest,
  onSelect,
}: MoveItemProps) {
  const style = CLASS_STYLE[classification];
  const isWhite = ply % 2 === 1;
  const moveNumber = Math.ceil(ply / 2);

  return (
    <button
      type="button"
      onClick={() => onSelect(ply)}
      className={`w-full flex items-center justify-between px-2 py-1 text-left rounded-md transition-colors cursor-pointer ${
        isLatest ? "bg-[#81b64c]/10 border border-[#81b64c]/30" : "hover:bg-neutral-800/40"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-6 text-center text-[10px] text-neutral-500 font-mono font-bold">
          {moveNumber}.
        </span>
        {isWhite && (
          <span className="font-bold text-white">{san}</span>
        )}
        {!isWhite && (
          <span className="pl-2 font-bold text-white">{san}</span>
        )}
        <span className={`${style.color} text-[11px] font-mono font-bold ml-1 shrink-0`}>
          {style.symbol}
        </span>
        {deltaCp !== null && (
          <span className="text-[10px] text-neutral-500 font-mono shrink-0">
            {deltaCp > 0 ? `+${(deltaCp / 100).toFixed(1)}` : `-${(Math.abs(deltaCp) / 100).toFixed(1)}`}
          </span>
        )}
      </div>
      {scoreCp !== null && (
        <span className="text-[10px] font-mono text-neutral-400 shrink-0">
          {scoreCp > 0 ? `+${(scoreCp / 100).toFixed(1)}` : scoreCp < 0 ? `-${(Math.abs(scoreCp) / 100).toFixed(1)}` : "0.0"}
        </span>
      )}
    </button>
  );
}
