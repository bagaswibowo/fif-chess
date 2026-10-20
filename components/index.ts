// board
export {
  BoardProvider,
  useBoard,
  type BoardContextValue,
  type BoardOrientation,
  type BoardMove,
} from "./board/BoardContext";
export {
  ChessBoard,
  type ChessBoardProps,
} from "./board/ChessBoard";
export { Square, type SquareProps } from "./board/Square";
export {
  Piece,
  type PieceProps,
  type PieceType,
  type PieceColor,
} from "./board/Piece";

// game
export {
  GameClock,
  type GameClockProps,
} from "./game/GameClock";
export {
  GameControls,
  type GameControlsProps,
} from "./game/GameControls";
export {
  MoveItem,
  type MoveItemProps,
} from "./game/MoveItem";
export {
  MoveList,
  type MoveListProps,
  type MoveRow,
} from "./game/MoveList";
export { GameView, type GameViewProps } from "./game/GameView";

// existing board components (re-export for convenience)
export {
  PlayerStrip,
  type PlayerStripProps,
} from "./board/player-strip";
export { EvalBar } from "./board/eval-bar";
export {
  CapturedPiecesBar,
  type CapturedPiecesData,
} from "./board/captured-pieces";
