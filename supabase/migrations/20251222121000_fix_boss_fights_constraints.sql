-- Fix missing UNIQUE constraint on boss_fights
-- Required for upsert functionality (ON CONFLICT)

DO $$
BEGIN
    -- Check if the unique constraint exists, if not, add it
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'boss_fights_user_id_plan_id_module_number_key'
    ) THEN
        -- We try to add it. If there are duplicates, this might fail, so we might need to clean up first.
        -- But assuming clean state for now.
        ALTER TABLE public.boss_fights 
        ADD CONSTRAINT boss_fights_user_id_plan_id_module_number_key 
        UNIQUE (user_id, plan_id, module_number);
    END IF;
END $$;

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload config';
