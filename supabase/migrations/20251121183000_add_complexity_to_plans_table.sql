-- Add 'complexity' column to the 'plans' table
ALTER TABLE public.plans
ADD COLUMN complexity text not null default 'simple';
