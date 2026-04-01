-- Trigger function to handle awarding dungeon keys based on subscription changes
-- UPDATED: Increased paid tier reward to 5 keys.

CREATE OR REPLACE FUNCTION public.handle_subscription_key_awards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key_amount integer;
BEGIN
    -- Check if the status transitioned to trialing/active OR if the period was extended (renewal)
    -- We use stripe_current_period_end as the marker for a new billing cycle
    IF (NEW.status IN ('trialing', 'active')) AND 
       (OLD.status IS NULL OR OLD.status = 'free' OR NEW.stripe_current_period_end > OLD.stripe_current_period_end OR NEW.status != OLD.status) THEN
        
        -- Logic: 1 Key for Trial, 5 for Paid
        IF NEW.status = 'trialing' AND (OLD.status IS NULL OR OLD.status = 'free') THEN
            v_key_amount := 1;
        ELSIF NEW.status = 'active' THEN
            v_key_amount := 5;
        ELSE
            -- No keys for status transitions that don't involve starting/renewing
            RETURN NEW;
        END IF;

        -- Award the keys
        UPDATE public.profiles
        SET dungeon_keys = dungeon_keys + v_key_amount
        WHERE id = NEW.user_id;

        RAISE NOTICE 'Awarded % dungeon keys to user %', v_key_amount, NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Apply the trigger to the subscriptions table
DROP TRIGGER IF EXISTS on_subscription_reward ON public.subscriptions;
CREATE TRIGGER on_subscription_reward
    AFTER INSERT OR UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_subscription_key_awards();
