'use client';

import { useState, useTransition, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
    Scroll, Users, Heart, Smile, Send, PawPrint, Loader2
} from 'lucide-react';
import { postGuildFeed, getGuildFeedPaginated } from '@/app/actions/guild-actions';
import { toast } from 'sonner';
import type { Quest, Task, UserPet, GuildFeedPost } from '@/lib/types';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface DashboardClientPageProps {
    currentQuest: Quest | null;
    planId: number | null;
    pet: UserPet | null;
    guildId: string | null;
    guildName: string | null;
    guildFeed: GuildFeedPost[];
    guildFeedHasMore: boolean;
    isBossStage?: boolean;
    bossStory?: string | null;
}

interface GuildFeedPayload {
    id: string;
    guild_id: string;
    user_id: string;
    content: string;
    created_at: string;
}

const MAX_INITIAL_POSTS = 13;

export function DashboardClientPage({
    currentQuest,
    planId,
    pet,
    guildId,
    guildName,
    guildFeed,
    guildFeedHasMore,
    isBossStage,
    bossStory
}: DashboardClientPageProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [guildPost, setGuildPost] = useState('');

    const [posts, setPosts] = useState<GuildFeedPost[]>(guildFeed);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(guildFeedHasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const supabase = createClient();

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore || !guildId) return;

        setIsLoadingMore(true);
        const nextPage = page + 1;
        const result = await getGuildFeedPaginated(guildId, nextPage, MAX_INITIAL_POSTS);

        setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = result.items.filter(item => !existingIds.has(item.id));
            return [...prev, ...newItems];
        });
        setHasMore(result.hasMore);
        setPage(nextPage);
        setIsLoadingMore(false);
    }, [isLoadingMore, hasMore, guildId, page]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !guildId) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, loadMore, guildId]);

    useEffect(() => {
        if (!guildId) return;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        channelRef.current = supabase
            .channel(`dashboard-guild-feed-${guildId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'guild_feed',
                    filter: `guild_id=eq.${guildId}`,
                },
                async (payload: RealtimePostgresInsertPayload<GuildFeedPayload>) => {
                    const newPost = payload.new;
                    if (!newPost || !newPost.id) return;

                    const { data: enrichedPost } = await supabase
                        .from('guild_feed')
                        .select('*, profiles:user_id(full_name, character_model_path)')
                        .eq('id', newPost.id)
                        .single();

                    if (!enrichedPost) return;

                    setPosts(prev => {
                        if (prev.some(p => p.id === newPost.id)) return prev;

                        const realPost = enrichedPost as unknown as GuildFeedPost;
                        const optimisticIndex = prev.findIndex(p =>
                            p.id.startsWith('temp-') && p.content === realPost.content
                        );

                        if (optimisticIndex !== -1) {
                            const updated = [...prev];
                            updated[optimisticIndex] = realPost;
                            return updated;
                        }

                        const updated = [realPost, ...prev];

                        if (page === 0 && updated.length > MAX_INITIAL_POSTS) {
                            return updated.slice(0, MAX_INITIAL_POSTS);
                        }

                        return updated;
                    });
                }
            )
            .subscribe();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [guildId, supabase, page]);

    const handlePostGuild = async () => {
        if (!guildId || !guildPost.trim()) return;
        const content = guildPost.trim();

        const optimisticPost: GuildFeedPost = {
            id: `temp-${Date.now()}`,
            guild_id: guildId,
            user_id: '',
            content,
            created_at: new Date().toISOString(),
            profiles: { full_name: 'You' } as GuildFeedPost['profiles'],
        };

        setPosts(prev => {
            const updated = [optimisticPost, ...prev];
            if (updated.length > MAX_INITIAL_POSTS) {
                return updated.slice(0, MAX_INITIAL_POSTS);
            }
            return updated;
        });
        setGuildPost('');

        startTransition(async () => {
            const result = await postGuildFeed(guildId, content);
            if (result.success) {
                toast.success('Posted to guild!');
                router.refresh();
            } else {
                setPosts(prev => prev.filter(p => p.id !== optimisticPost.id));
                setGuildPost(content);
                toast.error(result.error || 'Failed to post');
            }
        });
    };


    return (
        <div className="h-full overflow-y-auto pt-20 pb-24 lg:pb-8 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-stretch">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Current Task Section */}
                        <Card id="dashboard-quest-card">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    <Scroll className="w-5 h-5 text-primary" />
                                    {isBossStage ? "Chapter Complete" : (currentQuest?.title || "No Active Quest")}
                                </CardTitle>
                                {(isBossStage ? bossStory : currentQuest?.story) && (
                                    <p className="text-sm text-muted-foreground italic">
                                        {isBossStage ? bossStory : currentQuest?.story}
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent>
                                {isBossStage ? (
                                    <div className="space-y-4">
                                        <div className="text-center py-6 px-4 bg-muted/30 rounded-lg border border-primary/20">
                                            <p className="text-sm font-medium text-primary mb-2">Boss Battle</p>
                                            <p className="text-xs text-muted-foreground italic">
                                                The module is complete, but a powerful guardian blocks your path.
                                            </p>
                                        </div>
                                        <Link href="/log" className="block">
                                            <Button variant="default" size="lg" className="w-full shadow-lg shadow-primary/20">
                                                Start
                                            </Button>
                                        </Link>
                                    </div>
                                ) : currentQuest ? (
                                    <div className="space-y-4">
                                        <div className="space-y-3 ">
                                            {currentQuest.tasks?.sort((a, b) => a.id - b.id).map((task: Task) => (
                                                <div
                                                    key={task.id}
                                                    className={`p-3 rounded-lg border min-h-[66px] flex items-center justify-center text-center transition-colors ${task.is_completed ? 'bg-muted/30 border-muted text-muted-foreground' : 'bg-muted/80'
                                                        }`}
                                                >
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-medium ${task.is_completed ? 'line-through' : ''}`}>
                                                            {task.title}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Link href="/log" className="block">
                                            <Button variant="default" size="lg" className="w-full">
                                                View Quest
                                            </Button>
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-muted-foreground">
                                        <p>No active quest</p>
                                        <Link href="/new-path">
                                            <Button variant="link">Start a journey</Button>
                                        </Link>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Companion Card - Compact */}
                        <Card id="dashboard-companion-card">
                            <CardContent className="py-4">
                                {pet ? (
                                    <Link href="/pet" className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                                            <PawPrint className="w-6 h-6 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <h3 className="font-semibold text-lg leading-none">{pet.nickname || pet.pet_definitions?.name || 'Companion'}</h3>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 text-sm">
                                                    <div className="flex items-center gap-1.5 min-w-[90px] text-muted-foreground font-medium">
                                                        <Heart className="w-4 h-4 text-red-500" /> Health
                                                    </div>
                                                    <Progress value={pet.health} className="h-2.5 flex-1" />
                                                    <span className="font-bold w-9 text-right">{pet.health}%</span>
                                                </div>

                                                <div className="flex items-center gap-3 text-sm">
                                                    <div className="flex items-center gap-1.5 min-w-[90px] text-muted-foreground font-medium">
                                                        <Smile className="w-4 h-4 text-yellow-500" /> Happiness
                                                    </div>
                                                    <Progress value={pet.happiness} className="h-2.5 flex-1" />
                                                    <span className="font-bold w-9 text-right">{pet.happiness}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    <Link href="/pet" className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                            <PawPrint className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">No companion yet</p>
                                            <p className="text-xs text-primary">Adopt one →</p>
                                        </div>
                                    </Link>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Guild Activity (full height) */}
                    <Card id="dashboard-guild-card" className="h-full flex flex-col">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                {guildName || 'Guild Activity'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col h-full">
                            {guildId ? (
                                <div className="space-y-4 flex-1 flex flex-col">
                                    <div className="flex gap-2 items-end">
                                        <Textarea
                                            value={guildPost}
                                            onChange={(e) => setGuildPost(e.target.value)}
                                            placeholder="Share with your guild..."
                                            className="min-h-[60px] text-sm resize-none"
                                            maxLength={280}
                                        />
                                        <Button
                                            size="icon"
                                            onClick={handlePostGuild}
                                            disabled={isPending || !guildPost.trim()}
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 space-y-2 overflow-y-auto max-h-[400px]">
                                        {posts.length > 0 ? (
                                            <>
                                                {posts.map((post) => (
                                                    <div key={post.id} className="p-3 rounded-lg bg-muted/80 text-sm">
                                                        <p className="text-xs text-muted-foreground mb-1">
                                                            {(post as GuildFeedPost & { profiles?: { full_name?: string } }).profiles?.full_name || 'Member'}
                                                        </p>
                                                        <p>{post.content}</p>
                                                    </div>
                                                ))}
                                                {hasMore && (
                                                    <div ref={sentinelRef} className="h-4 flex items-center justify-center">
                                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-8">
                                                No posts yet. Be the first!
                                            </p>
                                        )}
                                    </div>
                                    <Link href={`/guilds/${guildId}`} className="block mt-auto">
                                        <Button variant="default" size="lg" className="w-full">
                                            Visit Guild
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p className="text-sm">Not in a guild yet</p>
                                    <Link href="/guilds">
                                        <Button variant="link" size="sm">Find a guild</Button>
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
