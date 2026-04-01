-- Add indexes for leaderboard performance
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_current_streak ON public.profiles(current_streak DESC);
