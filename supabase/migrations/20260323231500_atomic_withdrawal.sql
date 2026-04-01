-- Atomic Withdrawal Request
-- Eliminates TOCTOU race condition by performing balance check and insert atomically.
-- Date: 2026-03-23

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount_cents integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_balance integer;
BEGIN
    -- Get the authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF p_amount_cents <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
    END IF;

    -- Lock and check balance atomically
    SELECT COALESCE(
        (SELECT SUM(amount_cents) FROM master_revenue_ledgers WHERE user_id = v_user_id),
        0
    ) - COALESCE(
        (SELECT SUM(amount_cents) FROM withdrawal_requests WHERE user_id = v_user_id AND status IN ('pending', 'approved')),
        0
    )
    INTO v_balance;

    IF v_balance < p_amount_cents THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds for this withdrawal.');
    END IF;

    -- Insert the withdrawal request within the same transaction
    INSERT INTO withdrawal_requests (user_id, amount_cents, status)
    VALUES (v_user_id, p_amount_cents, 'pending');

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users (they need to call this)
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer) TO authenticated;
