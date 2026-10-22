"use client";

/**
 * paste-bar.tsx — S2-T4 Analysis Fast-path (G7).
 * Satu input universal di atas halaman analysis: paste PGN / FEN / tautan game
 * internal → langsung load ke board analisis existing (jalur analisis sama,
 * hanya pintu masuk baru). Copy & state visual: docs/design/sprint2.md §3.
 */

import { useCallback, useRef, useState } from "react";
import { parsePgnOrFen, PARSE_ERRORS, type PgnParseResult } from "@/lib/pgn-parse";
import { IconAlert3D } from "@/components/icons3d";

type Props = {
  lang?: "id" | "en";
  /** Muat FEN ke board analisis existing. */
  onLoadFen: (fen: string) => void;
  /** Muat PGN: posisi awal + movelist terisi. */
  onLoadPgn: (moves: string[], startFen: string) => void;
  /** Redirect tautan game internal. */
  onOpenGame: (gameId: string) => void;
};

type BarState =
  | { status: "idle"; message: null }
  | { status: "parsing"; message: null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const PLACEHOLDER = "Tempel PGN, FEN, atau tautan game internal…";

export function PasteBar({ lang = "id", onLoadFen, onLoadPgn, onOpenGame }: Props) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<BarState>({ status: "idle", message: null });
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const t = useCallback(
    (id: string, en: string) => (lang === "id" ? id : en),
    [lang],
  );

  const submit = useCallback(() => {
    if (state.status === "parsing") return;
    let parsed: PgnParseResult;
    try {
      parsed = parsePgnOrFen(value);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : PARSE_ERRORS.unknown });
      // Fokus pindah ke pesan error (a11y floor, design doc §3.2).
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    setState({ status: "parsing", message: null });
    try {
      if (parsed.kind === "fen") {
        onLoadFen(parsed.fen);
        setValue("");
        setState({ status: "success", message: t("Posisi dimuat.", "Position loaded.") });
        inputRef.current?.focus();
      } else if (parsed.kind === "pgn") {
        const setUp = parsed.headers.SetUp === "1" || !!parsed.headers.FEN;
        const startFen = setUp && parsed.headers.FEN ? parsed.headers.FEN : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        onLoadPgn(parsed.moves, startFen);
        setValue("");
        setState({ status: "success", message: t("Permainan dimuat.", "Game loaded.") });
        inputRef.current?.focus();
      } else {
        setState({ status: "idle", message: null });
        onOpenGame(parsed.gameId);
      }
    } catch {
      setState({ status: "error", message: PARSE_ERRORS.illegalFen });
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }, [state.status, value, onLoadFen, onLoadPgn, onOpenGame, t]);

  const busy = state.status === "parsing";

  return (
    <div className="w-full" aria-busy={busy}>
      <div className="flex items-stretch gap-2">
        <textarea
          ref={inputRef}
          aria-label={t("Tempel PGN, FEN, atau tautan game internal", "Paste PGN, FEN, or internal game link")}
          className="flex-1 min-h-0 resize-none rounded-xl bg-[var(--surface-alt,var(--surface))] border px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring,rgba(129,182,76,0.7))] transition-colors duration-[var(--move-animation-duration,180ms)]"
          style={{
            borderColor:
              state.status === "error" ? "var(--destructive, #e05252)" : "var(--border)",
            height: "2.6rem",
            maxHeight: "5rem",
            overflowY: "auto",
          }}
          rows={1}
          value={value}
          disabled={busy}
          placeholder={PLACEHOLDER}
          onChange={(e) => {
            setValue(e.target.value);
            if (state.status === "error") setState({ status: "idle", message: null });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="ctl ctl-primary shrink-0 font-bold"
          style={{ boxShadow: "0 4px 0 #45753c" }}
          onClick={submit}
          disabled={busy}
        >
          {busy
            ? t("Memproses…", "Processing…")
            : t("Analisis", "Analyze")}
        </button>
      </div>

      {state.message && (
        <p
          ref={state.status === "error" ? errorRef : undefined}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          tabIndex={state.status === "error" ? -1 : undefined}
          className={`mt-1.5 text-xs font-semibold flex items-center gap-1.5 focus-visible:outline-none ${
            state.status === "error" ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {state.status === "error" && <IconAlert3D size={14} />}
          {state.message}
        </p>
      )}
    </div>
  );
}
