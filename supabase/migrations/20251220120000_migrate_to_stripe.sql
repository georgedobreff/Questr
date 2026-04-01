-- Migration to replace Lemon Squeezy fields with Stripe fields
-- We are keeping the old columns for now to prevent data loss during migration, 
-- but you can drop them later once satisfied.

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS stripe_price_id text,
ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;

-- Add an index for faster lookups on Stripe fields
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
