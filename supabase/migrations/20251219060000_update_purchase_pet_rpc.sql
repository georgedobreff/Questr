-- Update purchase_pet_item to accept user_id explicitly
-- This allows it to be called by the Admin/Service Role securely
DROP FUNCTION IF EXISTS public.purchase_pet_item(bigint);

CREATE OR REPLACE FUNCTION public.purchase_pet_item(p_user_id uuid, p_pet_item_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cost int;
    v_user_coins int;
BEGIN
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
    UPDATE public.profiles SET coins = coins - v_cost WHERE id = p_user_id;

    -- Add to inventory (upsert for quantity)
    INSERT INTO public.user_pet_inventory (user_id, pet_item_id, quantity)
    VALUES (p_user_id, p_pet_item_id, 1)
    ON CONFLICT (user_id, pet_item_id) 
    DO UPDATE SET quantity = user_pet_inventory.quantity + 1;
END;
$$;
