-- Add skill_points to profiles safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'skill_points') THEN
        ALTER TABLE public.profiles ADD COLUMN skill_points integer DEFAULT 0 NOT NULL;
    END IF;
END $$;

-- Update process_level_up to award skill points
CREATE OR REPLACE FUNCTION public.process_level_up(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_level int;
  v_xp int;
  v_threshold int;
  v_leveled_up boolean := false;
  v_points_gained int := 0;
  v_points_for_this_level int;
BEGIN
  -- Get current state
  SELECT level, xp INTO v_level, v_xp FROM public.profiles WHERE id = p_user_id;

  -- Loop to handle multiple level-ups
  LOOP
    v_threshold := public.get_xp_threshold(v_level);
    
    IF v_xp >= v_threshold THEN
      v_xp := v_xp - v_threshold;
      v_level := v_level + 1;
      
      -- Calculate Skill Points for this specific new level
      -- Level 1-9: 1 point
      -- Level 10-19: 2 points
      -- Level 20-29: 3 points
      v_points_for_this_level := FLOOR(v_level / 10) + 1;
      v_points_gained := v_points_gained + v_points_for_this_level;
      
      v_leveled_up := true;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  IF v_leveled_up THEN
    UPDATE public.profiles 
    SET 
      level = v_level, 
      xp = v_xp,
      skill_points = skill_points + v_points_gained
    WHERE id = p_user_id;

    -- Log achievement progress for leveling
    PERFORM public.check_achievements(p_user_id);
  END IF;
END;
$$;

-- Function to spend skill points
CREATE OR REPLACE FUNCTION public.spend_skill_point(p_stat_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_current_points integer;
  v_stat_id bigint;
BEGIN
  v_user_id := auth.uid();
  
  -- Check points
  SELECT skill_points INTO v_current_points FROM public.profiles WHERE id = v_user_id;
  
  IF v_current_points IS NULL OR v_current_points < 1 THEN
    RAISE EXCEPTION 'Not enough skill points.';
  END IF;

  -- Find the stat to upgrade. 
  -- We target the stat belonging to the most recently created plan for this user.
  SELECT us.id INTO v_stat_id
  FROM public.user_stats us
  JOIN public.plans p ON us.plan_id = p.id
  WHERE us.user_id = v_user_id AND us.name = p_stat_name
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_stat_id IS NULL THEN
    RAISE EXCEPTION 'Stat not found.';
  END IF;

  -- Perform updates
  UPDATE public.profiles SET skill_points = skill_points - 1 WHERE id = v_user_id;
  UPDATE public.user_stats SET value = value + 1 WHERE id = v_stat_id;
END;
$$;
