"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { GameState, GameAction } from "@/types/game";
import PlayerHand from "@/components/PlayerHand";

let socket: Socket;

// Get the server URL based on the current hostname
const getServerUrl = () => {
  const hostname = window.location.hostname;
  const port = 3000;
  return `http://${hostname}:${port}`;
};

export default function Game() {
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    deck: [],
    currentTurn: "",
    gameStarted: false,
    gameEnded: false,
  });
  const [playerName, setPlayerName] = useState("");
  const [playerId] = useState(uuidv4());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Initialize socket connection using the server URL
      const serverUrl = getServerUrl();
      console.log("Connecting to server:", serverUrl);

      socket = io(serverUrl, {
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        console.log("Connected to server");
        setIsConnected(true);
        setError(null);
      });

      socket.on("connect_error", (err) => {
        console.error("Connection error:", err);
        setError("Failed to connect to server. Please try again.");
        setIsConnected(false);
      });

      socket.on("disconnect", () => {
        console.log("Disconnected from server");
        setIsConnected(false);
      });

      socket.on("gameStateUpdate", (newGameState: GameState) => {
        console.log("Game state updated:", newGameState);
        setGameState(newGameState);
      });

      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.error("Socket initialization error:", err);
      setError("Failed to initialize connection. Please refresh the page.");
    }
  }, []);

  const currentPlayer = gameState.players.find((p) => p.id === playerId);
  const isPlayerTurn = gameState.currentTurn === playerId;

  const handleJoinGame = () => {
    if (playerName.trim()) {
      const action: GameAction = {
        type: "JOIN",
        playerId,
        playerName: playerName.trim(),
      };
      socket.emit("gameAction", action);
    }
  };

  const handleStartGame = () => {
    socket.emit("gameAction", { type: "START" });
  };

  const handleHit = () => {
    socket.emit("gameAction", { type: "HIT", playerId });
  };

  const handleStand = () => {
    socket.emit("gameAction", { type: "STAND", playerId });
  };

  const handleReset = () => {
    socket.emit("gameAction", { type: "RESET" });
  };

  if (!isConnected) {
    return (
      <div className="text-white text-center">
        <p>Connecting to server...</p>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div className="bg-white rounded-lg p-8 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4">Join Game</h2>
        <input
          type="text"
          placeholder="Enter your name"
          className="w-full p-2 border rounded mb-4"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <button
          onClick={handleJoinGame}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Join
        </button>
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="mb-8">
        <h2 className="text-2xl mb-4">Players:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {gameState.players.map((player) => (
            <PlayerHand
              key={player.id}
              player={player}
              isCurrentTurn={gameState.currentTurn === player.id}
            />
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black/50 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            {!gameState.gameStarted && currentPlayer.isHouse && (
              <button
                onClick={handleStartGame}
                className="bg-green-500 text-white px-4 py-2 rounded mr-4 hover:bg-green-600"
                disabled={gameState.players.length < 2}
              >
                Start Game
              </button>
            )}
            {gameState.gameStarted &&
              isPlayerTurn &&
              !currentPlayer.isStanding && (
                <>
                  <button
                    onClick={handleHit}
                    className="bg-blue-500 text-white px-4 py-2 rounded mr-4 hover:bg-blue-600"
                  >
                    Hit
                  </button>
                  <button
                    onClick={handleStand}
                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                  >
                    Stand
                  </button>
                </>
              )}
          </div>

          {gameState.gameEnded && (
            <div className="flex items-center">
              <span className="mr-4">Winner: {gameState.winner?.name}</span>
              <button
                onClick={handleReset}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                New Game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
