'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Guild, Task, Quest, Plan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { startGuildQuest, completeGuildTask } from '@/app/actions/guild-quest-actions';
import { toast } from 'sonner';
import { Lock, PlayCircle, Clock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { CustomQuestGenerator } from './custom-quest-generator';

interface MemberProgress {
    current_week: number;
    is_synced: boolean;
    synced_at: string | null;
    guild_week: number;
    days_remaining: number;
    is_catching_up: boolean;
}

interface QuestTabProps {
    guild: Guild;
    isMaster: boolean;
    currentUserId: string;
    activeQuest?: Quest;
    completedTaskIds?: number[];
    questStatus?: {
        currentWeek?: number;
        currentDay?: number;
        daysRemainingInWeek?: number;
        weeklyProgress?: number;
        memberProgress?: MemberProgress | null;
        isActive?: boolean;
        draftSnapshot?: Plan | null;
        fullSnapshot?: Plan | null;
    } | null;
    availablePlans?: { id: number; title: string }[];
}

export function QuestTab({
    guild,
    isMaster,
    currentUserId,
    activeQuest,
    completedTaskIds = [],
    questStatus,
    availablePlans = []
}: QuestTabProps) {
    const [isPending, startTransition] = useTransition();
    const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null);
    const router = useRouter();

    const handleStartQuest = (planId: number) => {
        startTransition(async () => {
            const result = await startGuildQuest(guild.id, planId);
            if (result.success) {
                toast.success('Guild Quest Started!');
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to start quest');
            }
        });
    };

    const handleCompleteTask = (taskId: number) => {
        startTransition(async () => {
            const result = await completeGuildTask(guild.id, taskId);
            if (result.success) {
                toast.success('Task Completed!');
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to complete task');
            }
        });
    };

    const isUserMaster = isMaster || (guild?.master_id === currentUserId);
    const hasActiveQuest = questStatus?.isActive;

    if (!hasActiveQuest) {
        if (isUserMaster) {
            return (
                <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center w-full max-w-3xl mx-auto">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold">Start a Guild Quest</h3>
                        <p className="text-muted-foreground">
                            Create a custom quest curriculum for your guild using AI, or pick one of your existing personal plans.
                        </p>
                    </div>
                    
                    <div className="w-full text-left space-y-8 mt-4">
                        <CustomQuestGenerator 
                            guildId={guild.id} 
                            onQuestStarted={() => router.refresh()} 
                            initialDraft={questStatus?.draftSnapshot} 
                        />

                        <div className="space-y-4 pt-6 border-t">
                            <h4 className="font-semibold text-center text-muted-foreground">Or start from an existing personal plan:</h4>
                            {availablePlans.length > 0 ? (
                                <div className={cn(
                                    "grid gap-4",
                                    availablePlans.length === 1 ? "max-w-md mx-auto w-full" : "sm:grid-cols-2"
                                )}>
                                    {availablePlans.map(plan => (
                                        <Button
                                            key={plan.id}
                                            variant="outline"
                                            onClick={() => handleStartQuest(plan.id)}
                                            disabled={isPending}
                                            className="h-auto py-3 px-4 flex flex-col items-start text-left"
                                        >
                                            <span className="font-medium text-wrap">{plan.title}</span>
                                            <span className="text-xs text-muted-foreground mt-1">Click to Start</span>
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center space-y-2">
                                    <p className="text-sm text-yellow-600 dark:text-yellow-500">No personal plans found.</p>
                                    <Button variant="link" onClick={() => router.push('/new-path')}>
                                        Create a Personal Plan
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                <Lock className="w-12 h-12 text-muted-foreground/50" />
                <h3 className="text-xl font-bold text-muted-foreground">No Active Quest</h3>
                <p className="text-muted-foreground">The Guild Master hasn't started a quest path yet.</p>
            </div>
        );
    }

    if (!activeQuest || !questStatus || !questStatus.isActive) {
        return (
            <div className="py-12 text-center">
                <p className="text-muted-foreground">Loading quest data or waiting for next day unlock...</p>
            </div>
        );
    }

    const weeklyProgress = questStatus.weeklyProgress ?? 0;
    const memberProgress = questStatus.memberProgress;
    const isCatchingUp = memberProgress?.is_catching_up ?? false;
    const memberWeek = memberProgress?.current_week ?? (questStatus.currentWeek as number);
    const guildWeek = memberProgress?.guild_week ?? (questStatus.currentWeek as number);
    const isSynced = memberProgress?.is_synced ?? true;

    return (
        <div className="space-y-8">

            {isCatchingUp && (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                        <Clock className="w-5 h-5" />
                        <span className="font-semibold">Catch-Up Mode</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        You're on <strong>Week {memberWeek}</strong> while the guild is on <strong>Week {guildWeek}</strong>.
                        Complete your tasks to catch up! You have unlimited time.
                    </p>
                    <Progress
                        value={(memberWeek / guildWeek) * 100}
                        className="h-2 bg-yellow-500/20"
                    />
                </div>
            )}


            {!isCatchingUp && !isSynced && (
                <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <Clock className="w-5 h-5" />
                        <span className="font-semibold">Not Synced</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        You caught up with less than 3 days remaining. Your completions won't count toward guild XP this week.
                    </p>
                </div>
            )}

            <div className="rounded-lg border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            {isCatchingUp ? (
                                <>Week {memberWeek} <span className="text-xs text-yellow-600">(Catch-up)</span></>
                            ) : (
                                <>Week {questStatus.currentWeek} <span className="text-muted-foreground">•</span> Day {questStatus.currentDay}</>
                            )}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {activeQuest.title}
                        </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        {isUserMaster && questStatus.fullSnapshot && (
                            <CustomQuestGenerator 
                                guildId={guild.id} 
                                onQuestStarted={() => router.refresh()} 
                                editModeSnapshot={questStatus.fullSnapshot}
                            />
                        )}
                        <div className="text-2xl font-bold text-primary flex items-center justify-end gap-2">
                            <Clock className="w-5 h-5" />
                            {isCatchingUp ? 'Unlimited' : `${questStatus.daysRemainingInWeek} Days Left`}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isCatchingUp ? 'to catch up' : 'in this chapter'}
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Guild Weekly Progress</span>
                        <span>{weeklyProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={weeklyProgress} className="h-2" />
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="font-semibold text-lg">Today's Tasks</h4>
                <div className="grid gap-3">
                    {activeQuest.tasks.map(task => {
                        const isCompleted = completedTaskIds.includes(task.id);


                        return (
                            <div
                                key={task.id}
                                className={`flex items-start space-x-4 p-4 titled-cards transition-all duration-300 hover:border-primary/20 group relative ${isCompleted ? 'opacity-70' : ''}`}
                            >
                                <div className="relative mt-1 h-5 w-5 shrink-0 group/checkbox">
                                    <Checkbox
                                        id={`task-${task.id}`}
                                        checked={isCompleted}
                                        onCheckedChange={() => !isCompleted && handleCompleteTask(task.id)}
                                        disabled={isPending || isCompleted}
                                        className="h-5 w-5 border-muted-foreground data-[state=unchecked]:bg-transparent transition-all"
                                    />
                                    {!isCompleted && !isPending && (
                                        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none text-primary transition-opacity duration-200 opacity-0 group-hover/checkbox:opacity-50`}>
                                            <Check className="h-3.5 w-3.5" />
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-1.5 leading-none grow">
                                    <label
                                        htmlFor={`task-${task.id}`}
                                        className={`text-base font-bold peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${isCompleted ? "line-through" : ""}`}
                                    >
                                        {task.title}
                                    </label>
                                    {task.short_description && (
                                        <div className={`text-sm text-foreground leading-relaxed ${isCompleted ? "line-through opacity-70" : ""}`}>
                                            {task.short_description}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
