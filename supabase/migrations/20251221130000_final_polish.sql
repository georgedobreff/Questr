-- Final Security Polish & Cleanup

-- 1. Redundant Check for adopt_pet (Already handled in 110000, but ensuring)
-- ALTER FUNCTION public.adopt_pet(text, text) SET search_path = public;

-- 2. Drop Zombie Code
-- get_leaderboard_v2 does not exist, so we use IF EXISTS
DROP FUNCTION IF EXISTS public.get_leaderboard_v2(text, int, int);

-- 3. Ensure get_leaderboard is hardened
-- (Already handled in 110000, but repeating is harmless if signature matches)
ALTER FUNCTION public.get_leaderboard(text, int) SET search_path = public;

-- 4. Revoke redundant permissions just in case
-- Ensure public/anon cannot call it directly if it was meant to be secure (though leaderboard is usually public)
-- Actually, leaderboard IS public in this app.
-- REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, int) FROM public; 
-- GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, int) TO anon, authenticated, service_role;