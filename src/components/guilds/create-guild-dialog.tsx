'use client';

import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { createGuild } from '@/app/actions/guild-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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

export function CreateGuildDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [restrictToPro, setRestrictToPro] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!category) {
            toast.error('Please select a category');
            return;
        }
        startTransition(async () => {
            const result = await createGuild(name, description, true, category, restrictToPro);
            if (result.success) {
                toast.success('Guild created successfully!');
                setOpen(false);
                setName('');
                setDescription('');
                setCategory('');
                setRestrictToPro(false);
                router.push(`/guilds/${result.guildId}`);
            } else {
                toast.error(result.error || 'Failed to create guild');
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400 to-amber-600 border-amber-500 shadow-lg hover:brightness-110">
                    Create Guild
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Form a New Guild</DialogTitle>
                        <DialogDescription>
                            Create a gathering place for your allies.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Guild Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. The Night's Watch"
                                required
                                minLength={3}
                                maxLength={50}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="category">Category</Label>
                            <select
                                id="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                required
                            >
                                <option value="">Select a category...</option>
                                {GUILD_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your guild's purpose..."
                                required
                                maxLength={280}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="pro-only"
                                checked={restrictToPro}
                                onCheckedChange={(checked) => setRestrictToPro(checked as boolean)}
                            />
                            <Label htmlFor="pro-only" className="leading-snug">
                                Restrict to Pro members only
                                <p className="text-xs text-muted-foreground font-normal">Only users with an active Pro subscription can join.</p>
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isPending || !category}>
                            {isPending ? 'Forging...' : 'Create Guild'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
