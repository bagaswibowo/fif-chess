"use client";

// Tampilan Fullscreen Mode Fokus: Jam Digital + Riwayat Langkah.
// Tanpa elemen pengalih fokus, dirancang khusus untuk pertandingan konsentrasi tinggi.
import { useEffect, useRef } from "react";

type Props = {
  onClose: () => void;
  whiteName: string;
  blackName: string;
  whiteTime: string;
  blackTime: string;
  activeSide: "white" | "black" | null;
  moves: { san: string }[];
  fen?: string;
};

export function ClockMovesFullscreen({
  onClose,
  whiteName,
  blackName,
  whiteTime,
  blackTime,
  activeSide,
  moves,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    // Coba aktifkan browser fullscreen jika didukung
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "f" || e.key === "F") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
    };
  }, [onClose]);

  // Auto scroll riwayat langkah ke bawah saat langkah bertambah
  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves.length]);

  const rows: { n: number; white?: string; black?: string }[] = [];
  moves.forEach((m, i) => {
    const n = Math.floor(i / 2) + 1;
    if (!rows[n - 1]) rows[n - 1] = { n };
    if (i % 2 === 0) rows[n - 1].white = m.san;
    else rows[n - 1].black = m.san;
  });

  const renderClockCard = (name: string, time: string, side: "white" | "black") => {
    const isActive = activeSide === side;
    return (
      <div
        className="panel p-4 md:p-6 stack-tight text-center transition-all"
        style={{
          borderColor: isActive ? "var(--primary)" : "var(--border)",
          background: isActive
            ? "color-mix(in srgb, var(--primary) 14%, var(--card))"
            : "var(--card)",
          boxShadow: isActive ? "0 0 24px color-mix(in srgb, var(--primary) 20%, transparent)" : "none",
        }}
      >
        <div className="row-between" style={{ marginBottom: "0.25rem" }}>
          <span className="label flex items-center gap-1.5">
            <span
              style={{
                width: "0.5rem",
                height: "0.5rem",
                borderRadius: "9999px",
                background: side === "white" ? "var(--foreground)" : "var(--muted-foreground)",
                display: "inline-block",
              }}
            />
            {side === "white" ? "Putih" : "Hitam"} · {name}
          </span>
          {isActive && (
            <span
              className="label"
              style={{
                color: "var(--primary)",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              ● Giliran Melangkah
            </span>
          )}
        </div>
        <div
          className="clock"
          style={{
            fontSize: "clamp(2.5rem, 10vw, 4.5rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            color: isActive ? "var(--primary)" : "var(--foreground)",
          }}
        >
          {time}
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mode Fokus: Jam dan Riwayat Langkah"
      className="fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between"
      style={{
        background: "color-mix(in srgb, var(--background) 98%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="stack" style={{ maxWidth: "56rem", margin: "0 auto", padding: "1.25rem", width: "100%" }}>
        {/* Header Bar */}
        <div className="row-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
          <div>
            <h2 className="section-title" style={{ margin: 0, fontSize: "var(--text-base)" }}>
              Mode Fokus Pertandingan
            </h2>
            <p className="prose-note" style={{ margin: 0, fontSize: "var(--text-xs)" }}>
              Tampilan minimalis: waktu &amp; riwayat langkah untuk konsentrasi penuh
            </p>
          </div>
          <button ref={closeRef} className="ctl ctl-sm ctl-quiet" onClick={onClose} title="Tekan Escape atau F untuk keluar">
            ✕ Tutup Fokus (Esc / F)
          </button>
        </div>

        {/* 2-Player Digital Clocks */}
        <div className="row" style={{ gap: "1rem", alignItems: "stretch", marginTop: "0.5rem" }}>
          <div style={{ flex: "1 1 14rem" }}>{renderClockCard(whiteName, whiteTime, "white")}</div>
          <div style={{ flex: "1 1 14rem" }}>{renderClockCard(blackName, blackTime, "black")}</div>
        </div>

        {/* Move History Table */}
        <div className="panel p-4" style={{ marginTop: "0.75rem" }}>
          <div className="row-between" style={{ marginBottom: "0.75rem" }}>
            <div className="label" style={{ fontSize: "var(--text-xs)", fontWeight: 700 }}>
              Riwayat Langkah ({moves.length} total)
            </div>
            {moves.length > 0 && (
              <span className="label" style={{ color: "var(--muted-foreground)" }}>
                Langkah terakhir: <strong style={{ color: "var(--foreground)" }}>{moves[moves.length - 1]?.san}</strong>
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="prose-note text-center py-8">Belum ada langkah yang dimainkan.</p>
          ) : (
            <div className="table-wrap" style={{ maxHeight: "45vh", overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "3.5rem", textAlign: "center" }}>#</th>
                    <th>Putih</th>
                    <th>Hitam</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const isLatestRow = idx === rows.length - 1;
                    return (
                      <tr
                        key={r.n}
                        style={{
                          background: isLatestRow
                            ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                            : undefined,
                        }}
                      >
                        <td className="num" style={{ color: "var(--muted-foreground)", textAlign: "center" }}>
                          {r.n}.
                        </td>
                        <td
                          className="num font-bold"
                          style={{
                            color: !r.black && isLatestRow ? "var(--primary)" : "var(--foreground)",
                          }}
                        >
                          {r.white ?? "—"}
                        </td>
                        <td
                          className="num font-bold"
                          style={{
                            color: r.black && isLatestRow ? "var(--primary)" : "var(--foreground)",
                          }}
                        >
                          {r.black ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div ref={scrollBottomRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
