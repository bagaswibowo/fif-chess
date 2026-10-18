import { Chess, type Square } from "chess.js";

export const KENARI_ENDPOINT = "https://kenari.id/v1/systemone";
export const KENARI_MODEL = "jev-1-13-free";
export const KENARI_DEFAULT_API_KEY = "kn-2d8e9086471b9f5a62ed9bc47d233cd0e595e1e4c2ff6ba6";

export function getKenariApiKey(): string {
  return (
    process.env.KENARI_API_KEY ||
    process.env.TYPESAFE_API_KEY ||
    KENARI_DEFAULT_API_KEY
  );
}

export interface CandidateMove {
  uci: string;
  san: string;
  desc?: string;
  priorScore?: number;
}

export interface KenariEvaluationResult {
  bestUci: string;
  probabilities: Record<string, number>;
  confidence: number;
  scores: Record<string, number>;
}

/**
 * Memanggil endpoint Kenari AI (https://kenari.id/v1/systemone) model jev-1-13-free
 * Menggunakan format pertanyaan { type: "noul" } untuk mengevaluasi setiap kandidat langkah catur.
 */
export async function queryKenariJev(
  fen: string,
  candidateMoves: CandidateMove[],
  history: string[] = [],
  timeoutMs = 2500
): Promise<KenariEvaluationResult | null> {
  const apiKey = getKenariApiKey();
  if (!apiKey) return null;

  if (candidateMoves.length === 0) return null;

  // Batasi ke maksimal 8 kandidat teratas agar response kilat
  const selectedCandidates = candidateMoves.slice(0, 8);

  const questions: Record<string, { type: "noul"; instructions: string }> = {};
  for (const c of selectedCandidates) {
    questions[c.uci] = {
      type: "noul",
      instructions: `Evaluasi kualitas langkah catur ${c.san} (${c.desc || "kandidat strategis"}) pada skala 0.0 hingga 1.0 berdasarkan akurasi taktik, keamanan Raja, dan dominasi spasial.`,
    };
  }

  const payload = {
    model: KENARI_MODEL,
    state: `Pertandingan catur. Posisi FEN: ${fen}. Riwayat langkah terakhir: ${
      history.slice(-4).join(" ") || "awal permainan"
    }. Giliran melangkah.`,
    questions,
  };

  try {
    const resp = await fetch(KENARI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      return null;
    }

    const data = await resp.json();
    const answers = data?.answers;
    if (!answers || typeof answers !== "object") {
      return null;
    }

    const scores: Record<string, number> = {};
    let bestUci = selectedCandidates[0].uci;
    let maxScore = -1;
    let sumScore = 0;

    for (const c of selectedCandidates) {
      const item = answers[c.uci];
      const val = typeof item?.noul === "number" ? Math.max(0, item.noul) : 0.1;
      scores[c.uci] = val;
      sumScore += val;

      if (val > maxScore) {
        maxScore = val;
        bestUci = c.uci;
      }
    }

    const probabilities: Record<string, number> = {};
    for (const [uci, sc] of Object.entries(scores)) {
      probabilities[uci] = sumScore > 0 ? Number((sc / sumScore).toFixed(4)) : 1 / selectedCandidates.length;
    }

    return {
      bestUci,
      probabilities,
      confidence: maxScore > 0 ? maxScore : 0.5,
      scores,
    };
  } catch (err) {
    // Timeout atau network glitch: kembalikan null agar engine fallback mulus ke Drosophila MCTS
    return null;
  }
}
