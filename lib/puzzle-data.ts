import rawQuestChapters from "@/resource/puzzles-quest.json";
import rawPuzzles from "@/resource/puzzles-all.json";

export type PuzzleCategory = "opening" | "defense" | "middlegame" | "endgame" | "jebakan" | "skakmat" | "opponent";
export type PuzzleDifficulty = "Mudah" | "Sedang" | "Sulit";
export type PuzzleMotif = "mate" | "promotion" | "capture" | "capture-check" | "check" | "tactic" | "trap";
export type PuzzleTrack = "quest" | "puzzle";
export type PuzzleSource = "ct-art" | "bpcaturpedia" | "live";

export type Puzzle = {
  id: string;
  category: PuzzleCategory;
  difficulty: PuzzleDifficulty;
  track: PuzzleTrack;
  fen: string;
  turn: "w" | "b";
  solutionUci: string;
  solutionSan: string;
  motif: PuzzleMotif;
  theme: string;
  description: string;
  hintPiece: string;
  hintExplanation: string;
  trickExplanation: string;
  xp: number;
  source?: PuzzleSource;
};

export const PUZZLE_CATEGORIES: { id: PuzzleCategory | "all"; label: string }[] = [
  { id: "all", label: "Semua Kategori" },
  { id: "opening", label: "Pembukaan (Opening)" },
  { id: "defense", label: "Pertahanan (Defense)" },
  { id: "middlegame", label: "Babak Tengah (Middlegame)" },
  { id: "endgame", label: "Babak Akhir (Endgame)" },
  { id: "jebakan", label: "Jebakan (Traps) · BPCaturPedia" },
  { id: "skakmat", label: "Taktik Skakmat · BPCaturPedia" },
  { id: "opponent", label: "Trik Lawan Live" },
];

export function byCategory(puzzles: Puzzle[], category: PuzzleCategory | "all"): Puzzle[] {
  if (category === "all") return puzzles;
  return puzzles.filter((p) => p.category === category);
}

export const QUEST_CHAPTERS: Puzzle[] = rawQuestChapters as Puzzle[];
export const PUZZLES: Puzzle[] = rawPuzzles as Puzzle[];
