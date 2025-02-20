-- Create a table for game sessions
CREATE TABLE game_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('waiting', 'in_progress', 'completed')),
    winner_id UUID REFERENCES auth.users(id)
);

-- Create a table for players in a game session
CREATE TABLE game_players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    score INTEGER DEFAULT 0,
    UNIQUE(game_session_id, user_id)
);

-- Create a table for game moves/actions
CREATE TABLE game_moves (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES game_players(id),
    move_type VARCHAR(50) NOT NULL,
    move_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a table for player statistics
CREATE TABLE player_stats (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    last_played_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a function to update player statistics
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats for the winner
    IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL THEN
        INSERT INTO player_stats (user_id, games_played, games_won, last_played_at)
        VALUES (NEW.winner_id, 1, 1, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET games_played = player_stats.games_played + 1,
            games_won = player_stats.games_won + 1,
            last_played_at = NOW(),
            updated_at = NOW();
        
        -- Update stats for other players
        UPDATE player_stats
        SET games_played = games_played + 1,
            last_played_at = NOW(),
            updated_at = NOW()
        WHERE user_id IN (
            SELECT user_id FROM game_players
            WHERE game_session_id = NEW.id
            AND user_id != NEW.winner_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating player statistics
CREATE TRIGGER update_player_stats_trigger
    AFTER UPDATE OF status ON game_sessions
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_player_stats();

-- Enable Row Level Security (RLS)
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow users to view all game sessions"
    ON game_sessions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow users to create game sessions"
    ON game_sessions FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow users to update their own game sessions"
    ON game_sessions FOR UPDATE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM game_players
        WHERE game_players.game_session_id = game_sessions.id
        AND game_players.user_id = auth.uid()
    ));

CREATE POLICY "Allow users to view game players"
    ON game_players FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow users to join games"
    ON game_players FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to view game moves"
    ON game_moves FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow users to create moves in their games"
    ON game_moves FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM game_players
        WHERE game_players.id = game_moves.player_id
        AND game_players.user_id = auth.uid()
    ));

CREATE POLICY "Allow users to view all player stats"
    ON player_stats FOR SELECT
    TO authenticated
    USING (true); 