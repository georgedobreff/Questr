DO $$
BEGIN
    -- Check if the NOT NULL constraint exists on plan_id in shop_items
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'shop_items'
        AND column_name = 'plan_id'
        AND is_nullable = 'NO'
    ) THEN
        -- If it exists, drop the NOT NULL constraint
        ALTER TABLE public.shop_items ALTER COLUMN plan_id DROP NOT NULL;
    END IF;

    -- Check if the 'type' column exists before adding it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_items' AND column_name='type') THEN
        ALTER TABLE public.shop_items ADD COLUMN type TEXT DEFAULT 'equippable';
    END IF;
END
$$;

-- Add the permanent Magic Mirror as a global consumable item
INSERT INTO public.shop_items (name, description, cost, type, slot, asset_url)
VALUES (
  'Magic Mirror',
  'Look into this mirror and see the future you. (Change character)',
  50,
  'consumable',
  'consumable',
  'magic-portal.png'
);
