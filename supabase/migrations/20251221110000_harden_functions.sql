-- Security Hardening: Set search_path = public for all SECURITY DEFINER functions
-- This prevents search path hijacking attacks.
-- Uses generic blocks to prevent "does not exist" errors during migration chain.

-- 1. Profile Security
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_profile_update_permissions') THEN
        ALTER FUNCTION public.check_profile_update_permissions() SET search_path = public;
    END IF;
END $$;

-- 2. Equip Security
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_item_ownership') THEN
        ALTER FUNCTION public.check_item_ownership() SET search_path = public;
    END IF;
END $$;

-- 3. Task Security
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_task_update_permissions') THEN
        ALTER FUNCTION public.check_task_update_permissions() SET search_path = public;
    END IF;
END $$;

-- 4. Plan Credits
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_plan_credits') THEN
        ALTER FUNCTION public.increment_plan_credits(uuid, int) SET search_path = public;
    END IF;
END $$;

-- 5. Achievements
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_achievements') THEN
        ALTER FUNCTION public.check_achievements(uuid) SET search_path = public;
    END IF;
END $$;

-- 6. Activity
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_activity') THEN
        ALTER FUNCTION public.update_activity(text) SET search_path = public;
    END IF;
END $$;

-- 7. Leaderboard
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_leaderboard') THEN
        ALTER FUNCTION public.get_leaderboard(text, int) SET search_path = public;
    END IF;
END $$;

-- 9. Pet Item Usage
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'use_pet_item') THEN
        ALTER FUNCTION public.use_pet_item(bigint) SET search_path = public;
    END IF;
END $$;

-- 10. Pet Revival
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revive_pet') THEN
        ALTER FUNCTION public.revive_pet(uuid) SET search_path = public;
    END IF;
END $$;

-- 11. Purchase Permissions
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purchase_pet_item') THEN
        ALTER FUNCTION public.purchase_pet_item(uuid, bigint) SET search_path = public;
    END IF;
END $$;

-- 12. Consumables (Handles both int and bigint variants to be safe)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'use_consumable_item' AND pronargs = 1) THEN
        -- Try to alter whatever version exists
        BEGIN
            ALTER FUNCTION public.use_consumable_item(int) SET search_path = public;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Ignore if int version doesn't exist
        END;
        BEGIN
            ALTER FUNCTION public.use_consumable_item(bigint) SET search_path = public;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Ignore if bigint version doesn't exist
        END;
    END IF;
END $$;

-- 13. Add Rewards
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_rewards') THEN
        ALTER FUNCTION public.add_rewards(uuid, int, int) SET search_path = public;
    END IF;
END $$;

-- 14. Adopt Pet
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'adopt_pet') THEN
        ALTER FUNCTION public.adopt_pet(text, text) SET search_path = public;
    END IF;
END $$;

-- 15. Purchase Item (Legacy)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purchase_item' AND pronargs = 2) THEN
        ALTER FUNCTION public.purchase_item(uuid, bigint) SET search_path = public;
    END IF;
END $$;
