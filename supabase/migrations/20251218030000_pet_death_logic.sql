-- Update decay_pet_stats to handle death logic
CREATE OR REPLACE FUNCTION public.decay_pet_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_health integer;
    v_current_modules integer;
BEGIN
    -- Calculate current completed modules count
    SELECT count(*) INTO v_current_modules 
    FROM quests q 
    JOIN plans p ON q.plan_id = p.id 
    WHERE p.user_id = p_user_id 
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id) > 0
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id AND t.is_completed = false) = 0;

    -- Update Pet
    UPDATE public.user_pets
    SET 
        health = GREATEST(0, health - 10),
        happiness = GREATEST(0, happiness - 5),
        status = CASE 
            WHEN health - 10 <= 0 THEN 'dead' 
            ELSE status 
        END,
        -- If dying now, snapshot the current modules count
        revival_progress = CASE 
            WHEN health - 10 <= 0 AND status = 'alive' THEN v_current_modules
            ELSE revival_progress 
        END
    WHERE user_id = p_user_id AND status = 'alive';
END;
$$;

-- Function to Attempt Revival
CREATE OR REPLACE FUNCTION public.revive_pet(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pet_record RECORD;
    v_current_modules integer;
    v_modules_needed integer := 3;
    v_modules_done_since_death integer;
BEGIN
    SELECT * INTO v_pet_record FROM user_pets WHERE user_id = p_user_id AND status = 'dead';
    
    IF v_pet_record IS NULL THEN
        RAISE EXCEPTION 'No dead companion found.';
    END IF;

    -- Calculate current modules
    SELECT count(*) INTO v_current_modules 
    FROM quests q 
    JOIN plans p ON q.plan_id = p.id 
    WHERE p.user_id = p_user_id 
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id) > 0
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id AND t.is_completed = false) = 0;

    -- Calculate progress
    v_modules_done_since_death := v_current_modules - v_pet_record.revival_progress;

    IF v_modules_done_since_death >= v_modules_needed THEN
        -- Revive!
        UPDATE user_pets 
        SET status = 'alive', health = 50, happiness = 50, revival_progress = 0 
        WHERE id = v_pet_record.id;
        RETURN 'success';
    ELSE
        RETURN format('progress:%s/%s', v_modules_done_since_death, v_modules_needed);
    END IF;
END;
$$;
