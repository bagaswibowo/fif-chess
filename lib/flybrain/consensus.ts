/**
 * Multiconnectome consensus cell typing for chess moves (FlyWire paper §3/6 pipeline).
 * Balanced co-clustering across move sources/databases with technical noise control.
 */

export type Reliability = "unsampled" | "weak" | "moderate" | "strong";

export interface MoveProfile {
  san: string;
  counts: Record<string, number>;
  total: number;
  reliability: Reliability;
  snowflake: boolean;
  technicalNoise: number;
}

export interface ConsensusResult {
  fen: string;
  moves: MoveProfile[];
  nTypes: number;
  strongPct: number;
  snowflakePct: number;
}

/**
 * Coefficient of variation — technical noise proxy (paper ≤ 30% / 0.5 threshold).
 */
export function calcCv(scores: number[]): number {
  if (!scores || scores.length < 2) return 0.0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (mean === 0) return 0.0;
  const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Occurrence fraction to reliability bucket (FlyWire: ≥0.9% -> >90% preserved).
 * Degrades one tier if technical noise exceeds 50% (paper Fig 4j).
 */
export function classifyReliability(frac: number, noise: number = 0.0): Reliability {
  if (frac >= 0.009) return noise < 0.5 ? "strong" : "moderate";
  if (frac >= 0.003) return "moderate";
  if (frac > 0) return "weak";
  return "unsampled";
}

/**
 * Classifies a single move across candidate sources / databases.
 */
export function classifyMove(
  san: string,
  counts: Record<string, number>,
  total: number,
  minDbs: number,
): MoveProfile {
  const activeEntries = Object.entries(counts).filter(([, v]) => v > 0);
  if (activeEntries.length < minDbs) {
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      san,
      counts,
      total: totalCount,
      reliability: activeEntries.length === 0 ? "unsampled" : "weak",
      snowflake: activeEntries.length === 1,
      technicalNoise: 0.0,
    };
  }

  const vals = activeEntries.map(([, v]) => v);
  const sumVals = vals.reduce((a, b) => a + b, 0);
  const frac = total > 0 ? sumVals / total : 0;
  const noise = calcCv(vals);

  return {
    san,
    counts,
    total: sumVals,
    reliability: classifyReliability(frac, noise),
    snowflake: false,
    technicalNoise: Number(Math.min(noise, 1.0).toFixed(3)),
  };
}

export function collectProfiles(
  allSan: string[],
  dbMoves: Record<string, Record<string, number>>,
  total: number,
  minDbs: number,
): MoveProfile[] {
  const dbs = Object.keys(dbMoves);
  return allSan.map((san) => {
    const counts: Record<string, number> = {};
    for (const db of dbs) {
      counts[db] = dbMoves[db][san] || 0;
    }
    return classifyMove(san, counts, total, minDbs);
  });
}

export function aggregateProfiles(profiles: MoveProfile[]) {
  const strong = profiles.filter((p) => p.reliability === "strong").length;
  const flake = profiles.filter((p) => p.snowflake).length;
  const nTypes = profiles.filter((p) => p.reliability === "strong" || p.reliability === "moderate").length;
  return { strong, flake, nTypes };
}

/**
 * FlyWire §3/6 pipeline analog: balanced co-clustering across databases.
 */
export function consensusMoves(
  fen: string,
  dbMoves: Record<string, Record<string, number>>,
  minDbs: number = 2,
): ConsensusResult {
  const dbs = Object.keys(dbMoves);
  const total = dbs.reduce((acc, db) => {
    return acc + Object.values(dbMoves[db]).reduce((a, b) => a + b, 0);
  }, 0);

  if (total === 0) {
    return { fen, moves: [], nTypes: 0, strongPct: 0, snowflakePct: 0 };
  }

  const allSanSet = new Set<string>();
  for (const db of dbs) {
    for (const san of Object.keys(dbMoves[db])) {
      allSanSet.add(san);
    }
  }

  const profiles = collectProfiles(Array.from(allSanSet), dbMoves, total, minDbs);
  const { strong, flake, nTypes } = aggregateProfiles(profiles);
  const len = Math.max(1, profiles.length);

  return {
    fen,
    moves: profiles,
    nTypes,
    strongPct: Number(((strong / len) * 100).toFixed(1)),
    snowflakePct: Number(((flake / len) * 100).toFixed(1)),
  };
}
