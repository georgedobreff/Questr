-- Create a function to check and reset plan limits based on subscription renewal
-- This is called from the frontend on page load to ensure the UI reflects the correct state

CREATE OR REPLACE FUNCTION public.check_and_reset_plan_limit()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_subscription_updated_at timestamptz;
    v_plan_period_start timestamptz;
    v_plan_count int;
    v_purchased_credits int;
    v_has_had_trial boolean;
    v_subscription_status text;
    v_profile_record record;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get subscription details
    SELECT updated_at, status INTO v_subscription_updated_at, v_subscription_status
    FROM public.subscriptions
    WHERE user_id = v_user_id;

    -- Get profile details
    SELECT plan_generations_period_start, plan_generations_count, purchased_plan_credits, has_had_trial
    INTO v_plan_period_start, v_plan_count, v_purchased_credits, v_has_had_trial
    FROM public.profiles
    WHERE id = v_user_id;

    -- Check for reset condition
    -- Logic: If subscription updated_at is NEWER than plan_generations_period_start, it means a renewal/change occurred.
    -- We assume any subscription update (renewal, upgrade) should reset the counter if it happened after the last period start.
    IF v_subscription_updated_at IS NOT NULL AND (v_plan_period_start IS NULL OR v_plan_period_start < v_subscription_updated_at) THEN
        -- Reset the count and period start
        UPDATE public.profiles
        SET plan_generations_count = 0,
            plan_generations_period_start = NOW()
        WHERE id = v_user_id
        RETURNING plan_generations_count, plan_generations_period_start INTO v_plan_count, v_plan_period_start;
    END IF;

    -- Return the (potentially updated) profile state as JSON
    -- This matches the standard structure expected by the UI for these fields
    RETURN json_build_object(
        'plan_generations_count', COALESCE(v_plan_count, 0),
        'purchased_plan_credits', COALESCE(v_purchased_credits, 0),
        'has_had_trial', COALESCE(v_has_had_trial, false),
        'subscription_status', COALESCE(v_subscription_status, 'free')
    );
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.check_and_reset_plan_limit() TO authenticated;
