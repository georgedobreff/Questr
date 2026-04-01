'use client';

import { Guild } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Tag, Crown } from 'lucide-react';
import { joinGuild } from '@/app/actions/guild-actions';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { useRouter } from 'next/navigation';
import { useGoPro } from '@/hooks/use-go-pro';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useState } from 'react';

interface GuildCardProps {
    guild: Guild;
    currentGuildId?: string | null;
    isPro?: boolean;
}

export function GuildCard({ guild, currentGuildId, isPro = false }: GuildCardProps) {
    const [isPending, startTransition] = useTransition();
    const [showProDialog, setShowProDialog] = useState(false);
    const router = useRouter();
    const { handleGoPro } = useGoPro();
    const isMember = currentGuildId === guild.id;
    const hasGuild = !!currentGuildId;
    const isRestricted = guild.restrict_to_pro || false;

    const handleJoinClick = () => {
        if (isRestricted && !isPro) {
            setShowProDialog(true);
            return;
        }

        if (hasGuild && !isMember) {
            toast.error("You must leave your current guild before joining a new one.");
            return;
        }

        startTransition(async () => {
            const result = await joinGuild(guild.id);
            if (result.success) {
                toast.success(`Joined ${guild.name}!`);
                window.dispatchEvent(new Event('guild_status_changed'));
                router.push(`/guilds/${guild.id}`);
            } else {
                toast.error(result.error || 'Failed to join guild');
            }
        });
    };

    return (
        <Card className="hover:border-primary/50 transition-all duration-300 h-full flex flex-col text-center">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl line-clamp-2 h-14 flex items-center justify-center leading-tight mb-2" title={guild.name}>{guild.name}</CardTitle>
                <CardDescription className="line-clamp-3 min-h-[3.75rem]">{guild.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{guild.member_count}</span>
                    </div>
                    {guild.category && (
                        <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            <span>{guild.category}</span>
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="pt-4">
                <Button
                    className="w-full"
                    onClick={handleJoinClick}
                    disabled={isPending || (hasGuild && !isMember && !isRestricted) || isMember}
                    variant={isRestricted && !isPro ? "outline" : isMember ? "outline" : "default"}
                >
                    {isPending ? "Joining..." : isMember ? "Joined" : isRestricted && !isPro ? "Pro Guild" : hasGuild ? "Leave Current First" : "Join Guild"}
                </Button>
            </CardFooter>

            <Dialog open={showProDialog} onOpenChange={setShowProDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Crown className="w-5 h-5 text-amber-500" />
                            Pro-Only Guild
                        </DialogTitle>
                        <DialogDescription className="pt-3 pb-2 text-base">
                            The Guild Master has restricted this guild to <strong>Pro</strong> subscribers only.
                            <br /><br />
                            Upgrade today to join exclusive guilds and unlock all premium features.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setShowProDialog(false)}>Cancel</Button>
                        <Button 
                            className="bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] hover:brightness-110 text-white border-none"
                            onClick={() => {
                                setShowProDialog(false);
                                handleGoPro();
                            }}
                        >
                            Subscribe
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
