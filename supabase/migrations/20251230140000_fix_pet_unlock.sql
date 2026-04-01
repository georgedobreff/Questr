-- Update Pet Unlock Requirement to First Day
-- Tuesday, 30 December 2025

CREATE OR REPLACE FUNCTION public.adopt_pet(p_pet_def_id text, p_nickname text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_is_day_one_completed boolean;
BEGIN
    -- Check if user already has a pet
    IF EXISTS (SELECT 1 FROM public.user_pets WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'You already have a companion.';
    END IF;

    -- Check if user completed the first day (Module 1, Day 1)
    SELECT EXISTS (
        SELECT 1
        FROM quests q 
        JOIN plans p ON q.plan_id = p.id 
        WHERE p.user_id = v_user_id 
        AND q.module_number = 1
        AND q.day_number = 1
        AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id) > 0
        AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id AND t.is_completed = false) = 0
    ) INTO v_is_day_one_completed;

    IF NOT v_is_day_one_completed THEN
        RAISE EXCEPTION 'You must complete your first day to unlock a companion.';
    END IF;

    INSERT INTO public.user_pets (user_id, pet_def_id, nickname)
    VALUES (v_user_id, p_pet_def_id, p_nickname);
END;
$$;
