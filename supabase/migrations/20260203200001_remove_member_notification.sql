-- ============================================
-- UPDATE REMOVE MEMBER RPC TO ADD NOTIFICATION
-- Date: 2026-02-03
-- ============================================

CREATE OR REPLACE FUNCTION remove_guild_member(target_guild_id uuid, target_member_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id uuid;
    guild_master_id uuid;
    member_guild_id uuid;
    guild_name_text text;
BEGIN
    -- Get caller
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Get guild master and name
    SELECT master_id, name INTO guild_master_id, guild_name_text 
    FROM guilds WHERE id = target_guild_id;
    
    IF guild_master_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guild not found');
    END IF;

    -- Verify caller is master
    IF caller_id != guild_master_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the guild master can remove members');
    END IF;

    -- Cannot remove yourself
    IF caller_id = target_member_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot remove yourself. Use leave guild instead.');
    END IF;

    -- Verify target is a member of this guild
    SELECT guild_id INTO member_guild_id FROM profiles WHERE id = target_member_id;
    IF member_guild_id IS NULL OR member_guild_id != target_guild_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'User is not a member of this guild');
    END IF;

    -- Remove member from guild
    UPDATE profiles 
    SET guild_id = NULL, guild_joined_at = NULL 
    WHERE id = target_member_id;

    -- Delete their progress record if exists
    DELETE FROM guild_member_progress 
    WHERE guild_id = target_guild_id AND user_id = target_member_id;

    -- Decrement member count
    UPDATE guilds 
    SET member_count = GREATEST(1, member_count - 1) 
    WHERE id = target_guild_id;

    -- Send notification to the removed member
    INSERT INTO notifications (user_id, title, message, type, action_link)
    VALUES (
        target_member_id,
        'Removed from Guild',
        'You have been removed from ' || guild_name_text || '.',
        'warning',
        '/guilds'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
