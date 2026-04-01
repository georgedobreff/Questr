-- Add missing total_estimated_duration_days column to the 'plans' table
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS total_estimated_duration_days integer not null default 0;

-- Add missing created_at column to the 'plans' table
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default now() not null;
