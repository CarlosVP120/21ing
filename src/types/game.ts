export type Card = {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  value: string;
  code: string;
};

export type Player = {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  isHouse: boolean;
  isStanding: boolean;
};

export type GameState = {
  players: Player[];
  deck: Card[];
  currentTurn: string;
  gameStarted: boolean;
  gameEnded: boolean;
  winner?: Player;
};

export type GameAction = {
  type: "JOIN" | "START" | "HIT" | "STAND" | "RESET";
  playerId?: string;
  playerName?: string;
};
