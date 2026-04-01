-- Function to decay pet stats (called daily via update_activity)
CREATE OR REPLACE FUNCTION public.decay_pet_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.user_pets
    SET 
        health = GREATEST(0, health - 10),
        happiness = GREATEST(0, happiness - 5)
    WHERE user_id = p_user_id AND status = 'alive';
END;
$$;

-- Function to heal pet (called on task completion)
CREATE OR REPLACE FUNCTION public.heal_pet_on_task(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.user_pets
    SET 
        health = LEAST(100, health + 5),
        happiness = LEAST(100, happiness + 2)
    WHERE user_id = p_user_id AND status = 'alive';
END;
$$;

-- Update 'update_activity' to call decay (modify existing function)
-- I need to DROP and RECREATE it to add the call.
-- Actually, I'll just CREATE OR REPLACE it.

CREATE OR REPLACE FUNCTION public.update_activity(p_timezone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_last_login timestamptz;
    v_current_streak integer;
    v_longest_streak integer;
    
    v_now_utc timestamptz := now();
    v_today_local date;
    v_last_login_local date;
    v_yesterday_local date;
BEGIN
    SELECT last_login_at, current_streak, longest_streak 
    INTO v_last_login, v_current_streak, v_longest_streak
    FROM profiles
    WHERE id = v_user_id;

    UPDATE profiles SET timezone = p_timezone WHERE id = v_user_id;

    v_today_local := date(v_now_utc AT TIME ZONE p_timezone);
    v_last_login_local := date(v_last_login AT TIME ZONE p_timezone);
    v_yesterday_local := v_today_local - integer '1';

    -- Streak Logic
    IF v_current_streak = 0 THEN
        v_current_streak := 1;
        UPDATE profiles SET current_streak = 1, last_login_at = v_now_utc WHERE id = v_user_id;
    ELSIF v_last_login_local = v_today_local THEN
        NULL; -- Already processed today
    ELSIF v_last_login_local = v_yesterday_local THEN
        v_current_streak := v_current_streak + 1;
        IF v_current_streak > v_longest_streak THEN
            v_longest_streak := v_current_streak;
        END IF;
        UPDATE profiles SET current_streak = v_current_streak, longest_streak = v_longest_streak, last_login_at = v_now_utc WHERE id = v_user_id;
        PERFORM check_achievements(v_user_id);
        
        -- Decay Pet Stats (Only once per day)
        PERFORM public.decay_pet_stats(v_user_id);
        
    ELSE
        -- Missed a day
        v_current_streak := 1;
        UPDATE profiles SET current_streak = 1, last_login_at = v_now_utc WHERE id = v_user_id;
        
        -- Decay Pet Stats (Multiplied by missed days? For now just once to be kind, or maybe harsher?)
        -- Let's just decay once per login event to avoid killing it instantly after a vacation.
        PERFORM public.decay_pet_stats(v_user_id);
    END IF;
END;
$$;

-- Update 'add_rewards' to call heal_pet_on_task
-- I need to recreate add_rewards to include the call.
CREATE OR REPLACE FUNCTION public.add_rewards(user_id_input uuid, coin_amount integer, xp_amount integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    coins = coins + coin_amount,
    xp = xp + xp_amount,
    updated_at = now()
  WHERE id = user_id_input;
  
  -- Heal Pet
  PERFORM public.heal_pet_on_task(user_id_input);
END;
$$;
