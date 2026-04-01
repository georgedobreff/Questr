'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuildCard } from '@/components/guilds/guild-card';
import { CreateGuildDialog } from '@/components/guilds/create-guild-dialog';
import type { Guild } from '@/lib/types';

interface GuildsClientPageProps {
    guilds: Guild[];
    currentGuildId: string | null;
    isPro: boolean;
}

type SortOption = 'popularity' | 'newest' | 'oldest';

export function GuildsClientPage({ guilds, currentGuildId, isPro }: GuildsClientPageProps) {
    const [activeTab, setActiveTab] = useState<'by_questr' | 'by_members'>('by_questr');
    const [category, setCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState<SortOption>('popularity');

    const questrGuilds = useMemo(() => guilds.filter(g => g.by_questr), [guilds]);
    const memberGuilds = useMemo(() => guilds.filter(g => !g.by_questr), [guilds]);

    const categories = [
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
    ];

    const filteredGuilds = useMemo(() => {
        let list = activeTab === 'by_questr' ? questrGuilds : memberGuilds;

        if (category !== 'all') {
            list = list.filter(g => g.category === category);
        }

        if (sortBy === 'popularity') {
            list = [...list].sort((a, b) => b.member_count - a.member_count);
        } else if (sortBy === 'newest') {
            list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (sortBy === 'oldest') {
            list = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }

        return list;
    }, [activeTab, questrGuilds, memberGuilds, category, sortBy]);

    return (
        <div className="container mx-auto pt-24 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8 space-y-6 px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-uncial-antiqua)' }}>
                        Guild Hall
                    </h1>
                    <p className="text-muted-foreground">Find your tribe and conquer quests together.</p>
                </div>
                <div className="flex items-center gap-4">
                    {currentGuildId && (
                        <div className="hidden md:block text-sm text-muted-foreground mr-2">
                            You are in a guild
                        </div>
                    )}
                    {isPro && <CreateGuildDialog />}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'by_questr' | 'by_members')} className="w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <TabsList className="grid grid-cols-2 w-full sm:w-auto">
                        <TabsTrigger value="by_questr" className="px-6">
                            By Questr
                        </TabsTrigger>
                        <TabsTrigger value="by_members" className="px-6">
                            By Members
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-full sm:w-[150px]"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-full sm:w-[140px]"
                        >
                            <option value="popularity">Popularity</option>
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                        </select>
                    </div>
                </div>

                <TabsContent value="by_questr" className="mt-0">
                    {filteredGuilds.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            <h3 className="text-lg font-semibold mb-2">No Guilds Found</h3>
                            <p>No official guilds match your filters.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredGuilds.map((guild) => (
                                <div key={guild.id} className="h-full">
                                    <GuildCard guild={guild} currentGuildId={currentGuildId} isPro={isPro} />
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="by_members" className="mt-0">
                    {filteredGuilds.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            <h3 className="text-lg font-semibold mb-2">No Guilds Found</h3>
                            <p>{isPro ? 'Be the first to found a guild!' : 'No community guilds match your filters.'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredGuilds.map((guild) => (
                                <div key={guild.id} className="h-full">
                                    <GuildCard guild={guild} currentGuildId={currentGuildId} isPro={isPro} />
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
