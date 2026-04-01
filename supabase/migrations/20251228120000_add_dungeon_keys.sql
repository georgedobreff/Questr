-- Add dungeon_keys to profiles (Default 0 for new users)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dungeon_keys INTEGER DEFAULT 0 NOT NULL;

-- Update handle_task_rewards to give 1 AP instead of 5
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
    v_reward_ap integer := 1; -- CHANGED: Reduced to 1
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

-- Function to safely deduct dungeon costs (12 AP + 1 Key)
-- Also validates Subscription Status
CREATE OR REPLACE FUNCTION public.enter_dungeon(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ap int;
    v_keys int;
    v_status text;
BEGIN
    -- Check Subscription Status
    SELECT status INTO v_status
    FROM public.subscriptions
    WHERE user_id = p_user_id;

    IF v_status NOT IN ('active', 'trialing', 'pro') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pro Subscription required'
        );
    END IF;

    -- Check Resources
    SELECT action_points, dungeon_keys INTO v_ap, v_keys
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_ap >= 12 AND v_keys >= 1 THEN
        UPDATE public.profiles
        SET action_points = action_points - 12,
            dungeon_keys = dungeon_keys - 1
        WHERE id = p_user_id;
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object(
            'success', false, 
            'error', CASE 
                WHEN v_ap < 12 THEN 'Not enough Action Points (12 required)'
                WHEN v_keys < 1 THEN 'No Dungeon Keys remaining'
                ELSE 'Insufficient resources'
            END
        );
    END IF;
END;
$$;

-- Function to add dungeon keys (for purchase or monthly grant)
CREATE OR REPLACE FUNCTION public.add_dungeon_keys(p_user_id uuid, p_amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET dungeon_keys = dungeon_keys + p_amount
    WHERE id = p_user_id;
END;
$$;
