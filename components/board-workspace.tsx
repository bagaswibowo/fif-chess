import type { ReactNode } from "react";

export type BoardWorkspaceProps = {
  top?: ReactNode;
  controls?: ReactNode;
  board: ReactNode;
  rail?: ReactNode;
  bottom?: ReactNode;
  side?: ReactNode;
  layout?: "arena" | "board-only" | "review";
  className?: string;
};

export function BoardWorkspace({
  top,
  controls,
  board,
  rail,
  bottom,
  side,
  layout = "arena",
  className = "",
}: BoardWorkspaceProps) {
  const boardColumn = layout === "board-only"
    ? "min-w-0 min-h-0 flex flex-col gap-2"
    : "min-w-0 min-h-0 flex flex-col gap-2 lg:overflow-hidden";
  const columns = side ? "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]" : "lg:grid-cols-1";

  return (
    <section
      className={`board-workspace board-workspace-${layout} grid min-h-0 w-full gap-2 ${columns} ${className}`}
    >
      <div className={boardColumn}>
        {top}
        {controls}
        <div className="board-workspace-stage flex min-h-0 min-w-0 flex-1 items-center justify-center gap-2">
          {rail}
          <div className="board-workspace-board min-w-0 max-w-full flex-1">{board}</div>
        </div>
        {bottom}
      </div>
      {side && (
        <aside className="board-workspace-side min-h-0 overflow-y-auto pr-0.5 custom-scrollbar">
          {side}
        </aside>
      )}
    </section>
  );
}

export const BoardShell = BoardWorkspace;
