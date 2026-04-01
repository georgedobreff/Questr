-- Fixed leave_guild logic based on strict requirements:
-- 1. Guild Master CANNOT leave if there are other members (member_count > 1).
-- 2. Guild Master CAN leave if they are the only member (member_count = 1). In this case, the guild is DELETED.
-- 3. Regular members can always leave.

CREATE OR REPLACE FUNCTION leave_guild()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_guild_id uuid;
    is_master boolean;
    current_member_count int;
BEGIN
    -- Get current guild and member count
    SELECT p.guild_id, g.member_count, (g.master_id = auth.uid())
    INTO current_guild_id, current_member_count, is_master
    FROM public.profiles p
    LEFT JOIN public.guilds g ON p.guild_id = g.id
    WHERE p.id = auth.uid();

    IF current_guild_id IS NULL THEN
        RAISE EXCEPTION 'You are not in a guild.';
    END IF;

    -- Master Logic
    IF is_master THEN
        IF current_member_count > 1 THEN
            RAISE EXCEPTION 'Guild Masters cannot leave while there are other members. Transfer ownership first.';
        ELSE
            -- Master is the last member. Delete the guild.
            -- This will cascade to profiles.guild_id via ON DELETE SET NULL (or we update manually to be safe)
            -- and delete feed/activity via ON DELETE CASCADE.
            DELETE FROM public.guilds WHERE id = current_guild_id;
            
            -- Explicitly update profile just in case (though cascade should handle it)
            UPDATE public.profiles SET guild_id = NULL WHERE id = auth.uid();
            RETURN;
        END IF;
    END IF;

    -- Regular Member Logic
    UPDATE public.profiles
    SET guild_id = NULL
    WHERE id = auth.uid();

    -- Decrement Member Count
    UPDATE public.guilds
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = current_guild_id;
END;
$$;
