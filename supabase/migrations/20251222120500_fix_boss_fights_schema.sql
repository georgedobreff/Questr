-- Fix for boss_fights table schema being out of sync
-- This migration runs explicitly to add columns that might be missing from a previous failed/partial apply.

DO $$
BEGIN
    -- 1. Ensure updated_at exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boss_fights' AND column_name='updated_at') THEN
        ALTER TABLE public.boss_fights ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;

    -- 2. Ensure cooldown_until exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boss_fights' AND column_name='cooldown_until') THEN
        ALTER TABLE public.boss_fights ADD COLUMN cooldown_until timestamptz;
    END IF;

    -- 3. Ensure columns used in queries are present (sanity check)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boss_fights' AND column_name='status') THEN
        ALTER TABLE public.boss_fights ADD COLUMN status boss_fight_status NOT NULL DEFAULT 'active';
    END IF;
    
    -- 4. Ensure questions exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boss_fights' AND column_name='questions') THEN
        ALTER TABLE public.boss_fights ADD COLUMN questions jsonb NOT NULL DEFAULT '[]'::jsonb;
    END IF;

END $$;

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload config';
