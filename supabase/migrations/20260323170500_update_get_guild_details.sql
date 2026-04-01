-- ============================================
-- FIX: Update get_guild_details RPC to include restrict_to_pro
-- Date: 2026-03-23
-- ============================================

-- Drop the function first because we are changing the return type (adding a column)
DROP FUNCTION IF EXISTS get_guild_details(uuid);

-- Recreate the function with the new return table structure
CREATE OR REPLACE FUNCTION get_guild_details(target_guild_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    is_public boolean,
    member_count integer,
    category text,
    level integer,
    xp integer,
    master_name text,
    master_id uuid,
    pinned_post_id uuid,
    rules text[],
    quest_start_date timestamptz,
    created_at timestamptz,
    restrict_to_pro boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.name,
        g.description,
        g.is_public,
        g.member_count,
        g.category,
        g.level,
        g.xp,
        COALESCE(p.full_name, 'Questr')::text as master_name,
        g.master_id,
        g.pinned_post_id,
        g.rules,
        g.quest_start_date,
        g.created_at,
        g.restrict_to_pro
    FROM guilds g
    LEFT JOIN profiles p ON g.master_id = p.id
    WHERE g.id = target_guild_id
    AND (g.is_public = true OR EXISTS (
        SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.guild_id = target_guild_id
    ));
END;
$$;
