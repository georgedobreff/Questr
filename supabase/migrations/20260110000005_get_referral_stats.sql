-- Securely get referral counts for the current user
-- Date: 2026-01-10

CREATE OR REPLACE FUNCTION get_referral_stats()
RETURNS TABLE (referred_count bigint, rewarded_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM profiles WHERE referred_by = auth.uid()) AS referred_count,
    (SELECT count(*) FROM profiles WHERE referred_by = auth.uid() AND referral_rewards_claimed = TRUE) AS rewarded_count;
END;
$$;
