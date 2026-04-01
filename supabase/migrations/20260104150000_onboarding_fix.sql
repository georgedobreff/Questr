-- Security Hardening Part 6: Onboarding Compatibility Fix
-- Date: 2026-01-04

-- Update Profile Security Trigger to allow the one-way transition of onboarding_completed
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the current effective user is a restricted web role.
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
    
    -- 1. Special Case: onboarding_completed
    -- Allow transition from FALSE to TRUE, but block everything else (e.g. setting it back to FALSE)
    IF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed THEN
        IF NOT (COALESCE(OLD.onboarding_completed, FALSE) = FALSE AND NEW.onboarding_completed = TRUE) THEN
            RAISE EXCEPTION 'Not authorized to update onboarding status.';
        END IF;
    END IF;

    -- 2. Block ALL other sensitive financial, progression, and internal columns
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
       NEW.plan_generations_count IS DISTINCT FROM OLD.plan_generations_count OR
       NEW.plan_generations_period_start IS DISTINCT FROM OLD.plan_generations_period_start OR
       NEW.last_plan_generated_at IS DISTINCT FROM OLD.last_plan_generated_at OR
       NEW.last_oracle_chat_at IS DISTINCT FROM OLD.last_oracle_chat_at OR
       NEW.last_adventure_at IS DISTINCT FROM OLD.last_adventure_at
    THEN
      RAISE EXCEPTION 'Not authorized to update sensitive profile columns directly.';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;
