import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClientPage } from "./dashboard-client-page";
import { getGuildFeedPaginated } from "@/app/actions/guild-actions";
import type { Plan, Quest, Task, UserPet, GuildFeedPost } from "@/lib/types";

export default async function DashboardPage() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");


    const [
        profileRes,
        plansRes,
        petRes
    ] = await Promise.all([
        supabase.from("profiles").select("guild_id").eq("id", user.id).single(),
        supabase.from("plans").select("*, quests(*, tasks(*))").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("user_pets").select("*, pet_definitions(*)").eq("user_id", user.id).maybeSingle()
    ]);

    const profile = profileRes.data;
    const activePlan = (plansRes.data as Plan[] | null)?.[0] ?? null;
    const userPet = petRes.data as UserPet | null;


    let guildFeed: GuildFeedPost[] = [];
    let guildName: string | null = null;
    let guildFeedHasMore = false;
    if (profile?.guild_id) {
        const [feedRes, guildRes] = await Promise.all([
            getGuildFeedPaginated(profile.guild_id, 0, 13),
            supabase.from("guilds").select("name").eq("id", profile.guild_id).single()
        ]);
        guildFeed = feedRes.items;
        guildFeedHasMore = feedRes.hasMore;
        guildName = guildRes.data?.name ?? null;
    }

    let currentQuest: Quest | null = null;
    let isBossStage = false;
    let bossStory: string | null = null;

    if (activePlan?.quests) {
        const quests = activePlan.quests as Quest[];
        const sortedByModule = quests.sort((a, b) =>
            a.module_number - b.module_number || a.day_number - b.day_number
        );


        const { data: bossFights } = await supabase
            .from("boss_fights")
            .select("module_number, status, story_plot")
            .eq("plan_id", activePlan.id)
            .eq("user_id", user.id);

        const questsByModule = (activePlan.quests || []).reduce((acc: Record<number, Quest[]>, quest: Quest) => {
            const moduleNum = quest.module_number;
            if (!acc[moduleNum]) acc[moduleNum] = [];
            acc[moduleNum].push(quest);
            return acc;
        }, {});

        const sortedModuleNumbers = Object.keys(questsByModule).map(Number).sort((a, b) => a - b);

        for (const modNum of sortedModuleNumbers) {
            const tasksInModule = questsByModule[modNum].flatMap((q: Quest) => q.tasks);
            const uncompletedCount = tasksInModule.filter((t: Task) => !t.is_completed).length;
            const bossForModule = bossFights?.find(f => f.module_number === modNum);
            const isBossDefeated = bossForModule?.status === 'defeated';

            if (uncompletedCount > 0) {
                const sortedQuests = questsByModule[modNum].sort((a, b) => a.day_number - b.day_number);
                for (const q of sortedQuests) {
                    if (q.tasks.some((t: Task) => !t.is_completed)) {
                        currentQuest = q;
                        break;
                    }
                }
                break;
            } else if (!isBossDefeated) {
                isBossStage = true;
                bossStory = bossForModule?.story_plot ?? null;
                break;
            }
        }
    }

    return (
        <DashboardClientPage
            currentQuest={currentQuest}
            planId={activePlan?.id ?? null}
            pet={userPet}
            guildId={profile?.guild_id ?? null}
            guildName={guildName}
            guildFeed={guildFeed}
            guildFeedHasMore={guildFeedHasMore}
            isBossStage={isBossStage}
            bossStory={bossStory}
        />
    );
}
