-- Change default Action Points for new users from 100 to 15
ALTER TABLE public.profiles ALTER COLUMN action_points SET DEFAULT 15;
