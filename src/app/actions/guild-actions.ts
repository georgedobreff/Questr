'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Guild, GuildActivity, GuildFeedPost, GuildEvent } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function createGuild(name: string, description: string, isPublic: boolean, category: string, restrictToPro: boolean = false) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('create_guild', {
        name,
        description,
        is_public: isPublic,
        category,
        restrict_to_pro: restrictToPro
    });

    if (error) {
        console.error('Error creating guild:', error);
        return { success: false, error: 'Failed to create guild.' };
    }

    revalidatePath('/guilds');
    revalidatePath('/profile');
    return { success: true, guildId: data };
}

export async function joinGuild(guildId: string) {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.rpc('join_guild', {
        target_guild_id: guildId
    });

    if (error) {
        console.error('Error joining guild:', error);
        return { success: false, error: 'Failed to join guild.' };
    }

    revalidatePath('/guilds');
    revalidatePath(`/guilds/${guildId}`);
    revalidatePath('/profile');
    return { success: true };
}

export async function leaveGuild() {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.rpc('leave_guild');

    if (error) {
        console.error('Error leaving guild:', error);
        return { success: false, error: 'Failed to leave guild.' };
    }

    revalidatePath('/guilds');
    revalidatePath('/profile');
    return { success: true };
}

export async function removeMember(guildId: string, memberId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('remove_guild_member', {
        target_guild_id: guildId,
        target_member_id: memberId
    });

    if (error) {
        console.error('Error removing member:', error);
        return { success: false, error: 'Failed to remove member.' };
    }

    if (data && !data.success) {
        return { success: false, error: data.error };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function getPublicGuilds() {
    const supabase = await createServerSupabaseClient();

    const { data: guilds, error } = await supabase
        .from('guilds')
        .select('*')
        .eq('is_public', true)
        .order('member_count', { ascending: false });

    if (error) {
        console.error('Error fetching guilds:', error);
        return [];
    }

    return guilds as Guild[];
}

export async function getGuildById(id: string) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(id)) return null;

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('get_guild_details', {
        target_guild_id: id
    });

    if (error || !data || data.length === 0) {
        console.error('Error fetching guild:', error);
        return null;
    }

    const guildData = data[0];
    return {
        ...guildData,
        active_plan_snapshot: null
    } as Guild & { master_name: string };
}

export async function getGuildFeed(guildId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('guild_feed')
        .select('*, profiles:user_id(full_name, character_model_path)')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching feed:', error);
        return [];
    }

    return (data ?? []) as unknown as GuildFeedPost[];
}

export async function getGuildFeedPaginated(guildId: string, page: number = 0, limit: number = 13) {
    const supabase = await createServerSupabaseClient();
    const offset = page * limit;

    const { data, error, count } = await supabase
        .from('guild_feed')
        .select('*, profiles:user_id(full_name, character_model_path)', { count: 'exact' })
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Error fetching paginated feed:', error);
        return { items: [], hasMore: false };
    }

    const items = (data ?? []) as unknown as GuildFeedPost[];
    const hasMore = count ? offset + items.length < count : false;

    return { items, hasMore };
}

export async function getGuildActivity(guildId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('guild_activity')
        .select('*, profiles:user_id(full_name, character_model_path)')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching activity:', error);
        return [];
    }

    return (data ?? []) as unknown as GuildActivity[];
}

export async function getGuildActivityPaginated(guildId: string, page: number = 0, limit: number = 13) {
    const supabase = await createServerSupabaseClient();
    const offset = page * limit;

    const { data, error, count } = await supabase
        .from('guild_activity')
        .select('*, profiles:user_id(full_name, character_model_path)', { count: 'exact' })
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Error fetching paginated activity:', error);
        return { items: [], hasMore: false };
    }

    const items = (data ?? []) as unknown as GuildActivity[];
    const hasMore = count ? offset + items.length < count : false;

    return { items, hasMore };
}

export async function getGuildMembers(guildId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('get_guild_members', {
        target_guild_id: guildId
    });

    if (error) {
        console.error('Error fetching members:', error);
        return [];
    }

    return data ?? [];
}

export async function postGuildFeed(guildId: string, content: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('guild_feed')
        .insert({
            guild_id: guildId,
            user_id: user.id,
            content
        });

    if (error) {
        console.error('Error posting to feed:', error);
        return { success: false, error: 'Post is too long.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function pinGuildPost(guildId: string, postId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('guilds')
        .update({ pinned_post_id: postId })
        .eq('id', guildId)
        .eq('master_id', user.id);

    if (error) {
        console.error('Error pinning post:', error);
        return { success: false, error: 'Failed to pin post.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function unpinGuildPost(guildId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('guilds')
        .update({ pinned_post_id: null })
        .eq('id', guildId)
        .eq('master_id', user.id);

    if (error) {
        console.error('Error unpinning post:', error);
        return { success: false, error: 'Failed to unpin post.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function updateGuildRules(guildId: string, rules: string[]) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('guilds')
        .update({ rules })
        .eq('id', guildId)
        .eq('master_id', user.id);

    if (error) {
        console.error('Error updating rules:', error);
        return { success: false, error: 'Failed to update rules.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function updateGuildDetails(
    guildId: string,
    name: string,
    description: string,
    category: string,
    restrictToPro?: boolean
) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const updatePayload: any = {
        name: name.trim(),
        description: description.trim(),
        category: category.trim()
    };
    if (restrictToPro !== undefined) {
        updatePayload.restrict_to_pro = restrictToPro;
    }

    const { error } = await supabase
        .from('guilds')
        .update(updatePayload)
        .eq('id', guildId)
        .eq('master_id', user.id);

    if (error) {
        console.error('Error updating guild details:', error);
        return { success: false, error: 'Failed to update guild details.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    revalidatePath('/guilds');
    return { success: true };
}

export async function getGuildEvents(guildId: string): Promise<GuildEvent[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('guild_events')
        .select('*')
        .eq('guild_id', guildId)
        .order('event_date', { ascending: true });

    if (error) {
        console.error('Error fetching events:', error);
        return [];
    }

    return data as GuildEvent[];
}

export async function createGuildEvent(
    guildId: string,
    title: string,
    description: string | null,
    eventDate: string
) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('guild_events')
        .insert({
            guild_id: guildId,
            title: title.trim(),
            description: description?.trim() || null,
            event_date: eventDate,
            created_by: user.id
        });

    if (error) {
        console.error('Error creating event:', error);
        return { success: false, error: 'Failed to create event.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function updateGuildEvent(
    eventId: string,
    guildId: string,
    title: string,
    description: string | null,
    eventDate: string
) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('master_id')
        .eq('id', guildId)
        .single();

    if (guildError || guild.master_id !== user.id) {
        return { success: false, error: 'Only the Guild Master can update events.' };
    }

    const { error } = await supabase
        .from('guild_events')
        .update({
            title: title.trim(),
            description: description?.trim() || null,
            event_date: eventDate
        })
        .eq('id', eventId)
        .eq('guild_id', guildId);

    if (error) {
        console.error('Error updating event:', error);
        return { success: false, error: 'Failed to update event.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function deleteGuildEvent(eventId: string, guildId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('master_id')
        .eq('id', guildId)
        .single();

    if (guildError || guild.master_id !== user.id) {
        return { success: false, error: 'Only the Guild Master can delete events.' };
    }

    const { error } = await supabase
        .from('guild_events')
        .delete()
        .eq('id', eventId)
        .eq('guild_id', guildId);

    if (error) {
        console.error('Error deleting event:', error);
        return { success: false, error: 'Failed to delete event.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}
