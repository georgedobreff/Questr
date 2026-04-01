-- ============================================
-- FIX DAYS_REMAINING CALCULATION
-- Date: 2026-02-03
-- The previous calculation was incorrect
-- ============================================

-- UPDATE get_member_progress with correct days_remaining calculation
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
    days_elapsed integer;
    current_day_in_module integer;
BEGIN
    SELECT 
        CASE 
            WHEN g.quest_start_date IS NULL THEN 0
            ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (24 * 60 * 60))::integer
        END,
        CASE 
            WHEN g.quest_start_date IS NULL THEN 1
            ELSE GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (7 * 24 * 60 * 60)) + 1)::integer
        END
    INTO days_elapsed, guild_week
    FROM public.guilds g
    WHERE g.id = target_guild_id;

    -- Calculate current day in module (1-7) and days remaining
    current_day_in_module := (days_elapsed % 7) + 1;
    days_remaining := 7 - current_day_in_module;

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

-- UPDATE advance_member_week with correct days_remaining calculation
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
    days_elapsed integer;
    current_day_in_module integer;
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

    -- Get guild snapshot and calculate guild's current week and days remaining
    SELECT 
        g.active_plan_snapshot,
        CASE 
            WHEN g.quest_start_date IS NULL THEN 0
            ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (24 * 60 * 60))::integer
        END,
        CASE 
            WHEN g.quest_start_date IS NULL THEN 1
            ELSE GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - g.quest_start_date)) / (7 * 24 * 60 * 60)) + 1)::integer
        END
    INTO snapshot, days_elapsed, guild_current_week
    FROM public.guilds g
    WHERE g.id = target_guild_id;

    -- Calculate current day in module (1-7) and days remaining
    current_day_in_module := (days_elapsed % 7) + 1;
    days_remaining := 7 - current_day_in_module;

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
