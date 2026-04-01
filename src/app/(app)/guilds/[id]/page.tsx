import { getGuildById, getGuildFeedPaginated, getGuildActivityPaginated, getGuildMembers, getGuildEvents } from '@/app/actions/guild-actions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CombinedFeed } from '@/components/guilds/combined-feed';
import { Leaderboard } from '@/components/guilds/leaderboard';
import { LeaveGuildButton } from '@/components/guilds/leave-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { redirect, notFound } from 'next/navigation';
import { Users, MessageSquare, Trophy, Crown, Tag, Calendar, Settings, Pin, ScrollText, Map } from 'lucide-react';
import { GuildActivity, GuildFeedPost } from '@/lib/types';
import { JoinGuildButton } from '@/components/guilds/join-button';
import { GuildRulesCard } from '@/components/guilds/guild-rules-card';
import { getGuildQuestStatus, getGuildMemberTaskCompletions, getMasterPlans } from '@/app/actions/guild-quest-actions';
import { GuildSettingsTab } from '@/components/guilds/settings-tab';
import { QuestTab } from '@/components/guilds/quest-tab';
import { EventsTab } from '@/components/guilds/events-tab';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function GuildDashboardPage({ params }: PageProps) {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const guild = await getGuildById(id);
    if (!guild) notFound();

    const { data: profile } = await supabase
        .from('profiles')
        .select('guild_id')
        .eq('id', user.id)
        .single();

    const isMember = profile?.guild_id === guild.id;
    const isMaster = guild.master_id === user.id;

    // Check if user has pro subscription
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle();

    const isPro = !!subscription;

    let activity: GuildActivity[] = [];
    let feed: GuildFeedPost[] = [];
    let feedHasMore = false;
    let activityHasMore = false;
    const members = await getGuildMembers(id);

    // Fetch Guild Quest Data
    const questStatus = await getGuildQuestStatus(guild.id);
    const completedTaskIds = await getGuildMemberTaskCompletions(guild.id, user.id);

    // If master, fetch plans for selection
    const availablePlans = isMaster ? await getMasterPlans(user.id) : [];

    if (isMember) {
        const [feedRes, activityRes] = await Promise.all([
            getGuildFeedPaginated(id, 0, 13),
            getGuildActivityPaginated(id, 0, 13)
        ]);
        feed = feedRes.items;
        feedHasMore = feedRes.hasMore;
        activity = activityRes.items;
        activityHasMore = activityRes.hasMore;
    }

    const events = isMember ? await getGuildEvents(id) : [];

    const masterName = (guild as typeof guild & { master_name?: string }).master_name ?? 'Questr';

    let pinnedPost: GuildFeedPost | null = null;
    if (guild.pinned_post_id) {
        const { data } = await supabase
            .from('guild_feed')
            .select('*, profiles:user_id(full_name, character_model_path)')
            .eq('id', guild.pinned_post_id)
            .single();
        if (data) pinnedPost = data as unknown as GuildFeedPost;
    }

    return (
        <div className="container mx-auto pt-24 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8 space-y-8 px-4">
            <div className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 opacity-50" />

                <div className="relative py-1 px-6 md:py-2 md:px-10 flex flex-col items-center justify-center gap-1 text-center">
                    <div className="space-y-1 flex flex-col items-center">
                        <div className="flex items-center w-full max-w-4xl">
                            {isMember && <div className="w-10 shrink-0" aria-hidden="true" />}
                            <h1 className="flex-1 text-2xl md:text-4xl font-bold tracking-tight text-center" style={{ fontFamily: 'var(--font-uncial-antiqua)' }}>
                                {guild.name}
                            </h1>
                            {isMember && (
                                <div className="w-10 flex justify-end shrink-0">
                                    <LeaveGuildButton iconOnly />
                                </div>
                            )}
                        </div>
                        <p className="text-lg text-muted-foreground max-w-2xl">{guild.description}</p>
                        <div className="flex flex-wrap justify-center items-center text-sm text-muted-foreground gap-3 pt-0">
                            {guild.category && (
                                <div className="flex items-center">
                                    <Tag className="w-4 h-4 mr-2" />
                                    {guild.category}
                                </div>
                            )}
                            <div className="flex items-center">
                                <Crown className="w-4 h-4 mr-2" />
                                {masterName}
                            </div>
                            <div className="flex items-center">
                                <Users className="w-4 h-4 mr-2" />
                                {guild.member_count} Members
                            </div>
                            <div className="flex items-center">
                                <Trophy className="w-4 h-4 mr-2" />
                                #{/* Rank logic to be added here */}
                            </div>
                        </div>

                        {isMaster && (
                            <div className="mt-4 flex gap-3">
                                <Link href="/guilds/revenue">
                                    <Button variant="outline" className="text-amber-500 border-amber-500/50 hover:bg-amber-500/10">
                                        Open Revenue Vault
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>



                    {!isMember && (
                        <JoinGuildButton
                            guildId={guild.id}
                            guildName={guild.name}
                            currentGuildId={profile?.guild_id}
                            isPro={isPro}
                            restrictToPro={guild.restrict_to_pro}
                        />
                    )}
                </div>
            </div>

            <Tabs defaultValue={isMember ? "quest" : "members"} className="space-y-6">
                <TabsList className={`grid w-full ${isMaster ? 'grid-cols-5 lg:w-[600px]' : isMember ? 'grid-cols-3 lg:w-[400px]' : 'grid-cols-1 lg:w-[200px]'}`}>
                    {isMember && (
                        <>
                            <TabsTrigger value="quest"><Map className="w-4 h-4 mr-2" /> Quest</TabsTrigger>
                            <TabsTrigger value="feed"><MessageSquare className="w-4 h-4 mr-2" /> Feed</TabsTrigger>
                            <TabsTrigger value="events"><Calendar className="w-4 h-4 mr-2" /> Events</TabsTrigger>
                        </>
                    )}
                    {isMaster && <TabsTrigger value="members"><Users className="w-4 h-4 mr-2" /> Members</TabsTrigger>}
                    {isMaster && <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" /> Settings</TabsTrigger>}
                </TabsList>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3">
                        {isMember && (
                            <>
                                <TabsContent value="quest" className="mt-0">
                                    <QuestTab
                                        guild={guild}
                                        isMaster={isMaster}
                                        currentUserId={user.id}
                                        activeQuest={questStatus?.activeQuest ?? undefined}
                                        completedTaskIds={completedTaskIds}
                                        questStatus={questStatus}
                                        availablePlans={availablePlans}
                                    />
                                </TabsContent>
                                <TabsContent value="feed" className="mt-0">
                                    <CombinedFeed
                                        guildId={guild.id}
                                        posts={feed}
                                        activities={activity}
                                        currentUserId={user.id}
                                        isMaster={isMaster}
                                        pinnedPostId={guild.pinned_post_id}
                                        postsHasMore={feedHasMore}
                                        activitiesHasMore={activityHasMore}
                                    />
                                </TabsContent>
                                <TabsContent value="events" className="mt-0">
                                    <EventsTab
                                        guildId={guild.id}
                                        events={events}
                                        isMaster={isMaster}
                                    />
                                </TabsContent>
                                <TabsContent value="settings" className="mt-0">
                                    <GuildSettingsTab
                                        guildId={guild.id}
                                        isMaster={isMaster}
                                        hasActiveQuest={!!questStatus}
                                        initialName={guild.name}
                                        initialDescription={guild.description}
                                        initialCategory={guild.category || ''}
                                        initialRestrictToPro={guild.restrict_to_pro || false}
                                    />
                                </TabsContent>
                            </>
                        )}
                        <TabsContent value="members" className="mt-0">
                            <div className="hidden lg:block">
                                <Leaderboard
                                    members={members}
                                    title={null}
                                    enableHighlighting={false}
                                    guildId={guild.id}
                                    masterId={guild.master_id ?? undefined}
                                    isMaster={isMaster}
                                />
                            </div>
                            <div className="lg:hidden">
                                <Leaderboard
                                    members={members}
                                    title={null}
                                    enableHighlighting={false}
                                    guildId={guild.id}
                                    masterId={guild.master_id ?? undefined}
                                    isMaster={isMaster}
                                />
                            </div>
                        </TabsContent>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        {/* Pinned Post */}
                        {guild.pinned_post_id && (
                            <div className="rounded-lg border bg-card p-4 space-y-3">
                                <h4 className="font-semibold flex items-center gap-2 text-sm text-primary">
                                    <Pin className="w-4 h-4 rotate-45" />
                                    Pinned Post
                                </h4>
                                <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md italic border-l-2 border-primary/50">
                                    {pinnedPost?.content || "Loading pinned content..."}
                                </div>
                            </div>
                        )}

                        {/* Top Members */}
                        <div className="rounded-lg border bg-card p-4">
                            <Leaderboard members={members.slice(0, 5)} enableHighlighting={true} title="Top Members" />
                        </div>

                        {/* Guild Rules */}
                        <GuildRulesCard guildId={guild.id} rules={guild.rules} isMaster={isMaster} />
                    </div>
                </div>
            </Tabs>
        </div>
    );
}
