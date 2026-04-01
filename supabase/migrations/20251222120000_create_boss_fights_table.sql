-- Create boss_fights table to track encounter state and cooldowns

-- 1. Safely create the ENUM type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'boss_fight_status') THEN
        CREATE TYPE boss_fight_status AS ENUM ('active', 'defeated', 'failed');
    END IF;
END $$;

-- 2. Safely create the TABLE
CREATE TABLE IF NOT EXISTS public.boss_fights (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id bigint NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    module_number int NOT NULL,
    
    -- Encounter Details
    boss_type text NOT NULL, -- e.g. "Wizard"
    boss_model_path text NOT NULL,
    story_plot text,
    
    -- Quiz Data (JSON array of objects: { question, options[], correct_index })
    questions jsonb NOT NULL DEFAULT '[]'::jsonb,
    
    -- State
    player_hp int NOT NULL DEFAULT 100,
    boss_hp int NOT NULL DEFAULT 100,
    status boss_fight_status NOT NULL DEFAULT 'active',
    
    -- Cooldown Logic
    cooldown_until timestamptz,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    PRIMARY KEY (id),
    UNIQUE (user_id, plan_id, module_number) -- One active fight per module attempt
);

-- 2.5 Ensure columns exist (Idempotency fix for existing partial tables)
DO $$
BEGIN
    -- Check and add updated_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boss_fights' AND column_name='updated_at') THEN
        ALTER TABLE public.boss_fights ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;

    -- Check and add cooldown_until if missing (just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boss_fights' AND column_name='cooldown_until') THEN
        ALTER TABLE public.boss_fights ADD COLUMN cooldown_until timestamptz;
    END IF;
END $$;

-- 3. RLS Policies
ALTER TABLE public.boss_fights ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflict
DROP POLICY IF EXISTS "Users can read own boss fights" ON public.boss_fights;

-- Recreate Policy
CREATE POLICY "Users can read own boss fights"
    ON public.boss_fights FOR SELECT
    USING (auth.uid() = user_id);

-- Permissions
GRANT SELECT ON public.boss_fights TO authenticated;
GRANT ALL ON public.boss_fights TO service_role;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_boss_fights_lookup ON public.boss_fights(user_id, plan_id, module_number);

-- 5. Force Schema Cache Reload (Optional but helpful trick: notifying pgrst)
NOTIFY pgrst, 'reload config';
