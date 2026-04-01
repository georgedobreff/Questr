-- Fix award_plan_completion_reward to set is_reward_claimed flag and award correct amount of coins.
CREATE OR REPLACE FUNCTION public.award_plan_completion_reward(p_user_id uuid, p_plan_id int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward_coins_amount int := 2000;
  trophy_item_id int;
  plan_owner_id uuid;
  plan_goal text;
  plan_claimed boolean;
BEGIN
  -- Verify ownership and claim status
  SELECT user_id, goal_text, is_reward_claimed INTO plan_owner_id, plan_goal, plan_claimed 
  FROM public.plans 
  WHERE id = p_plan_id;
  
  IF plan_owner_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  IF plan_owner_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF plan_claimed THEN
    RETURN;
  END IF;

  -- Add coins
  UPDATE public.profiles
  SET coins = coins + reward_coins_amount
  WHERE id = p_user_id;

  -- Mark plan as claimed
  UPDATE public.plans
  SET is_reward_claimed = true
  WHERE id = p_plan_id;

  -- Award Trophy
  INSERT INTO public.shop_items (name, description, cost, type, slot, source, asset_url)
  VALUES ('Pathfinder''s Trophy', 'A trophy awarded for completion.', 0, 'equippable', 'trophy', 'reward', 'trophy.png')
  ON CONFLICT (name) DO UPDATE SET 
    description = EXCLUDED.description,
    source = 'reward',
    asset_url = EXCLUDED.asset_url
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
