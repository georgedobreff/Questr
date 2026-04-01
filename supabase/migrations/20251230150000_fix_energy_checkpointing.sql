-- Migration to fix energy logic and add sync helper
-- Tuesday, 30 December 2025

-- 1. Function to calculate current pet energy (Pauses during missions)
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
BEGIN
    SELECT last_energy_refill_at, current_energy INTO v_last_refill, v_stored_energy
    FROM public.user_pets
    WHERE id = p_pet_id;

    IF v_last_refill IS NULL THEN
        RETURN 100;
    END IF;

    -- If a mission is ongoing, return the frozen value
    IF EXISTS (SELECT 1 FROM public.pet_missions WHERE pet_id = p_pet_id AND status = 'ongoing') THEN
        RETURN v_stored_energy;
    END IF;

    -- Calculate linear restoration: 100 energy / 240 minutes
    v_minutes_passed := extract(epoch from (now() - v_last_refill)) / 60.0;
    v_restored_energy := floor(v_minutes_passed * (100.0 / 240.0));
    
    RETURN LEAST(100, GREATEST(0, v_stored_energy + v_restored_energy));
END;
$$;

-- 2. Helper function to sync energy state (Checkpointing)
CREATE OR REPLACE FUNCTION public.sync_pet_energy(p_pet_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_calculated_energy integer;
BEGIN
    v_calculated_energy := public.get_pet_energy(p_pet_id);
    
    UPDATE public.user_pets
    SET current_energy = v_calculated_energy,
        last_energy_refill_at = now()
    WHERE id = p_pet_id;
    
    RETURN v_calculated_energy;
END;
$$;

-- 3. Override spend_pet_energy to use the checkpointing logic
CREATE OR REPLACE FUNCTION public.spend_pet_energy(p_pet_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_energy integer;
    v_new_energy integer;
BEGIN
    -- Calculate current actual energy including passive restoration
    v_current_energy := public.get_pet_energy(p_pet_id);
    
    IF v_current_energy < p_amount THEN
        RAISE EXCEPTION 'Not enough energy.';
    END IF;
    
    v_new_energy := v_current_energy - p_amount;
    
    -- Save the new baseline and reset the timer (Freezing it for the mission)
    UPDATE public.user_pets
    SET current_energy = v_new_energy,
        last_energy_refill_at = now()
    WHERE id = p_pet_id;
END;
$$;
