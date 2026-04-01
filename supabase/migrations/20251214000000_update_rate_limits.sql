ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_generations_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS plan_generations_period_start TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS oracle_messages_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS oracle_messages_period_start TIMESTAMPTZ DEFAULT NOW();
