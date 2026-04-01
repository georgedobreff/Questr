-- Server-side Energy Heartbeat Logic
-- Calculates and PERSISTS energy regeneration to the database.
-- Tuesday, 30 December 2025

CREATE OR REPLACE FUNCTION public.heartbeat_pet_energy(p_pet_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_energy integer;
    v_last_refill timestamptz;
    v_minutes_passed float;
    v_restored_energy integer;
    v_new_total integer;
BEGIN
    -- 1. Get current saved state
    SELECT current_energy, last_energy_refill_at INTO v_current_energy, v_last_refill
    FROM public.user_pets
    WHERE id = p_pet_id AND user_id = auth.uid();

    IF v_current_energy IS NULL THEN
        RETURN 0;
    END IF;

    -- 2. If mission is ongoing, regeneration is frozen. Return saved value.
    IF EXISTS (SELECT 1 FROM public.pet_missions WHERE pet_id = p_pet_id AND status = 'ongoing') THEN
        RETURN v_current_energy;
    END IF;

    -- 3. Calculate restoration (100% in 4 hours = 1% every 2.4 minutes)
    v_minutes_passed := extract(epoch from (now() - v_last_refill)) / 60.0;
    v_restored_energy := floor(v_minutes_passed * (100.0 / 240.0));

    IF v_restored_energy < 1 THEN
        RETURN v_current_energy; -- Nothing to update yet
    END IF;

    v_new_total := LEAST(100, v_current_energy + v_restored_energy);

    -- 4. Persist to DB and reset the calculation baseline
    UPDATE public.user_pets
    SET current_energy = v_new_total,
        last_energy_refill_at = now()
    WHERE id = p_pet_id;

    RETURN v_new_total;
END;
$$;
