'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { terminateGuildQuest as terminateQuestAction } from '@/app/actions/guild-quest-actions';
import { updateGuildDetails as updateGuildDetailsAction } from '@/app/actions/guild-actions';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const GUILD_CATEGORIES = [
    'Software Development',
    'AI & Data Science',
    'Cybersecurity',
    'Business & Strategy',
    'Design & Creative',
    'Languages',
    'Mathematics',
    'Writing & Communication',
    'Personal Development',
    'Finance & Investing',
    'Health & Wellness'
] as const;

interface GuildSettingsTabProps {
    guildId: string;
    isMaster: boolean;
    hasActiveQuest: boolean;
    initialName: string;
    initialDescription: string;
    initialCategory: string;
    initialRestrictToPro: boolean;
}

export function GuildSettingsTab({
    guildId,
    isMaster,
    hasActiveQuest,
    initialName,
    initialDescription,
    initialCategory,
    initialRestrictToPro
}: GuildSettingsTabProps) {
    const [isTerminating, setIsTerminating] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription);
    const [category, setCategory] = useState(initialCategory || '');
    const [restrictToPro, setRestrictToPro] = useState(initialRestrictToPro);

    const handleTerminate = async () => {
        setIsTerminating(true);
        try {
            const result = await terminateQuestAction(guildId);
            if (result.success) {
                toast.success("Quest Terminated", {
                    description: "The active guild quest has been terminated and all progress cleared.",
                });
                setIsDialogOpen(false);
            } else {
                toast.error("Error", {
                    description: result.error || "Failed to terminate quest.",
                });
            }
        } catch (error) {
            toast.error("Error", {
                description: "An unexpected error occurred.",
            });
        } finally {
            setIsTerminating(false);
        }
    };

    const handleSaveChanges = async () => {
        if (!name.trim()) {
            toast.error("Validation Error", { description: "Guild name cannot be empty." });
            return;
        }

        setIsSaving(true);
        try {
            const result = await updateGuildDetailsAction(guildId, name, description, category, restrictToPro);
            if (result.success) {
                toast.success("Settings Updated", {
                    description: "Guild details have been successfully updated.",
                });
            } else {
                toast.error("Update Failed", {
                    description: result.error || "Failed to update guild settings.",
                });
            }
        } catch (error) {
            toast.error("Error", {
                description: "An unexpected error occurred while saving.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isMaster) {
        return (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="w-8 h-8 opacity-50 text-amber-500" />
                <p>Only the Guild Master can access settings.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Manage your guild's public information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="guild-name">Guild Name</Label>
                        <Input
                            id="guild-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter guild name"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="guild-category">Category</Label>
                        <select
                            id="guild-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Select a category...</option>
                            {GUILD_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="guild-description">Description</Label>
                        <Textarea
                            id="guild-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe your guild..."
                            className="min-h-[100px]"
                        />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="guild-pro-only"
                            checked={restrictToPro}
                            onCheckedChange={(checked) => setRestrictToPro(checked as boolean)}
                        />
                        <Label htmlFor="guild-pro-only" className="leading-snug">
                            Restrict to Pro members only
                            <p className="text-xs text-muted-foreground font-normal">Only users with an active Pro subscription can join.</p>
                        </Label>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveChanges} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h4 className="font-medium text-destructive">Terminate Active Quest</h4>
                            <p className="text-sm text-muted-foreground">
                                Stop the current guild quest and delete all progress. This cannot be undone.
                            </p>
                        </div>

                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="destructive" disabled={!hasActiveQuest || isTerminating}>
                                    Terminate Quest
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Terminate Active Quest?</DialogTitle>
                                    <DialogDescription>
                                        Are you sure you want to terminate the current quest?
                                        This will <strong>permanently delete all progress</strong> for all guild members.
                                        This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isTerminating}>
                                        Cancel
                                    </Button>
                                    <Button variant="destructive" onClick={handleTerminate} disabled={isTerminating}>
                                        {isTerminating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Terminating...
                                            </>
                                        ) : (
                                            'Terminate Quest'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
