import { Chess } from "chess.js";
import { identifyOpeningOrGambit, identifyBainTactics, computeTektokkanExchange } from "./tactics";

export type GrandmasterCommentary = {
  headline: string;
  reason: string;
  tacticalBadge: {
    name: string;
    description: string;
    badgeColor: string;
  } | null;
  openingInfo: {
    name: string;
    description: string;
  } | null;
  exchangeThreat: string | null;
  evalAssessment: string;
  strategicPlan: string;
  evalCp: number;
};

export function generateGrandmasterCommentary(params: {
  chess: Chess;
  moves: Array<{ san: string; uci: string; by?: string }>;
  evalCp: number | null;
  mate: number | null;
  humanSide: "white" | "black";
  humanToMove: boolean;
  opponentName: string;
}): GrandmasterCommentary {
  const { chess, moves, evalCp, mate, humanSide, humanToMove, opponentName } = params;
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  const ply = moves.length;
  const currentEval = evalCp ?? 0;

  // 1. Opening detection
  let openingInfo: { name: string; description: string } | null = null;
  const opening = identifyOpeningOrGambit(moves.map((m) => m.san));
  if (opening) {
    openingInfo = {
      name: opening.name,
      description: opening.description,
    };
  }

  // 2. Tactical motif detection (John A. Bain & Master Motifs)
  let tacticalBadge: { name: string; description: string; badgeColor: string } | null = null;
  if (lastMove?.uci) {
    const tactic = identifyBainTactics(chess, lastMove.uci);
    if (tactic) {
      tacticalBadge = {
        name: tactic.name,
        description: tactic.description,
        badgeColor: tactic.badgeColor,
      };
    }
  }

  // 3. Tektokkan exchange calculation
  let exchangeThreat: string | null = null;
  if (lastMove?.uci) {
    const tektokkan = computeTektokkanExchange(chess, lastMove.uci);
    if (tektokkan.hasExchange && tektokkan.explanation) {
      exchangeThreat = tektokkan.explanation;
    }
  }

  // 4. Headline & Reason (selayaknya komentator kejuaraan dunia catur)
  let headline = "Fase Pembukaan — Memperebutkan Ruang Sentral";
  let reason = "Kedua pihak mengembangkan perwira ringan dan memperebutkan kendali empat petak pusat (e4, d4, e5, d5).";

  if (lastMove) {
    const san = lastMove.san;
    const isWhiteMove = ply % 2 === 1;
    const moverName = isWhiteMove
      ? humanSide === "white"
        ? "Anda (Putih)"
        : `${opponentName} (Putih)`
      : humanSide === "black"
        ? "Anda (Hitam)"
        : `${opponentName} (Hitam)`;

    if (san.includes("#")) {
      headline = "SKAKMAT MUTLAK! Kemenangan Terkunci";
      reason = `${moverName} melancarkan manuver penutup ${san}! Serangan taktis mematikan yang tidak menyisakan petak pelarian bagi raja lawan.`;
    } else if (san.includes("+")) {
      headline = "Skak Tajam & Serangan Langsung!";
      reason = `${moverName} memberi skak dengan ${san}! Menuntut respons tanggap darurat dari raja dan merebut inisiatif tempo pertempuran.`;
    } else if (san.includes("x")) {
      headline = "Pertukaran Material Taktis";
      reason = `${moverName} mengeksekusi pemukulan perwira di petak sasaran (${san}). Struktur pion terbuka dan ketegangan papan meningkat drastis!`;
    } else if (san === "O-O" || san === "O-O-O") {
      headline = "Rokade & Konsolidasi Raja";
      reason = `${moverName} merokade rajanya (${san}), mengevakuasi raja ke bunker aman sekaligus mengaktifkan benteng ke kolom tengah.`;
    } else if (san.startsWith("N")) {
      headline = "Manuver Kuda Strategis";
      reason = `${moverName} mengarahkan kuda (${san}) menuju pos terdepan (outpost) yang mengincar petak lemah di teritori lawan.`;
    } else if (san.startsWith("B")) {
      headline = "Penguasaan Diagonal Terbuka";
      reason = `${moverName} menempatkan gajah (${san}) membelah papan diagonal panjang, memberi tekanan silang yang menusuk pertahanan.`;
    } else if (san.startsWith("R")) {
      headline = "Mobilisasi Benteng di Kolom Kunci";
      reason = `${moverName} menggeser benteng (${san}), bersiap memperebutkan kolom terbuka atau penetrasi ke baris ke-7.`;
    } else if (san.startsWith("Q")) {
      headline = "Manuver Menteri Berdaya Jelajah Luas";
      reason = `${moverName} mengaktifkan menteri (${san}), menghadirkan ancaman ganda yang memaksa lawan berhati-hati.`;
    } else {
      // Pawn move
      headline = "Ekspansi Pion & Rantai Pusat";
      reason = `${moverName} mendorong pion ${san}, memperkokoh rantai pion serta membuka ruang manuver bagi perwira di belakangnya.`;
    }
  }

  // 5. Evaluation Assessment
  let evalAssessment = "";
  if (mate !== null) {
    if (mate > 0) {
      evalAssessment = `⚠️ Ancaman Skakmat Terdeteksi: Putih memiliki skakmat paksa dalam ${mate} langkah!`;
    } else {
      evalAssessment = `⚠️ Ancaman Skakmat Terdeteksi: Hitam memiliki skakmat paksa dalam ${Math.abs(mate)} langkah!`;
    }
  } else {
    const absVal = Math.abs(currentEval);
    const formattedEval = (currentEval / 100).toFixed(2);
    if (absVal <= 35) {
      evalAssessment = `Keseimbangan Dinamis (${formattedEval > "0" ? "+" + formattedEval : formattedEval}): Kedua pihak bermain sangat presisi. Belum ada kelemahan struktur pion yang dapat dieksploitasi.`;
    } else if (currentEval > 35 && currentEval <= 120) {
      evalAssessment = `Putih Memegang Inisiatif (+${formattedEval}): Putih mengontrol ruang dan inisiatif gerak, namun posisi pertahanan Hitam masih kokoh.`;
    } else if (currentEval > 120 && currentEval <= 300) {
      evalAssessment = `Keunggulan Signifikan Putih (+${formattedEval}): Koordinasi perwira Putih lebih aktif, menekan titik lemah sayap lawan.`;
    } else if (currentEval > 300) {
      evalAssessment = `Dominasi Telak Putih (+${formattedEval}): Keunggulan materi atau posisional yang menentukan. Pertandingan menuju fase konversi kemenangan.`;
    } else if (currentEval < -35 && currentEval >= -120) {
      evalAssessment = `Hitam Memegang Inisiatif (${formattedEval}): Serangan balik Hitam aktif menekan struktur perwira Putih.`;
    } else if (currentEval < -120 && currentEval >= -300) {
      evalAssessment = `Keunggulan Signifikan Hitam (${formattedEval}): Tekanan Hitam sangat berat, Putih harus bermain defensif untuk bertahan.`;
    } else {
      evalAssessment = `Dominasi Telak Hitam (${formattedEval}): Hitam mengendalikan penuh dinamika papan dengan keunggulan taktis mutlak.`;
    }
  }

  // 6. Strategic Plan
  let strategicPlan = "";
  if (humanToMove) {
    if (ply < 10) {
      strategicPlan = "Saran Grandmaster: Selesaikan perkembangan perwira ringan (Kuda & Gajah), segera lakukan rokade untuk mengamankan raja, dan jangan melangkah bidak yang sama berulang kali.";
    } else if (ply < 30) {
      strategicPlan = "Saran Grandmaster: Awasi petak pos depan (outpost), cari kolom semi-terbuka untuk benteng, dan perhatikan potensi taktik (pin, fork, atau skak kejutan).";
    } else {
      strategicPlan = "Saran Grandmaster: Babak akhir catur — aktifkan raja ke pusat papan, dorong pion bebas (passed pawn), dan hitung tempo langkah secara hati-hati.";
    }
  } else {
    strategicPlan = `Analisis Komentator: ${opponentName} sedang mengkalkulasi variasi taktis terdalam untuk membatasi ruang serang dan mempertahankan koordinasi perwira.`;
  }

  return {
    headline,
    reason,
    tacticalBadge,
    openingInfo,
    exchangeThreat,
    evalAssessment,
    strategicPlan,
    evalCp: currentEval,
  };
}
