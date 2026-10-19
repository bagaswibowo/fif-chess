export interface BotPersona {
  id: string;
  name: string;
  title: string;
  rating: number;
  engine: "stockfish" | "fly" | "jev" | "jev-fly";
  depth: number;
  descriptionId: string;
  descriptionEn: string;
  blunderRate: number;
  aggression: "balanced" | "aggressive" | "solid" | "master";
}

export const BOT_PERSONAS: BotPersona[] = [
  {
    id: "jimmy",
    name: "Jimmy (Pemula)",
    title: "BOT",
    rating: 600,
    engine: "stockfish",
    depth: 2,
    descriptionId: "Pemain pemula yang sering melewatkan ancaman perwira.",
    descriptionEn: "Beginner player who occasionally hangs pieces.",
    blunderRate: 0.35,
    aggression: "balanced",
  },
  {
    id: "nelson",
    name: "Nelson (Penyerang)",
    title: "BOT",
    rating: 1300,
    engine: "stockfish",
    depth: 5,
    descriptionId: "Agresif membawa Menteri keluar lebih awal untuk menekan.",
    descriptionEn: "Aggressive player who brings his Queen out very early.",
    blunderRate: 0.15,
    aggression: "aggressive",
  },
  {
    id: "master-jev",
    name: "Master JEV (Connectome)",
    title: "IM",
    rating: 2500,
    engine: "jev-fly",
    depth: 12,
    descriptionId: "Jaringan syaraf Drosophila Connectome MCTS canggih.",
    descriptionEn: "Neural connectome Drosophila brain network hybrid.",
    blunderRate: 0.02,
    aggression: "solid",
  },
  {
    id: "stockfish-gm",
    name: "Stockfish 19 NNUE",
    title: "GM",
    rating: 3550,
    engine: "stockfish",
    depth: 16,
    descriptionId: "Mesin catur Grandmaster presisi tanpa celah taktis.",
    descriptionEn: "World-class tactical engine calculation powerhouse.",
    blunderRate: 0.0,
    aggression: "master",
  },
];
