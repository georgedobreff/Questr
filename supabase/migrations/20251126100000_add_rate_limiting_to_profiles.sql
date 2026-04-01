ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_plan_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_oracle_chat_at TIMESTAMPTZ;
