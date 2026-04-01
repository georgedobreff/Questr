'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { Quest, Task, Plan } from '@/lib/types';

export async function startGuildQuest(guildId: string, planId: number) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('master_id')
        .eq('id', guildId)
        .single();

    if (guildError || guild.master_id !== user.id) {
        return { success: false, error: 'Only the Guild Master can start a quest.' };
    }

    const { data: plan, error: planError } = await supabase
        .from('plans')
        .select(`
            *,
            quests (
                *,
                tasks (*)
            )
        `)
        .eq('id', planId)
        .single();

    if (planError || !plan) {
        return { success: false, error: 'Plan not found or validation failed.' };
    }

    const planSnapshot = {
        ...plan,
        started_at: new Date().toISOString()
    };

    await supabase.from('guild_task_completions').delete().eq('guild_id', guildId);

    const { error: updateError } = await supabase
        .from('guilds')
        .update({
            active_plan_snapshot: planSnapshot,
            quest_start_date: new Date().toISOString()
        })
        .eq('id', guildId);

    if (updateError) {
        console.error('Error starting guild quest:', updateError);
        return { success: false, error: 'Failed to start guild quest.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function startCustomGuildQuest(guildId: string, customSnapshot: Plan) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };


    const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('master_id')
        .eq('id', guildId)
        .single();

    if (guildError || guild.master_id !== user.id) {
        return { success: false, error: 'Only the Guild Master can start a quest.' };
    }


    const planSnapshot = {
        ...customSnapshot,
        started_at: new Date().toISOString()
    };


    await supabase.from('guild_task_completions').delete().eq('guild_id', guildId);

    const { error: updateError } = await supabase
        .from('guilds')
        .update({
            active_plan_snapshot: planSnapshot,
            quest_start_date: new Date().toISOString(),
            draft_plan_snapshot: null
        })
        .eq('id', guildId);

    if (updateError) {
        console.error('Error starting custom guild quest:', updateError);
        return { success: false, error: 'Failed to start custom guild quest.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function saveGuildQuestDraft(guildId: string, customSnapshot: Plan | null) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };


    const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('master_id')
        .eq('id', guildId)
        .single();

    if (guildError || guild.master_id !== user.id) {
        return { success: false, error: 'Only the Guild Master can save a quest draft.' };
    }

    const { error: updateError } = await supabase
        .from('guilds')
        .update({
            draft_plan_snapshot: customSnapshot
        })
        .eq('id', guildId);

    if (updateError) {
        console.error('Error saving draft:', updateError);
        return { success: false, error: 'Failed to save quest draft.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function updateActiveGuildQuest(guildId: string, updatedSnapshot: Plan) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };


    const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('master_id, active_plan_snapshot')
        .eq('id', guildId)
        .single();

    if (guildError || guild.master_id !== user.id) {
        return { success: false, error: 'Only the Guild Master can edit the active quest.' };
    }

    if (!guild.active_plan_snapshot) {
        return { success: false, error: 'No active quest to update.' };
    }


    const existingSnapshot = guild.active_plan_snapshot as Plan & { started_at?: string };
    const planSnapshot = {
        ...updatedSnapshot,
        started_at: existingSnapshot.started_at || new Date().toISOString()
    };

    const { error: updateError } = await supabase
        .from('guilds')
        .update({
            active_plan_snapshot: planSnapshot
        })
        .eq('id', guildId);

    if (updateError) {
        console.error('Error updating active quest:', updateError);
        return { success: false, error: 'Failed to update active quest.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function getGuildQuestStatus(guildId: string) {
    const supabase = await createServerSupabaseClient();


    const { data: guild, error } = await supabase
        .from('guilds')
        .select('quest_start_date, active_plan_snapshot, draft_plan_snapshot, member_count')
        .eq('id', guildId)
        .single();

    if (error) {
        return null;
    }

    const draftSnapshot = guild.draft_plan_snapshot as (Plan & { quests: Quest[] }) | null;

    if (!guild.active_plan_snapshot) {
        return {
            isActive: false,
            draftSnapshot
        }; // No active quest
    }

    const snapshot = guild.active_plan_snapshot as Plan & { quests: Quest[] };


    const startDate = new Date(guild.quest_start_date!);
    const now = new Date();

    const diffTime = Math.max(0, now.getTime() - startDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const currentWeek = Math.floor(diffDays / 7) + 1;
    const currentDayInModule = (diffDays % 7) + 1;

    if (!snapshot.quests || !Array.isArray(snapshot.quests)) {
        console.error("Invalid snapshot format: quests missing");
        return null;
    }


    const { data: memberProgressData } = await supabase.rpc('get_member_progress', {
        target_guild_id: guildId
    });

    const memberProgress = memberProgressData?.error ? null : memberProgressData;


    const displayWeek = memberProgress?.is_catching_up ? memberProgress.current_week : currentWeek;
    const displayDay = memberProgress?.is_catching_up ? 1 : currentDayInModule;

    const activeQuest = snapshot.quests.find((q: Quest) =>
        q.module_number === displayWeek && q.day_number === displayDay
    );


    const weeklyQuests = snapshot.quests.filter((q: Quest) => q.module_number === currentWeek);
    const weeklyTaskIds: number[] = [];
    weeklyQuests.forEach((q: Quest) => {
        if (q.tasks && Array.isArray(q.tasks)) {
            q.tasks.forEach((t: Task) => weeklyTaskIds.push(t.id));
        }
    });

    let weeklyProgress = 0;
    if (weeklyTaskIds.length > 0 && guild.member_count > 0) {
        const { count, error: countError } = await supabase
            .from('guild_task_completions')
            .select('*', { count: 'exact', head: true })
            .eq('guild_id', guildId)
            .in('task_id', weeklyTaskIds);

        if (!countError && count !== null) {
            const totalRequired = weeklyTaskIds.length * guild.member_count;
            weeklyProgress = (count / totalRequired) * 100;
        }
    }

    return {
        isActive: true, // It is active
        startDate: guild.quest_start_date,
        activePlanId: snapshot.id,
        currentWeek,
        currentDay: currentDayInModule,
        daysRemainingInWeek: 7 - currentDayInModule,
        activeQuest: activeQuest || null,
        weeklyProgress: Math.min(100, Math.max(0, weeklyProgress)),
        memberProgress,
        draftSnapshot,
        fullSnapshot: snapshot // Pass the full snapshot for editing!
    };
}

export async function completeGuildTask(guildId: string, taskId: number) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };



    const { error } = await supabase
        .from('guild_task_completions')
        .insert({
            guild_id: guildId,
            user_id: user.id,
            task_id: taskId
        });

    if (error) {
        if (error.code === '23505') return { success: true }; // Duplicate
        console.error('Error completing task:', error);
        return { success: false, error: 'Failed to complete task.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function terminateGuildQuest(guildId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };


    const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('master_id')
        .eq('id', guildId)
        .single();

    if (guildError || guild.master_id !== user.id) {
        return { success: false, error: 'Only the Guild Master can terminate a quest.' };
    }


    await supabase.from('guild_task_completions').delete().eq('guild_id', guildId);


    const { error } = await supabase
        .from('guilds')
        .update({
            active_plan_snapshot: null,
            quest_start_date: null
        })
        .eq('id', guildId);

    if (error) {
        return { success: false, error: 'Failed to terminate quest.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

export async function checkWeeklyCompletion(guildId: string, moduleNumber: number) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('check_guild_weekly_completion', {
        target_guild_id: guildId,
        module_number: moduleNumber
    });

    if (error) {
        console.error('Error checking weekly completion:', error);
        return { success: false, error: 'Failed to check weekly completion.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return data;
}

export async function getMemberProgress(guildId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('get_member_progress', {
        target_guild_id: guildId
    });

    if (error) {
        console.error('Error fetching member progress:', error);
        return null;
    }

    return data;
}

export async function advanceMemberWeek(guildId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('advance_member_week', {
        target_guild_id: guildId
    });

    if (error) {
        console.error('Error advancing member week:', error);
        return { success: false, error: 'Failed to advance week.' };
    }

    revalidatePath(`/guilds/${guildId}`);
    return data;
}

export async function getGuildMemberTaskCompletions(guildId: string, userId: string): Promise<number[]> {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
        .from('guild_task_completions')
        .select('task_id')
        .eq('guild_id', guildId)
        .eq('user_id', userId);

    return data?.map(row => row.task_id) || [];
}

export async function getMasterPlans(masterId: string) {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
        .from('plans')
        .select('id, goal_text')
        .eq('user_id', masterId)
        .order('id', { ascending: false });

    if (!data) return [];

    const uniqueTitles = new Set<string>();
    const uniquePlans: { id: number, title: string }[] = [];

    for (const p of data) {
        if (!uniqueTitles.has(p.goal_text)) {
            uniqueTitles.add(p.goal_text);
            uniquePlans.push({ id: p.id, title: p.goal_text });
        }
    }

    return uniquePlans;
}
