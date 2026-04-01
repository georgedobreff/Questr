-- Create master_revenue_ledgers table
CREATE TABLE IF NOT EXISTS public.master_revenue_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- The Guild Master
    source_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- The Member who paid
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for master_revenue_ledgers
ALTER TABLE public.master_revenue_ledgers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view their own ledgers" ON public.master_revenue_ledgers
    FOR SELECT USING (auth.uid() = user_id);

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests" ON public.withdrawal_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests" ON public.withdrawal_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Function to get the current balance for a master
CREATE OR REPLACE FUNCTION get_guild_master_balance(master_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_revenue integer;
    total_withdrawn integer;
    pending_withdrawals integer;
BEGIN
    -- Sum of all revenue
    SELECT COALESCE(SUM(amount_cents), 0) INTO total_revenue
    FROM public.master_revenue_ledgers
    WHERE user_id = master_id;

    -- Sum of paid withdrawals
    SELECT COALESCE(SUM(amount_cents), 0) INTO total_withdrawn
    FROM public.withdrawal_requests
    WHERE user_id = master_id AND status = 'paid';

    -- Sum of pending/approved withdrawals (funds are locked)
    SELECT COALESCE(SUM(amount_cents), 0) INTO pending_withdrawals
    FROM public.withdrawal_requests
    WHERE user_id = master_id AND status IN ('pending', 'approved');

    RETURN total_revenue - total_withdrawn - pending_withdrawals;
END;
$$;
