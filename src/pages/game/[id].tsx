import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import {
  GameSession,
  GamePlayer,
  GameMove,
  joinGame,
  getGameSession,
  makeMove,
  startGame,
} from "../../lib/gameUtils";
import { supabase } from "../../lib/supabase";

type GameState = {
  session: GameSession & { players: GamePlayer[] };
  currentPlayer: GamePlayer | null;
  moves: GameMove[];
};

export default function Game() {
  const router = useRouter();
  const { id } = router.query;
  const { user, session } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch game moves
  const fetchMoves = async (gameId: string) => {
    try {
      const { data, error } = await supabase
        .from("game_moves")
        .select("*")
        .eq("game_session_id", gameId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error fetching moves:", err);
      return [];
    }
  };

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }

    if (!id) return;

    const loadGame = async () => {
      try {
        const gameSession = await getGameSession(id as string);
        if (!gameSession) throw new Error("Game not found");

        // Fetch existing moves
        const existingMoves = await fetchMoves(id as string);

        // Join the game if not already joined
        const isPlayerInGame = gameSession.players.some(
          (p: GamePlayer) => p.user_id === user?.id
        );

        if (!isPlayerInGame && gameSession.status === "waiting") {
          if (!user) throw new Error("User not authenticated");
          await joinGame(gameSession.id, user);
          // Reload session to get updated players
          const updatedSession = await getGameSession(id as string);
          setGameState({
            session: updatedSession,
            currentPlayer:
              updatedSession.players.find(
                (p: GamePlayer) => p.user_id === user.id
              ) || null,
            moves: existingMoves,
          });
        } else {
          setGameState({
            session: gameSession,
            currentPlayer:
              gameSession.players.find(
                (p: GamePlayer) => p.user_id === user?.id
              ) || null,
            moves: existingMoves,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load game");
      } finally {
        setLoading(false);
      }
    };

    loadGame();

    // Subscribe to game session changes
    const gameSubscription = supabase
      .channel(`game_session_${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${id}`,
        },
        async (payload) => {
          if (payload.eventType === "UPDATE") {
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                session: { ...prev.session, ...payload.new },
              };
            });
          }
        }
      )
      .subscribe();

    // Subscribe to game moves
    const movesSubscription = supabase
      .channel(`game_moves_${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_moves",
          filter: `game_session_id=eq.${id}`,
        },
        (payload) => {
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              moves: [...prev.moves, payload.new as GameMove],
            };
          });
        }
      )
      .subscribe();

    return () => {
      gameSubscription.unsubscribe();
      movesSubscription.unsubscribe();
    };
  }, [id, user, session, router]);

  const handleStartGame = async () => {
    if (!gameState || !id) return;
    try {
      setLoading(true);
      await startGame(id as string);
      const updatedSession = await getGameSession(id as string);
      setGameState({
        ...gameState,
        session: updatedSession,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayCard = async (card: string) => {
    if (!gameState || !gameState.currentPlayer || !id) return;
    try {
      setLoading(true);
      await makeMove(id as string, gameState.currentPlayer.id, "playCard", {
        card,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to play card");
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return null;
  }

  if (loading && !gameState) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Game not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Game #{gameState.session.id.slice(0, 8)}
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                Status: {gameState.session.status}
              </span>
              <button
                onClick={() => router.push("/lobby")}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700"
              >
                Back to Lobby
              </button>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Players</h2>
              <div className="grid grid-cols-2 gap-4">
                {gameState.session.players.map((player) => (
                  <div
                    key={player.id}
                    className={`p-4 rounded-lg ${
                      player.user_id === user?.id
                        ? "bg-green-100"
                        : "bg-gray-100"
                    }`}
                  >
                    <p className="font-medium">
                      Player {player.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Score: {player.score}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {gameState.session.status === "waiting" &&
              gameState.session.players.length >= 2 && (
                <button
                  onClick={handleStartGame}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? "Starting game..." : "Start Game"}
                </button>
              )}

            {gameState.session.status === "in_progress" && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-4">Your Cards</h2>
                <div className="flex space-x-2">
                  {/* Replace with actual cards */}
                  {["A♠", "K♥", "Q♦", "J♣"].map((card) => (
                    <button
                      key={card}
                      onClick={() => handlePlayCard(card)}
                      disabled={loading}
                      className="w-16 h-24 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center text-xl hover:border-indigo-500 disabled:opacity-50"
                    >
                      {card}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4">Game Moves</h2>
              <div className="space-y-2">
                {gameState.moves.map((move) => (
                  <div
                    key={move.id}
                    className="p-2 bg-gray-50 rounded-md text-sm"
                  >
                    <p>
                      Player {move.player_id.slice(0, 8)} played{" "}
                      {move.move_data.card}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
