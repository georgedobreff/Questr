-- Add restrict_to_pro column to guilds table
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS restrict_to_pro BOOLEAN DEFAULT false;

-- Overwrite create_guild to include restrict_to_pro
CREATE OR REPLACE FUNCTION create_guild(
    name text,
    description text,
    is_public boolean,
    category text DEFAULT NULL,
    restrict_to_pro boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Required to update profiles.guild_id
SET search_path = public -- Secure search path
AS $$
DECLARE
    new_guild_id uuid;
    user_subscription_status text;
BEGIN
    -- Input normalization
    name := TRIM(name);
    description := TRIM(description);

    -- Check Subscription (Must be Pro, Active, or Trialing)
    SELECT status INTO user_subscription_status
    FROM public.subscriptions
    WHERE user_id = auth.uid();

    IF user_subscription_status NOT IN ('active', 'trialing', 'pro') THEN
        RAISE EXCEPTION 'Only Pro users can create guilds.';
    END IF;

    -- Check uniqueness (Case insensitive)
    IF EXISTS (SELECT 1 FROM public.guilds WHERE lower(guilds.name) = lower(create_guild.name)) THEN
        RAISE EXCEPTION 'Guild name already exists.';
    END IF;

    -- Insert Guild
    INSERT INTO public.guilds (name, description, master_id, is_public, category, member_count, restrict_to_pro)
    VALUES (name, description, auth.uid(), is_public, category, 1, restrict_to_pro) -- Start with 1 member
    RETURNING id INTO new_guild_id;

    -- Auto-join the creator
    UPDATE public.profiles
    SET guild_id = new_guild_id
    WHERE id = auth.uid();

    RETURN new_guild_id;
END;
$$;

-- Update join_guild RPC to enforce restrict_to_pro
CREATE OR REPLACE FUNCTION join_guild(target_guild_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_guild_id uuid;
    is_restricted boolean;
    user_subscription_status text;
BEGIN
    -- Check if user is already in a guild
    SELECT guild_id INTO current_guild_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF current_guild_id IS NOT NULL THEN
        IF current_guild_id = target_guild_id THEN
            RAISE EXCEPTION 'You are already a member of this guild.';
        ELSE
            RAISE EXCEPTION 'You must leave your current guild before joining another.';
        END IF;
    END IF;

    -- Check if guild is restricted to Pro users
    SELECT restrict_to_pro INTO is_restricted
    FROM public.guilds
    WHERE id = target_guild_id;

    IF is_restricted THEN
        SELECT status INTO user_subscription_status
        FROM public.subscriptions
        WHERE user_id = auth.uid();

        IF user_subscription_status NOT IN ('active', 'trialing', 'pro') THEN
            RAISE EXCEPTION 'This guild is restricted to Pro members only.';
        END IF;
    END IF;

    -- Update Profile
    UPDATE public.profiles
    SET guild_id = target_guild_id
    WHERE id = auth.uid();

    -- Increment Member Count
    UPDATE public.guilds
    SET member_count = member_count + 1
    WHERE id = target_guild_id;
END;
$$;
