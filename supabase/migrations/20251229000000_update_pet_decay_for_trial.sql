-- Update decay_pet_stats to double decay for non-subscribers
CREATE OR REPLACE FUNCTION public.decay_pet_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_health integer;
    v_current_modules integer;
    v_subscription_status text;
    v_decay_amount integer := 10;
BEGIN
    -- Check Subscription Status
    SELECT status INTO v_subscription_status FROM public.subscriptions WHERE user_id = p_user_id;

    -- If not active, trialing, or pro, double the decay
    IF v_subscription_status NOT IN ('active', 'trialing', 'pro') THEN
        v_decay_amount := 20;
    END IF;

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
        health = GREATEST(0, health - v_decay_amount),
        happiness = GREATEST(0, happiness - 5),
        status = CASE 
            WHEN health - v_decay_amount <= 0 THEN 'dead' 
            ELSE status 
        END,
        -- If dying now, snapshot the current modules count
        revival_progress = CASE 
            WHEN health - v_decay_amount <= 0 AND status = 'alive' THEN v_current_modules
            ELSE revival_progress 
        END
    WHERE user_id = p_user_id AND status = 'alive';
END;
$$;
