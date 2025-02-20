import { supabase } from "./supabase";
import { User } from "@supabase/supabase-js";

export type GameSession = {
  id: string;
  created_at: string;
  status: "waiting" | "in_progress" | "completed";
  winner_id: string | null;
};

export type GamePlayer = {
  id: string;
  game_session_id: string;
  user_id: string;
  score: number;
  joined_at: string;
};

export type MoveData = {
  card?: string;
  position?: number;
  target?: string;
  action?: string;
  [key: string]: unknown;
};

export type GameMove = {
  id: string;
  game_session_id: string;
  player_id: string;
  move_type: string;
  move_data: MoveData;
  created_at: string;
};

export async function createGameSession(user: User) {
  const { data, error } = await supabase
    .from("game_sessions")
    .insert([
      {
        status: "waiting",
      },
    ])
    .select()
    .single();

  if (error) throw error;

  // Add the creator as the first player
  await joinGame(data.id, user);

  return data;
}

export async function joinGame(gameId: string, user: User) {
  const { data, error } = await supabase
    .from("game_players")
    .insert([
      {
        game_session_id: gameId,
        user_id: user.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function startGame(gameId: string) {
  const { error } = await supabase
    .from("game_sessions")
    .update({ status: "in_progress" })
    .eq("id", gameId);

  if (error) throw error;
}

export async function makeMove(
  gameId: string,
  playerId: string,
  moveType: string,
  moveData: MoveData
) {
  const { data, error } = await supabase
    .from("game_moves")
    .insert([
      {
        game_session_id: gameId,
        player_id: playerId,
        move_type: moveType,
        move_data: moveData,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function endGame(gameId: string, winnerId: string) {
  const { error } = await supabase
    .from("game_sessions")
    .update({
      status: "completed",
      winner_id: winnerId,
    })
    .eq("id", gameId);

  if (error) throw error;
}

export async function getGameSession(gameId: string) {
  const { data, error } = await supabase
    .from("game_sessions")
    .select(
      `
      *,
      players:game_players(*)
    `
    )
    .eq("id", gameId)
    .single();

  if (error) throw error;
  return data;
}

export async function getPlayerStats(userId: string) {
  const { data, error } = await supabase
    .from("player_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 is "not found"
  return data;
}

export function subscribeToGame(
  gameId: string,
  callback: (payload: { new: GameMove; old: GameMove | null }) => void
) {
  return supabase
    .channel(`game:${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_moves",
        filter: `game_session_id=eq.${gameId}`,
      },
      callback
    )
    .subscribe();
}
