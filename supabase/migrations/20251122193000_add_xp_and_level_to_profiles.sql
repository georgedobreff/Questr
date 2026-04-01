-- Add level and xp columns to the profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS level integer default 1 not null,
ADD COLUMN IF NOT EXISTS xp integer default 0 not null;
