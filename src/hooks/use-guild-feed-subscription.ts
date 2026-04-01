'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GuildFeedPost } from '@/lib/types';
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface UseGuildFeedSubscriptionOptions {
    guildId: string;
    initialPosts: GuildFeedPost[];
    initialHasMore: boolean;
    maxInitialPosts?: number;
}

interface UseGuildFeedSubscriptionReturn {
    posts: GuildFeedPost[];
    hasMore: boolean;
    isLoadingMore: boolean;
    loadMore: () => Promise<void>;
    page: number;
}

interface GuildFeedPayload {
    id: string;
    guild_id: string;
    user_id: string;
    content: string;
    created_at: string;
}

export function useGuildFeedSubscription({
    guildId,
    initialPosts,
    initialHasMore,
    maxInitialPosts = 13,
}: UseGuildFeedSubscriptionOptions): UseGuildFeedSubscriptionReturn {
    const [posts, setPosts] = useState<GuildFeedPost[]>(initialPosts);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const supabase = createClient();

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        const nextPage = page + 1;
        const offset = nextPage * maxInitialPosts;

        const { data, count } = await supabase
            .from('guild_feed')
            .select('*, profiles:user_id(full_name, character_model_path)', { count: 'exact' })
            .eq('guild_id', guildId)
            .order('created_at', { ascending: false })
            .range(offset, offset + maxInitialPosts - 1);

        if (data) {
            const newItems = data as unknown as GuildFeedPost[];
            setPosts(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
                return [...prev, ...uniqueNewItems];
            });
            setHasMore(count ? offset + newItems.length < count : false);
            setPage(nextPage);
        }

        setIsLoadingMore(false);
    }, [isLoadingMore, hasMore, guildId, page, maxInitialPosts, supabase]);

    useEffect(() => {
        if (!guildId) return;

        const setupSubscription = async () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }

            channelRef.current = supabase
                .channel(`guild-feed-${guildId}`)
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

                            const updated = [enrichedPost as unknown as GuildFeedPost, ...prev];

                            if (page === 0 && updated.length > maxInitialPosts) {
                                return updated.slice(0, maxInitialPosts);
                            }

                            return updated;
                        });
                    }
                )
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [guildId, supabase, page, maxInitialPosts]);

    useEffect(() => {
        setPosts(initialPosts);
        setPage(0);
        setHasMore(initialHasMore);
    }, [guildId, initialPosts, initialHasMore]);

    return {
        posts,
        hasMore,
        isLoadingMore,
        loadMore,
        page,
    };
}
