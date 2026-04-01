ALTER TABLE public.profiles
ADD COLUMN purchased_plan_credits INTEGER DEFAULT 0 NOT NULL;

CREATE OR REPLACE FUNCTION public.increment_plan_credits(user_id_input UUID, amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET purchased_plan_credits = purchased_plan_credits + amount
  WHERE id = user_id_input;
END;
$$;
