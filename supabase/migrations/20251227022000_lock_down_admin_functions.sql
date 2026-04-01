-- Secure administrative functions
-- These functions bypass RLS and modify sensitive data (credits/coins).
-- They must ONLY be callable by the Service Role (Edge Functions/Webhooks).
-- We revoke access from 'public', 'anon', and 'authenticated' (web users).

-- 1. Secure add_coins
REVOKE ALL ON FUNCTION public.add_coins(uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.add_coins(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.add_coins(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_coins(uuid, integer) TO service_role;

-- 2. Secure increment_plan_credits
REVOKE ALL ON FUNCTION public.increment_plan_credits(uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.increment_plan_credits(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.increment_plan_credits(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_plan_credits(uuid, integer) TO service_role;

-- 3. Secure add_rewards (if it exists)
-- It was created in 20251122194000_create_add_rewards_function.sql
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_rewards') THEN
        REVOKE ALL ON FUNCTION public.add_rewards(uuid, integer, integer) FROM public, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.add_rewards(uuid, integer, integer) TO service_role;
    END IF;
END $$;
