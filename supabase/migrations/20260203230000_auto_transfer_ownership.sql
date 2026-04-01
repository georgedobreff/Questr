-- ============================================
-- AUTO-TRANSFER GUILD OWNERSHIP ON LEAVE
-- Date: 2026-02-03
-- When guild master leaves, transfer to highest XP subscriber
-- ============================================

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
    new_master_id uuid;
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
            -- Find highest XP member who is a subscriber
            SELECT p.id INTO new_master_id
            FROM public.profiles p
            JOIN public.subscriptions s ON s.user_id = p.id AND s.status IN ('active', 'trialing')
            WHERE p.guild_id = current_guild_id
              AND p.id != auth.uid()
            ORDER BY p.xp DESC
            LIMIT 1;

            IF new_master_id IS NOT NULL THEN
                -- Transfer ownership
                UPDATE public.guilds
                SET master_id = new_master_id
                WHERE id = current_guild_id;

                -- Remove leaving master from guild
                UPDATE public.profiles
                SET guild_id = NULL, guild_joined_at = NULL
                WHERE id = auth.uid();

                -- Delete their progress
                DELETE FROM public.guild_member_progress
                WHERE guild_id = current_guild_id AND user_id = auth.uid();

                -- Decrement member count
                UPDATE public.guilds
                SET member_count = GREATEST(1, member_count - 1)
                WHERE id = current_guild_id;

                -- Send notification to new master
                INSERT INTO public.notifications (user_id, title, message, type, action_link)
                VALUES (
                    new_master_id,
                    'You are now Guild Master!',
                    'The previous Guild Master has left. You have been promoted to lead the guild.',
                    'success',
                    '/guilds/' || current_guild_id::text
                );

                RETURN;
            ELSE
                -- No eligible subscriber found
                RAISE EXCEPTION 'No eligible subscriber to transfer ownership to. Ask a Pro member to join first.';
            END IF;
        ELSE
            -- Master is the last member. Delete the guild.
            DELETE FROM public.guilds WHERE id = current_guild_id;
            UPDATE public.profiles SET guild_id = NULL, guild_joined_at = NULL WHERE id = auth.uid();
            RETURN;
        END IF;
    END IF;

    -- Regular Member Logic
    UPDATE public.profiles
    SET guild_id = NULL, guild_joined_at = NULL
    WHERE id = auth.uid();

    -- Delete their progress
    DELETE FROM public.guild_member_progress
    WHERE guild_id = current_guild_id AND user_id = auth.uid();

    -- Decrement Member Count
    UPDATE public.guilds
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = current_guild_id;
END;
$$;
