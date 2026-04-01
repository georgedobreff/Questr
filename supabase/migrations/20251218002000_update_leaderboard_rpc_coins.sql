-- Drop the existing function first because we are changing the return type
DROP FUNCTION IF EXISTS public.get_leaderboard(text, integer);

-- Update Secure Leaderboard Function to include Coins
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
    coins integer,
    character_model_path text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Input validation
    IF sort_by NOT IN ('xp', 'current_streak', 'coins') THEN
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
            coins,
            character_model_path 
         FROM profiles 
         ORDER BY %I DESC 
         LIMIT %L',
        sort_by, 
        limit_count
    );
END;
$$;
