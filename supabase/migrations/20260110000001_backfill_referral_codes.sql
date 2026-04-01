-- Backfill referral codes for existing users
-- Date: 2026-01-10

DO $$
DECLARE
  r RECORD;
  new_code TEXT;
  collision BOOLEAN;
BEGIN
  -- Loop through all profiles that don't have a code yet
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    
    -- Generate unique code loop (same logic as the trigger)
    LOOP
      new_code := generate_referral_code();
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO collision;
      EXIT WHEN NOT collision;
    END LOOP;

    -- Update the specific profile
    UPDATE public.profiles
    SET referral_code = new_code
    WHERE id = r.id;
    
  END LOOP;
END;
$$;
