-- Function to use a pet item (Feed/Play)
CREATE OR REPLACE FUNCTION public.use_pet_item(p_user_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_item_name text;
    v_item_type text;
    v_pet_id uuid;
BEGIN
    -- Verify ownership and get item details
    SELECT s.name, s.type INTO v_item_name, v_item_type
    FROM user_items ui
    JOIN shop_items s ON ui.item_id = s.id
    WHERE ui.id = p_user_item_id AND ui.user_id = v_user_id;

    IF v_item_name IS NULL THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    IF v_item_type != 'pet_consumable' THEN
        RAISE EXCEPTION 'This item is not for companions.';
    END IF;

    -- Check if user has a live pet
    SELECT id INTO v_pet_id FROM user_pets WHERE user_id = v_user_id AND status = 'alive' LIMIT 1;
    
    IF v_pet_id IS NULL THEN
        RAISE EXCEPTION 'You have no active companion to use this on.';
    END IF;

    -- Apply Effects based on Item Name (Hardcoded for MVP, ideally dynamic)
    IF v_item_name = 'Pet Food' THEN
        UPDATE user_pets SET health = LEAST(100, health + 20) WHERE id = v_pet_id;
    ELSIF v_item_name = 'Fresh Water' THEN
        UPDATE user_pets SET health = LEAST(100, health + 10), happiness = LEAST(100, happiness + 10) WHERE id = v_pet_id;
    ELSIF v_item_name = 'Squeaky Toy' THEN
        UPDATE user_pets SET happiness = LEAST(100, happiness + 30) WHERE id = v_pet_id;
    END IF;

    -- Consume Item
    DELETE FROM user_items WHERE id = p_user_item_id;

    RETURN 'Used ' || v_item_name;
END;
$$;
