'use client';

import { useState, useTransition } from 'react';
import { ScrollText, Pen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { updateGuildRules } from '@/app/actions/guild-actions';
import { toast } from 'sonner';

interface GuildRulesCardProps {
    guildId: string;
    rules: string[] | undefined;
    isMaster: boolean;
}

export function GuildRulesCard({ guildId, rules, isMaster }: GuildRulesCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editedRules, setEditedRules] = useState(rules?.join('\n') || '');
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        const rulesArray = editedRules.split('\n').filter(r => r.trim().length > 0);

        startTransition(async () => {
            const result = await updateGuildRules(guildId, rulesArray);
            if (result.success) {
                toast.success('Rules updated');
                setIsOpen(false);
            } else {
                toast.error(result.error || 'Failed to update rules');
            }
        });
    };

    const displayRules = rules && rules.length > 0 ? rules : [
        'Be respectful to fellow members',
        'No spamming or self-promotion',
        'Participate in guild quests'
    ];

    return (
        <div className="rounded-lg border bg-card p-4 space-y-3 relative group">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-muted-foreground" />
                    Guild Rules
                </h4>
                {isMaster && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setEditedRules(displayRules.join('\n'))}
                            >
                                <Pen className="w-3 h-3" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Edit Guild Rules</DialogTitle>
                                <DialogDescription>
                                    Enter each rule on a new line. Empty lines will be removed.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Textarea
                                    value={editedRules}
                                    onChange={(e) => setEditedRules(e.target.value)}
                                    rows={10}
                                    placeholder="Rule 1&#10;Rule 2&#10;Rule 3"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                                <Button onClick={handleSave} disabled={isPending}>
                                    {isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {displayRules.map((rule, i) => (
                    <li key={i}>{rule}</li>
                ))}
            </ul>
        </div>
    );
}
