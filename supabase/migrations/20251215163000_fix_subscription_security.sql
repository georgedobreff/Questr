-- Secure the subscriptions table
-- Users should never be able to manually update their subscription status.
-- Only the Lemon Squeezy webhook (service_role) should do this.

DROP POLICY "Allow users to update their own subscription" ON public.subscriptions;

-- Ensure the select policy remains (it was created in 20251121155600)
-- "Allow users to read their own subscription"
