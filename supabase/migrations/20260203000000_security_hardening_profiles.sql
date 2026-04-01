-- ============================================
-- SECURITY HARDENING: Profile Visibility
-- Date: 2026-02-03
-- Priority: 1 (MAXIMUM SECURITY)
-- ============================================

-- 1. Drop overly permissive profile policy that exposes ALL profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone." ON public.profiles;

-- 2. STRICT: Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- 3. STRICT: Guild members can view each other (for guild leaderboards/feed)
CREATE POLICY "Guild members can view each other"
ON public.profiles FOR SELECT
USING (
    guild_id IS NOT NULL 
    AND guild_id = (SELECT guild_id FROM public.profiles WHERE id = auth.uid())
);

-- ============================================
-- SECURITY HARDENING: Guild Weekly Rewards
-- ============================================

-- Explicit deny INSERT for authenticated users (service_role bypasses RLS)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guild_weekly_rewards' 
        AND policyname = 'Deny direct insert to weekly rewards'
    ) THEN
        CREATE POLICY "Deny direct insert to weekly rewards"
        ON public.guild_weekly_rewards FOR INSERT
        WITH CHECK (false);
    END IF;
END $$;

-- Explicit deny UPDATE for authenticated users
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guild_weekly_rewards' 
        AND policyname = 'Deny direct update to weekly rewards'
    ) THEN
        CREATE POLICY "Deny direct update to weekly rewards"
        ON public.guild_weekly_rewards FOR UPDATE
        USING (false);
    END IF;
END $$;

-- Explicit deny DELETE for authenticated users
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guild_weekly_rewards' 
        AND policyname = 'Deny direct delete from weekly rewards'
    ) THEN
        CREATE POLICY "Deny direct delete from weekly rewards"
        ON public.guild_weekly_rewards FOR DELETE
        USING (false);
    END IF;
END $$;

-- ============================================
-- SECURITY HARDENING: Guild Task Completions
-- ============================================

-- Prevent deletion of task completions (anti-cheat measure)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guild_task_completions' 
        AND policyname = 'Deny direct delete of task completions'
    ) THEN
        CREATE POLICY "Deny direct delete of task completions"
        ON public.guild_task_completions FOR DELETE
        USING (false);
    END IF;
END $$;

-- ============================================
-- SECURE RPCs: Guild Member Access
-- ============================================

-- Secure Guild Members RPC
-- Replaces direct profile queries in guild-actions.ts
CREATE OR REPLACE FUNCTION get_guild_members(target_guild_id uuid)
RETURNS TABLE (
    id uuid,
    full_name text,
    character_model_path text,
    level integer,
    xp integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is in the guild (principle of least privilege)
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.guild_id = target_guild_id
    ) THEN
        RAISE EXCEPTION 'Access denied: not a guild member';
    END IF;

    RETURN QUERY
    SELECT p.id, p.full_name, p.character_model_path, p.level, p.xp
    FROM profiles p
    WHERE p.guild_id = target_guild_id
    ORDER BY p.xp DESC
    LIMIT 200;
END;
$$;

-- Secure Guild Details RPC (with master name)
-- For viewing public guilds or guilds user is a member of
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
    created_at timestamptz
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
        g.created_at
    FROM guilds g
    LEFT JOIN profiles p ON g.master_id = p.id
    WHERE g.id = target_guild_id
    AND (g.is_public = true OR EXISTS (
        SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.guild_id = target_guild_id
    ));
END;
$$;
