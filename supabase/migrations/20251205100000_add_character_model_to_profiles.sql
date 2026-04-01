DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='character_model_path') THEN
        ALTER TABLE public.profiles ADD COLUMN character_model_path TEXT;
    END IF;
END
$$;
