"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PromotionPiece, Side } from "@/lib/chess";

const PIECES: { piece: PromotionPiece; white: string; black: string; label: string }[] = [
  { piece: "q", white: "♕", black: "♛", label: "Queen" },
  { piece: "r", white: "♖", black: "♜", label: "Rook" },
  { piece: "b", white: "♗", black: "♝", label: "Bishop" },
  { piece: "n", white: "♘", black: "♞", label: "Knight" },
];

type Props = {
  open: boolean;
  side: Side;
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
};

export function PromotionDialog({ open, side, onPick, onCancel }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Promote pawn</DialogTitle>
          <DialogDescription>
            Chess.js will apply the piece you pick. Jev never invents this choice.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          {PIECES.map(({ piece, white, black, label }) => (
            <Button
              key={piece}
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
              onClick={() => onPick(piece)}
            >
              <span className="text-3xl leading-none">{side === "white" ? white : black}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
