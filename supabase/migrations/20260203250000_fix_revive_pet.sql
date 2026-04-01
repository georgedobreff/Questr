-- Fix revive_pet function to validate caller is the pet owner
-- This ensures users can only revive their own pets

CREATE OR REPLACE FUNCTION public.revive_pet(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid;
    v_pet_record RECORD;
    v_current_modules integer;
    v_modules_needed integer := 3;
    v_modules_done_since_death integer;
BEGIN
    -- Get the caller's ID
    v_caller_id := auth.uid();
    
    -- Security check: caller must match p_user_id
    IF v_caller_id IS NULL OR v_caller_id != p_user_id THEN
        RAISE EXCEPTION 'Permission denied: You can only revive your own companion.';
    END IF;

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
    v_modules_done_since_death := v_current_modules - COALESCE(v_pet_record.revival_progress, 0);

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

-- Grant execute permission to authenticated users only
REVOKE ALL ON FUNCTION public.revive_pet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revive_pet(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revive_pet(uuid) TO authenticated;
