-- Implement robust Task Rewards and Level Up logic in the Database
-- This replaces the insecure/redundant 'award-rewards' Edge Function.

-- 1. Helper Function: Calculate XP required for next level
-- Formula: 100 * (Level ^ 1.5)
CREATE OR REPLACE FUNCTION public.get_xp_threshold(p_level int)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT FLOOR(100 * POWER(p_level::numeric, 1.5))::int;
$$;

-- 2. Helper Function: Handle Leveling Up
-- Checks if user has enough XP to level up, and loops until they don't.
CREATE OR REPLACE FUNCTION public.process_level_up(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_level int;
    v_xp int;
    v_threshold int;
    v_leveled_up boolean := false;
BEGIN
    SELECT level, xp INTO v_level, v_xp FROM public.profiles WHERE id = p_user_id;
    
    -- Loop to handle multiple level-ups at once (rare but possible with big rewards)
    LOOP
        v_threshold := public.get_xp_threshold(v_level);
        
        IF v_xp >= v_threshold THEN
            v_xp := v_xp - v_threshold;
            v_level := v_level + 1;
            v_leveled_up := true;
        ELSE
            EXIT; -- Break loop when XP is not enough for next level
        END IF;
    END LOOP;
    
    -- Only update if changed
    IF v_leveled_up THEN
        UPDATE public.profiles 
        SET level = v_level, xp = v_xp 
        WHERE id = p_user_id;
    END IF;
END;
$$;

-- 3. Main Trigger Function: Handle Task Rewards
CREATE OR REPLACE FUNCTION public.handle_task_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_reward_coins integer;
    v_module_number integer;
    v_base_xp integer;
    v_multiplier numeric;
    v_final_xp integer;
    v_reward_ap integer := 5; -- Fixed AP
BEGIN
    -- Only process strictly on completion
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        
        -- Get Context (User ID and Module Number)
        SELECT p.user_id, q.module_number 
        INTO v_user_id, v_module_number
        FROM public.plans p
        JOIN public.quests q ON q.plan_id = p.id
        WHERE q.id = NEW.quest_id;

        -- Calculate Rewards
        v_reward_coins := NEW.reward_coins;
        
        -- Smart XP Formula: Base (Coins * 10) * Multiplier (1 + Module * 0.1)
        v_base_xp := v_reward_coins * 10;
        v_multiplier := 1.0 + (COALESCE(v_module_number, 1) * 0.1);
        v_final_xp := FLOOR(v_base_xp * v_multiplier)::int;

        -- Update Profile (Coins + XP + AP)
        -- Trigger allows this because function is SECURITY DEFINER (postgres role)
        UPDATE public.profiles
        SET 
            coins = coins + v_reward_coins,
            xp = xp + v_final_xp,
            action_points = action_points + v_reward_ap
        WHERE id = v_user_id;

        -- Process Level Up (if XP overflowed)
        PERFORM public.process_level_up(v_user_id);
        
        -- Heal Pet (if alive)
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'heal_pet_on_task') THEN
             PERFORM public.heal_pet_on_task(v_user_id);
        END IF;

        -- Mark Metadata
        NEW.is_rewarded := true;
        NEW.completed_at := now();
        
        -- Check Achievements (Keep existing hook)
        PERFORM public.check_achievements(v_user_id);
    END IF;

    RETURN NEW;
END;
$$;