'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Star, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { removeMember } from '@/app/actions/guild-actions';
import { toast } from 'sonner';

interface Member {
    id: string;
    full_name: string | null;
    level: number;
    xp: number;
}

interface LeaderboardProps {
    members: Member[];
    title?: string | null;
    enableHighlighting?: boolean;
    guildId?: string;
    masterId?: string;
    isMaster?: boolean;
}

export function Leaderboard({
    members,
    title = "Top Members",
    enableHighlighting = false,
    guildId,
    masterId,
    isMaster = false
}: LeaderboardProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleRemove = (memberId: string, memberName: string) => {
        if (!guildId) return;

        startTransition(async () => {
            const result = await removeMember(guildId, memberId);
            if (result.success) {
                toast.success(`${memberName || 'Member'} removed from guild`);
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to remove member');
            }
        });
    };

    return (
        <Card className="border-none shadow-none bg-transparent">
            {title && (
                <CardHeader className="px-0 pt-0">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        {title}
                    </CardTitle>
                </CardHeader>
            )}
            <CardContent className="px-0 space-y-0">
                {members.map((member, index) => {
                    const isTop3 = enableHighlighting && index < 3;
                    const isMasterMember = member.id === masterId;

                    return (
                        <div
                            key={member.id}
                            className={cn(
                                "flex items-center justify-between rounded-lg transition-colors",
                                isTop3
                                    ? "p-3 border bg-card/50 mb-2"
                                    : "p-2 hover:bg-muted/10 border-b border-border/40 last:border-0 rounded-none",
                                isTop3 && index === 0 && "border-yellow-500/50 bg-yellow-500/10",
                                isTop3 && index === 1 && "border-slate-400/50 bg-slate-400/5",
                                isTop3 && index === 2 && "border-amber-700/50 bg-amber-700/5"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "flex items-center justify-center w-8 font-bold",
                                    isTop3 ? "text-foreground text-lg" : "text-muted-foreground text-sm"
                                )}>
                                    {index + 1}
                                </div>
                                <div className="flex flex-col">
                                    <span className={cn("font-semibold", !isTop3 && "font-normal")}>
                                        {member.full_name || 'Unknown Helper'}
                                        {isMasterMember && <span className="ml-2 text-xs text-primary">(Master)</span>}
                                    </span>
                                    {isTop3 && <span className="text-xs text-muted-foreground">Level {member.level}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
                                    <Star className={cn("w-3 h-3", isTop3 ? "text-primary" : "text-muted-foreground/50")} />
                                    <span>{new Intl.NumberFormat('en-US').format(member.xp)} XP</span>
                                </div>
                                {isMaster && !isMasterMember && guildId && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleRemove(member.id, member.full_name || 'Member')}
                                        disabled={isPending}
                                    >
                                        <UserMinus className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
