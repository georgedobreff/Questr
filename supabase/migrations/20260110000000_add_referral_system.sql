-- Add referral system columns and logic
-- Date: 2026-01-10

-- 1. Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_rewards_claimed BOOLEAN DEFAULT FALSE;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 3. Helper to generate random code (A-Z, 0-9)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 4. Update the new user trigger to assign a code automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  collision BOOLEAN;
BEGIN
  -- Generate unique code loop to ensure no duplicates
  LOOP
    new_code := generate_referral_code();
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO collision;
    EXIT WHEN NOT collision;
  END LOOP;

  -- Insert with the new code
  INSERT INTO public.profiles (id, referral_code)
  VALUES (new.id, new_code);
  RETURN new;
END;
$$;

-- 5. RPC to validate referral code (for Frontend usage)
-- Returns the UUID of the referrer so the frontend can attach it to the profile update
CREATE OR REPLACE FUNCTION validate_referral_code(code_input TEXT)
RETURNS TABLE (valid boolean, referrer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT true, id
  FROM profiles
  WHERE referral_code = code_input;
END;
$$;

-- 6. RPC to process internal rewards (Keys/Credits)
-- This will be called by the Stripe Webhook
CREATE OR REPLACE FUNCTION public.apply_internal_referral_rewards(p_user_id UUID)
RETURNS TABLE (referrer_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referred_by UUID;
  v_already_rewarded BOOLEAN;
BEGIN
  -- Get the referrer
  SELECT referred_by INTO v_referred_by FROM profiles WHERE id = p_user_id;
  
  -- If no referrer, stop
  IF v_referred_by IS NULL THEN
    RETURN;
  END IF;

  -- Check if rewards already claimed
  SELECT referral_rewards_claimed INTO v_already_rewarded FROM profiles WHERE id = p_user_id;
  
  IF v_already_rewarded THEN
    RETURN;
  END IF;

  -- Grant Rewards to Referrer: 5 Keys, 5 Credits
  UPDATE profiles 
  SET 
    dungeon_keys = dungeon_keys + 5,
    purchased_plan_credits = purchased_plan_credits + 5
  WHERE id = v_referred_by;

  -- Mark as claimed
  UPDATE profiles SET referral_rewards_claimed = TRUE WHERE id = p_user_id;

  -- Return the referrer ID so the webhook knows who to give the Stripe Coupon to
  referrer_id := v_referred_by;
  RETURN NEXT;
END;
$$;
