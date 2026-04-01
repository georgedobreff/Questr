-- HOTFIX: Restore profile visibility
-- Issue: Previous migration broke profile access

-- Drop the policies we just created
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Guild members can view each other" ON public.profiles;

-- Restore working policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Restore working policy: Authenticated users can view profiles (for leaderboards etc)
-- This is necessary because many pages need to query profiles
CREATE POLICY "Authenticated can view profiles"
ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');
