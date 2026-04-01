DO $$
BEGIN
    -- Handle oracle_messages_count
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'oracle_messages_count') THEN
        ALTER TABLE public.profiles ADD COLUMN oracle_messages_count INTEGER DEFAULT 0 NOT NULL;
    ELSE
        ALTER TABLE public.profiles ALTER COLUMN oracle_messages_count SET NOT NULL;
        ALTER TABLE public.profiles ALTER COLUMN oracle_messages_count SET DEFAULT 0;
    END IF;

    -- Handle oracle_messages_period_start
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'oracle_messages_period_start') THEN
        ALTER TABLE public.profiles ADD COLUMN oracle_messages_period_start TIMESTAMPTZ DEFAULT now() NOT NULL;
    ELSE
        ALTER TABLE public.profiles ALTER COLUMN oracle_messages_period_start SET NOT NULL;
        ALTER TABLE public.profiles ALTER COLUMN oracle_messages_period_start SET DEFAULT now();
    END IF;
END $$;
