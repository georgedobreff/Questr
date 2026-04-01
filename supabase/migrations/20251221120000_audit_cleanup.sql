-- 1. Create table for Idempotency
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    stripe_event_id text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (id)
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read this table
CREATE POLICY "Service role only" ON public.processed_webhook_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Harden add_coins (Input Validation)
CREATE OR REPLACE FUNCTION public.add_coins(user_id_input uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET coins = coins + amount, updated_at = now()
  WHERE id = user_id_input;
END;
$$;

-- 3. Harden increment_plan_credits (Input Validation)
CREATE OR REPLACE FUNCTION public.increment_plan_credits(user_id_input UUID, amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET purchased_plan_credits = purchased_plan_credits + amount
  WHERE id = user_id_input;
END;
$$;
