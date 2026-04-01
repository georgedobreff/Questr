-- Fix Concurrency and Data Integrity

-- 1. Ensure one pet per user (Fixes race condition in adopt_pet)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_pets_user_id_key') THEN
        ALTER TABLE public.user_pets ADD CONSTRAINT user_pets_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 2. Prevent negative inventory
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quantity_non_negative') THEN
        ALTER TABLE public.user_pet_inventory ADD CONSTRAINT quantity_non_negative CHECK (quantity >= 0);
    END IF;
END $$;

-- 3. Fix race condition in use_pet_item
-- Drop old versions to be safe regarding parameter names
DROP FUNCTION IF EXISTS public.use_pet_item(bigint);

CREATE OR REPLACE FUNCTION public.use_pet_item(p_pet_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_item_name text;
    v_effect_health int;
    v_effect_happiness int;
    v_pet_species text[];
    v_pet_id uuid;
    v_pet_def_id text;
    v_updated_count int;
BEGIN
    -- Get item details (without locking yet, just for info)
    SELECT 
        pi.name, 
        pi.effect_health, 
        pi.effect_happiness, 
        pi.pet_species
    INTO 
        v_item_name, 
        v_effect_health, 
        v_effect_happiness, 
        v_pet_species
    FROM pet_items pi
    WHERE pi.id = p_pet_item_id;

    IF v_item_name IS NULL THEN
        RAISE EXCEPTION 'Item definition not found.';
    END IF;

    -- Check active pet
    SELECT id, pet_def_id 
    INTO v_pet_id, v_pet_def_id
    FROM user_pets 
    WHERE user_id = v_user_id AND status = 'alive' 
    LIMIT 1;
    
    IF v_pet_id IS NULL THEN
        RAISE EXCEPTION 'You have no active companion.';
    END IF;

    -- Species Check
    IF v_pet_species IS NOT NULL AND NOT (v_pet_def_id = ANY(v_pet_species)) THEN
        RAISE EXCEPTION 'This item cannot be used on this type of companion.';
    END IF;

    -- ATOMIC UPDATE: Try to decrement quantity
    -- This succeeds only if user has the item AND quantity > 0
    UPDATE user_pet_inventory
    SET quantity = quantity - 1
    WHERE pet_item_id = p_pet_item_id 
      AND user_id = v_user_id 
      AND quantity > 0;
      
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- If no rows were updated, it means user doesn't have it or ran out (Race condition)
    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Item not found in inventory.';
    END IF;

    -- Clean up zero quantity rows (Maintenance)
    DELETE FROM user_pet_inventory 
    WHERE pet_item_id = p_pet_item_id 
      AND user_id = v_user_id 
      AND quantity = 0;

    -- Apply Effects (Only if decrement succeeded)
    UPDATE user_pets 
    SET 
        health = LEAST(100, GREATEST(0, health + v_effect_health)), 
        happiness = LEAST(100, GREATEST(0, happiness + v_effect_happiness)) 
    WHERE id = v_pet_id;

    RETURN 'Used ' || v_item_name;
END;
$$;

-- 4. Fix race condition in use_consumable_item
-- Drop old versions (int and bigint) to be safe
DROP FUNCTION IF EXISTS public.use_consumable_item(int);
DROP FUNCTION IF EXISTS public.use_consumable_item(bigint);

CREATE OR REPLACE FUNCTION public.use_consumable_item(p_user_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_name text;
  v_deleted_count int;
BEGIN
  -- Get item info
  SELECT s.name INTO v_item_name
  FROM public.user_items ui
  JOIN public.shop_items s ON ui.item_id = s.id
  WHERE ui.id = p_user_item_id AND ui.user_id = v_user_id;

  IF v_item_name IS NULL THEN
    RAISE EXCEPTION 'Item not found or you do not own it.';
  END IF;

  -- Atomic Delete
  WITH deleted AS (
    DELETE FROM public.user_items
    WHERE id = p_user_item_id AND user_id = v_user_id
    RETURNING *
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'Item already used.';
  END IF;

  -- Apply Logic (Placeholder)
  
  RETURN 'Used ' || v_item_name;
END;
$$;