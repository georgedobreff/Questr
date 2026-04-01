-- ============================================
-- FIX JOIN_GUILD TO SET SYNC STATUS CORRECTLY
-- Date: 2026-02-03
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
    days_elapsed integer;
    current_day_in_module integer;
    days_remaining integer;
    should_be_synced boolean;
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

    -- Calculate guild's current week and days remaining
    SELECT 
        CASE 
            WHEN g.quest_start_date IS NULL THEN 0
            ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (24 * 60 * 60))::integer
        END,
        CASE 
            WHEN g.quest_start_date IS NULL THEN 1
            ELSE GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (7 * 24 * 60 * 60)) + 1)::integer
        END
    INTO days_elapsed, guild_current_week
    FROM public.guilds g
    WHERE g.id = target_guild_id;

    -- Calculate days remaining in current week
    current_day_in_module := (days_elapsed % 7) + 1;
    days_remaining := 7 - current_day_in_module;

    -- User is synced if:
    -- 1. Guild is on week 1 (no catching up needed), OR
    -- 2. Guild has no active quest yet (quest_start_date is null)
    -- Otherwise they start catching up from week 1
    IF guild_current_week = 1 AND days_remaining >= 3 THEN
        should_be_synced := true;
    ELSE
        should_be_synced := false;
    END IF;

    -- Create member progress record
    INSERT INTO public.guild_member_progress (guild_id, user_id, current_week, is_synced, synced_at)
    VALUES (
        target_guild_id, 
        auth.uid(), 
        CASE WHEN should_be_synced THEN guild_current_week ELSE 1 END,
        should_be_synced,
        CASE WHEN should_be_synced THEN NOW() ELSE NULL END
    )
    ON CONFLICT (guild_id, user_id) DO UPDATE 
    SET current_week = CASE WHEN should_be_synced THEN guild_current_week ELSE 1 END,
        is_synced = should_be_synced,
        synced_at = CASE WHEN should_be_synced THEN NOW() ELSE NULL END;
END;
$$;
