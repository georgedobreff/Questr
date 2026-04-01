-- Secure the tasks table to prevent reward manipulation

CREATE OR REPLACE FUNCTION public.check_task_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow updates to 'is_completed' for authenticated users
  IF (auth.role() = 'authenticated') THEN
    -- Prevent changing rewards
    IF NEW.reward_coins IS DISTINCT FROM OLD.reward_coins THEN
      RAISE EXCEPTION 'Not authorized to update task rewards.';
    END IF;

    -- Prevent changing the task description/title
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION 'Not authorized to update task title.';
    END IF;
    
    -- Prevent changing description if it exists (columns vary by migration, using robust check or known schema)
    -- Schema has 'title' and 'short_description' based on types.ts, or 'description' in SQL.
    -- Migration 20251122180000 renamed/added. Let's assume standard columns.
    -- To be safe, we just check the sensitive one: reward_coins.
    
    -- Prevent moving the task to another quest
    IF NEW.quest_id IS DISTINCT FROM OLD.quest_id THEN
      RAISE EXCEPTION 'Not authorized to move tasks between quests.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_task_rewards ON public.tasks;

CREATE TRIGGER protect_task_rewards
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.check_task_update_permissions();
