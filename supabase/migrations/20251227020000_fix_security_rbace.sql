-- 1. Upgrade security trigger to use Role-Based Access Control (RBAC)
-- We switch from checking 'auth.role()' (which checks the web user) 
-- to 'CURRENT_USER' (which checks the effective database privilege).
-- This allows SECURITY DEFINER functions (System) to update profiles while blocking direct API access.

CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
-- IMPORANT: Removed SECURITY DEFINER. Now defaults to SECURITY INVOKER.
-- This ensures CURRENT_USER reflects the caller (User vs System Function).
AS $$
BEGIN
  -- Check if the current effective user is a restricted web role.
  -- 'authenticated' = Logged in user via API
  -- 'anon' = Public user via API
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
    
    -- Prevent changes to 'coins'
    IF NEW.coins IS DISTINCT FROM OLD.coins THEN
      RAISE EXCEPTION 'Not authorized to update coins directly.';
    END IF;

    -- Prevent changes to 'xp'
    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'Not authorized to update XP directly.';
    END IF;

    -- Prevent changes to 'level'
    IF NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Not authorized to update level directly.';
    END IF;
    
  END IF;
  
  -- If CURRENT_USER is 'postgres', 'service_role', etc., allow the update.
  RETURN NEW;
END;
$$;

-- 2. Create the Task Reward Handler (System Function)
-- This function is owned by postgres/admin.
-- Because it is SECURITY DEFINER, it executes with Owner privileges.
-- When it runs 'UPDATE profiles', the trigger sees CURRENT_USER = 'postgres' and allows it.

CREATE OR REPLACE FUNCTION public.handle_task_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_reward_coins integer;
    v_reward_xp integer := 10; -- Fixed XP per task for now
    v_reward_ap integer := 5;  -- Fixed AP per task
BEGIN
    -- Only process if task is marked completed and hasn't been rewarded yet
    IF NEW.is_completed = true AND OLD.is_completed = false AND OLD.is_rewarded = false THEN
        
        -- Get the user_id via the plan
        SELECT p.user_id INTO v_user_id
        FROM public.plans p
        JOIN public.quests q ON q.plan_id = p.id
        WHERE q.id = NEW.quest_id;

        -- Get coin amount from task itself
        v_reward_coins := NEW.reward_coins;

        -- Update Profile
        UPDATE public.profiles
        SET 
            coins = coins + v_reward_coins,
            xp = xp + v_reward_xp,
            action_points = action_points + v_reward_ap
        WHERE id = v_user_id;

        -- Mark task as rewarded
        NEW.is_rewarded := true;
        
        -- Mark completed_at
        NEW.completed_at := now();
        
        -- Check achievements
        PERFORM public.check_achievements(v_user_id);
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Attach Trigger
DROP TRIGGER IF EXISTS trigger_handle_task_rewards ON public.tasks;
CREATE TRIGGER trigger_handle_task_rewards
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_rewards();
