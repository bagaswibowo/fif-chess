"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconTrophy3D, IconSkull3D, IconBalance3D, IconFlag3D, IconClock3D } from "@/components/icons3d";
import { Confetti } from "@/components/confetti";
import type { GameOutcome, Side } from "@/lib/chess";
import type { PlayerGameSummary } from "@/lib/caps-evaluator";
import { sendRematchRequest } from "@/lib/rematch";

type Props = {
  outcome: GameOutcome;
  humanSide: Side;
  lang?: "id" | "en";
  open: boolean;
  onClose: () => void;
  onNewGame: () => void;
  onExportPgn?: () => void;
  onReview?: () => void;
  history?: string[];
  /** S2-T1: jeda auto-redirect ke review (detik). 0 = tanpa timer. */
  autoReviewSeconds?: number;
  /** S6-T3: lawan manusia + metadata partai untuk baris aksi Rematch.
   *  Lawan bot (username kosong) → tombol Rematch disembunyikan. */
  opponentUsername?: string | null;
  gameId?: string | null;
  timeControl?: string | null;
  /** S6-T3: lawan mengirim RematchRequested ke matcher kita — status
   *  "Menunggu rematch dari @{user}…" ditampilkan di modal. */
  rematchRequest?: { fromUser: string } | null;
  /** S6-T3: akun pending → Rematch/Remis disabled + subteks (state matrix §3.4). */
  pendingAccount?: boolean;
  /** S6-T3 (dev_note #2): delta rating RIIL dari respons /api/match-result.
   *  null / undefined → badge "Rating diperbarui" tanpa angka (no-mock). */
  ratingDelta?: number | null;
};

export function GameOverModal({
  outcome,
  humanSide,
  lang = "id",
  open,
  onClose,
  onNewGame,
  onExportPgn,
  onReview,
  history = [],
  autoReviewSeconds = 2.5,
  opponentUsername = null,
  gameId = null,
  timeControl = null,
  rematchRequest = null,
  pendingAccount = false,
  ratingDelta = null,
}: Props) {
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [autoReviewCountdown, setAutoReviewCountdown] = useState(false);
  const primaryCtaRef = React.useRef<HTMLButtonElement | null>(null);
  const autoRedirectFired = React.useRef(false);
  const [whiteCaps, setWhiteCaps] = useState<PlayerGameSummary | null>(null);
  const [blackCaps, setBlackCaps] = useState<PlayerGameSummary | null>(null);

  // S2-T1: fokus awal modal di CTA utama (a11y floor — design doc §1.2).
  useEffect(() => {
    if (open) {
      autoRedirectFired.current = false;
      setAutoReviewCountdown(false);
      requestAnimationFrame(() => primaryCtaRef.current?.focus());
    }
  }, [open]);

  // S2-T1: auto-redirect ke review 2.5s setelah game finished — ATAU saat modal
  // ditutup, mana yang lebih dulu. Dibatalkan saat tab tidak terlihat.
  useEffect(() => {
    if (!open || autoReviewSeconds <= 0) return;
    if (autoRedirectFired.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const timer = setTimeout(() => {
      autoRedirectFired.current = true;
      setAutoReviewCountdown(false);
      onReview?.();
    }, autoReviewSeconds * 1000);
    setAutoReviewCountdown(true);
    return () => clearTimeout(timer);
  }, [open, autoReviewSeconds, onReview]);

  const reviewNow = () => {
    if (autoRedirectFired.current) return;
    autoRedirectFired.current = true;
    setAutoReviewCountdown(false);
    onClose();
    onReview?.();
  };

  useEffect(() => {
    if (!open || history.length === 0) return;
    let active = true;
    setAnalysisLoading(true);

    fetch("/api/twirp/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.white && data.black) {
          setWhiteCaps(data.white);
          setBlackCaps(data.black);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAnalysisLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, history]);

  if (!open || !outcome.over) return null;

  const isWin = outcome.winner === humanSide;
  const isDraw = outcome.over && !outcome.winner;
  const isLoss = outcome.winner && outcome.winner !== humanSide;

  const playerSummary = humanSide === "white" ? whiteCaps : blackCaps;
  const opponentSummary = humanSide === "white" ? blackCaps : whiteCaps;

  // S6-T3: rematch satu-klik (lib/rematch.ts — D3.2) + status rematch masuk.
  const [rematchState, setRematchState] = useState<"idle" | "sent" | "error">("idle");
  const [rematchErr, setRematchErr] = useState<string | null>(null);
  const canRematch = Boolean(opponentUsername && gameId);

  const requestRematch = async () => {
    if (!canRematch) return;
    setRematchState("idle");
    setRematchErr(null);
    const res = await sendRematchRequest({
      gameId: gameId!,
      opponent: opponentUsername!,
      timeControl,
    });
    if (res.ok) {
      setRematchState("sent");
    } else {
      setRematchState("error");
      setRematchErr(res.error ?? "Gagal mengirim rematch.");
    }
  };

  return (
    <>
      {isWin && <Confetti />}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl bg-neutral-900 border-2 border-neutral-800 shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
          {/* Header 3D Icon */}
          <div className="flex justify-center pt-1">
            {isWin && (
              <div className="relative">
                <div className="absolute -inset-3 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                <IconTrophy3D size={64} />
              </div>
            )}
            {isLoss && outcome.kind === "checkmate" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-rose-600/30 rounded-full blur-xl animate-pulse" />
                <IconSkull3D size={64} />
              </div>
            )}
            {isLoss && outcome.kind === "resigned" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-neutral-400/20 rounded-full blur-xl animate-pulse" />
                <IconFlag3D size={64} />
              </div>
            )}
            {isLoss && outcome.kind === "timeout" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                <IconClock3D size={64} />
              </div>
            )}
            {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && (
              <div className="relative">
                <div className="absolute -inset-3 bg-rose-600/20 rounded-full blur-xl animate-pulse" />
                <IconSkull3D size={64} />
              </div>
            )}
            {isDraw && (
              <div className="relative">
                <div className="absolute -inset-3 bg-blue-500/20 rounded-full blur-xl" />
                <IconBalance3D size={64} />
              </div>
            )}
          </div>

          {/* Title & Status */}
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {isWin && (lang === "id" ? "Kemenangan Gemilang!" : "Victory!")}
              {isLoss && outcome.kind === "checkmate" && (lang === "id" ? "Skakmat — Raja Tumbang!" : "Checkmate — Defeat!")}
              {isLoss && outcome.kind === "resigned" && (lang === "id" ? "Menyerah — Permainan Berakhir" : "Resigned — Game Over")}
              {isLoss && outcome.kind === "timeout" && (lang === "id" ? "Waktu Berpikir Habis" : "Time Out")}
              {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && (lang === "id" ? "Kekalahan" : "Defeat")}
              {isDraw && (lang === "id" ? "Pertandingan Remis" : "Draw Game")}
            </h2>

            <p className="text-xs sm:text-sm text-neutral-300">
              {isWin && (lang === "id" ? "Selamat! Anda berhasil menumbangkan pertahanan lawan." : "Congratulations! You defeated your opponent.")}
              {isLoss && outcome.kind === "checkmate" && (lang === "id" ? "Raja Anda telah ditumbangkan mutlak dalam pertempuran ini." : "Your king has fallen in checkmate.")}
              {isLoss && outcome.kind === "resigned" && (lang === "id" ? "Anda telah memutuskan untuk menyerah dalam babak ini." : "You have resigned this game.")}
              {isLoss && outcome.kind === "timeout" && (lang === "id" ? "Waktu pada jam Anda telah habis." : "You ran out of time.")}
              {isLoss && outcome.kind !== "checkmate" && outcome.kind !== "resigned" && outcome.kind !== "timeout" && outcome.label}
              {isDraw && outcome.label}
            </p>
          </div>

          {/* CAPS Accuracy Score Card (Chess.com Style) */}
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
              <span>{lang === "id" ? "Akurasi Langkah (CAPS)" : "Accuracy (CAPS)"}</span>
              {analysisLoading && <span className="text-[10px] text-amber-400 animate-pulse">Kalkulasi Stockfish...</span>}
            </div>

            {playerSummary && opponentSummary ? (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                  <div className="text-[11px] text-neutral-400">{lang === "id" ? "Anda" : "You"}</div>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {playerSummary.accuracy}%
                  </div>
                  <div className="text-[10px] text-neutral-400 flex justify-center gap-1 mt-0.5">
                    {playerSummary.brilliantCount > 0 && <span className="text-cyan-400 font-bold">!! {playerSummary.brilliantCount}</span>}
                    <span className="text-emerald-400">✓ {playerSummary.bestCount}</span>
                    {playerSummary.blunderCount > 0 && <span className="text-rose-400 font-bold">?? {playerSummary.blunderCount}</span>}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                  <div className="text-[11px] text-neutral-400">{lang === "id" ? "Lawan" : "Opponent"}</div>
                  <div className="text-lg font-black text-neutral-200 font-mono">
                    {opponentSummary.accuracy}%
                  </div>
                  <div className="text-[10px] text-neutral-400 flex justify-center gap-1 mt-0.5">
                    {opponentSummary.brilliantCount > 0 && <span className="text-cyan-400 font-bold">!! {opponentSummary.brilliantCount}</span>}
                    <span className="text-emerald-400">✓ {opponentSummary.bestCount}</span>
                    {opponentSummary.blunderCount > 0 && <span className="text-rose-400 font-bold">?? {opponentSummary.blunderCount}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2 text-xs text-neutral-400 font-mono">
                {analysisLoading ? "Menganalisis kualitas langkah..." : "Siap untuk review akurasi"}
              </div>
            )}
          </div>

          {/* Rating adjustment — S6-T3: angka RIIL dari /api/match-result
              (field ratingDelta). Tanpa field → "Rating diperbarui" tanpa
              angka (jangan angka palsu — bug fix, dev_note #2). */}
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-neutral-400 font-semibold">
              {lang === "id" ? "Penyesuaian Rating ELO:" : "Rating Adjustment:"}
            </span>
            {ratingDelta != null ? (
              <Badge
                className={`font-mono font-bold text-xs px-2.5 py-0.5 ${
                  ratingDelta > 0
                    ? "bg-emerald-600 text-white"
                    : ratingDelta < 0
                      ? "bg-rose-600 text-white"
                      : "border border-neutral-600 text-neutral-300 bg-transparent"
                }`}
              >
                {ratingDelta > 0 ? "+" : ""}
                {ratingDelta}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-neutral-600 text-neutral-300 font-mono text-xs px-2.5 py-0.5">
                {lang === "id" ? "Rating diperbarui" : "Rating updated"}
              </Badge>
            )}
          </div>

          {/* S6-T3: baris aksi Rematch + status rematch masuk (spec §3.2–3.3) */}
          {(canRematch || rematchRequest) && (
            <div className="flex flex-col gap-2">
              {canRematch && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => void requestRematch()}
                    disabled={rematchState === "sent" || pendingAccount}
                    className="flex-1 text-xs sm:text-sm font-semibold"
                  >
                    {rematchState === "sent"
                      ? "Menunggu rematch…"
                      : lang === "id"
                        ? "Rematch"
                        : "Rematch"}
                  </Button>
                  {pendingAccount && (
                    <span className="text-[10px] text-neutral-500" role="status">
                      Akun menunggu persetujuan admin.
                    </span>
                  )}
                </div>
              )}
              <div aria-live="polite" className="sr-only">
                {rematchState === "sent" && "Rematch terkirim. Menunggu lawan."}
                {rematchState === "error" && (rematchErr ?? "Rematch gagal.")}
                {rematchRequest && `Menunggu rematch dari @${rematchRequest.fromUser}…`}
              </div>
              {rematchState === "sent" && (
                <p className="text-[11px] text-neutral-400" role="status">
                  Menunggu rematch dari {lang === "id" ? "lawan" : "opponent"}…
                </p>
              )}
              {rematchState === "error" && (
                <p className="text-[11px] text-rose-400" role="alert">
                  {rematchErr}
                </p>
              )}
              {rematchRequest && (
                <p className="text-[11px] text-neutral-300" role="status">
                  @{rematchRequest.fromUser} mengirim rematch — dimulai saat diterima.
                </p>
              )}
            </div>
          )}

          {/* Action Buttons — S2-T1: CTA utama "Review Permainan", sekunder "Kembali ke Lobby" */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              ref={primaryCtaRef}
              onClick={reviewNow}
              className="ctl ctl-primary flex-1 font-bold focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label={lang === "id" ? "Review Permainan" : "Review Game"}
            >
              {lang === "id" ? "Review Permainan" : "Review Game"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                autoRedirectFired.current = true;
                onClose();
                onNewGame();
              }}
              className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs sm:text-sm font-semibold"
            >
              {lang === "id" ? "Kembali ke Lobby" : "Back to Lobby"}
            </Button>
            {onExportPgn && (
              <Button
                variant="outline"
                onClick={onExportPgn}
                className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs sm:text-sm font-semibold"
              >
                PGN
              </Button>
            )}
          </div>

          {/* Countdown halus di bawah CTA — teks, bukan spinner penuh (design doc §1.2) */}
          {autoReviewCountdown && (
            <p className="text-[11px] text-neutral-400 animate-pulse" aria-live="polite">
              {lang === "id" ? "Membuka review…" : "Opening review…"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
