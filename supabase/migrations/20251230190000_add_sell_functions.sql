-- Function to sell an item (Character Gear)
CREATE OR REPLACE FUNCTION public.sell_item(p_item_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_cost int;
    v_sell_price int;
    v_count int;
BEGIN
    -- 1. Check ownership
    SELECT count(*) INTO v_count FROM public.user_items WHERE user_id = v_user_id AND item_id = p_item_id;
    IF v_count < 1 THEN
        RAISE EXCEPTION 'You do not own this item.';
    END IF;

    -- 2. Get original cost
    SELECT cost INTO v_cost FROM public.shop_items WHERE id = p_item_id;
    v_sell_price := floor(v_cost / 2);

    -- 3. Remove item (Delete 1 instance - usually unique for gear but safe to limit)
    DELETE FROM public.user_items 
    WHERE id IN (
        SELECT id FROM public.user_items 
        WHERE user_id = v_user_id AND item_id = p_item_id 
        LIMIT 1
    );

    -- 4. Add coins
    UPDATE public.profiles SET coins = coins + v_sell_price WHERE id = v_user_id;

    RETURN v_sell_price;
END;
$$;

-- Function to sell a pet item (Supplies)
CREATE OR REPLACE FUNCTION public.sell_pet_item(p_pet_item_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_cost int;
    v_sell_price int;
    v_quantity int;
BEGIN
    -- 1. Check ownership and quantity
    SELECT quantity INTO v_quantity FROM public.user_pet_inventory 
    WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    
    IF v_quantity IS NULL OR v_quantity < 1 THEN
        RAISE EXCEPTION 'You do not own this item.';
    END IF;

    -- 2. Get original cost
    SELECT cost INTO v_cost FROM public.pet_items WHERE id = p_pet_item_id;
    v_sell_price := floor(v_cost / 2);

    -- 3. Remove item (Decrement or Delete)
    IF v_quantity > 1 THEN
        UPDATE public.user_pet_inventory SET quantity = quantity - 1 
        WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    ELSE
        DELETE FROM public.user_pet_inventory 
        WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    END IF;

    -- 4. Add coins
    UPDATE public.profiles SET coins = coins + v_sell_price WHERE id = v_user_id;

    RETURN v_sell_price;
END;
$$;
