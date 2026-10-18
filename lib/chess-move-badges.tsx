import React from "react";
import { Chess, type Square } from "chess.js";

export type MoveBadgeType = "brilliant" | "great" | "best" | "book" | "blunder" | "mistake";

export interface MoveBadge {
  type: MoveBadgeType;
  label: string;
  bg: string;
  color: string;
  desc: string;
}

export const BADGE_CONFIGS: Record<MoveBadgeType, MoveBadge> = {
  brilliant: {
    type: "brilliant",
    label: "!!",
    bg: "#06b6d4", // Cyan
    color: "#ffffff",
    desc: "Brilian (Pengorbanan Taktis Jenius)",
  },
  great: {
    type: "great",
    label: "★",
    bg: "#0284c7", // Sky blue
    color: "#ffffff",
    desc: "Luar Biasa (Satu-satunya Langkah Menang)",
  },
  best: {
    type: "best",
    label: "✓",
    bg: "#16a34a", // Green
    color: "#ffffff",
    desc: "Langkah Terbaik (Best Move)",
  },
  book: {
    type: "book",
    label: "📖",
    bg: "#d97706", // Amber
    color: "#ffffff",
    desc: "Teori Buku Pembukaan (Book Move)",
  },
  blunder: {
    type: "blunder",
    label: "??",
    bg: "#dc2626", // Red
    color: "#ffffff",
    desc: "Blunder Fatal (Kehilangan Materi)",
  },
  mistake: {
    type: "mistake",
    label: "?",
    bg: "#ea580c", // Orange
    color: "#ffffff",
    desc: "Ketidaktelitian (Mistake)",
  },
};

const PIECE_VALS: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

/**
 * Mengklasifikasikan kualitas langkah catur ala Chess.com:
 * 📖 Book, ‼️ Brilliant, ⭐️ Great, 🟢 Best, ⚠️ Mistake, ❌ Blunder
 */
export function classifyMove(
  fenBefore: string,
  moveUci: string,
  moveSan: string,
  options?: {
    isBook?: boolean;
    evalBefore?: number;
    evalAfter?: number;
    isEngineBest?: boolean;
  }
): MoveBadge {
  if (options?.isBook) {
    return BADGE_CONFIGS.book;
  }

  const c = new Chess(fenBefore);
  const from = moveUci.slice(0, 2) as Square;
  const to = moveUci.slice(2, 4) as Square;
  const moverPiece = c.get(from);
  const targetPiece = c.get(to);

  // Checkmate is always great / brilliant
  if (moveSan.includes("#")) {
    return BADGE_CONFIGS.great;
  }

  // Deteksi Pengorbanan Brilian (Brilliant Move):
  // Menempatkan perwira berharga ke petak yang diserang atau membiarkannya dipukul
  if (moverPiece && moverPiece.type !== "p") {
    const moverVal = PIECE_VALS[moverPiece.type] ?? 100;
    const oppColor = moverPiece.color === "w" ? "b" : "w";

    // Cek apakah petak tujuan diserang oleh bidak lawan yang lebih murah
    const isAttacked = c.isAttacked(to, oppColor);
    const targetVal = targetPiece ? (PIECE_VALS[targetPiece.type] ?? 0) : 0;

    // Jika mengorbankan perwira (target bernilai lebih kecil dari yang dikorbankan)
    // namun langkah ini adalah taktik kunci (skak, garpu, atau langkah rekomendasi)
    if (isAttacked && moverVal > targetVal + 100 && (moveSan.includes("+") || options?.isEngineBest)) {
      return BADGE_CONFIGS.brilliant;
    }
  }

  // Jika ada data evaluasi delta
  if (typeof options?.evalBefore === "number" && typeof options?.evalAfter === "number") {
    const delta = options.evalBefore - options.evalAfter; // drop in centipawns
    if (delta >= 250) return BADGE_CONFIGS.blunder;
    if (delta >= 120) return BADGE_CONFIGS.mistake;
    if (options.evalAfter >= 400 && delta <= 20) return BADGE_CONFIGS.great;
  }

  // Jika langkah ini adalah langkah terbaik engine atau langkah kunci
  if (options?.isEngineBest) {
    return BADGE_CONFIGS.best;
  }

  // Default: Langkah Bagus / Terbaik
  return BADGE_CONFIGS.best;
}

/**
 * Membuat custom square renderer untuk react-chessboard
 * yang secara reaktif menempelkan badge melayang di atas bidak
 * dan OTOMATIS HILANG jika bidak berpindah dari petak tersebut.
 */
export function createSquareBadgeRenderer(
  moveBadges: Record<string, MoveBadge>,
  currentFen: string,
  squareStyles: Record<string, React.CSSProperties> = {}
) {
  let chessInstance: Chess | null = null;
  try {
    chessInstance = new Chess(currentFen);
  } catch {
    chessInstance = null;
  }

  return ({ square, children }: any) => {
    const badge = moveBadges[square];
    let hasPiece = false;
    if (chessInstance) {
      try {
        hasPiece = Boolean(chessInstance.get(square as Square));
      } catch {
        hasPiece = false;
      }
    }

    const shouldShow = Boolean(badge && hasPiece);

    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          ...(squareStyles[square] || {}),
        }}
      >
        {children}
        {shouldShow && badge && (
          <div
            title={badge.desc}
            className="animate-in zoom-in duration-150"
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              zIndex: 40,
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 900,
              boxShadow: "0 2px 6px rgba(0,0,0,0.7), 0 0 8px rgba(255,255,255,0.3)",
              border: "1.5px solid white",
              pointerEvents: "none",
              backgroundColor: badge.bg,
              color: badge.color,
            }}
          >
            {badge.label}
          </div>
        )}
      </div>
    );
  };
}
