-- ============================================
-- REMOVE MEMBER FROM GUILD RPC
-- Allows guild master to remove members
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
BEGIN
    -- Get caller
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Get guild master
    SELECT master_id INTO guild_master_id FROM guilds WHERE id = target_guild_id;
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

    RETURN jsonb_build_object('success', true);
END;
$$;
