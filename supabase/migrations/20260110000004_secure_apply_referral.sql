-- Securely apply referral code (Validate & Link)
-- Date: 2026-01-10

CREATE OR REPLACE FUNCTION apply_referral_code(code_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_is_active BOOLEAN;
BEGIN
  -- 1. Find the referrer ID
  SELECT id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = code_input;

  -- If code doesn't exist, return false
  IF v_referrer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Check Referrer's Subscription Status
  -- We allow 'active' or 'trialing'.
  SELECT EXISTS (
    SELECT 1 
    FROM subscriptions 
    WHERE user_id = v_referrer_id 
    AND status IN ('active', 'trialing')
  ) INTO v_is_active;

  IF NOT v_is_active THEN
    RETURN FALSE;
  END IF;

  -- 3. Apply the Link
  -- Update the current user's profile (auth.uid())
  UPDATE profiles
  SET referred_by = v_referrer_id
  WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;
