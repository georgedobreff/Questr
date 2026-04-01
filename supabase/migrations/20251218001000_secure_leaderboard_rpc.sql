-- Secure Leaderboard Function
-- This function allows retrieving public leaderboard data without exposing sensitive profile columns.
-- It runs with SECURITY DEFINER to bypass the row-level RLS, but explicitly controls the returned data.

CREATE OR REPLACE FUNCTION public.get_leaderboard(
    sort_by text DEFAULT 'xp', 
    limit_count integer DEFAULT 50
)
RETURNS TABLE (
    id uuid,
    full_name text,
    xp integer,
    level integer,
    current_streak integer,
    character_model_path text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Secure search path
AS $$
BEGIN
    -- Input validation to prevent SQL injection via dynamic sort
    IF sort_by NOT IN ('xp', 'current_streak') THEN
        sort_by := 'xp';
    END IF;

    -- Clamp limit
    IF limit_count > 100 THEN
        limit_count := 100;
    END IF;

    RETURN QUERY EXECUTE format(
        'SELECT 
            id, 
            full_name, 
            xp, 
            level, 
            current_streak, 
            character_model_path 
         FROM profiles 
         ORDER BY %I DESC 
         LIMIT %L',
        sort_by, 
        limit_count
    );
END;
$$;
