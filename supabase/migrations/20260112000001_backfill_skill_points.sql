-- Backfill skill points for existing users
DO $$
DECLARE
    r_profile RECORD;
    v_calculated_points integer;
    i integer;
BEGIN
    FOR r_profile IN SELECT id, level FROM public.profiles LOOP
        v_calculated_points := 0;
        
        -- Sum up points for every level gained (starting from moving to level 2)
        IF r_profile.level > 1 THEN
            FOR i IN 2..r_profile.level LOOP
                v_calculated_points := v_calculated_points + (FLOOR(i / 10) + 1);
            END LOOP;
        END IF;

        -- Update the user's skill points
        UPDATE public.profiles
        SET skill_points = v_calculated_points
        WHERE id = r_profile.id;
        
    END LOOP;
END $$;
