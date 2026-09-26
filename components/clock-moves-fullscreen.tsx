"use client";

// Layar fullscreen khusus untuk proyek ini: jam kedua sisi + riwayat langkah.
// Sengaja tidak ada papan di sini — ini tampilan "jam & log", bukan papan
// kedua, supaya tidak ada dua sumber kebenaran posisi.
import { useEffect, useRef } from "react";

type Props = {
  onClose: () => void;
  whiteName: string;
  blackName: string;
  whiteTime: string;
  blackTime: string;
  activeSide: "white" | "black" | null;
  moves: { san: string }[];
  fen: string;
};

export function ClockMovesFullscreen({ onClose, whiteName, blackName, whiteTime, blackTime, activeSide, moves, fen }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: { n: number; white?: string; black?: string }[] = [];
  moves.forEach((m, i) => {
    const n = Math.floor(i / 2) + 1;
    if (!rows[n - 1]) rows[n - 1] = { n };
    if (i % 2 === 0) rows[n - 1].white = m.san;
    else rows[n - 1].black = m.san;
  });

  const clock = (name: string, time: string, side: "white" | "black") => (
    <div
      className="panel p-4 stack-tight"
      style={{
        borderColor: activeSide === side ? "var(--primary)" : "var(--border)",
        background: activeSide === side ? "color-mix(in srgb, var(--primary) 12%, var(--card))" : "var(--card)",
      }}
    >
      <div className="label">
        {side === "white" ? "Putih" : "Hitam"} · {name}
      </div>
      <div className="clock" style={{ fontSize: "clamp(2rem, 8vw, 3.5rem)", lineHeight: 1 }}>
        {time}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jam dan riwayat langkah"
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "color-mix(in srgb, var(--background) 96%, transparent)" }}
    >
      <div className="stack" style={{ maxWidth: "56rem", margin: "0 auto", padding: "1rem" }}>
        <div className="row-between">
          <h2 className="section-title">Jam &amp; Riwayat Langkah</h2>
          <button ref={closeRef} className="ctl ctl-sm" onClick={onClose}>
            Tutup (Esc)
          </button>
        </div>

        <div className="row" style={{ gap: "0.75rem", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 12rem" }}>{clock(whiteName, whiteTime, "white")}</div>
          <div style={{ flex: "1 1 12rem" }}>{clock(blackName, blackTime, "black")}</div>
        </div>

        <div className="panel p-3">
          <div className="label" style={{ marginBottom: "0.5rem" }}>
            FEN
          </div>
          <p className="clock wrap-anywhere" style={{ fontSize: "var(--text-xs)", fontWeight: 400 }}>
            {fen}
          </p>
        </div>

        <div className="panel p-3">
          <div className="label" style={{ marginBottom: "0.5rem" }}>
            {moves.length} langkah
          </div>
          {rows.length === 0 ? (
            <p className="prose-note">Belum ada langkah.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "3rem" }}>#</th>
                    <th>Putih</th>
                    <th>Hitam</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.n}>
                      <td className="num" style={{ color: "var(--muted-foreground)" }}>
                        {r.n}.
                      </td>
                      <td className="num">{r.white ?? "—"}</td>
                      <td className="num">{r.black ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
