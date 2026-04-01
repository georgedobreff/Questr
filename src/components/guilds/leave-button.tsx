'use client';

import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { leaveGuild } from '@/app/actions/guild-actions';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface LeaveGuildButtonProps {
    className?: string;
    iconOnly?: boolean;
}

export function LeaveGuildButton({ className, iconOnly }: LeaveGuildButtonProps) {
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    const handleLeave = () => {
        startTransition(async () => {
            const result = await leaveGuild();
            if (result.success) {
                toast.success('Left guild successfully');
                window.dispatchEvent(new Event('guild_status_changed'));
                setIsOpen(false);
                router.push('/guilds');
            } else {
                toast.error(result.error || 'Failed to leave guild');
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size={iconOnly ? "icon" : "default"}
                    className={cn("text-muted-foreground hover:bg-destructive/10 hover:text-destructive", className)}
                >
                    <LogOut className="w-4 h-4" />
                    {!iconOnly && <span className="ml-2">Leave Guild</span>}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Leave Guild</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to leave this guild?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button
                        variant="destructive"
                        onClick={handleLeave}
                        disabled={isPending}
                    >
                        {isPending ? 'Leaving...' : 'Leave Guild'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
