import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { createGameSession, GameSession } from "../lib/gameUtils";

export default function Lobby() {
  const [games, setGames] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }

    fetchGames();

    // Subscribe to changes in game sessions
    const subscription = supabase
      .channel("game_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
        },
        (payload) => {
          // Handle different types of changes
          if (payload.eventType === "INSERT") {
            setGames((prev) => [payload.new as GameSession, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setGames((prev) =>
              prev.filter((game) => game.id !== payload.old.id)
            );
          } else if (payload.eventType === "UPDATE") {
            setGames((prev) =>
              prev.map((game) =>
                game.id === payload.new.id ? (payload.new as GameSession) : game
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session, router]);

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from("game_sessions")
        .select(
          `
          *,
          players:game_players(*)
        `
        )
        .eq("status", "waiting")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error("Error fetching games:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async () => {
    try {
      if (!user) return;
      setLoading(true);
      const game = await createGameSession(user);
      router.push(`/game/${game.id}`);
    } catch (error) {
      console.error("Error creating game:", error);
      setLoading(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    try {
      if (!user) return;
      setLoading(true);
      router.push(`/game/${gameId}`);
    } catch (error) {
      console.error("Error joining game:", error);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Game Lobby</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.email}</span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="mb-8">
            <button
              onClick={handleCreateGame}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create New Game"}
            </button>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {loading ? (
              <div className="px-6 py-4 text-center text-gray-500">
                Loading games...
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {games.length === 0 ? (
                  <li className="px-6 py-4 text-center text-gray-500">
                    No games available. Create one to start playing!
                  </li>
                ) : (
                  games.map((game) => (
                    <li key={game.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Game #{game.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Created {new Date(game.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleJoinGame(game.id)}
                          disabled={loading}
                          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          {loading ? "Joining..." : "Join Game"}
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
