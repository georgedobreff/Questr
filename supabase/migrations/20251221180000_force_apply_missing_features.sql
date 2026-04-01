-- FORCE APPLY MIGRATION: Consolidates multiple previous migrations that were skipped or not applied correctly in production.
-- Includes: Stripe migration, Trial columns, Security RPCs, Coin Farming Fix, Hardening, Audit Cleanup, Performance Indexes, and Concurrency Fixes.

-- ==========================================
-- 1. MIGRATE TO STRIPE
-- ==========================================
-- Migration to replace Lemon Squeezy fields with Stripe fields
-- We are keeping the old columns for now to prevent data loss during migration.

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS stripe_price_id text,
ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;

-- Add an index for faster lookups on Stripe fields
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- ==========================================
-- 2. ENSURE TRIAL COLUMN
-- ==========================================
-- Ensure the has_had_trial column exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_had_trial boolean DEFAULT false;

-- Index it for performance
CREATE INDEX IF NOT EXISTS idx_profiles_has_had_trial ON profiles(has_had_trial);

-- ==========================================
-- 3. SECURE PURCHASE RPCS
-- ==========================================
-- Secure the purchase functions by revoking public access
-- They should only be called by the Edge Functions (Service Role)

-- 1. Secure purchase_item (Gear Shop)
REVOKE ALL ON FUNCTION public.purchase_item(uuid, bigint) FROM public;
REVOKE ALL ON FUNCTION public.purchase_item(uuid, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.purchase_item(uuid, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item(uuid, bigint) TO service_role;

-- 2. Secure purchase_pet_item (Pet Shop)
-- Note: Depending on the exact signature in the DB, we ensure we target the right one.
-- The latest definition uses (uuid, bigint).
REVOKE ALL ON FUNCTION public.purchase_pet_item(uuid, bigint) FROM public;
REVOKE ALL ON FUNCTION public.purchase_pet_item(uuid, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.purchase_pet_item(uuid, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_pet_item(uuid, bigint) TO service_role;

-- 3. Just in case the old signature (bigint only) still exists/lingers, revoke it too
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purchase_pet_item' AND pronargs = 1) THEN
        REVOKE ALL ON FUNCTION public.purchase_pet_item(bigint) FROM public, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.purchase_pet_item(bigint) TO service_role;
    END IF;
END $$;

-- ==========================================
-- 4. FIX COIN FARMING
-- ==========================================
-- Fix Coin Farming Vulnerability
-- 1. Add a flag to track if the reward has been claimed
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS is_reward_claimed boolean DEFAULT false;

-- 2. Update the reward function to check and set this flag      
CREATE OR REPLACE FUNCTION public.award_plan_completion_reward(p_user_id uuid, p_plan_id int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward_coins_amount int := 500;
  trophy_item_id int;
  plan_owner_id uuid;
  plan_claimed boolean;
BEGIN
  -- Verify ownership and claim status
  SELECT user_id, is_reward_claimed INTO plan_owner_id, plan_claimed
  FROM public.plans
  WHERE id = p_plan_id;

  IF plan_owner_id != p_user_id THEN
    RAISE EXCEPTION 'User does not own this plan.';
  END IF;

  IF plan_claimed THEN
    -- Silently return or raise notice; do not award again       
    RETURN;
  END IF;

  -- Add coins to the user's profile
  UPDATE public.profiles
  SET coins = coins + reward_coins_amount
  WHERE id = p_user_id;

  -- Mark plan as claimed
  UPDATE public.plans
  SET is_reward_claimed = true
  WHERE id = p_plan_id;

  -- Upsert the "Trophy" item into the shop_items table to ensure it exists
  INSERT INTO public.shop_items (name, description, cost, type, slot, source, asset_url)
  VALUES ('Pathfinder''s Trophy', 'A trophy awarded for seeing a Main Path through to the very end.', 0, 'equippable', 'trophy', 'reward', 'trophy.png')
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    source = EXCLUDED.source,
    asset_url = EXCLUDED.asset_url
  RETURNING id INTO trophy_item_id;

  -- Grant the trophy to the user
  INSERT INTO public.user_items (user_id, item_id)
  VALUES (p_user_id, trophy_item_id)
  ON CONFLICT DO NOTHING;

END;
$$;

-- ==========================================
-- 5. HARDEN FUNCTIONS (SEARCH_PATH)
-- ==========================================
-- Security Hardening: Set search_path = public for all SECURITY DEFINER functions

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

-- 12. Consumables
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'use_consumable_item' AND pronargs = 1) THEN
        BEGIN
            ALTER FUNCTION public.use_consumable_item(int) SET search_path = public;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
            ALTER FUNCTION public.use_consumable_item(bigint) SET search_path = public;
        EXCEPTION WHEN OTHERS THEN NULL;
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

-- ==========================================
-- 6. AUDIT CLEANUP (IDEMPOTENCY)
-- ==========================================
-- 1. Create table for Idempotency
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (     
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    stripe_event_id text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (id)
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read this table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'processed_webhook_events' AND policyname = 'Service role only'
    ) THEN
        CREATE POLICY "Service role only" ON public.processed_webhook_events
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 2. Harden add_coins (Input Validation)
CREATE OR REPLACE FUNCTION public.add_coins(user_id_input uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET coins = coins + amount, updated_at = now()
  WHERE id = user_id_input;
END;
$$;

-- 3. Harden increment_plan_credits (Input Validation)
CREATE OR REPLACE FUNCTION public.increment_plan_credits(user_id_input UUID, amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET purchased_plan_credits = purchased_plan_credits + amount   
  WHERE id = user_id_input;
END;
$$;

-- ==========================================
-- 7. FINAL POLISH
-- ==========================================

-- 1. Drop Zombie Code
DROP FUNCTION IF EXISTS public.get_leaderboard_v2(text, int, int);

-- 2. Ensure get_leaderboard is hardened
ALTER FUNCTION public.get_leaderboard(text, int) SET search_path = public;

-- ==========================================
-- 8. PERFORMANCE INDEXES
-- ==========================================

-- 1. Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_quest_id ON public.tasks(quest_id);

-- 2. Quests
CREATE INDEX IF NOT EXISTS idx_quests_plan_id ON public.quests(plan_id);

-- 3. User Items
CREATE INDEX IF NOT EXISTS idx_user_items_item_id ON public.user_items(item_id);

-- 4. User Pets
CREATE INDEX IF NOT EXISTS idx_user_pets_pet_def_id ON public.user_pets(pet_def_id);

-- 5. User Stats
CREATE INDEX IF NOT EXISTS idx_user_stats_plan_id ON public.user_stats(plan_id);

-- 6. Shop Items (Plan specific items if any)
CREATE INDEX IF NOT EXISTS idx_shop_items_plan_id ON public.shop_items(plan_id);

-- ==========================================
-- 9. FIX CONCURRENCY RETRY
-- ==========================================

-- 1. Ensure one pet per user
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_pets_user_id_key') THEN
        ALTER TABLE public.user_pets ADD CONSTRAINT user_pets_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 2. Prevent negative inventory
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quantity_non_negative') THEN
        ALTER TABLE public.user_pet_inventory ADD CONSTRAINT quantity_non_negative CHECK (quantity >= 0);
    END IF;
END $$;

-- 3. Fix race condition in use_pet_item
DROP FUNCTION IF EXISTS public.use_pet_item(bigint);

CREATE OR REPLACE FUNCTION public.use_pet_item(p_pet_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_item_name text;
    v_effect_health int;
    v_effect_happiness int;
    v_pet_species text[];
    v_pet_id uuid;
    v_pet_def_id text;
    v_updated_count int;
BEGIN
    -- Get item details (without locking yet, just for info)     
    SELECT
        pi.name,
        pi.effect_health,
        pi.effect_happiness,
        pi.pet_species
    INTO
        v_item_name,
        v_effect_health,
        v_effect_happiness,
        v_pet_species
    FROM pet_items pi
    WHERE pi.id = p_pet_item_id;

    IF v_item_name IS NULL THEN
        RAISE EXCEPTION 'Item definition not found.';
    END IF;

    -- Check active pet
    SELECT id, pet_def_id
    INTO v_pet_id, v_pet_def_id
    FROM user_pets
    WHERE user_id = v_user_id AND status = 'alive'
    LIMIT 1;

    IF v_pet_id IS NULL THEN
        RAISE EXCEPTION 'You have no active companion.';
    END IF;

    -- Species Check
    IF v_pet_species IS NOT NULL AND NOT (v_pet_def_id = ANY(v_pet_species)) THEN
        RAISE EXCEPTION 'This item cannot be used on this type of companion.';
    END IF;

    -- ATOMIC UPDATE: Try to decrement quantity
    UPDATE user_pet_inventory
    SET quantity = quantity - 1
    WHERE pet_item_id = p_pet_item_id
      AND user_id = v_user_id
      AND quantity > 0;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Item not found in inventory.';
    END IF;

    -- Clean up zero quantity rows
    DELETE FROM user_pet_inventory
    WHERE pet_item_id = p_pet_item_id
      AND user_id = v_user_id
      AND quantity = 0;

    -- Apply Effects
    UPDATE user_pets
    SET
        health = LEAST(100, GREATEST(0, health + v_effect_health)),
        happiness = LEAST(100, GREATEST(0, happiness + v_effect_happiness))
    WHERE id = v_pet_id;

    RETURN 'Used ' || v_item_name;
END;
$$;

-- 4. Fix race condition in use_consumable_item
DROP FUNCTION IF EXISTS public.use_consumable_item(int);
DROP FUNCTION IF EXISTS public.use_consumable_item(bigint);      

CREATE OR REPLACE FUNCTION public.use_consumable_item(p_user_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_name text;
  v_deleted_count int;
BEGIN
  -- Get item info
  SELECT s.name INTO v_item_name
  FROM public.user_items ui
  JOIN public.shop_items s ON ui.item_id = s.id
  WHERE ui.id = p_user_item_id AND ui.user_id = v_user_id;       

  IF v_item_name IS NULL THEN
    RAISE EXCEPTION 'Item not found or you do not own it.';      
  END IF;

  -- Atomic Delete
  WITH deleted AS (
    DELETE FROM public.user_items
    WHERE id = p_user_item_id AND user_id = v_user_id
    RETURNING *
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'Item already used.';
  END IF;

  RETURN 'Used ' || v_item_name;
END;
$$;
