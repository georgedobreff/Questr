-- Security Hardening Part 4: Locking Administrative Backdoors
-- Date: 2026-01-04

-- 1. Secure add_dungeon_keys
-- This was wide open to public/authenticated users. 
ALTER FUNCTION public.add_dungeon_keys(uuid, integer) SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.add_dungeon_keys(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_dungeon_keys(uuid, integer) TO service_role;

-- 2. Secure increment_profile_coins
-- Used by Pet Mission Manager, must not be callable by web users.
ALTER FUNCTION public.increment_profile_coins(uuid, integer) SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.increment_profile_coins(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_profile_coins(uuid, integer) TO service_role;

-- 3. Secure purchase_pet_item_internal
-- Used to award items from missions/rewards.
ALTER FUNCTION public.purchase_pet_item_internal(uuid, bigint) SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.purchase_pet_item_internal(uuid, bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_pet_item_internal(uuid, bigint) TO service_role;

-- 4. Secure Pet Energy Management
-- These should only be called by the system (Edge Functions) to prevent energy spoofing.
ALTER FUNCTION public.spend_pet_energy(uuid, integer) SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.spend_pet_energy(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_pet_energy(uuid, integer) TO service_role;

ALTER FUNCTION public.sync_pet_energy(uuid) SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.sync_pet_energy(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_pet_energy(uuid) TO service_role;

-- 5. Additional hardening for notify functions
ALTER FUNCTION public.notify_pet_mission_completion() SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.notify_pet_mission_completion() FROM public, anon, authenticated;
-- Note: Trigger functions don't usually need EXECUTE grants for users, as the system fires them.

ALTER FUNCTION public.notify_pet_status() SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.notify_pet_status() FROM public, anon, authenticated;

-- 6. Verification: Ensure all sensitive functions are revoked from public access
-- This is a catch-all to prevent any lingering 'ALL' grants from previous backups.
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN (
            'add_dungeon_keys', 
            'increment_profile_coins', 
            'purchase_pet_item_internal', 
            'spend_pet_energy', 
            'sync_pet_energy', 
            'increment_plan_credits',
            'add_rewards',
            'add_coins'
        )
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM public, anon, authenticated', func_record.proname, func_record.args);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', func_record.proname, func_record.args);
    END LOOP;
END $$;
