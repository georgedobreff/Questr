-- Allow free users to enter dungeon if they have resources
-- Replaces previous strict subscription check with a more flexible one

CREATE OR REPLACE FUNCTION public.enter_dungeon(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ap int;
    v_keys int;
BEGIN
    -- Resources Check (Subscription check removed)
    SELECT action_points, dungeon_keys INTO v_ap, v_keys
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF v_ap >= 12 AND v_keys >= 1 THEN
        UPDATE public.profiles
        SET action_points = action_points - 12,
            dungeon_keys = dungeon_keys - 1
        WHERE id = p_user_id;
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object(
            'success', false, 
            'error', CASE 
                WHEN v_ap < 12 THEN 'Not enough Action Points (12 required)'
                WHEN v_keys < 1 THEN 'No Dungeon Keys remaining'
                ELSE 'Insufficient resources'
            END
        );
    END IF;
END;
$$;
