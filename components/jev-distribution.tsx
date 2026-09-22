"use client";

import { Badge } from "@/components/ui/badge";
import type { JevAnalysis } from "@/lib/types";

type Props = {
  analysis: JevAnalysis | null;
  thinking: boolean;
};

export function JevDistribution({ analysis, thinking }: Props) {
  if (thinking) {
    return (
      <div className="space-y-2" aria-live="polite">
        <p className="text-sm text-muted-foreground">
          Jev is scoring the legal UCI list. This is a probability distribution, not a sentence.
        </p>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-md bg-muted/70" />
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <p className="text-sm text-muted-foreground">
        After Jev moves, the top of its Choice distribution appears here — every bar is a legal
        move you sent, never a generated string.
      </p>
    );
  }

  const ranked = Object.entries(analysis.probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const max = ranked[0]?.[1] ?? 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          chose {analysis.chosenSan}
          <span className="ml-1 font-mono text-[10px] opacity-70">{analysis.chosenUci}</span>
        </Badge>
        {analysis.confidence !== null && (
          <Badge variant="outline">
            confidence {(analysis.confidence * 100).toFixed(0)}%
          </Badge>
        )}
        {analysis.droppedMoveCount > 0 && (
          <Badge variant="destructive">
            dropped {analysis.droppedMoveCount} surplus options
          </Badge>
        )}
      </div>
      <ul className="space-y-2">
        {ranked.map(([uci, probability]) => {
          const chosen = uci === analysis.chosenUci;
          const width = max > 0 ? Math.max(4, (probability / max) * 100) : 4;
          return (
            <li key={uci} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
                <span className={chosen ? "text-amber-200" : "text-muted-foreground"}>
                  {uci}
                </span>
                <span>{(probability * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={chosen ? "h-full bg-amber-400" : "h-full bg-foreground/40"}
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
