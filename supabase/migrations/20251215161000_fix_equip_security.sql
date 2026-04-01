-- Ensure users can only equip items they actually own

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.check_item_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user possesses the item in their inventory (user_items)
  IF NOT EXISTS (
    SELECT 1 
    FROM public.user_items 
    WHERE user_id = NEW.user_id 
    AND item_id = NEW.item_id
  ) THEN
    RAISE EXCEPTION 'You do not own this item.';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Create the trigger on equipped_items
DROP TRIGGER IF EXISTS verify_ownership_before_equip ON public.equipped_items;

CREATE TRIGGER verify_ownership_before_equip
BEFORE INSERT OR UPDATE ON public.equipped_items
FOR EACH ROW
EXECUTE FUNCTION public.check_item_ownership();
