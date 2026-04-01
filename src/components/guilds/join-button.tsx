'use client';

import { Button } from '@/components/ui/button';
import { joinGuild, leaveGuild } from '@/app/actions/guild-actions';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useGoPro } from '@/hooks/use-go-pro';
import { Crown } from 'lucide-react';

interface JoinGuildButtonProps {
    guildId: string;
    guildName: string;
    currentGuildId?: string | null;
    isPro?: boolean;
    restrictToPro?: boolean;
}

export function JoinGuildButton({ guildId, guildName, currentGuildId, isPro = false, restrictToPro = false }: JoinGuildButtonProps) {
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);
    const [showProDialog, setShowProDialog] = useState(false);
    const router = useRouter();
    const { handleGoPro } = useGoPro();
    const hasGuild = !!currentGuildId;

    const performJoin = async () => {
        const result = await joinGuild(guildId);
        if (result.success) {
            toast.success(`Joined ${guildName}!`);
            window.dispatchEvent(new Event('guild_status_changed'));
            router.refresh();
            setIsOpen(false);
        } else {
            toast.error(result.error || 'Failed to join guild');
            setIsOpen(false);
        }
    };

    const handleJoinClick = () => {
        if (restrictToPro && !isPro) {
            setShowProDialog(true);
            return;
        }

        if (hasGuild) {
            setIsOpen(true);
        } else {
            startTransition(async () => {
                await performJoin();
            });
        }
    };

    const handleConfirmSwitch = () => {
        startTransition(async () => {

            const leaveResult = await leaveGuild();
            if (!leaveResult.success) {
                toast.error(leaveResult.error || 'Failed to leave current guild');
                setIsOpen(false);
                return;
            }


            await performJoin();
        });
    };

    return (
        <>
            <Button
                onClick={handleJoinClick}
                disabled={isPending}
                variant={restrictToPro && !isPro ? "outline" : "default"}
            >
                {isPending ? "Joining..." : restrictToPro && !isPro ? "Pro Guild" : hasGuild ? "Switch to this Guild" : "Join Guild"}
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Switch Guilds?</DialogTitle>
                        <DialogDescription>
                            You are currently a member of another guild. Joining <strong>{guildName}</strong> will automatically remove you from your current guild.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>Cancel</Button>
                        <Button
                            variant="default"
                            onClick={handleConfirmSwitch}
                            disabled={isPending}
                        >
                            {isPending ? 'Switching...' : 'Confirm Switch'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
        </>
    );
}
