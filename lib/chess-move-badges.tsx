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
    desc: "Brilian (Pengorbanan Taktis Jenius & Inisiatif Serang)",
  },
  great: {
    type: "great",
    label: "★",
    bg: "#0284c7", // Sky blue
    color: "#ffffff",
    desc: "Luar Biasa (Langkah Kunci Skakmat / Garpu Kemenangan)",
  },
  best: {
    type: "best",
    label: "✓",
    bg: "#16a34a", // Green
    color: "#ffffff",
    desc: "Langkah Terbaik (Best Move Sesuai Rekomendasi Mesin)",
  },
  book: {
    type: "book",
    label: "📖",
    bg: "#d97706", // Amber
    color: "#ffffff",
    desc: "Teori Buku Pembukaan Resmi (ECO Book Move)",
  },
  blunder: {
    type: "blunder",
    label: "??",
    bg: "#dc2626", // Red
    color: "#ffffff",
    desc: "Blunder Fatal (Menggantung Bidak / Membuka Celah Skakmat)",
  },
  mistake: {
    type: "mistake",
    label: "?",
    bg: "#ea580c", // Orange
    color: "#ffffff",
    desc: "Ketidaktelitian (Mistake - Melemahkan Pertahanan)",
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

// Langkah-langkah pembukaan teori standar (ECO Master Opening Book)
const COMMON_BOOK_MOVES = new Set([
  "e2e4", "e7e5", "d2d4", "d7d5", "c2c4", "c7c5", "g1f3", "g8f6",
  "b1c3", "b8c6", "f1c4", "f8c5", "f1b5", "f8b4", "e1g1", "e8g8",
  "c2c3", "d2d3", "d7d6", "g2g3", "g7g6", "c8g4", "c1g5", "a2a3",
  "a7a6", "c8e6", "c1e3", "d8e7", "d1e2", "d8c7", "d1c2"
]);

/**
 * Mesin Analisis Kualitas Langkah Catur Real-time:
 * Mengombinasikan Stockfish Evaluation + Client Tactical Blunder Detection + ECO Book
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
    forceBadge?: MoveBadgeType;
  }
): MoveBadge {
  // Jika dipaksa oleh modul taktik (misal Trik & Quest)
  if (options?.forceBadge && BADGE_CONFIGS[options.forceBadge]) {
    return BADGE_CONFIGS[options.forceBadge];
  }

  const cBefore = new Chess(fenBefore);
  const from = moveUci.slice(0, 2) as Square;
  const to = moveUci.slice(2, 4) as Square;
  const moverPiece = cBefore.get(from);
  const targetPiece = cBefore.get(to);

  // 1. Skakmat Mutlak = Langkah Luar Biasa (★ Great)
  if (moveSan.includes("#")) {
    return BADGE_CONFIGS.great;
  }

  // Simulasikan langkah di papan baru
  let cAfter: Chess;
  try {
    cAfter = new Chess(fenBefore);
    cAfter.move({ from, to, promotion: moveUci[4] });
  } catch {
    return BADGE_CONFIGS.mistake;
  }

  const moverColor = moverPiece ? moverPiece.color : "w";
  const oppColor = moverColor === "w" ? "b" : "w";

  // 2. DETEKSI BLUNDER FATAL 1: Mengizinkan lawan melakukan Skakmat di langkah berikutnya
  const oppMoves = cAfter.moves({ verbose: true });
  for (const om of oppMoves) {
    const cCheckMate = new Chess(cAfter.fen());
    cCheckMate.move(om);
    if (cCheckMate.isCheckmate()) {
      return BADGE_CONFIGS.blunder; // Blunder fatal: membiarkan Raja diskakmat!
    }
  }

  // 3. DETEKSI BLUNDER FATAL 2: Menggantung Bidak Berharga Gratis (Hanging Piece)
  // Menempatkan Perwira (Menteri/Benteng/Gajah/Kuda) ke petak yang diserang lawan tanpa perlindungan kawan
  if (moverPiece && moverPiece.type !== "p") {
    const isAttacked = cAfter.isAttacked(to, oppColor);
    const isDefended = cAfter.isAttacked(to, moverColor);
    const moverVal = PIECE_VALS[moverPiece.type] || 100;
    const targetVal = targetPiece ? (PIECE_VALS[targetPiece.type] || 0) : 0;

    // Jika masuk petak diserang, tidak dikawal, dan bukan skak balik: BLUNDER BESAR!
    if (isAttacked && !isDefended && moverVal > targetVal + 100) {
      return BADGE_CONFIGS.blunder;
    }

    // Jika dikawal tapi diserang pion lawan (perwira mahal dimakan pion murah): MISTAKE / BLUNDER
    if (moverVal >= 500 && isAttacked && targetVal < 300) {
      return BADGE_CONFIGS.blunder;
    }
  }

  // 4. DETEKSI PENGORBANAN BRILIAN (‼️ Brilliant Move)
  // Menempatkan perwira berharga ke petak diserang atau membiarkannya dipukul,
  // tapi menghasilkan skak (+), garpu taktis ganda, atau inisiatif serangan menang!
  if (moverPiece && moverPiece.type !== "p") {
    const moverVal = PIECE_VALS[moverPiece.type] || 100;
    const isAttacked = cAfter.isAttacked(to, oppColor);

    if (isAttacked && moverVal >= 320) {
      // Jika langkah ini memberikan skak atau garpu
      if (moveSan.includes("+")) {
        return BADGE_CONFIGS.brilliant;
      }
      // Jika langkah ini merupakan rekomendasi terbaik engine (pengorbanan terhitung)
      if (options?.isEngineBest) {
        return BADGE_CONFIGS.brilliant;
      }
    }
  }

  // 5. DETEKSI EVALUASI DELTA STOCKFISH (Centipawn Drop)
  if (typeof options?.evalBefore === "number" && typeof options?.evalAfter === "number") {
    const delta = options.evalBefore - options.evalAfter; // drop evaluasi
    if (delta >= 200) return BADGE_CONFIGS.blunder;
    if (delta >= 80) return BADGE_CONFIGS.mistake;
    if (options.evalAfter >= 350 && delta <= 15) return BADGE_CONFIGS.great;
  }

  // 6. DETEKSI TEORI BUKU PEMBUKAAN (📖 Book Move)
  // Di 6 langkah pertama jika memainkan jalur teori catur terkenal
  const moveNumber = parseInt(fenBefore.split(" ")[5] || "1", 10);
  if (options?.isBook || (moveNumber <= 4 && COMMON_BOOK_MOVES.has(moveUci))) {
    return BADGE_CONFIGS.book;
  }

  // 7. Rekomendasi Utama Mesin / Langkah Unggul
  if (options?.isEngineBest || moveSan.includes("+") || (targetPiece && PIECE_VALS[targetPiece.type] >= 300)) {
    return BADGE_CONFIGS.best;
  }

  // Default untuk langkah solid
  return BADGE_CONFIGS.best;
}

/**
 * Renderer Petak Papan Catur:
 * Merender badge kualitas mengambang persis di atas petak yang berisi bidak
 * dan langsung membersihkannya saat bidak berpindah.
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

/**
 * Komponen Legenda Badge ala Chess.com:
 * Menampilkan baris indikator (!! Brilian, ✓ Terbaik, 📖 Buku, ?? Blunder)
 * yang dipasang di bawah papan catur pada semua mode.
 */
export function ChessBadgeLegend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`mt-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs text-neutral-300 flex-wrap gap-2 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-[#06b6d4] text-white flex items-center justify-center font-black text-[9px] border border-white/50 shadow-sm">
          !!
        </span>
        <span className="font-bold text-white text-[11px]">Brilian</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-[#16a34a] text-white flex items-center justify-center font-black text-[9px] border border-white/50 shadow-sm">
          ✓
        </span>
        <span className="font-medium text-[11px]">Terbaik</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-[#d97706] text-white flex items-center justify-center font-black text-[9px] border border-white/50 shadow-sm">
          📖
        </span>
        <span className="font-medium text-[11px]">Buku</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-[#dc2626] text-white flex items-center justify-center font-black text-[9px] border border-white/50 shadow-sm">
          ??
        </span>
        <span className="font-medium text-[11px]">Blunder</span>
      </div>
    </div>
  );
}
