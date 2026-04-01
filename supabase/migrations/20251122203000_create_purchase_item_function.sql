CREATE OR REPLACE FUNCTION purchase_item(p_user_id uuid, p_item_id bigint)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  item_cost integer;
  user_coins integer;
BEGIN
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
  UPDATE public.profiles
  SET coins = coins - item_cost
  WHERE id = p_user_id;

  INSERT INTO public.user_items (user_id, item_id)
  VALUES (p_user_id, p_item_id);

  RETURN 'Purchase successful.';
END;
$$;
