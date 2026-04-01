ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_generations_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS plan_generations_period_start TIMESTAMPTZ DEFAULT now() NOT NULL;
