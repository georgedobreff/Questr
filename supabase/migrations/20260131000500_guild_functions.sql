-- Create Guild RPC
CREATE OR REPLACE FUNCTION create_guild(
    name text,
    description text,
    is_public boolean,
    category text DEFAULT NULL
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
    INSERT INTO public.guilds (name, description, master_id, is_public, category, member_count)
    VALUES (name, description, auth.uid(), is_public, category, 1) -- Start with 1 member
    RETURNING id INTO new_guild_id;

    -- Auto-join the creator
    UPDATE public.profiles
    SET guild_id = new_guild_id
    WHERE id = auth.uid();

    RETURN new_guild_id;
END;
$$;

-- Join Guild RPC
CREATE OR REPLACE FUNCTION join_guild(target_guild_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_guild_id uuid;
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

-- Leave Guild RPC
CREATE OR REPLACE FUNCTION leave_guild()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_guild_id uuid;
    is_master boolean;
BEGIN
    -- Get current guild
    SELECT guild_id INTO current_guild_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF current_guild_id IS NULL THEN
        RAISE EXCEPTION 'You are not in a guild.';
    END IF;

    -- Check if master (Cannot leave if master, must transfer or delete - keeping simple for now: prevent leave)
    -- Or we could allow recursive delete / master reassignment. For MVP: Prevent leaving if master.
    IF EXISTS (SELECT 1 FROM public.guilds WHERE id = current_guild_id AND master_id = auth.uid()) THEN
        RAISE EXCEPTION 'Guild Masters cannot leave their own guild. You must delete the guild or transfer ownership.';
    END IF;

    -- Update Profile
    UPDATE public.profiles
    SET guild_id = NULL
    WHERE id = auth.uid();

    -- Decrement Member Count
    UPDATE public.guilds
    SET member_count = member_count - 1
    WHERE id = current_guild_id;
END;
$$;
