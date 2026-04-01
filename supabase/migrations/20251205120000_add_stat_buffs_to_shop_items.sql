DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_items' AND column_name='stat_buffs') THEN
        ALTER TABLE public.shop_items ADD COLUMN stat_buffs JSONB;
    END IF;
END
$$;
