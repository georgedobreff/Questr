-- Migration to add robust identification for Energy Potions
-- Tuesday, 30 December 2025

-- 1. Add identifying column to pet_items
ALTER TABLE public.pet_items ADD COLUMN IF NOT EXISTS is_full_energy_refill BOOLEAN DEFAULT false NOT NULL;

-- 2. Mark the existing Energy Potion (handles both old and new names)
UPDATE public.pet_items 
SET is_full_energy_refill = true 
WHERE name IN ('Energy Potion', 'Pet Energy Potion');

-- 3. Update use_pet_item to use the flag instead of the name
CREATE OR REPLACE FUNCTION public.use_pet_item(p_pet_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_item_name text;
    v_effect_health int;
    v_effect_happiness int;
    v_is_refill boolean;
    v_pet_species text[];
    v_pet_id uuid;
    v_pet_def_id text;
    v_current_quantity int;
BEGIN
    -- Get active pet first to check missions
    SELECT id, pet_def_id 
    INTO v_pet_id, v_pet_def_id
    FROM user_pets 
    WHERE user_id = v_user_id AND status = 'alive' 
    LIMIT 1;
    
    IF v_pet_id IS NULL THEN
        RAISE EXCEPTION 'You have no active companion.';
    END IF;

    -- 1. Check if on mission
    IF EXISTS (
        SELECT 1 FROM public.pet_missions 
        WHERE pet_id = v_pet_id AND status = 'ongoing'
    ) THEN
        RAISE EXCEPTION 'Your companion is currently away on a mission.';
    END IF;

    -- 2. Get item details and verify ownership
    SELECT 
        pi.name, 
        pi.effect_health, 
        pi.effect_happiness, 
        pi.is_full_energy_refill,
        pi.pet_species,
        upi.quantity
    INTO 
        v_item_name, 
        v_effect_health, 
        v_effect_happiness, 
        v_is_refill,
        v_pet_species,
        v_current_quantity
    FROM user_pet_inventory upi
    JOIN pet_items pi ON upi.pet_item_id = pi.id
    WHERE upi.pet_item_id = p_pet_item_id AND upi.user_id = v_user_id;

    IF v_item_name IS NULL OR v_current_quantity < 1 THEN
        RAISE EXCEPTION 'Item not found in inventory.';
    END IF;

    -- 3. Species Check
    IF v_pet_species IS NOT NULL AND NOT (v_pet_def_id = ANY(v_pet_species)) THEN
        RAISE EXCEPTION 'This item cannot be used on this type of companion.';
    END IF;

    -- 4. Apply Effects
    IF v_is_refill = true THEN
        UPDATE user_pets 
        SET 
            current_energy = 100,
            last_energy_refill_at = now()
        WHERE id = v_pet_id;
    ELSE
        UPDATE user_pets 
        SET 
            health = LEAST(100, GREATEST(0, health + v_effect_health)), 
            happiness = LEAST(100, GREATEST(0, happiness + v_effect_happiness)) 
        WHERE id = v_pet_id;
    END IF;

    -- 5. Consume 1 from quantity
    IF v_current_quantity > 1 THEN
        UPDATE user_pet_inventory SET quantity = quantity - 1 WHERE pet_item_id = p_pet_item_id AND user_id = v_user_id;
    ELSE
        DELETE FROM user_pet_inventory WHERE pet_item_id = p_pet_item_id AND user_id = v_user_id;
    END IF;

    RETURN 'Used ' || v_item_name;
END;
$$;
