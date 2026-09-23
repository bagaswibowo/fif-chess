"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { PlayedMove } from "@/lib/types";

type Props = {
  moves: PlayedMove[];
};

export function MoveList({ moves }: Props) {
  const rows: { number: number; white?: PlayedMove; black?: PlayedMove }[] = [];
  for (const move of moves) {
    const number = Math.ceil(move.ply / 2);
    let row = rows.find((entry) => entry.number === number);
    if (!row) {
      row = { number };
      rows.push(row);
    }
    if (move.ply % 2 === 1) row.white = move;
    else row.black = move;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No moves yet. Play a legal move on the board — illegal drops snap back.
      </p>
    );
  }

  return (
    <ScrollArea className="h-56 pr-2">
      <ol className="space-y-1 font-mono text-sm">
        {rows.map((row) => (
          <li key={row.number} className="grid grid-cols-[2rem_1fr_1fr] items-baseline gap-2">
            <span className="text-muted-foreground">{row.number}.</span>
            <MoveCell move={row.white} />
            <MoveCell move={row.black} />
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}

function MoveCell({ move }: { move?: PlayedMove }) {
  if (!move) return <span />;
  return (
    <span className={move.by === "jev" ? "text-amber-200" : "text-foreground"}>
      {move.san}
      <span className="ml-1 text-xs uppercase tracking-wide text-muted-foreground">
        {move.by === "jev" ? "jev" : "you"}
      </span>
    </span>
  );
}
