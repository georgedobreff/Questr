-- Update the plan completion reward to 2000 coins

CREATE OR REPLACE FUNCTION public.award_plan_completion_reward(p_user_id uuid, p_plan_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward_coins_amount int := 2000; -- Updated to 2000
  trophy_item_id int;
  plan_owner_id uuid;
  plan_claimed boolean;
BEGIN
  -- Verify ownership and claim status
  SELECT user_id, is_reward_claimed INTO plan_owner_id, plan_claimed
  FROM public.plans
  WHERE id = p_plan_id;

  IF plan_owner_id != p_user_id THEN
    RAISE EXCEPTION 'User does not own this plan.';
  END IF;

  IF plan_claimed THEN
    RETURN;
  END IF;

  -- Add coins to the user's profile
  UPDATE public.profiles
  SET coins = coins + reward_coins_amount
  WHERE id = p_user_id;

  -- Mark plan as claimed
  UPDATE public.plans
  SET is_reward_claimed = true
  WHERE id = p_plan_id;

  -- Upsert the "Trophy" item
  INSERT INTO public.shop_items (name, description, cost, type, slot, source, asset_url)
  VALUES ('Pathfinder''s Trophy', 'A trophy awarded for seeing a Main Path through to the very end.', 0, 'equippable', 'trophy', 'reward', 'trophy.png')
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    source = EXCLUDED.source,
    asset_url = EXCLUDED.asset_url
  RETURNING id INTO trophy_item_id;

  -- Grant the trophy to the user
  INSERT INTO public.user_items (user_id, item_id)
  VALUES (p_user_id, trophy_item_id)
  ON CONFLICT DO NOTHING;

END;
$$;

NOTIFY pgrst, 'reload config';
