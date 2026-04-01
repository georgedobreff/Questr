-- Existing policy restricts viewing to own profile only.
-- We need to allow viewing for guild lists, leaderboards, etc.

DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone."
ON public.profiles FOR SELECT
USING (true);
