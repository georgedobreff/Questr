'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Edit3, Loader2, Wand2 } from 'lucide-react';
import { startCustomGuildQuest, saveGuildQuestDraft, updateActiveGuildQuest } from '@/app/actions/guild-quest-actions';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Plan, Quest, Task } from '@/lib/types';
import { useRouter } from 'next/navigation';

export function CustomQuestGenerator({ 
    guildId, 
    onQuestStarted, 
    initialDraft, 
    editModeSnapshot 
}: { 
    guildId: string, 
    onQuestStarted?: () => void,
    initialDraft?: Plan | null,
    editModeSnapshot?: Plan | null
}) {
    const [prompt, setPrompt] = useState(initialDraft?.goal_text || '');
    const [experience, setExperience] = useState('Beginner');
    const [isGenerating, setIsGenerating] = useState(false);
    const [customPlan, setCustomPlan] = useState<Plan | null>(editModeSnapshot || initialDraft || null);
    const [quests, setQuests] = useState<Quest[]>(editModeSnapshot?.quests || initialDraft?.quests || []);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error('Please enter a topic for the guild quest.');
            return;
        }

        setIsGenerating(true);
        setCustomPlan(null);
        setQuests([]);

        try {
            const { data, error } = await supabase.functions.invoke('generate-guild-plan', {
                body: { goal_text: prompt, experience }
            });

            if (error) {
                console.error("Function error:", error);
                throw new Error(error.message || 'Failed to generate quest');
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            if (data && data.modules && data.modules.length > 0) {
                const planData = data as any;
                

                let taskIdCounter = -1;
                let questIdCounter = -1;
                const mappedQuests: Quest[] = [];

                planData.modules.forEach((mod: any) => {
                    if (mod.daily_quests) {
                        mod.daily_quests.forEach((dq: any) => {
                            const qId = questIdCounter--;
                            mappedQuests.push({
                                id: qId,
                                plan_id: -1,
                                module_number: mod.module_number,
                                day_number: dq.day,
                                title: dq.title,
                                story: dq.story || '',
                                tasks: dq.tasks?.map((t: any) => ({
                                    id: taskIdCounter--,
                                    quest_id: qId,
                                    title: t.title,
                                    short_description: t.short_description || '',
                                    reward_coins: t.reward || 10,
                                    is_completed: false,
                                    created_at: new Date().toISOString()
                                })) || []
                            });
                        });
                    }
                });

                const planToSet = {
                    id: -1,
                    user_id: '',
                    goal_text: prompt,
                    complexity: 'simple' as const,
                    total_estimated_duration_weeks: planData.total_estimated_duration_weeks || 1,
                    total_estimated_modules: planData.modules.length,
                    plot: planData.plot || '',
                    plan_details: planData,
                    quests: mappedQuests
                };

                setCustomPlan(planToSet);
                setQuests(mappedQuests);
                

                saveGuildQuestDraft(guildId, planToSet).catch(console.error);

                toast.success('Guild Quest Generated! You can now edit the goals below.');
            } else {
                toast.error('Could not generate a valid quest. Please try again.');
            }

        } catch (err: any) {
            toast.error(err.message || 'An unexpected error occurred.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpdateTask = (questIndex: number, taskIndex: number, field: keyof Task, value: any) => {
        const newQuests = [...quests];
        newQuests[questIndex].tasks[taskIndex] = {
            ...newQuests[questIndex].tasks[taskIndex],
            [field]: value
        };
        setQuests(newQuests);
    };

    const handleSaveQuest = async () => {
        if (!customPlan || quests.length === 0) return;

        setIsSaving(true);
        try {
            const finalPlan: Plan = {
                ...customPlan,
                quests: quests
            };

            let result;
            if (editModeSnapshot) {
                result = await updateActiveGuildQuest(guildId, finalPlan);
            } else {
                result = await startCustomGuildQuest(guildId, finalPlan);
            }
            
            if (result.success) {
                toast.success(editModeSnapshot ? 'Quest Changes Saved!' : 'Guild Quest Started!');
                if (editModeSnapshot) setIsEditOpen(false);
                if (onQuestStarted) onQuestStarted();
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to start quest');
            }
        } catch (err: any) {
            toast.error(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        setCustomPlan(null);
        if (!editModeSnapshot) {
            saveGuildQuestDraft(guildId, null).catch(console.error);
        }
    };

    const renderQuestEditor = () => (
        <div className="space-y-6">
            <div className="flex justify-between flex-wrap gap-4 items-center">
                <h3 className="font-medium text-lg text-primary">{customPlan!.goal_text}</h3>
                {!editModeSnapshot && (
                    <Button variant="outline" size="sm" onClick={handleDiscard}>
                        Discard & Regenerate
                    </Button>
                )}
            </div>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="plot" className="rounded-lg border bg-card text-card-foreground shadow-sm px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <span className="font-medium text-sm text-foreground">Fantasy Plot</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                            <Textarea 
                                value={customPlan!.plot || ''} 
                                onChange={(e) => setCustomPlan({ ...customPlan!, plot: e.target.value })}
                                className="min-h-[100px] text-sm resize-y italic"
                                placeholder="A grand story awaits..."
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                <Accordion type="multiple" className="w-full space-y-4" defaultValue={['q-0']}>
                    {quests.map((quest, qIdx) => (
                        <AccordionItem value={`q-${qIdx}`} key={qIdx} className="rounded-lg border bg-card text-card-foreground shadow-sm px-4">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex gap-2 items-center text-left">
                                    <span className="text-muted-foreground font-mono text-xs font-semibold bg-muted px-2 py-1 rounded">
                                        W{quest.module_number} D{quest.day_number}
                                    </span>
                                    <span className="font-medium text-sm">{quest.title}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-0 pt-0 pb-2">
                                {quest.tasks.map((task, tIdx) => (
                                    <div key={tIdx} className="space-y-3 py-4 border-t first:border-0 relative group">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Task Title</Label>
                                            <Input 
                                                value={task.title} 
                                                onChange={(e) => handleUpdateTask(qIdx, tIdx, 'title', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Description</Label>
                                            <Textarea 
                                                value={task.short_description || ''} 
                                                onChange={(e) => handleUpdateTask(qIdx, tIdx, 'short_description', e.target.value)}
                                                className="min-h-[120px] text-sm resize-y"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>

            <div className="pt-4 border-t flex justify-end gap-3">
                {editModeSnapshot && (
                    <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                )}
                <Button 
                    onClick={handleSaveQuest} 
                    disabled={isSaving}
                    className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400 to-amber-600 border-amber-500 hover:brightness-110"
                >
                    {isSaving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                        editModeSnapshot ? 'Save Changes' : 'Save & Start Quest'
                    )}
                </Button>
            </div>
        </div>
    );

    if (editModeSnapshot) {
        return (
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Active Quest
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col pt-10">
                    <DialogHeader>
                        <DialogTitle>Edit Active Quest</DialogTitle>
                        <DialogDescription>
                            Make changes to the active guild quest. Members will see these updates immediately.
                        </DialogDescription>
                    </DialogHeader>
                    {renderQuestEditor()}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-primary" />
                    Forge Custom Guild Quest
                </CardTitle>
                <CardDescription>
                    Use AI to create a unique curriculum for your guild members to follow.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {!customPlan ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>What is the goal for your guild?</Label>
                            <Textarea 
                                placeholder="E.g. Master the basics of Python programming over the next few weeks..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                        <div className="space-y-2 flex flex-col">
                            <Label>Target Experience Level</Label>
                            <select 
                                className="h-10 px-3 py-2 text-sm rounded-md border bg-background"
                                value={experience}
                                onChange={(e) => setExperience(e.target.value)}
                            >
                                <option value="Beginner">Beginner (Start from basics)</option>
                                <option value="Intermediate">Intermediate (Skip basics)</option>
                                <option value="Advanced">Advanced (High difficulty)</option>
                            </select>
                        </div>
                        <Button 
                            className="w-full" 
                            onClick={handleGenerate} 
                            disabled={isGenerating || !prompt.trim()}
                        >
                            {isGenerating ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Divining Quest...</>
                            ) : (
                                <><Wand2 className="w-4 h-4 mr-2" /> Generate Quest</>
                            )}
                        </Button>
                    </div>
                ) : (
                    renderQuestEditor()
                )}
            </CardContent>
        </Card>
    );
} 
