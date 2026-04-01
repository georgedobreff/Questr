-- Security Hardening Migration
-- Date: 2026-01-04

-- 1. Update Profile Security Trigger to protect all sensitive columns
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the current effective user is a restricted web role.
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
    
    -- Block sensitive financial and progression stats
    IF NEW.coins IS DISTINCT FROM OLD.coins THEN
      RAISE EXCEPTION 'Not authorized to update coins directly.';
    END IF;

    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'Not authorized to update XP directly.';
    END IF;

    IF NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Not authorized to update level directly.';
    END IF;

    IF NEW.current_streak IS DISTINCT FROM OLD.current_streak THEN
      RAISE EXCEPTION 'Not authorized to update current_streak directly.';
    END IF;

    IF NEW.longest_streak IS DISTINCT FROM OLD.longest_streak THEN
      RAISE EXCEPTION 'Not authorized to update longest_streak directly.';
    END IF;

    IF NEW.action_points IS DISTINCT FROM OLD.action_points THEN
      RAISE EXCEPTION 'Not authorized to update action_points directly.';
    END IF;

    IF NEW.dungeon_keys IS DISTINCT FROM OLD.dungeon_keys THEN
      RAISE EXCEPTION 'Not authorized to update dungeon_keys directly.';
    END IF;

    IF NEW.plan_credits IS DISTINCT FROM OLD.plan_credits THEN
      RAISE EXCEPTION 'Not authorized to update plan_credits directly.';
    END IF;

    IF NEW.oracle_quota IS DISTINCT FROM OLD.oracle_quota THEN
      RAISE EXCEPTION 'Not authorized to update oracle_quota directly.';
    END IF;

    IF NEW.streak_freezes_available IS DISTINCT FROM OLD.streak_freezes_available THEN
      RAISE EXCEPTION 'Not authorized to update streak_freezes_available directly.';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Create Pet Security Trigger to protect pet stats
CREATE OR REPLACE FUNCTION public.check_pet_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
    
    -- Block stats manipulation
    IF NEW.health IS DISTINCT FROM OLD.health THEN
      RAISE EXCEPTION 'Not authorized to update pet health directly.';
    END IF;

    IF NEW.happiness IS DISTINCT FROM OLD.happiness THEN
      RAISE EXCEPTION 'Not authorized to update pet happiness directly.';
    END IF;

    IF NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Not authorized to update pet level directly.';
    END IF;

    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'Not authorized to update pet XP directly.';
    END IF;

    IF NEW.current_energy IS DISTINCT FROM OLD.current_energy THEN
      RAISE EXCEPTION 'Not authorized to update pet energy directly.';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Not authorized to update pet status directly.';
    END IF;

    IF NEW.pet_def_id IS DISTINCT FROM OLD.pet_def_id THEN
      RAISE EXCEPTION 'Not authorized to update pet species directly.';
    END IF;

    IF NEW.revival_progress IS DISTINCT FROM OLD.revival_progress THEN
      RAISE EXCEPTION 'Not authorized to update pet revival_progress directly.';
    END IF;

    -- Allow nickname updates if nothing else changed
    -- (The IF THEN ELSE flow above already blocks sensitive changes)
    
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_pet_stats ON public.user_pets;
CREATE TRIGGER protect_pet_stats
BEFORE UPDATE ON public.user_pets
FOR EACH ROW
EXECUTE FUNCTION public.check_pet_update_permissions();

-- 3. Notification Security Trigger (Allow only is_read update)
CREATE OR REPLACE FUNCTION public.check_notification_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
    
    -- Only allow updating 'is_read'
    IF NEW.title IS DISTINCT FROM OLD.title OR
       NEW.message IS DISTINCT FROM OLD.message OR
       NEW.type IS DISTINCT FROM OLD.type OR
       NEW.user_id IS DISTINCT FROM OLD.user_id OR
       NEW.action_link IS DISTINCT FROM OLD.action_link THEN
      RAISE EXCEPTION 'Not authorized to update notification content.';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_notification_content ON public.notifications;
CREATE TRIGGER protect_notification_content
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.check_notification_update_permissions();

-- 4. Remove Insecure RLS Policies
-- Users should not be able to insert/update missions directly (handled by Edge Function)
DROP POLICY IF EXISTS "Users can insert their own pet missions" ON public.pet_missions;
DROP POLICY IF EXISTS "Users can update their own pet missions" ON public.pet_missions;

-- Users should not be able to insert pets directly (handled by adopt_pet RPC)
DROP POLICY IF EXISTS "Users can insert their own pets" ON public.user_pets;

-- Users should not be able to create or update boss fights directly (handled by Edge Function)
DROP POLICY IF EXISTS "Users can create their own boss fights" ON public.boss_fights;
DROP POLICY IF EXISTS "Users can update their own boss fights" ON public.boss_fights;
DROP POLICY IF EXISTS "Users can read own boss fights" ON public.boss_fights; -- We re-created it in 20251222140500_optimize_rls_policies_v2.sql
DROP POLICY IF EXISTS "Users can view their own boss fights" ON public.boss_fights;

-- Re-create a clean select policy for boss fights
CREATE POLICY "Users can view their own boss fights"
ON public.boss_fights FOR SELECT
USING (user_id = (select auth.uid()));

-- Adventure States: Users should only be able to SELECT. INSERT/UPDATE/DELETE handled by Edge Function.
DROP POLICY IF EXISTS "Users can insert/update their own adventure state." ON public.adventure_states;
DROP POLICY IF EXISTS "Users can view their own adventure state." ON public.adventure_states;

CREATE POLICY "Users can view their own adventure state"
ON public.adventure_states FOR SELECT
USING (user_id = (select auth.uid()));

-- Plans & Quests: Users should only be able to SELECT. INSERT/UPDATE/DELETE handled by Edge Function.
DROP POLICY IF EXISTS "Users can update their own quests" ON public.quests;
DROP POLICY IF EXISTS "Users can update quests for their own plans." ON public.quests;

-- User Items: Users should only be able to SELECT. INSERT/DELETE handled by purchase/reward logic.
DROP POLICY IF EXISTS "Users can update their own inventory" ON public.user_items;
-- (Note: check if there's an insert policy on user_items)
DROP POLICY IF EXISTS "Users can insert their own inventory" ON public.user_items;

-- 5. Harden missing functions with SECURITY DEFINER and search_path
-- These functions perform sensitive updates and should be authoritative.

ALTER FUNCTION public.decay_pet_stats(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.heal_pet_on_task(uuid) SECURITY DEFINER SET search_path = public;

-- Fix add_rewards if it exists (it was missing SECURITY DEFINER in one migration)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_rewards') THEN
        ALTER FUNCTION public.add_rewards(uuid, int, int) SECURITY DEFINER SET search_path = public;
    END IF;
END $$;
