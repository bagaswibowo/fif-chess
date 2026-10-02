import type { GameRecord } from "@/lib/game-history";

export type ForumCategory = {
  id: string;
  name: string;
  description: string;
  threadsCount: number;
};

export type GameAnalysisReport = {
  accuracy: number;
  blunders: number;
  mistakes: number;
  missedWins: number;
  bestMovesCount: number;
  verdict: string;
  moveFeedback: {
    ply: number;
    san: string;
    type: "best" | "good" | "inaccuracy" | "mistake" | "blunder" | "missed";
    commentary: string;
    engineAlternative?: string;
  }[];
};

export type ForumPost = {
  id: string;
  postNumber: number;
  authorUsername: string;
  authorName: string;
  authorTitle?: string;
  authorRole?: string;
  avatarInitials: string;
  content: string;
  likes: number;
  createdAt: string;
  attachedGame?: GameRecord;
  attachedGames?: GameRecord[];
};

export type ForumThread = {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  authorUsername: string;
  authorName: string;
  authorTitle?: string;
  avatarInitials: string;
  repliesCount: number;
  lastActivity: string;
  isPinned?: boolean;
  isHot?: boolean;
  posts: ForumPost[];
  attachedGameSummary?: {
    opponent: string;
    outcome: string;
    movesCount: number;
    playedAs: "white" | "black";
  };
};
