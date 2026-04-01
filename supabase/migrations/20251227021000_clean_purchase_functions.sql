-- Clean up purchase functions to remove deprecated "bypass_coin_check" logic.
-- The security is now handled by the Role-Based trigger (check_profile_update_permissions).
-- We also add strict user verification to prevent ID spoofing.

-- 1. Clean purchase_pet_item (Admin/System version with user_id)
CREATE OR REPLACE FUNCTION public.purchase_pet_item(p_user_id uuid, p_pet_item_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cost int;
    v_user_coins int;
BEGIN
    -- Security Check: Ensure the caller is operating on their own data
    -- We allow 'service_role' (server-side calls) to bypass this check if needed,
    -- but for web users ('authenticated'), they must match.
    IF (auth.role() = 'authenticated' AND auth.uid() != p_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: You can only purchase items for yourself.';
    END IF;

    -- Get cost
    SELECT cost INTO v_cost FROM public.pet_items WHERE id = p_pet_item_id;
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    -- Check coins
    SELECT coins INTO v_user_coins FROM public.profiles WHERE id = p_user_id;
    IF v_user_coins < v_cost THEN
        RAISE EXCEPTION 'Not enough coins.';
    END IF;

    -- Deduct coins
    -- Trigger will allow this because function is SECURITY DEFINER (CURRENT_USER = postgres)
    UPDATE public.profiles SET coins = coins - v_cost WHERE id = p_user_id;

    -- Add to inventory (upsert for quantity)
    INSERT INTO public.user_pet_inventory (user_id, pet_item_id, quantity)
    VALUES (p_user_id, p_pet_item_id, 1)
    ON CONFLICT (user_id, pet_item_id) 
    DO UPDATE SET quantity = user_pet_inventory.quantity + 1;
END;
$$;

-- 2. Clean purchase_item (Standard Shop)
CREATE OR REPLACE FUNCTION public.purchase_item(p_user_id uuid, p_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_cost integer;
  user_coins integer;
BEGIN
    -- Security Check: Ensure the caller is operating on their own data
    IF (auth.role() = 'authenticated' AND auth.uid() != p_user_id) THEN
        RETURN 'Unauthorized: You can only purchase items for yourself.';
    END IF;

  -- Get item cost
  SELECT cost INTO item_cost FROM public.shop_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN 'Item not found.';
  END IF;

  -- Get user coins
  SELECT coins INTO user_coins FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN 'User profile not found.';
  END IF;

  -- Check if user has enough coins
  IF user_coins < item_cost THEN
    RETURN 'Insufficient coins.';
  END IF;

  -- Check if user already owns the item
  IF EXISTS (SELECT 1 FROM public.user_items WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN 'Item already owned.';
  END IF;

  -- Perform the transaction
  -- Trigger will allow this because function is SECURITY DEFINER (CURRENT_USER = postgres)
  UPDATE public.profiles
  SET coins = coins - item_cost
  WHERE id = p_user_id;

  INSERT INTO public.user_items (user_id, item_id)
  VALUES (p_user_id, p_item_id);

  RETURN 'Purchase successful.';
END;
$$;

-- 3. Grant permissions
-- Allow authenticated users to call these secure functions
GRANT EXECUTE ON FUNCTION public.purchase_pet_item(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_pet_item(uuid, bigint) TO service_role;

GRANT EXECUTE ON FUNCTION public.purchase_item(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item(uuid, bigint) TO service_role;
