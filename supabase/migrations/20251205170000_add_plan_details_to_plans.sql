DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='plan_details') THEN
        ALTER TABLE public.plans ADD COLUMN plan_details JSONB;
    END IF;
END
$$;
