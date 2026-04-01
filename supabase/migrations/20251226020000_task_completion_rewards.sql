-- Add is_rewarded column to tasks to prevent farming
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_rewarded boolean DEFAULT false;

-- Function to handle task rewards (Coins, XP, AP)
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
        
        -- Mark completed_at (redundant if set_task_completed_at exists, but safe)
        NEW.completed_at := now();
        
        -- Check achievements (existing function)
        PERFORM public.check_achievements(v_user_id);
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trigger_handle_task_rewards ON public.tasks;
CREATE TRIGGER trigger_handle_task_rewards
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_rewards();
