-- Security Hardening Part 3: Final Sweep
-- Date: 2026-01-04

-- 1. Final Profile Lockdown (Covering all sensitive columns)
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the current effective user is a restricted web role.
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
    
    -- Block ALL sensitive columns
    IF NEW.coins IS DISTINCT FROM OLD.coins OR
       NEW.xp IS DISTINCT FROM OLD.xp OR
       NEW.level IS DISTINCT FROM OLD.level OR
       NEW.current_streak IS DISTINCT FROM OLD.current_streak OR
       NEW.longest_streak IS DISTINCT FROM OLD.longest_streak OR
       NEW.action_points IS DISTINCT FROM OLD.action_points OR
       NEW.dungeon_keys IS DISTINCT FROM OLD.dungeon_keys OR
       NEW.plan_credits IS DISTINCT FROM OLD.plan_credits OR
       NEW.oracle_quota IS DISTINCT FROM OLD.oracle_quota OR
       NEW.streak_freezes_available IS DISTINCT FROM OLD.streak_freezes_available OR
       NEW.has_had_trial IS DISTINCT FROM OLD.has_had_trial OR
       NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
       NEW.lemon_squeezy_customer_id IS DISTINCT FROM OLD.lemon_squeezy_customer_id OR
       NEW.last_login_at IS DISTINCT FROM OLD.last_login_at OR
       NEW.last_action_at IS DISTINCT FROM OLD.last_action_at OR
       NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed OR
       NEW.plan_generations_count IS DISTINCT FROM OLD.plan_generations_count OR
       NEW.plan_generations_period_start IS DISTINCT FROM OLD.plan_generations_period_start OR
       NEW.last_plan_generated_at IS DISTINCT FROM OLD.last_plan_generated_at OR
       NEW.last_oracle_chat_at IS DISTINCT FROM OLD.last_oracle_chat_at
    THEN
      RAISE EXCEPTION 'Not authorized to update sensitive profile columns directly.';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Boss Fight Reward Automation
CREATE OR REPLACE FUNCTION public.handle_boss_defeat_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only award rewards when transitioning from 'active' to 'defeated'
    IF NEW.status = 'defeated' AND OLD.status = 'active' THEN
        -- Award 500 Coins and 200 XP and 1 Dungeon Key
        UPDATE public.profiles
        SET 
            coins = coins + 500,
            xp = xp + 200,
            dungeon_keys = dungeon_keys + 1
        WHERE id = NEW.user_id;

        -- Add notification
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (NEW.user_id, 'Boss Defeated!', 'You have conquered the ' || NEW.boss_type || '! Rewards: 500 Coins, 200 XP, 1 Dungeon Key.', 'reward');
        
        -- Check achievements
        PERFORM public.check_achievements(NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_boss_defeat_rewards ON public.boss_fights;
CREATE TRIGGER trigger_boss_defeat_rewards
AFTER UPDATE OF status ON public.boss_fights
FOR EACH ROW
EXECUTE FUNCTION public.handle_boss_defeat_rewards();

-- 3. Enforce search_path = public for ALL SECURITY DEFINER functions
-- This fixes the vulnerability across the entire database.
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.prosecdef = true
    LOOP
        EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', func_record.proname, func_record.args);
    END LOOP;
END $$;

-- 4. Final RLS Policy Cleanup
-- Notifications: Ensure users cannot insert their own notifications
DROP POLICY IF EXISTS "Users can insert their own notifications." ON public.notifications;

-- Chat Histories: Ensure users cannot insert directly (Oracle function handles it)
DROP POLICY IF EXISTS "Users can insert their own chat history." ON public.chat_history;
DROP POLICY IF EXISTS "Users can insert their own adventure chat history." ON public.adventure_chat_history;

-- Adventure States: Ensure SELECT only
DROP POLICY IF EXISTS "Users can insert/update their own adventure state." ON public.adventure_states;
