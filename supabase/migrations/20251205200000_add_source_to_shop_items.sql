DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_items' AND column_name='source') THEN
        ALTER TABLE public.shop_items ADD COLUMN source TEXT DEFAULT 'shop' NOT NULL;
    END IF;
END
$$;
