/**
 * Drosophila Whole-Brain Connectome Network Statistics (FlyWire bioRxiv 2023.07.29.551086 / Nature 2024)
 * Authors: Lin, Yang, Dorkenwald, Matsliah, Sterling, Schlegel, Yu, McKellar, Costa, Eichler, Bates, Eckstein, Funke, Jefferis, Murthy.
 * 
 * Key Principles Implemented:
 * 1. Reciprocal Connectivity (Reciprocity = 0.138 vs 0.015 random null models):
 *    - Symmetric ACh <-> ACh: Mutual piece co-protection / pawn chains (synaptic reinforcement).
 *    - Asymmetric ACh <-> GABA: Feedback inhibition & gain control (suppresses counter-punished attacks).
 * 2. Three-Node Motifs (Triads):
 *    - Over-representation of recurrent/feedback motifs (motifs 4-12, motif 13 fully connected).
 *    - 3-piece triangular defense networks (A -> B -> C -> A) provide topological fortress resilience.
 * 3. Neuropil-Specific Highly Reciprocal Neurons (NSRN):
 *    - 1,863 NSRNs (54% GABA, 29% Glutamate) provide local circuit gain control.
 *    - Sector partitioning: Kingside (MB), Central (CX), Queenside (Optic/Lateral).
 *    - Local GABAergic inhibition suppresses desertion blunders leaving home sectors undefended.
 * 4. Rich-Club Hubs (Integrator vs Broadcaster Neurons):
 *    - Integrators (high in-degree): Multi-piece anchored hubs.
 *    - Broadcasters (high out-degree): Radiating mobile pieces (>= 5 controlled squares).
 *    - Anchored coupling: Broadcasters must maintain structural connection to an Integrator anchor.
 */

import { Chess, type Square } from "chess.js";

export type NeuropilSector = "central" | "kingside" | "queenside";

export function getNeuropilSector(sq: string): NeuropilSector {
  const file = sq[0];
  if (file === "a" || file === "b") return "queenside";
  if (file === "g" || file === "h") return "kingside";
  return "central";
}

export interface ConnectomeNetworkStats {
  reciprocityScore: number;
  triadMotifsCount: number;
  triadBonus: number;
  nsrnInhibition: number;
  richClubScore: number;
  netScore: number;
  diagnostics: string[];
}

/**
 * Calculates connectome network statistics and neuromodulatory feedback for a candidate move.
 */
export function evaluateConnectomeNetwork(chess: Chess, uci: string): ConnectomeNetworkStats {
  const diagnostics: string[] = [];
  let reciprocityScore = 0;
  let triadMotifsCount = 0;
  let triadBonus = 0;
  let nsrnInhibition = 0;
  let richClubScore = 0;

  try {
    const fromSq = uci.slice(0, 2) as Square;
    const toSq = uci.slice(2, 4) as Square;
    const promo = uci[4] || undefined;

    const moverColor = chess.turn();
    const oppColor = moverColor === "w" ? "b" : "w";

    // 1. Simulasikan langkah
    const moved = chess.move({ from: fromSq, to: toSq, promotion: promo });
    if (!moved) {
      return {
        reciprocityScore: 0,
        triadMotifsCount: 0,
        triadBonus: 0,
        nsrnInhibition: 0,
        richClubScore: 0,
        netScore: 0,
        diagnostics: ["invalid_move"],
      };
    }

    const board = chess.board();
    const friendlyPieces: { sq: Square; type: string }[] = [];
    const oppPieces: { sq: Square; type: string }[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const sq = p.square;
        if (p.color === moverColor) {
          friendlyPieces.push({ sq, type: p.type });
        } else {
          oppPieces.push({ sq, type: p.type });
        }
      }
    }

    // 2. RECIPROCAL CONNECTION COUPLING (Lin et al. §Recurrent motifs & §Neurotransmitter makeup)
    // Skenario A: Symmetric ACh <-> ACh (Mutual Defense / Reciprocal support)
    // Cek apakah perwira yang baru melangkah saling menjaga dengan perwira kawan lainnya
    const toAttackers = chess.attackers(toSq, moverColor);
    for (const defSq of toAttackers) {
      const defendersOfDef = chess.attackers(defSq, moverColor);
      if (defendersOfDef.includes(toSq)) {
        // Mutual reciprocal defense: toSq protects defSq, and defSq protects toSq!
        reciprocityScore += 140;
        diagnostics.push(`ach_reciprocal_defense_${defSq}_${toSq}`);
      }
    }

    // Skenario B: Asymmetric ACh <-> GABA (Feedback Inhibition / Gain Control)
    // Jika langkah ini menyerang perwira musuh, periksa apakah perwira musuh tersebut
    // atau sekutunya langsung memiliki respon serangan balik (counter-pin/discovered attack)
    if (moved.captured) {
      // Capture creates immediate positive cholinergic surge
      reciprocityScore += 60;
    } else {
      const attackedByMoved = chess.moves({ square: toSq, verbose: true }).filter((m) => m.captured);
      if (attackedByMoved.length > 0) {
        // Langkah menyerang perwira lawan: cek apakah toSq sendiri langsung diserang lawan (GABA feedback)
        const isCounterAttacked = chess.isAttacked(toSq, oppColor);
        if (isCounterAttacked) {
          const defenders = chess.attackers(toSq, moverColor);
          if (defenders.length === 0) {
            // Serangan sembrono tanpa pelindung: GABA feedback inhibition keras
            nsrnInhibition += 180;
            diagnostics.push("gaba_unsupported_offensive_inhibition");
          }
        }
      }
    }

    // 3. THREE-NODE MOTIFS (Triads - Lin et al. §Neurotransmitter composition of three-node motifs)
    // Deteksi motif segitiga pertahanan (Triad Motif 13: A -> B -> C -> A)
    // Periksa apakah toSq berpartisipasi dalam triad defensif 3 simpul
    for (const b of friendlyPieces) {
      if (b.sq === toSq) continue;
      const bAttackedByTo = chess.attackers(b.sq, moverColor).includes(toSq);
      if (!bAttackedByTo) continue;

      // Cari simpul C yang dijaga B dan menjaga toSq
      for (const c of friendlyPieces) {
        if (c.sq === toSq || c.sq === b.sq) continue;
        const cAttackedByB = chess.attackers(c.sq, moverColor).includes(b.sq);
        const toAttackedByC = chess.attackers(toSq, moverColor).includes(c.sq);

        if (cAttackedByB && toAttackedByC) {
          triadMotifsCount++;
          triadBonus += 180; // Triad reciprocal closed loop: benteng kokoh tahan banting
          diagnostics.push(`triad_motif_13_${toSq}_${b.sq}_${c.sq}`);
          break;
        }
      }
      if (triadMotifsCount >= 2) break;
    }

    // 4. NEUROPIL-SPECIFIC HIGHLY RECIPROCAL NEURONS (NSRN - Lin et al. §Identifying NSRNs)
    // Partisi sektor neuropil (Kingside / Central / Queenside)
    // Pastikan tidak terjadi pengosongan sektor (desertion) saat sektor tersebut sedang diserang
    const fromSector = getNeuropilSector(fromSq);
    const toSector = getNeuropilSector(toSq);

    if (fromSector !== toSector && fromSector === "kingside") {
      // Perwira meninggalkan sayap raja: periksa apakah raja berada di sayap raja dan ada ancaman lawan
      const kingSq = friendlyPieces.find((p) => p.type === "k")?.sq;
      if (kingSq && getNeuropilSector(kingSq) === "kingside") {
        const oppKingsideAttackers = oppPieces.filter((p) => {
          const attacks = chess.moves({ square: p.sq, verbose: true });
          return attacks.some((m) => getNeuropilSector(m.to) === "kingside");
        });
        if (oppKingsideAttackers.length >= 2) {
          // Sayap raja sedang di bawah tekanan, meninggalkan sektor di-veto oleh NSRN GABAergic local circuit
          nsrnInhibition += 260;
          diagnostics.push("nsrn_kingside_desertion_inhibition");
        }
      }
    }

    // 5. RICH-CLUB INTEGRATORS VS BROADCASTERS (Lin et al. §Large-scale connectivity & §Definitions of highly connected neurons)
    // Integrator: in-degree >= 3 (banyak pelindung)
    // Broadcaster: out-degree >= 5 (mengontrol banyak petak)
    const inDegree = chess.attackers(toSq, moverColor).length;
    const outDegree = chess.moves({ square: toSq }).length;

    if (outDegree >= 5) {
      // Broadcaster neuron: kekuatan mobilitas tinggi
      if (inDegree >= 1) {
        // Broadcaster terhubung ke jaringan integrator kawan: sinergi stabil
        richClubScore += 120;
        diagnostics.push("rich_club_anchored_broadcaster");
      } else {
        // Broadcaster terisolasi tanpa jangkar kawan: rentan dijebak
        richClubScore -= 80;
        diagnostics.push("rich_club_isolated_broadcaster");
      }
    }

    chess.undo();

    const netScore = reciprocityScore + triadBonus + richClubScore - nsrnInhibition;

    return {
      reciprocityScore,
      triadMotifsCount,
      triadBonus,
      nsrnInhibition,
      richClubScore,
      netScore,
      diagnostics,
    };
  } catch {
    return {
      reciprocityScore: 0,
      triadMotifsCount: 0,
      triadBonus: 0,
      nsrnInhibition: 0,
      richClubScore: 0,
      netScore: 0,
      diagnostics: ["exception_fallback"],
    };
  }
}
