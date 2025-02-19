import { Player } from "@/types/game";

interface PlayerHandProps {
  player: Player;
  isCurrentTurn: boolean;
}

export default function PlayerHand({ player, isCurrentTurn }: PlayerHandProps) {
  return (
    <div
      className={`bg-green-900 rounded-lg p-4 ${
        isCurrentTurn ? "ring-4 ring-yellow-400" : ""
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">
          {player.name} {player.isHouse ? "(House)" : ""}
        </h3>
        <span className="text-lg">Score: {player.score}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {player.hand.map((card, index) => (
          <div
            key={`${card.code}-${index}`}
            className="w-16 h-24 bg-white rounded-lg flex items-center justify-center text-black font-bold relative"
          >
            <span
              className={`text-${
                card.suit === "hearts" || card.suit === "diamonds"
                  ? "red"
                  : "black"
              }-600`}
            >
              {card.value}
              <span className="text-xs block">
                {card.suit === "hearts"
                  ? "♥"
                  : card.suit === "diamonds"
                  ? "♦"
                  : card.suit === "clubs"
                  ? "♣"
                  : "♠"}
              </span>
            </span>
          </div>
        ))}
      </div>

      {player.isStanding && (
        <div className="mt-2 text-yellow-400 font-bold">Standing</div>
      )}
    </div>
  );
}
