-- 1. Update award_achievement to include notifications
CREATE OR REPLACE FUNCTION public.award_achievement(p_user_id uuid, p_achievement_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_title text;
BEGIN
    -- Check if already has it
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = p_user_id AND achievement_id = p_achievement_id) THEN
        RETURN;
    END IF;

    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (p_user_id, p_achievement_id);
    
    SELECT title INTO v_title FROM public.achievements WHERE id = p_achievement_id;

    -- Add notification
    INSERT INTO public.notifications (user_id, title, message, type, action_link)
    VALUES (p_user_id, 'Achievement Unlocked!', 'You earned: ' || v_title, 'success', '/character');
END;
$$;

-- 2. Update award_plan_completion_reward to include notifications
CREATE OR REPLACE FUNCTION public.award_plan_completion_reward(p_user_id uuid, p_plan_id int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reward_coins_amount int := 500;
  trophy_item_id int;
  plan_owner_id uuid;
  plan_goal text;
BEGIN
  SELECT user_id, goal_text INTO plan_owner_id, plan_goal FROM public.plans where id = p_plan_id;
  
  IF plan_owner_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Add coins
  UPDATE public.profiles
  SET coins = coins + reward_coins_amount
  WHERE id = p_user_id;

  -- Award Trophy
  INSERT INTO public.shop_items (name, description, cost, type, slot, source, asset_url)
  VALUES ('Pathfinder''s Trophy', 'A trophy awarded for completion.', 0, 'equippable', 'trophy', 'reward', 'trophy.png')
  ON CONFLICT (name) DO UPDATE SET source = 'reward'
  RETURNING id INTO trophy_item_id;
  
  IF NOT EXISTS (SELECT 1 FROM public.user_items WHERE user_id = p_user_id AND item_id = trophy_item_id) THEN
    INSERT INTO public.user_items (user_id, item_id)
    VALUES (p_user_id, trophy_item_id);
  END IF;

  -- Add notification
  INSERT INTO public.notifications (user_id, title, message, type, action_link)
  VALUES (p_user_id, 'Journey Complete!', 'Congratulations! You mastered: ' || plan_goal, 'reward', '/path');
END;
$$;

-- 3. Pet Status Triggers
CREATE OR REPLACE FUNCTION public.notify_pet_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Notify on Death
    IF (NEW.status = 'dead' AND (OLD.status IS NULL OR OLD.status = 'alive')) THEN
        INSERT INTO public.notifications (user_id, title, message, type, action_link)
        VALUES (NEW.user_id, 'Companion Fallen', 'Your companion has passed away. Visit the hub to revive them.', 'warning', '/pet');
    END IF;

    -- Notify on low health (Hungry)
    IF (NEW.health < 30 AND (OLD.health IS NULL OR OLD.health >= 30) AND NEW.status = 'alive') THEN
        INSERT INTO public.notifications (user_id, title, message, type, action_link)
        VALUES (NEW.user_id, 'Companion Hungry', 'Your companion is weak and needs food!', 'warning', '/pet');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pet_notifications ON public.user_pets;
CREATE TRIGGER tr_pet_notifications
AFTER UPDATE ON public.user_pets
FOR EACH ROW EXECUTE FUNCTION public.notify_pet_status();
