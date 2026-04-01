-- Migration to add Pet Missions and Leveling
-- Tuesday, 30 December 2025

-- 1. Enhance user_pets table
ALTER TABLE public.user_pets 
ADD COLUMN IF NOT EXISTS level integer DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_energy_refill_at timestamp with time zone DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS current_energy integer DEFAULT 100 NOT NULL;

-- 2. Create mission types
DO $$ BEGIN
    CREATE TYPE public.mission_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.mission_status AS ENUM ('ongoing', 'completed', 'failed', 'claimed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create pet_missions table
CREATE TABLE IF NOT EXISTS public.pet_missions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    pet_id uuid REFERENCES public.user_pets(id) ON DELETE CASCADE NOT NULL,
    difficulty public.mission_difficulty NOT NULL,
    status public.mission_status DEFAULT 'ongoing' NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_seconds integer NOT NULL,
    mission_title text,
    story_plot text,
    success_story text,
    failure_story text,
    gold_reward integer DEFAULT 0,
    xp_reward integer DEFAULT 0,
    items_awarded jsonb DEFAULT '[]'::jsonb
);

-- 4. Enable RLS on pet_missions
ALTER TABLE public.pet_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pet missions" ON public.pet_missions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pet missions" ON public.pet_missions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pet missions" ON public.pet_missions
    FOR UPDATE USING (auth.uid() = user_id);

-- 5. Function to calculate current pet energy
CREATE OR REPLACE FUNCTION public.get_pet_energy(p_pet_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_last_refill timestamptz;
    v_stored_energy integer;
    v_minutes_passed double precision;
    v_restored_energy integer;
    v_total_energy integer;
    v_mission_minutes double precision := 0;
BEGIN
    SELECT last_energy_refill_at, current_energy INTO v_last_refill, v_stored_energy
    FROM public.user_pets
    WHERE id = p_pet_id;

    IF v_last_refill IS NULL THEN
        RETURN 100;
    END IF;

    -- Calculate total minutes since last refill
    v_minutes_passed := extract(epoch from (now() - v_last_refill)) / 60.0;

    -- Subtract minutes spent on missions since last refill
    SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 INTO v_mission_minutes
    FROM public.pet_missions
    WHERE pet_id = p_pet_id 
    AND started_at > v_last_refill;

    v_minutes_passed := GREATEST(0, v_minutes_passed - v_mission_minutes);

    -- 4 hours for 100 energy = 100/240 = 0.4166 energy per minute
    v_restored_energy := floor(v_minutes_passed * (100.0 / 240.0));
    
    v_total_energy := v_stored_energy + v_restored_energy;
    
    IF v_total_energy > 100 THEN
        RETURN 100;
    ELSE
        RETURN v_total_energy;
    END IF;
END;
$$;

-- 6. Helper function to spend energy
-- This function calculates the current energy, subtracts the cost, and updates the DB.
CREATE OR REPLACE FUNCTION public.spend_pet_energy(p_pet_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_energy integer;
    v_new_energy integer;
BEGIN
    -- Calculate current energy with restoration
    v_current_energy := public.get_pet_energy(p_pet_id);
    
    IF v_current_energy < p_amount THEN
        RAISE EXCEPTION 'Not enough energy.';
    END IF;
    
    v_new_energy := v_current_energy - p_amount;
    
    UPDATE public.user_pets
    SET current_energy = v_new_energy,
        last_energy_refill_at = now()
    WHERE id = p_pet_id;
END;
$$;

-- 7. Add show_in_shop to pet_items and seed Energy Potion
ALTER TABLE public.pet_items ADD COLUMN IF NOT EXISTS show_in_shop boolean DEFAULT true NOT NULL;

INSERT INTO public.pet_items (name, cost, description, asset_url, item_tier, effect_health, effect_happiness, pet_species, show_in_shop, is_full_energy_refill)
VALUES ('Energy Potion', 150, 'Instantly restores 100 energy to your pet.', 'potion-ball.png', 3, 0, 0, NULL, false, true)
ON CONFLICT (name) DO UPDATE SET is_full_energy_refill = true;

-- 8. Internal helper to increment coins
CREATE OR REPLACE FUNCTION public.increment_profile_coins(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET coins = coins + p_amount
    WHERE id = p_user_id;
END;
$$;

-- 9. Internal helper to award pet items
CREATE OR REPLACE FUNCTION public.purchase_pet_item_internal(p_user_id uuid, p_pet_item_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Add to inventory (upsert for quantity)
    INSERT INTO public.user_pet_inventory (user_id, pet_item_id, quantity)
    VALUES (p_user_id, p_pet_item_id, 1)
    ON CONFLICT (user_id, pet_item_id) 
    DO UPDATE SET quantity = user_pet_inventory.quantity + 1;
END;
$$;

-- 10. Update use_pet_item to block usage during missions and handle Energy Potions
CREATE OR REPLACE FUNCTION public.use_pet_item(p_pet_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_item_name text;
    v_effect_health int;
    v_effect_happiness int;
    v_is_refill boolean;
    v_pet_species text[];
    v_pet_id uuid;
    v_pet_def_id text;
    v_current_quantity int;
BEGIN
    -- Get active pet first to check missions
    SELECT id, pet_def_id 
    INTO v_pet_id, v_pet_def_id
    FROM user_pets 
    WHERE user_id = v_user_id AND status = 'alive' 
    LIMIT 1;
    
    IF v_pet_id IS NULL THEN
        RAISE EXCEPTION 'You have no active companion.';
    END IF;

    -- 1. Check if on mission
    IF EXISTS (
        SELECT 1 FROM public.pet_missions 
        WHERE pet_id = v_pet_id AND status = 'ongoing'
    ) THEN
        RAISE EXCEPTION 'Your companion is currently away on a mission.';
    END IF;

    -- 2. Get item details and verify ownership
    SELECT 
        pi.name, 
        pi.effect_health, 
        pi.effect_happiness, 
        pi.is_full_energy_refill,
        pi.pet_species,
        upi.quantity
    INTO 
        v_item_name, 
        v_effect_health, 
        v_effect_happiness, 
        v_is_refill,
        v_pet_species,
        v_current_quantity
    FROM user_pet_inventory upi
    JOIN pet_items pi ON upi.pet_item_id = pi.id
    WHERE upi.pet_item_id = p_pet_item_id AND upi.user_id = v_user_id;

    IF v_item_name IS NULL OR v_current_quantity < 1 THEN
        RAISE EXCEPTION 'Item not found in inventory.';
    END IF;

    -- 3. Species Check
    IF v_pet_species IS NOT NULL AND NOT (v_pet_def_id = ANY(v_pet_species)) THEN
        RAISE EXCEPTION 'This item cannot be used on this type of companion.';
    END IF;

    -- 4. Apply Effects
    IF v_is_refill = true THEN
        UPDATE user_pets 
        SET 
            current_energy = 100,
            last_energy_refill_at = now()
        WHERE id = v_pet_id;
    ELSE
        UPDATE user_pets 
        SET 
            health = LEAST(100, GREATEST(0, health + v_effect_health)), 
            happiness = LEAST(100, GREATEST(0, happiness + v_effect_happiness)) 
        WHERE id = v_pet_id;
    END IF;

    -- 5. Consume 1 from quantity
    IF v_current_quantity > 1 THEN
        UPDATE user_pet_inventory SET quantity = quantity - 1 WHERE pet_item_id = p_pet_item_id AND user_id = v_user_id;
    ELSE
        DELETE FROM user_pet_inventory WHERE pet_item_id = p_pet_item_id AND user_id = v_user_id;
    END IF;

    RETURN 'Used ' || v_item_name;
END;
$$;
