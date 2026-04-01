-- Add timezone and streak columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0;

-- Add completed_at to tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Trigger to automatically set completed_at when a task is completed
CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        NEW.completed_at = now();
    ELSIF NEW.is_completed = false THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_task_completed_at ON public.tasks;
CREATE TRIGGER trigger_set_task_completed_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_completed_at();

-- RPC to update user activity (timezone + login streak)
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
    -- Get current profile data
    SELECT last_login_at, current_streak, longest_streak 
    INTO v_last_login, v_current_streak, v_longest_streak
    FROM profiles
    WHERE id = v_user_id;

    -- Update timezone immediately
    UPDATE profiles SET timezone = p_timezone WHERE id = v_user_id;

    -- Calculate Dates in User's Timezone
    v_today_local := date(v_now_utc AT TIME ZONE p_timezone);
    v_last_login_local := date(v_last_login AT TIME ZONE p_timezone);
    v_yesterday_local := v_today_local - integer '1';

    -- Streak Logic
    IF v_current_streak = 0 THEN
        -- First time tracking streak, set to 1
        v_current_streak := 1;
        UPDATE profiles 
        SET current_streak = 1, last_login_at = v_now_utc
        WHERE id = v_user_id;
    ELSIF v_last_login_local = v_today_local THEN
        -- Already logged in today, do nothing to streak
        NULL;
    ELSIF v_last_login_local = v_yesterday_local THEN
        -- Logged in yesterday, increment streak
        v_current_streak := v_current_streak + 1;
        
        -- Update longest streak if needed
        IF v_current_streak > v_longest_streak THEN
            v_longest_streak := v_current_streak;
        END IF;
        
        UPDATE profiles 
        SET current_streak = v_current_streak, longest_streak = v_longest_streak, last_login_at = v_now_utc
        WHERE id = v_user_id;
        
        -- Check achievements
        PERFORM check_achievements(v_user_id);
        
    ELSE
        -- Missed a day (or more), reset streak
        v_current_streak := 1;
        UPDATE profiles 
        SET current_streak = 1, last_login_at = v_now_utc
        WHERE id = v_user_id;
    END IF;

END;
$$;
