-- Secure Selling Functions using SECURITY DEFINER to bypass direct write restrictions
-- Tuesday, 30 December 2025

-- 1. Function to sell Gear (Character Items)
CREATE OR REPLACE FUNCTION public.sell_item(p_item_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_cost int;
    v_sell_price int;
    v_item_instance_id bigint;
BEGIN
    -- 1. Verify caller identity
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- 2. Verify ownership and get an instance ID
    SELECT id INTO v_item_instance_id 
    FROM public.user_items 
    WHERE user_id = v_user_id AND item_id = p_item_id 
    LIMIT 1;

    IF v_item_instance_id IS NULL THEN
        RAISE EXCEPTION 'You do not own this item.';
    END IF;

    -- 3. Get original cost
    SELECT cost INTO v_cost FROM public.shop_items WHERE id = p_item_id;
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Item price data not found.';
    END IF;
    
    v_sell_price := floor(v_cost / 2);

    -- 4. Delete the item instance
    DELETE FROM public.user_items WHERE id = v_item_instance_id;

    -- 5. Update coins (Bypassing RLS via SECURITY DEFINER)
    UPDATE public.profiles 
    SET coins = coins + v_sell_price 
    WHERE id = v_user_id;

    RETURN v_sell_price;
END;
$$;

-- 2. Function to sell Supplies (Pet Items)
CREATE OR REPLACE FUNCTION public.sell_pet_item(p_pet_item_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_cost int;
    v_sell_price int;
    v_current_quantity int;
BEGIN
    -- 1. Verify caller identity
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- 2. Verify ownership and quantity
    SELECT quantity INTO v_current_quantity 
    FROM public.user_pet_inventory 
    WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    
    IF v_current_quantity IS NULL OR v_current_quantity < 1 THEN
        RAISE EXCEPTION 'You do not own this item.';
    END IF;

    -- 3. Get original cost
    SELECT cost INTO v_cost FROM public.pet_items WHERE id = p_pet_item_id;
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Item price data not found.';
    END IF;

    v_sell_price := floor(v_cost / 2);

    -- 4. Decrement or Delete
    IF v_current_quantity > 1 THEN
        UPDATE public.user_pet_inventory 
        SET quantity = quantity - 1 
        WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    ELSE
        DELETE FROM public.user_pet_inventory 
        WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    END IF;

    -- 5. Update coins (Bypassing RLS via SECURITY DEFINER)
    UPDATE public.profiles 
    SET coins = coins + v_sell_price 
    WHERE id = v_user_id;

    RETURN v_sell_price;
END;
$$;

-- 3. Hardening Permissions
REVOKE ALL ON FUNCTION public.sell_item(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.sell_item(bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.sell_pet_item(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.sell_pet_item(bigint) TO authenticated;
