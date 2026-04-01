-- ============================================
-- GUILD LATE JOINER TRACKING
-- Date: 2026-02-03
-- ============================================

-- 1. Add guild_joined_at to profiles for tracking when member joined
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS guild_joined_at TIMESTAMPTZ;

-- 2. Backfill existing guild members with NOW()
UPDATE public.profiles 
SET guild_joined_at = NOW() 
WHERE guild_id IS NOT NULL AND guild_joined_at IS NULL;

-- 3. Create member progress tracking table
CREATE TABLE IF NOT EXISTS public.guild_member_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    current_week INTEGER DEFAULT 1 NOT NULL,
    is_synced BOOLEAN DEFAULT false NOT NULL,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(guild_id, user_id)
);

-- 4. RLS for guild_member_progress
ALTER TABLE public.guild_member_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own progress"
ON public.guild_member_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Guild members can view each others progress"
ON public.guild_member_progress FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.guild_id = guild_member_progress.guild_id
    )
);

-- Deny direct INSERT/UPDATE/DELETE (handled by RPCs)
CREATE POLICY "Deny direct insert to member progress"
ON public.guild_member_progress FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny direct update to member progress"
ON public.guild_member_progress FOR UPDATE
USING (false);

CREATE POLICY "Deny direct delete from member progress"
ON public.guild_member_progress FOR DELETE
USING (false);

-- ============================================
-- UPDATE join_guild RPC
-- ============================================

CREATE OR REPLACE FUNCTION join_guild(target_guild_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_guild_id uuid;
    guild_current_week integer;
    days_since_start integer;
BEGIN
    SELECT guild_id INTO current_guild_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF current_guild_id IS NOT NULL THEN
        IF current_guild_id = target_guild_id THEN
            RAISE EXCEPTION 'You are already a member of this guild.';
        ELSE
            RAISE EXCEPTION 'You must leave your current guild before joining another.';
        END IF;
    END IF;

    -- Update Profile with join timestamp
    UPDATE public.profiles
    SET guild_id = target_guild_id,
        guild_joined_at = NOW()
    WHERE id = auth.uid();

    -- Increment Member Count
    UPDATE public.guilds
    SET member_count = member_count + 1
    WHERE id = target_guild_id;

    -- Calculate guild's current week (for late joiner tracking)
    SELECT 
        CASE 
            WHEN g.quest_start_date IS NULL THEN 1
            ELSE GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (7 * 24 * 60 * 60)) + 1)::integer
        END
    INTO guild_current_week
    FROM public.guilds g
    WHERE g.id = target_guild_id;

    -- Create member progress record
    INSERT INTO public.guild_member_progress (guild_id, user_id, current_week, is_synced)
    VALUES (target_guild_id, auth.uid(), 1, false)
    ON CONFLICT (guild_id, user_id) DO NOTHING;
END;
$$;

-- ============================================
-- UPDATE create_guild RPC
-- ============================================

CREATE OR REPLACE FUNCTION create_guild(
    name text,
    description text,
    is_public boolean,
    category text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_guild_id uuid;
    user_subscription_status text;
BEGIN
    name := TRIM(name);
    description := TRIM(description);

    SELECT status INTO user_subscription_status
    FROM public.subscriptions
    WHERE user_id = auth.uid();

    IF user_subscription_status NOT IN ('active', 'trialing', 'pro') THEN
        RAISE EXCEPTION 'Only Pro users can create guilds.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.guilds WHERE lower(guilds.name) = lower(create_guild.name)) THEN
        RAISE EXCEPTION 'Guild name already exists.';
    END IF;

    INSERT INTO public.guilds (name, description, master_id, is_public, category, member_count)
    VALUES (name, description, auth.uid(), is_public, category, 1)
    RETURNING id INTO new_guild_id;

    -- Auto-join the creator with timestamp
    UPDATE public.profiles
    SET guild_id = new_guild_id,
        guild_joined_at = NOW()
    WHERE id = auth.uid();

    -- Master starts synced (they define the quest timeline)
    INSERT INTO public.guild_member_progress (guild_id, user_id, current_week, is_synced, synced_at)
    VALUES (new_guild_id, auth.uid(), 1, true, NOW());

    RETURN new_guild_id;
END;
$$;

-- ============================================
-- ADVANCE MEMBER WEEK RPC
-- ============================================

CREATE OR REPLACE FUNCTION advance_member_week(target_guild_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    member_current_week integer;
    guild_current_week integer;
    days_remaining integer;
    member_tasks_complete boolean;
    snapshot jsonb;
    week_task_ids integer[];
    completed_count integer;
    total_tasks integer;
BEGIN
    -- Get member's current week
    SELECT current_week INTO member_current_week
    FROM public.guild_member_progress
    WHERE guild_id = target_guild_id AND user_id = auth.uid();

    IF member_current_week IS NULL THEN
        RAISE EXCEPTION 'No progress record found';
    END IF;

    -- Get guild snapshot and calculate guild's current week
    SELECT 
        g.active_plan_snapshot,
        CASE 
            WHEN g.quest_start_date IS NULL THEN 1
            ELSE GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (7 * 24 * 60 * 60)) + 1)::integer
        END,
        CASE 
            WHEN g.quest_start_date IS NULL THEN 7
            ELSE 7 - (EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (24 * 60 * 60))::integer % 7
        END
    INTO snapshot, guild_current_week, days_remaining
    FROM public.guilds g
    WHERE g.id = target_guild_id;

    IF snapshot IS NULL THEN
        RAISE EXCEPTION 'No active quest';
    END IF;

    -- Get all task IDs for member's current week
    SELECT ARRAY_AGG((task->>'id')::integer)
    INTO week_task_ids
    FROM jsonb_array_elements(snapshot->'quests') quest,
         jsonb_array_elements(quest->'tasks') task
    WHERE (quest->>'module_number')::integer = member_current_week;

    total_tasks := COALESCE(array_length(week_task_ids, 1), 0);

    -- Count completed tasks for this week
    SELECT COUNT(*)::integer INTO completed_count
    FROM public.guild_task_completions
    WHERE guild_id = target_guild_id 
      AND user_id = auth.uid()
      AND task_id = ANY(week_task_ids);

    IF completed_count < total_tasks THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Complete all tasks before advancing',
            'completed', completed_count,
            'total', total_tasks
        );
    END IF;

    -- Advance to next week
    member_current_week := member_current_week + 1;

    -- Check if now synced with guild
    IF member_current_week >= guild_current_week THEN
        IF days_remaining >= 3 THEN
            UPDATE public.guild_member_progress
            SET current_week = guild_current_week,
                is_synced = true,
                synced_at = NOW()
            WHERE guild_id = target_guild_id AND user_id = auth.uid();
            
            RETURN jsonb_build_object(
                'success', true,
                'synced', true,
                'current_week', guild_current_week,
                'message', 'You have caught up and are now synced with the guild!'
            );
        ELSE
            UPDATE public.guild_member_progress
            SET current_week = guild_current_week,
                is_synced = false
            WHERE guild_id = target_guild_id AND user_id = auth.uid();
            
            RETURN jsonb_build_object(
                'success', true,
                'synced', false,
                'current_week', guild_current_week,
                'message', 'You caught up but with less than 3 days remaining. Your completions will not count toward guild XP this week.'
            );
        END IF;
    ELSE
        UPDATE public.guild_member_progress
        SET current_week = member_current_week
        WHERE guild_id = target_guild_id AND user_id = auth.uid();
        
        RETURN jsonb_build_object(
            'success', true,
            'synced', false,
            'current_week', member_current_week,
            'weeks_behind', guild_current_week - member_current_week
        );
    END IF;
END;
$$;

-- ============================================
-- CHECK GUILD WEEKLY COMPLETION RPC
-- ============================================

CREATE OR REPLACE FUNCTION check_guild_weekly_completion(target_guild_id uuid, module_number integer)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    synced_member_count integer;
    snapshot jsonb;
    week_task_ids integer[];
    total_required integer;
    total_completed integer;
    xp_reward integer := 100;
BEGIN
    -- Get snapshot
    SELECT g.active_plan_snapshot INTO snapshot
    FROM public.guilds g
    WHERE g.id = target_guild_id;

    IF snapshot IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active quest');
    END IF;

    -- Check if already rewarded
    IF EXISTS (
        SELECT 1 FROM public.guild_weekly_rewards
        WHERE guild_id = target_guild_id AND guild_weekly_rewards.module_number = check_guild_weekly_completion.module_number
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already rewarded');
    END IF;

    -- Get count of SYNCED members
    SELECT COUNT(*)::integer INTO synced_member_count
    FROM public.guild_member_progress
    WHERE guild_id = target_guild_id AND is_synced = true;

    IF synced_member_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No synced members');
    END IF;

    -- Get all task IDs for this module
    SELECT ARRAY_AGG((task->>'id')::integer)
    INTO week_task_ids
    FROM jsonb_array_elements(snapshot->'quests') quest,
         jsonb_array_elements(quest->'tasks') task
    WHERE (quest->>'module_number')::integer = module_number;

    total_required := COALESCE(array_length(week_task_ids, 1), 0) * synced_member_count;

    -- Count completions from SYNCED members only
    SELECT COUNT(*)::integer INTO total_completed
    FROM public.guild_task_completions gtc
    JOIN public.guild_member_progress gmp ON gtc.user_id = gmp.user_id AND gtc.guild_id = gmp.guild_id
    WHERE gtc.guild_id = target_guild_id
      AND gtc.task_id = ANY(week_task_ids)
      AND gmp.is_synced = true;

    IF total_completed >= total_required THEN
        -- Award XP
        UPDATE public.guilds
        SET xp = xp + xp_reward
        WHERE id = target_guild_id;

        -- Record reward
        INSERT INTO public.guild_weekly_rewards (guild_id, module_number)
        VALUES (target_guild_id, module_number);

        RETURN jsonb_build_object(
            'success', true,
            'xp_awarded', xp_reward,
            'synced_members', synced_member_count,
            'tasks_completed', total_completed,
            'tasks_required', total_required
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'progress', (total_completed::float / total_required * 100)::integer,
            'synced_members', synced_member_count,
            'tasks_completed', total_completed,
            'tasks_required', total_required
        );
    END IF;
END;
$$;

-- ============================================
-- GET MEMBER PROGRESS RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_member_progress(target_guild_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
    guild_week integer;
    days_remaining integer;
BEGIN
    SELECT 
        CASE 
            WHEN g.quest_start_date IS NULL THEN 1
            ELSE GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (7 * 24 * 60 * 60)) + 1)::integer
        END,
        CASE 
            WHEN g.quest_start_date IS NULL THEN 7
            ELSE 7 - (EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (24 * 60 * 60))::integer % 7
        END
    INTO guild_week, days_remaining
    FROM public.guilds g
    WHERE g.id = target_guild_id;

    SELECT jsonb_build_object(
        'current_week', gmp.current_week,
        'is_synced', gmp.is_synced,
        'synced_at', gmp.synced_at,
        'guild_week', guild_week,
        'days_remaining', days_remaining,
        'is_catching_up', gmp.current_week < guild_week
    ) INTO result
    FROM public.guild_member_progress gmp
    WHERE gmp.guild_id = target_guild_id AND gmp.user_id = auth.uid();

    RETURN COALESCE(result, jsonb_build_object('error', 'No progress found'));
END;
$$;
