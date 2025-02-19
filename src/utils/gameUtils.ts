import { Card, Player } from "@/types/game";

export const calculateHandValue = (hand: Card[]): number => {
  let value = 0;
  let aces = 0;

  hand.forEach((card) => {
    if (card.value === "A") {
      aces += 1;
      value += 11;
    } else if (["K", "Q", "J"].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  });

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
};

export const determineWinner = (players: Player[]): Player | undefined => {
  const activePlayers = players.filter((p) => !p.isHouse && p.score <= 21);
  const house = players.find((p) => p.isHouse);

  if (!house) return undefined;

  if (house.score > 21) {
    // House busts, highest non-bust player wins
    return activePlayers.reduce(
      (prev, curr) => (!prev || curr.score > prev.score ? curr : prev),
      undefined as Player | undefined
    );
  }

  // House doesn't bust, highest score under 21 wins
  const winner = activePlayers.find((p) => p.score > house.score) || house;
  return winner;
};

export const createDeck = (): Card[] => {
  const suits = ["hearts", "diamonds", "clubs", "spades"] as const;
  const values = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
  ];

  const deck: Card[] = [];

  suits.forEach((suit) => {
    values.forEach((value) => {
      deck.push({
        suit,
        value,
        code: `${value}${suit[0].toUpperCase()}`,
      });
    });
  });

  return shuffleDeck(deck);
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
