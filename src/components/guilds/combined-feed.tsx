'use client';

import { GuildActivity, GuildFeedPost } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { timeAgo } from '@/lib/utils';
import { postGuildFeed, pinGuildPost, unpinGuildPost, getGuildFeedPaginated, getGuildActivityPaginated } from '@/app/actions/guild-actions';
import { useState, useTransition, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Pin, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js';

type FeedItem =
    | { type: 'post'; data: GuildFeedPost }
    | { type: 'activity'; data: GuildActivity };

interface GuildFeedPayload {
    id: string;
    guild_id: string;
    user_id: string;
    content: string;
    created_at: string;
}

interface CombinedFeedProps {
    guildId: string;
    posts: GuildFeedPost[];
    activities: GuildActivity[];
    currentUserId: string;
    isMaster: boolean;
    pinnedPostId?: string | null;
    postsHasMore: boolean;
    activitiesHasMore: boolean;
}

const MAX_INITIAL_POSTS = 13;

export function CombinedFeed({ guildId, posts, activities, currentUserId, isMaster, pinnedPostId, postsHasMore, activitiesHasMore }: CombinedFeedProps) {
    const [content, setContent] = useState('');
    const [isPending, startTransition] = useTransition();

    const [postsList, setPostsList] = useState<GuildFeedPost[]>(posts);
    const [activitiesList, setActivitiesList] = useState<GuildActivity[]>(activities);
    const [postsPage, setPostsPage] = useState(0);
    const [activitiesPage, setActivitiesPage] = useState(0);
    const [hasMorePosts, setHasMorePosts] = useState(postsHasMore);
    const [hasMoreActivities, setHasMoreActivities] = useState(activitiesHasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const supabase = createClient();

    const hasMore = hasMorePosts || hasMoreActivities;

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);

        const promises: Promise<void>[] = [];

        if (hasMorePosts) {
            const nextPostsPage = postsPage + 1;
            promises.push(
                getGuildFeedPaginated(guildId, nextPostsPage, MAX_INITIAL_POSTS).then(result => {
                    setPostsList(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const newItems = result.items.filter(item => !existingIds.has(item.id));
                        return [...prev, ...newItems];
                    });
                    setHasMorePosts(result.hasMore);
                    setPostsPage(nextPostsPage);
                })
            );
        }

        if (hasMoreActivities) {
            const nextActivitiesPage = activitiesPage + 1;
            promises.push(
                getGuildActivityPaginated(guildId, nextActivitiesPage, MAX_INITIAL_POSTS).then(result => {
                    setActivitiesList(prev => {
                        const existingIds = new Set(prev.map(a => a.id));
                        const newItems = result.items.filter(item => !existingIds.has(item.id));
                        return [...prev, ...newItems];
                    });
                    setHasMoreActivities(result.hasMore);
                    setActivitiesPage(nextActivitiesPage);
                })
            );
        }

        await Promise.all(promises);
        setIsLoadingMore(false);
    }, [isLoadingMore, hasMore, hasMorePosts, hasMoreActivities, guildId, postsPage, activitiesPage]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

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
    }, [hasMore, isLoadingMore, loadMore]);

    useEffect(() => {
        if (!guildId) return;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        channelRef.current = supabase
            .channel(`guild-feed-combined-${guildId}`)
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

                    setPostsList(prev => {
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

                        if (postsPage === 0 && updated.length > MAX_INITIAL_POSTS) {
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
    }, [guildId, supabase, postsPage]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        const postContent = content.trim();

        const optimisticPost: GuildFeedPost = {
            id: `temp-${Date.now()}`,
            guild_id: guildId,
            user_id: currentUserId,
            content: postContent,
            created_at: new Date().toISOString(),
            profiles: { full_name: 'You' } as GuildFeedPost['profiles'],
        };

        setPostsList(prev => {
            const updated = [optimisticPost, ...prev];
            if (postsPage === 0 && updated.length > MAX_INITIAL_POSTS) {
                return updated.slice(0, MAX_INITIAL_POSTS);
            }
            return updated;
        });
        setContent('');

        startTransition(async () => {
            const result = await postGuildFeed(guildId, postContent);
            if (result.success) {
                toast.success('Post created');
            } else {
                setPostsList(prev => prev.filter(p => p.id !== optimisticPost.id));
                setContent(postContent);
                toast.error(result.error || 'Failed to post');
            }
        });
    };

    const handlePin = (postId: string, isPinned: boolean) => {
        startTransition(async () => {
            const result = isPinned
                ? await unpinGuildPost(guildId)
                : await pinGuildPost(guildId, postId);

            if (result.success) {
                toast.success(isPinned ? 'Post unpinned' : 'Post pinned');
            } else {
                toast.error(result.error || 'Failed to update pin');
            }
        });
    };


    const sortedItems: FeedItem[] = [
        ...postsList.map(p => ({ type: 'post' as const, data: p })),
        ...activitiesList.map(a => ({ type: 'activity' as const, data: a }))
    ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());

    return (
        <div className="space-y-6">

            <div className="rounded-lg border bg-card p-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Textarea
                        placeholder="Share something with your guild..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="bg-background resize-none"
                        rows={3}
                        maxLength={280}
                    />
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isPending || !content.trim()}>
                            {isPending ? 'Posting...' : 'Post'}
                        </Button>
                    </div>
                </form>
            </div>

            <div className="space-y-4">
                {sortedItems.map((item) => {
                    if (item.type === 'post') {
                        const post = item.data;
                        const isPinned = post.id === pinnedPostId;
                        return (
                            <div key={post.id} className={`rounded-lg border bg-card p-4 space-y-3 relative group ${isPinned ? 'border-primary/50 bg-primary/5' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm">
                                        <span className="text-primary">{post.profiles?.full_name || 'Unknown User'}</span>
                                        <span className="text-xs text-muted-foreground font-normal">• {timeAgo(post.created_at)}</span>
                                        {isPinned && <Pin className="w-3 h-3 text-primary rotate-45" />}
                                    </h4>
                                    {isMaster && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${isPinned ? 'text-primary opacity-100' : 'text-muted-foreground hover:text-primary'}`}
                                            onClick={() => handlePin(post.id, isPinned)}
                                            title={isPinned ? "Unpin Post" : "Pin Post"}
                                        >
                                            <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                                <div className="text-sm text-foreground whitespace-pre-wrap">
                                    {post.content}
                                </div>
                            </div>
                        );
                    } else {
                        const activity = item.data;
                        return (
                            <div key={activity.id} className="rounded-lg border bg-card p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm">
                                        <span className="text-primary">{activity.profiles?.full_name || 'Unknown User'}</span>
                                        <span className="text-xs text-muted-foreground font-normal">• {timeAgo(activity.created_at)}</span>
                                    </h4>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {formatActivity(activity)}
                                </div>
                            </div>
                        );
                    }
                })}
                {hasMore && (
                    <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
        </div>
    );
}

function formatActivity(activity: GuildActivity): string {
    switch (activity.activity_type) {
        case 'join':
            return 'joined the guild';
        case 'level_up':
            return `reached level ${activity.data.level}`;
        case 'quest_complete':
            return `completed a quest: ${activity.data.quest_title}`;
        default:
            return 'performed an action';
    }
}
