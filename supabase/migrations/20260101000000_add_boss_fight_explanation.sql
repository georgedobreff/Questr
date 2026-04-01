-- Add explanation column to boss_fights
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boss_fights' AND column_name='explanation') THEN
        ALTER TABLE public.boss_fights ADD COLUMN explanation text;
    END IF;
END $$;
