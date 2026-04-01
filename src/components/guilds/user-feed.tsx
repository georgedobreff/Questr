'use client';

import { GuildFeedPost } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { timeAgo } from '@/lib/utils';
import { postGuildFeed, pinGuildPost, unpinGuildPost } from '@/app/actions/guild-actions';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Pin } from 'lucide-react';

interface UserFeedProps {
    guildId: string;
    posts: GuildFeedPost[];
    currentUserId: string;
    isMaster: boolean;
    pinnedPostId?: string | null;
}

export function UserFeed({ guildId, posts, currentUserId, isMaster, pinnedPostId }: UserFeedProps) {
    const [content, setContent] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        startTransition(async () => {
            const result = await postGuildFeed(guildId, content);
            if (result.success) {
                setContent('');
                toast.success('Post created');
            } else {
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

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-sm bg-muted/20">
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Textarea
                            placeholder="Share something with your guild..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="bg-background resize-none"
                            rows={3}
                        />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={isPending || !content.trim()}>
                                {isPending ? 'Posting...' : 'Post'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <div className="space-y-4">
                {posts.map((post) => {
                    const isPinned = post.id === pinnedPostId;
                    return (
                        <Card key={post.id} className={`overflow-hidden ${isPinned ? 'border-primary/50 bg-primary/5' : 'bg-card/60'}`}>
                            <CardHeader className="flex flex-row items-center gap-4 py-3 bg-muted/10">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                    {post.profiles?.full_name?.substring(0, 2).toUpperCase() || '??'}
                                </div>
                                <div className="flex flex-col flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{post.profiles?.full_name || 'Unknown User'}</span>
                                        {isPinned && <Pin className="w-3 h-3 text-primary rotate-45" />}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                                </div>
                                {isMaster && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-8 w-8 transition-colors ${isPinned ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-primary'}`}
                                        onClick={() => handlePin(post.id, isPinned)}
                                        title={isPinned ? "Unpin Post" : "Pin Post"}
                                    >
                                        <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="py-4 text-sm whitespace-pre-wrap">
                                {post.content}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
