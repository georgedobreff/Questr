-- 1. Modify the security trigger to allow trusted functions to bypass it
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow bypass if our custom session variable is set
  IF current_setting('app.bypass_coin_check', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF (auth.role() = 'authenticated') THEN
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

  RETURN NEW;
END;
$$;

-- 2. Update purchase_pet_item to use the bypass
CREATE OR REPLACE FUNCTION public.purchase_pet_item(p_pet_item_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_cost int;
    v_user_coins int;
BEGIN
    -- Get cost
    SELECT cost INTO v_cost FROM public.pet_items WHERE id = p_pet_item_id;
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    -- Check coins
    SELECT coins INTO v_user_coins FROM public.profiles WHERE id = v_user_id;
    IF v_user_coins < v_cost THEN
        RAISE EXCEPTION 'Not enough coins.';
    END IF;

    -- Set the bypass flag for the current transaction
    PERFORM set_config('app.bypass_coin_check', 'on', true);

    -- Deduct coins
    UPDATE public.profiles SET coins = coins - v_cost WHERE id = v_user_id;

    -- Add to inventory (upsert for quantity)
    INSERT INTO public.user_pet_inventory (user_id, pet_item_id, quantity)
    VALUES (v_user_id, p_pet_item_id, 1)
    ON CONFLICT (user_id, pet_item_id) 
    DO UPDATE SET quantity = user_pet_inventory.quantity + 1;
END;
$$;
